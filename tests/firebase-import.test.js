// Tests moving accounts and reports from Firebase to MySQL
// (`npm run import:firebase`) against a fake Firebase on this computer:
// people keep their Firebase email and password, and after their first
// sign-in the password lives in MySQL.
//
// Uses the MySQL server in .env with its own database, `resqroad_import_test`
// (created and dropped by the test). Nothing is sent to the real Firebase.

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), "resqroad-import-test-"));
process.env.DB_NAME = process.env.TEST_IMPORT_DB_NAME || "resqroad_import_test";
process.env.STORAGE_DIR = storageDir;

/* ---------- A fake Firebase: sign-in and Firestore ---------- */

const firebaseAccounts = {
  "admin@fb.test": { uid: "uidAdmin", password: "AdminPass1" },
  "crew@fb.test": { uid: "uidCrew", password: "CrewPass1" },
  "rita@fb.test": { uid: "uidRita", password: "RitaPass1" },
  "pedro@fb.test": { uid: "uidPedro", password: "PedroPass1" },
  "gone@fb.test": { uid: "uidGone", password: "GonePass1" },
};
const adminToken = "fake-admin-id-token";
const firebase = { signIns: [], down: false };

function encode(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: encodeFields(value) } };
}

function encodeFields(object) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, encode(value)]));
}

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(120, 3)]);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(120, 4)]);
const at = (days) => new Date(Date.now() - days * 86400000).toISOString();

const collections = {
  users: {
    uidAdmin: { name: "Ana Admin", email: "admin@fb.test", role: "admin", active: true, createdAt: at(300) },
    uidCrew: { name: "Carlo Crew", email: "crew@fb.test", role: "maintenance", team: "North road crew", active: true, createdAt: at(200) },
    uidRita: { name: "Rita Resident", email: "rita@fb.test", role: "citizen", active: true, createdAt: at(100) },
    uidPedro: { name: "Pedro Off", email: "pedro@fb.test", role: "citizen", active: false, createdAt: at(90) },
    uidGone: { name: "Gina Gone", email: "gone@fb.test", role: "maintenance", team: "Old crew", active: false, deleted: true, createdAt: at(250), deletedAt: at(10) },
  },
  reports: {
    "RPT-1070": {
      id: "RPT-1070", title: "Pothole by the plaza", road: "Mabini Street", location: "Santiago, Malolos City",
      coordinates: { lat: 14.8506, lng: 120.8171 }, severity: "High", description: "Deep pothole in the outer lane.",
      reporterId: "uidRita", reportedAt: at(5), status: "repair_submitted", assignedTo: "uidCrew", assignedName: "Carlo Crew",
      evidencePhotos: [{ name: "pothole.jpg", photoId: "photo1" }, "old-name-only.jpg"],
      repair: { notes: "Patched it.", beforePhotos: [{ name: "before.png", photoId: "photo2" }], afterPhotos: ["after.jpg"], submittedAt: at(1) },
      history: [
        { status: "submitted", description: "Report received from a citizen.", actor: "Rita Resident", at: at(5) },
        { status: "verified", description: "Administrator confirmed the report.", actor: "Ana Admin", at: at(4) },
        { status: "assigned", description: "Assigned to Carlo Crew.", actor: "Administrator", at: at(3) },
        { status: "in_progress", description: "Repair work started.", actor: "Carlo Crew", at: at(2) },
        { status: "repair_submitted", description: "Repair submitted for admin verification.", actor: "Carlo Crew", at: at(1) },
      ],
      updatedAt: at(1),
    },
    "RPT-1071": {
      id: "RPT-1071", title: "Cracked road", road: "Tikay Road", location: "Tikay, Malolos City",
      coordinates: { lat: 14.8728, lng: 120.8141 }, severity: "Low", description: "Cracks spreading on the shoulder.",
      reporterId: "uidPedro", reportedAt: at(2), status: "submitted", assignedTo: null, assignedName: null,
      evidencePhotos: [], repair: null,
      history: [{ status: "submitted", description: "Report received from a citizen.", actor: "Pedro Off", at: at(2) }],
      updatedAt: at(2),
    },
  },
  photos: {
    photo1: { reportId: "RPT-1070", kind: "evidence", name: "pothole.jpg", src: "data:image/jpeg;base64," + jpeg.toString("base64") },
    photo2: { reportId: "RPT-1070", kind: "before", name: "before.png", src: "data:image/png;base64," + png.toString("base64") },
  },
  notes: {
    note1: { reportId: "RPT-1070", note: "Check the drainage too.", actor: "Ana Admin", at: at(3) },
  },
};
const adminOnly = new Set(["users", "notes"]);

