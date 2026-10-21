// Loads the ResQRoad sample accounts and reports into MySQL, for demos and
// testing. Real deployments start with `npm run create-admin` instead.
//
//   npm run seed            create missing sample accounts; add the sample
//                           reports only if there are no reports yet
//   npm run seed -- --reset also delete every report, note, and photo
//                           (including uploaded files), then reload the
//                           sample reports (accounts are kept)

import { hashPassword } from "../server/auth.js";
import { explainDatabaseError, pool, query, setupDatabase, transaction } from "../server/db.js";
import { removePhotoFiles } from "../server/photos.js";
import { accounts, sampleReports, daysAgo } from "./seed-data.js";

const reset = process.argv.includes("--reset");

function toDate(value) {
  return new Date(value);
}

async function ensureAccount(account) {
  const rows = await query("SELECT id FROM users WHERE email = ?", [account.email]);
  if (rows[0]) {
    console.log("  exists   " + account.email);
    return rows[0].id;
  }
  const result = await query(
    "INSERT INTO users (name, email, password_hash, role, team, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      account.name,
      account.email,
      await hashPassword(account.password),
      account.role,
      account.team || null,
      account.active === false ? 0 : 1,
      toDate(account.createdAt),
    ],
  );
  console.log("  created  " + account.email);
  return result.insertId;
}

async function main() {
  await setupDatabase();

  console.log("Accounts");
  const ids = { citizens: {}, crews: {} };
  ids.admin = await ensureAccount({
    name: accounts.admin.name,
    email: accounts.admin.email,
    password: accounts.admin.password,
    role: "admin",
    createdAt: daysAgo(300),
  });
  for (const crew of accounts.crews) {
    ids.crews[crew.key] = await ensureAccount({
      name: crew.name,
      email: crew.email,
      password: accounts.crewPassword,
      role: "maintenance",
      team: crew.team,
      createdAt: daysAgo(290),
    });
  }
  for (const citizen of accounts.citizens) {
    ids.citizens[citizen.email] = await ensureAccount({
      name: citizen.name,
      email: citizen.email,
      password: accounts.citizenPassword,
      role: "citizen",
      active: citizen.active,
      createdAt: daysAgo(citizen.joinedDaysAgo),
    });
  }

  console.log("Reports");
  const [{ count }] = await query("SELECT COUNT(*) AS count FROM reports");
  if (count > 0 && !reset) {
    console.log("  skipped  " + count + " reports already exist (use --reset to reload samples)");
    return;
  }

  const samples = sampleReports();
  let highest = 1000;
  await transaction(async function (connection) {
    if (reset) {
      const [files] = await connection.query("SELECT file_path FROM photos WHERE file_path IS NOT NULL");
      await connection.query("DELETE FROM reports");
      await removePhotoFiles(files);
      console.log("  cleared  " + count + " reports and " + files.length + " uploaded photos");
    }
    for (const sample of samples) {
      const number = Number(sample.id.replace("RPT-", ""));
      highest = Math.max(highest, number);
      const crew = sample.crewKey ? accounts.crews.find((item) => item.key === sample.crewKey) : null;
      const crewId = crew ? ids.crews[crew.key] : null;
      const reporterId = ids.citizens[sample.reporterEmail] || null;
      const updatedAt = sample.history.length ? sample.history[sample.history.length - 1].at : sample.reportedAt;
      await connection.query(
        "INSERT INTO reports (id, title, road, location, latitude, longitude, severity, description, status, reporter_id, " +
          "assigned_to, assigned_name, repair_notes, repair_submitted_at, reported_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          number,
          sample.title,
          sample.road,
          sample.location,
          sample.coordinates.lat,
          sample.coordinates.lng,
          sample.severity,
          sample.description,
          sample.status,
          reporterId,
          crewId,
          crew ? crew.name : null,
          sample.repair ? sample.repair.notes : null,
          sample.repair ? toDate(sample.repair.submittedAt) : null,
          toDate(sample.reportedAt),
          toDate(updatedAt),
        ],
      );
      const actorIds = { "Admin User": ids.admin, Administrator: ids.admin };
      accounts.crews.forEach(function (item) {
        actorIds[item.name] = ids.crews[item.key];
      });
      for (const entry of sample.history) {
        await connection.query(
          "INSERT INTO report_history (report_id, status, description, actor, actor_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            number,
            entry.status,
            entry.description,
            entry.actor,
            actorIds[entry.actor] || (entry.status === "submitted" ? reporterId : null),
            entry.note || null,
            toDate(entry.at),
          ],
        );
      }
      // Sample photos are file names only; the website shows stock road photos.
      const photos = sample.evidencePhotos
        .map((name) => ["evidence", name])
        .concat(sample.repair ? sample.repair.beforePhotos.map((name) => ["before", name]) : [])
        .concat(sample.repair ? sample.repair.afterPhotos.map((name) => ["after", name]) : []);
      for (const [index, [kind, name]] of photos.entries()) {
        await connection.query("INSERT INTO photos (report_id, kind, name, sort_order, created_at) VALUES (?, ?, ?, ?, ?)", [
          number,
          kind,
          name,
          index,
          toDate(sample.reportedAt),
        ]);
      }
    }
  });
  // New reports continue after the highest sample number (RPT-1054, ...).
  await query("ALTER TABLE reports AUTO_INCREMENT = " + (highest + 1));
  console.log("  saved    " + samples.length + " sample reports");
}

main()
  .catch(function (error) {
    console.error("\nSeeding failed: " + explainDatabaseError(error));
    process.exitCode = 1;
  })
  .finally(function () {
    return pool.end();
  });
