// Copies the data from the old Firebase project (Cloud Firestore) into MySQL:
// reports with their full history, internal notes, photos (saved as image
// files in storage/photos/), and accounts.
//
//   npm run import:firebase
//       Asks for the Firebase administrator's email and password, then copies
//       everything, accounts included.
//   npm run import:firebase -- --public-only
//       No sign-in: copies reports, history, and photos, but not accounts or
//       internal notes (reports then have no linked reporter or crew account;
//       the crew's name is kept).
//   Add --replace to delete the reports already in MySQL first.
//
// Firebase never reveals passwords, so imported accounts get a new temporary
// password (printed once at the end) — except the administrator who signs in
// here, who keeps the password typed in. Accounts whose email already exists
// in MySQL are linked and keep their current password.

import crypto from "node:crypto";
import { hashPassword } from "../server/auth.js";
import { explainDatabaseError, pool, query, setupDatabase, transaction } from "../server/db.js";
import { checkPhotos, removePhotoFiles, savePhotos } from "../server/photos.js";
import { firebaseConfig } from "../firebase/firebase-config.js";
import { ask, askHidden } from "./prompt.js";

const publicOnly = process.argv.includes("--public-only");
const replace = process.argv.includes("--replace");
const documentsUrl =
  "https://firestore.googleapis.com/v1/projects/" + firebaseConfig.projectId + "/databases/(default)/documents/";

/* ---------- Reading Firestore over its REST API ---------- */

function decode(value) {
  if (!value) {
    return null;
  }
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("mapValue" in value) return decodeFields(value.mapValue.fields);
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decode);
  return null;
}

function decodeFields(fields) {
  const result = {};
  Object.entries(fields || {}).forEach(function ([key, value]) {
    result[key] = decode(value);
  });
  return result;
}

async function readCollection(name, idToken) {
  const documents = [];
  let pageToken = "";
  do {
    const url =
      documentsUrl + name + "?pageSize=300&key=" + firebaseConfig.apiKey + (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : "");
    const response = await fetch(url, { headers: idToken ? { Authorization: "Bearer " + idToken } : {} });
    const body = await response.json();
    if (!response.ok) {
      throw new Error("Couldn't read " + name + " from Firebase: " + ((body.error && body.error.message) || response.status));
    }
    (body.documents || []).forEach(function (item) {
      documents.push(Object.assign({ id: item.name.split("/").pop() }, decodeFields(item.fields)));
    });
    pageToken = body.nextPageToken || "";
  } while (pageToken);
  return documents;
}

async function firebaseSignIn(email, password) {
  const response = await fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + firebaseConfig.apiKey,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password, returnSecureToken: true }),
    },
  );
  const body = await response.json();
  if (!response.ok) {
    throw new Error("Firebase sign-in failed: " + ((body.error && body.error.message) || response.status));
  }
  return { idToken: body.idToken, uid: body.localId };
}

/* ---------- Writing to MySQL ---------- */

function toDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : new Date();
}

function temporaryPassword() {
  return "Rq" + crypto.randomInt(1000, 9999) + crypto.randomBytes(3).toString("hex");
}

// Creates (or links) MySQL accounts for the Firebase users; returns a map
// from Firebase user ID to MySQL user ID.
async function importUsers(users, admin) {
  const ids = new Map();
  const created = [];
  for (const user of users) {
    const email = String(user.email || "").trim().toLowerCase();
    if (!email) {
      continue;
    }
    const existing = await query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing[0]) {
      ids.set(user.id, existing[0].id);
      console.log("  linked   " + email + " (keeps its MySQL password)");
      continue;
    }
    const isAdmin = admin && user.id === admin.uid;
    const password = isAdmin ? admin.password : temporaryPassword();
    const result = await query(
      "INSERT INTO users (name, email, password_hash, role, team, active, created_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        String(user.name || email).slice(0, 80),
        email,
        await hashPassword(password),
        ["admin", "maintenance", "citizen"].includes(user.role) ? user.role : "citizen",
        user.team || null,
        user.active === false || user.deleted ? 0 : 1,
        toDate(user.createdAt),
        user.deleted ? toDate(user.deletedAt) : null,
      ],
    );
    ids.set(user.id, result.insertId);
    console.log("  created  " + email);
    if (!isAdmin && !user.deleted) {
      created.push([email, user.role, password]);
    }
  }
  return { ids: ids, created: created };
}

// Turns Firestore photo references into photo rows; uploaded photos (data
// URLs in the `photos` collection) are saved as files.
async function photoRows(list, kind, photosById, saved) {
  const rows = [];
  for (const item of list || []) {
    const stored = item && typeof item === "object" ? photosById.get(item.photoId) : null;
    const name = String((item && typeof item === "object" ? item.name : item) || "photo.jpg").slice(0, 160);
    const match = stored && /^data:image\/[a-z]+;base64,(.+)$/.exec(stored.src || "");
    if (match) {
      const buffer = Buffer.from(match[1], "base64");
      const [checked] = checkPhotos([{ buffer: buffer, originalname: name, size: buffer.length }]);
      const [file] = await savePhotos([checked], kind);
      saved.push(file);
      rows.push({ kind: kind, name: checked.name, filePath: file.filePath, mime: checked.mime, size: checked.size });
    } else {
      rows.push({ kind: kind, name: name, filePath: null, mime: null, size: null });
    }
  }
  return rows;
}