const fakeFirebase = http.createServer(function (request, response) {
  const url = new URL(request.url, "http://localhost");
  const reply = (status, body) => {
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(body));
  };
  if (request.method === "POST" && url.pathname === "/auth") {
    let raw = "";
    request.on("data", (chunk) => (raw += chunk));
    request.on("end", () => {
      const { email, password } = JSON.parse(raw);
      firebase.signIns.push(email);
      if (firebase.down) {
        reply(503, { error: { message: "UNAVAILABLE" } });
        return;
      }
      const account = firebaseAccounts[email];
      if (account && account.password === password) {
        reply(200, { localId: account.uid, idToken: email === "admin@fb.test" ? adminToken : "fake-user-token" });
      } else {
        reply(400, { error: { message: "INVALID_LOGIN_CREDENTIALS" } });
      }
    });
    return;
  }
  const match = /^\/documents\/(\w+)$/.exec(url.pathname);
  if (request.method === "GET" && match && collections[match[1]]) {
    if (adminOnly.has(match[1]) && request.headers.authorization !== "Bearer " + adminToken) {
      reply(403, { error: { message: "Missing or insufficient permissions." } });
      return;
    }
    reply(200, {
      documents: Object.entries(collections[match[1]]).map(([id, fields]) => ({
        name: "projects/test/databases/(default)/documents/" + match[1] + "/" + id,
        fields: encodeFields(fields),
      })),
    });
    return;
  }
  reply(404, { error: { message: "Not found" } });
});

await new Promise((resolve) => fakeFirebase.listen(0, "127.0.0.1", resolve));
const fakeUrl = "http://127.0.0.1:" + fakeFirebase.address().port;
process.env.FIREBASE_AUTH_URL = fakeUrl + "/auth";

const { config } = await import("../server/config.js");
const db = await import("../server/db.js");
const { startServer } = await import("../server/index.js");
const { photosDir } = await import("../server/photos.js");

if (!/_test$/.test(config.db.database)) {
  throw new Error("The tests only run against a database whose name ends in _test.");
}

function runImport(extraEnv, args) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [path.join(rootDir, "tools", "import-firebase.js")].concat(args || []),
      {
        cwd: rootDir,
        env: Object.assign({}, process.env, { FIRESTORE_URL: fakeUrl + "/documents", FIREBASE_AUTH_URL: fakeUrl + "/auth" }, extraEnv),
      },
      (error, stdout, stderr) => resolve({ code: error ? error.code : 0, output: stdout + stderr }),
    );
  });
}

let server;
let base;

async function signIn(email, password) {
  const response = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-ResQRoad-Client": "mobile" },
    body: JSON.stringify({ email: email, password: password }),
  });
  return { status: response.status, body: await response.json() };
}

function storedHash(email) {
  return db.one("SELECT password_hash FROM users WHERE email = ?", [email]).then((row) => row.password_hash);
}

before(async function () {
  await db.setupDatabase();
  for (const table of ["sessions", "photos", "report_notes", "report_history", "reports", "users"]) {
    await db.query("DELETE FROM " + table);
  }
  server = await startServer({ port: 0, host: "127.0.0.1", quiet: true });
  base = "http://127.0.0.1:" + server.port;
});

after(async function () {
  if (server) {
    await server.close();
  }
  fakeFirebase.close();
  if (!process.env.KEEP_TEST_DB) {
    await db.query("DROP DATABASE IF EXISTS `" + config.db.database + "`");
  }
  await db.pool.end();
  fs.rmSync(storageDir, { recursive: true, force: true });
});

test("the import refuses a wrong Firebase admin password", async function () {
  const result = await runImport({ FIREBASE_ADMIN_EMAIL: "admin@fb.test", FIREBASE_ADMIN_PASSWORD: "wrong" });
  assert.notEqual(result.code, 0);
  assert.match(result.output, /Firebase sign-in failed/);
  const [{ count }] = await db.query("SELECT COUNT(*) AS count FROM users");
  assert.equal(count, 0);
});

test("the import copies accounts, reports, history, notes, and photos", async function () {
  const result = await runImport({ FIREBASE_ADMIN_EMAIL: "admin@fb.test", FIREBASE_ADMIN_PASSWORD: "AdminPass1" });
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /Everyone signs in with their usual Firebase email and password/);
  assert.doesNotMatch(result.output, /Temporary password/i);

  const users = await db.query("SELECT email, name, role, team, active, deleted_at FROM users ORDER BY email");
  assert.deepEqual(
    users.map((user) => [user.email, user.role, user.team, user.active, Boolean(user.deleted_at)]),
    [
      ["admin@fb.test", "admin", null, 1, false],
      ["crew@fb.test", "maintenance", "North road crew", 1, false],
      ["gone@fb.test", "maintenance", "Old crew", 0, true],
      ["pedro@fb.test", "citizen", null, 0, false],
      ["rita@fb.test", "citizen", null, 1, false],
    ],
  );
  // The admin's typed password is stored now; everyone else's waits for
  // their first sign-in.
  assert.match(await storedHash("admin@fb.test"), /^\$2[aby]\$/);
  assert.equal(await storedHash("rita@fb.test"), "firebase:uidRita");

  const report = await db.one(
    "SELECT r.*, reporter.email AS reporter_email, crew.email AS crew_email FROM reports r " +
      "LEFT JOIN users reporter ON reporter.id = r.reporter_id LEFT JOIN users crew ON crew.id = r.assigned_to WHERE r.id = 1070",
  );
  assert.equal(report.status, "repair_submitted");
  assert.equal(report.reporter_email, "rita@fb.test", "reports stay linked to their reporter");
  assert.equal(report.crew_email, "crew@fb.test", "and to their crew");
  const [{ history }] = await db.query("SELECT COUNT(*) AS history FROM report_history WHERE report_id = 1070");
  assert.equal(history, 5);
  const [{ notes }] = await db.query("SELECT COUNT(*) AS notes FROM report_notes WHERE report_id = 1070");
  assert.equal(notes, 1);

  // Photos stored in Firestore become image files on the server.
  const photos = await db.query("SELECT kind, name, file_path, mime_type FROM photos WHERE report_id = 1070 ORDER BY sort_order");
  assert.deepEqual(
    photos.map((photo) => [photo.kind, photo.name, photo.mime_type]),
    [
      ["evidence", "pothole.jpg", "image/jpeg"],
      ["evidence", "old-name-only.jpg", null],
      ["before", "before.png", "image/png"],
      ["after", "after.jpg", null],
    ],
  );
  const saved = photos.filter((photo) => photo.file_path);
  assert.equal(saved.length, 2);
  assert.deepEqual(fs.readFileSync(path.join(photosDir, saved[0].file_path)), jpeg);
  assert.deepEqual(fs.readFileSync(path.join(photosDir, saved[1].file_path)), png);
});

