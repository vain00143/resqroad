// Photos kept in MySQL (PHOTO_STORAGE=database), the setting for hosts with no
// permanent disk: uploads land in photo_data instead of storage/, are served
// from the same /uploads/ addresses, and are removed with their report.
//
//   npm test
//
// Uses its own database, `resqroad_photo_test`, created and dropped here.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

process.env.DB_NAME = "resqroad_photo_test";
process.env.PHOTO_STORAGE = "database";
const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), "resqroad-photo-test-"));
process.env.STORAGE_DIR = storageDir;

const { config } = await import("../server/config.js");
const db = await import("../server/db.js");
const { hashPassword } = await import("../server/auth.js");
const { startServer } = await import("../server/index.js");
const { photosDir } = await import("../server/photos.js");

if (!/_test$/.test(config.db.database)) {
  throw new Error("The tests only run against a database whose name ends in _test.");
}

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(300, 7)]);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(300, 9)]);
const password = "Test1234";
const tokens = {};
const ids = {};
let server;
let base;

async function call(who, method, url, body) {
  const init = { method: method, headers: { Authorization: "Bearer " + tokens[who] } };
  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const response = await fetch(base + url, init);
  return { status: response.status, body: await response.json() };
}

function form(fields, files) {
  const data = new FormData();
  Object.entries(fields).forEach(([key, value]) => data.append(key, String(value)));
  files.forEach(([field, buffer, name, type]) => data.append(field, new Blob([buffer], { type: type }), name));
  return data;
}

function filesOnDisk() {
  if (!fs.existsSync(photosDir)) {
    return [];
  }
  return fs.readdirSync(photosDir, { recursive: true }).filter((name) => fs.statSync(path.join(photosDir, name)).isFile());
}

before(async function () {
  await db.setupDatabase();
  for (const table of ["sessions", "photos", "report_notes", "report_history", "reports", "users"]) {
    await db.query("DELETE FROM " + table);
  }
  const hash = await hashPassword(password);
  for (const [key, name, email, role, team] of [
    ["admin", "Ana Admin", "admin@test.ph", "admin", null],
    ["crew", "Carlo Crew", "crew@test.ph", "maintenance", "North road crew"],
    ["resident", "Rita Resident", "rita@test.ph", "citizen", null],
  ]) {
    const result = await db.query("INSERT INTO users (name, email, password_hash, role, team) VALUES (?, ?, ?, ?, ?)", [
      name,
      email,
      hash,
      role,
      team,
    ]);
    ids[key] = String(result.insertId);
  }
  server = await startServer({ port: 0, host: "127.0.0.1", quiet: true });
  base = "http://127.0.0.1:" + server.port;
  for (const [key, email] of [
    ["admin", "admin@test.ph"],
    ["crew", "crew@test.ph"],
    ["resident", "rita@test.ph"],
  ]) {
    const response = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-ResQRoad-Client": "mobile" },
      body: JSON.stringify({ email: email, password: password }),
    });
    tokens[key] = (await response.json()).token;
  }
});

after(async function () {
  if (server) {
    await server.close();
  }
  await db.query("DROP DATABASE IF EXISTS `" + config.db.database + "`");
  await db.pool.end();
  fs.rmSync(storageDir, { recursive: true, force: true });
});

let reportId;

test("evidence photos are saved in MySQL and served from /uploads/", async function () {
  const created = await call(
    "resident",
    "POST",
    "/api/reports",
    form(
      {
        title: "Pothole by the plaza",
        road: "Rizal Street",
        location: "Poblacion, Plaridel",
        description: "A wide pothole in the right lane.",
        severity: "High",
        latitude: 14.8874,
        longitude: 120.8571,
      },
      [
        ["photos", jpeg, "pothole.jpg", "image/jpeg"],
        ["photos", png, "close-up.png", "image/png"],
      ],
    ),
  );
  assert.equal(created.status, 201, JSON.stringify(created.body));
  reportId = created.body.report.id;
  const photos = created.body.report.evidencePhotos;
  assert.equal(photos.length, 2);
  assert.deepEqual(filesOnDisk(), [], "nothing is written to disk");

  const expected = [jpeg, png];
  for (const [index, photo] of photos.entries()) {
    assert.match(photo.src, /^\/uploads\/\d{4}\/\d{2}\/evidence-[0-9a-f]+\.(jpg|png)$/);
    const download = await fetch(base + photo.src);
    assert.equal(download.status, 200);
    assert.match(download.headers.get("content-type"), index === 0 ? /^image\/jpeg/ : /^image\/png/);
    assert.match(download.headers.get("cache-control"), /immutable/);
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), expected[index], "the same bytes come back");
    const head = await fetch(base + photo.src, { method: "HEAD" });
    assert.equal(head.status, 200);
  }
  const [stored] = await db.query("SELECT COUNT(*) AS n FROM photo_data");
  assert.equal(stored.n, 2);
});

test("unknown photo addresses and path tricks are not served", async function () {
  assert.equal((await fetch(base + "/uploads/2026/10/evidence-0000000000000000.jpg")).status, 404);
  // Tricks are refused (403 or 400 from the file fallback) and leak nothing.
  for (const trick of ["/uploads/..%2F..%2F.env", "/uploads/..%2F..%2Fpackage.json", "/uploads/%E0%A4%A"]) {
    const response = await fetch(base + trick);
    assert.ok([400, 403, 404].includes(response.status), trick + " answered " + response.status);
    const text = await response.text();
    assert.doesNotMatch(text, /DB_PASSWORD|"dependencies"/, trick + " leaked a file");
  }
});

test("repair photos are saved in MySQL too", async function () {
  assert.equal((await call("admin", "POST", "/api/reports/" + reportId + "/status", { status: "verified" })).status, 200);
  assert.equal((await call("admin", "POST", "/api/reports/" + reportId + "/assign", { crewId: ids.crew })).status, 200);
  assert.equal((await call("crew", "POST", "/api/reports/" + reportId + "/start")).status, 200);
  const repaired = await call(
    "crew",
    "POST",
    "/api/reports/" + reportId + "/repair",
    form({ notes: "Patched and compacted." }, [
      ["before", jpeg, "before.jpg", "image/jpeg"],
      ["after", png, "after.png", "image/png"],
    ]),
  );
  assert.equal(repaired.status, 200, JSON.stringify(repaired.body));
  const { beforePhotos, afterPhotos } = repaired.body.report.repair;
  const before = await fetch(base + beforePhotos[0].src);
  assert.deepEqual(Buffer.from(await before.arrayBuffer()), jpeg);
  const afterImage = await fetch(base + afterPhotos[0].src);
  assert.deepEqual(Buffer.from(await afterImage.arrayBuffer()), png);
  assert.deepEqual(filesOnDisk(), [], "still nothing on disk");
});

test("the database health check answers", async function () {
  const response = await fetch(base + "/api/health/db");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, database: true });
});

test("photo bytes are removed with their report", async function () {
  await db.query("DELETE FROM reports");
  const [left] = await db.query("SELECT COUNT(*) AS n FROM photo_data");
  assert.equal(left.n, 0);
});