async function main() {
  await setupDatabase();
  const [{ count }] = await query("SELECT COUNT(*) AS count FROM reports");
  if (count > 0 && !replace) {
    throw new Error("MySQL already has " + count + " reports. Run again with --replace to delete them and import from Firebase.");
  }

  let admin = null;
  if (!publicOnly) {
    console.log("Sign in with the Firebase administrator account (needed to copy accounts and notes).");
    const email = (await ask("Firebase admin email: ")).toLowerCase();
    const password = await askHidden("Password: ");
    const session = await firebaseSignIn(email, password);
    admin = { uid: session.uid, idToken: session.idToken, password: password };
  }

  console.log("Reading Firebase project " + firebaseConfig.projectId);
  const token = admin ? admin.idToken : null;
  const [reports, photos, users, notes] = await Promise.all([
    readCollection("reports", token),
    readCollection("photos", token),
    admin ? readCollection("users", token) : [],
    admin ? readCollection("notes", token) : [],
  ]);
  console.log("  " + reports.length + " reports, " + photos.length + " uploaded photos, " + users.length + " accounts, " + notes.length + " notes");

  console.log("Accounts");
  const accounts = admin ? await importUsers(users, admin) : { ids: new Map(), created: [] };
  if (!admin) {
    console.log("  skipped  (--public-only)");
  }

  console.log("Reports");
  const photosById = new Map(photos.map((photo) => [photo.id, photo]));
  const saved = [];
  let highest = 1000;
  try {
    await transaction(async function (connection) {
      if (replace) {
        const [files] = await connection.query("SELECT file_path FROM photos WHERE file_path IS NOT NULL");
        await connection.query("DELETE FROM reports");
        await removePhotoFiles(files);
      }
      for (const report of reports) {
        const number = Number(String(report.id).replace(/^RPT-/i, ""));
        if (!Number.isInteger(number) || number < 1) {
          console.log("  skipped  " + report.id + " (not an RPT-number ID)");
          continue;
        }
        highest = Math.max(highest, number);
        const history = report.history || [];
        const repair = report.repair || null;
        const coordinates = report.coordinates || {};
        await connection.query(
          "INSERT INTO reports (id, title, road, location, latitude, longitude, severity, description, status, reporter_id, " +
            "assigned_to, assigned_name, repair_notes, repair_submitted_at, reported_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            number,
            String(report.title || "Road damage").slice(0, 120),
            String(report.road || "").slice(0, 120),
            String(report.location || "").slice(0, 160),
            Number(coordinates.lat) || 0,
            Number(coordinates.lng) || 0,
            ["Low", "Medium", "High"].includes(report.severity) ? report.severity : "Medium",
            String(report.description || ""),
            report.status,
            accounts.ids.get(report.reporterId) || null,
            accounts.ids.get(report.assignedTo) || null,
            report.assignedName || null,
            repair ? repair.notes || "" : null,
            repair ? toDate(repair.submittedAt) : null,
            toDate(report.reportedAt),
            toDate(report.updatedAt || (history.length ? history[history.length - 1].at : report.reportedAt)),
          ],
        );
        for (const entry of history) {
          await connection.query(
            "INSERT INTO report_history (report_id, status, description, actor, note, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            [number, entry.status, String(entry.description || "").slice(0, 255), String(entry.actor || "ResQRoad").slice(0, 80), entry.note || null, toDate(entry.at)],
          );
        }
        for (const note of notes.filter((item) => item.reportId === report.id)) {
          await connection.query("INSERT INTO report_notes (report_id, note, actor, created_at) VALUES (?, ?, ?, ?)", [
            number,
            String(note.note || ""),
            String(note.actor || "Administrator").slice(0, 80),
            toDate(note.at),
          ]);
        }
        const rows = (await photoRows(report.evidencePhotos, "evidence", photosById, saved))
          .concat(repair ? await photoRows(repair.beforePhotos, "before", photosById, saved) : [])
          .concat(repair ? await photoRows(repair.afterPhotos, "after", photosById, saved) : []);
        for (const [index, row] of rows.entries()) {
          await connection.query(
            "INSERT INTO photos (report_id, kind, name, file_path, mime_type, size_bytes, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [number, row.kind, row.name, row.filePath, row.mime, row.size, index, toDate(report.reportedAt)],
          );
        }
      }
    });
  } catch (error) {
    await removePhotoFiles(saved);
    throw error;
  }
  await query("ALTER TABLE reports AUTO_INCREMENT = " + (highest + 1));
  console.log("  saved    " + reports.length + " reports and " + saved.length + " photo files");

  if (accounts.created.length) {
    console.log("\nTemporary passwords for the imported accounts (shown only once; share each one privately):");
    accounts.created.forEach(function ([email, role, password]) {
      console.log("  " + email.padEnd(36) + " " + String(role).padEnd(12) + " " + password);
    });
  }
}

main()
  .catch(function (error) {
    console.error("\nImport failed: " + explainDatabaseError(error));
    process.exitCode = 1;
  })
  .finally(function () {
    return pool.end();
  });