test("people sign in with their existing Firebase email and password", async function () {
  firebase.signIns = [];
  const rita = await signIn("rita@fb.test", "RitaPass1");
  assert.equal(rita.status, 200, JSON.stringify(rita.body));
  assert.equal(rita.body.user.role, "citizen");
  assert.deepEqual(firebase.signIns, ["rita@fb.test"], "checked with Firebase once");
  assert.match(await storedHash("rita@fb.test"), /^\$2[aby]\$10\$/, "then stored in MySQL as a bcrypt hash");

  const crew = await signIn("crew@fb.test", "CrewPass1");
  assert.equal(crew.status, 200);
  assert.equal(crew.body.user.team, "North road crew");

  const admin = await signIn("admin@fb.test", "AdminPass1");
  assert.equal(admin.status, 200);
  assert.equal(admin.body.user.role, "admin");
});

test("after the first sign-in, Firebase isn't needed any more", async function () {
  firebase.down = true;
  firebase.signIns = [];
  const again = await signIn("rita@fb.test", "RitaPass1");
  assert.equal(again.status, 200);
  assert.deepEqual(firebase.signIns, [], "Firebase wasn't asked");
  firebase.down = false;
});

test("a wrong password is refused and nothing changes", async function () {
  const wrong = await signIn("pedro@fb.test", "NotPedro1");
  assert.equal(wrong.status, 401);
  assert.equal(await storedHash("pedro@fb.test"), "firebase:uidPedro");
});

test("deactivated and deleted Firebase accounts still can't sign in", async function () {
  const pedro = await signIn("pedro@fb.test", "PedroPass1");
  assert.equal(pedro.status, 403);
  assert.match(pedro.body.error, /deactivated/);
  const gone = await signIn("gone@fb.test", "GonePass1");
  assert.equal(gone.status, 403);
  assert.match(gone.body.error, /no longer active/);
});

test("if Firebase can't be reached, the person is told to try again", async function () {
  await db.query("UPDATE users SET password_hash = 'firebase:uidCrew' WHERE email = 'crew@fb.test'");
  firebase.down = true;
  const result = await signIn("crew@fb.test", "CrewPass1");
  firebase.down = false;
  assert.equal(result.status, 503);
  assert.match(result.body.error, /couldn't be checked/);
  assert.equal(await storedHash("crew@fb.test"), "firebase:uidCrew");
});

test("a Firebase password also works for changing the password", async function () {
  const login = await signIn("crew@fb.test", "CrewPass1");
  assert.equal(login.status, 200);
  await db.query("UPDATE users SET password_hash = 'firebase:uidCrew' WHERE email = 'crew@fb.test'");
  const response = await fetch(base + "/api/auth/password", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + login.body.token },
    body: JSON.stringify({ currentPassword: "CrewPass1", newPassword: "NewCrew22" }),
  });
  assert.equal(response.status, 200);
  assert.equal((await signIn("crew@fb.test", "NewCrew22")).status, 200);
});

test("importing again links existing emails to their Firebase password", async function () {
  await db.query("UPDATE users SET password_hash = 'local-hash-placeholder' WHERE email = 'rita@fb.test'");
  const result = await runImport({ FIREBASE_ADMIN_EMAIL: "admin@fb.test", FIREBASE_ADMIN_PASSWORD: "AdminPass1" }, ["--replace"]);
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /linked {3}rita@fb\.test \(now signs in with the Firebase password\)/);
  const [{ count }] = await db.query("SELECT COUNT(*) AS count FROM users");
  assert.equal(count, 5, "no duplicate accounts");
  assert.equal(await storedHash("rita@fb.test"), "firebase:uidRita");
  assert.equal((await signIn("rita@fb.test", "RitaPass1")).status, 200);
});
