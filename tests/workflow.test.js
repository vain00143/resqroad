// End-to-end test of the ResQRoad workflow against a real MySQL server:
// report → verify → assign → repair → resolve, plus sign-in, permissions,
// photo storage, and live updates between separate devices.
//
//   npm test
//
// Uses the MySQL server in .env but its own database, `resqroad_test` (set
// TEST_DB_NAME to change it), which is created and dropped by the test.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import WebSocket from "ws";

process.env.DB_NAME = process.env.TEST_DB_NAME || "resqroad_test";
const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), "resqroad-test-"));
process.env.STORAGE_DIR = storageDir;

const { config } = await import("../server/config.js");
const db = await import("../server/db.js");
const { hashPassword } = await import("../server/auth.js");
const { startServer } = await import("../server/index.js");
const { photosDir } = await import("../server/photos.js");

// Never run against a real database.
if (!/_test$/.test(config.db.database)) {
  throw new Error("The tests only run against a database whose name ends in _test.");
}

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 2)]);
const password = "Test1234";
const spot = { latitude: 14.8601, longitude: 120.8105 };

let server;
let base;
const ids = {};
const sockets = [];

/* ---------- A "device": its own cookie, requests, and live connection ---------- */

class Device {
  constructor(name) {
    this.name = name;
    this.cookie = "";
    this.token = "";
    this.messages = [];
    this.cursor = 0;
  }

  headers(extra) {
    const headers = Object.assign({}, extra);
    if (this.cookie) {
      headers.Cookie = this.cookie;
    }
    if (this.token) {
      headers.Authorization = "Bearer " + this.token;
    }
    return headers;
  }

  async request(method, url, body, extraHeaders) {
    const init = { method: method, headers: this.headers(extraHeaders) };
    if (body instanceof FormData) {
      init.body = body;
    } else if (body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    const response = await fetch(base + url, init);
    const setCookie = response.headers.get("set-cookie");
    if (setCookie && setCookie.startsWith("resqroad_session=")) {
      const value = setCookie.split(";")[0];
      this.cookie = value === "resqroad_session=" ? "" : value;
    }
    const type = response.headers.get("content-type") || "";
    const data = type.includes("json") ? await response.json() : await response.text();
    return { status: response.status, body: data, headers: response.headers };
  }

  async signIn(email, extraHeaders) {
    const result = await this.request("POST", "/api/auth/login", { email: email, password: password }, extraHeaders);
    assert.equal(result.status, 200, this.name + " sign-in: " + JSON.stringify(result.body));
    return result;
  }

  // Opens the live connection and waits for the server's greeting.
  connect() {
    const socket = new WebSocket(base.replace("http", "ws") + "/api/live", {
      headers: Object.assign({ Origin: base }, this.headers()),
    });
    sockets.push(socket);
    this.socket = socket;
    socket.on("message", (data) => {
      this.messages.push(JSON.parse(String(data)));
    });
    return this.waitFor((message) => message.type === "hello");
  }

  // Resolves with the next live message that matches, including ones that
  // arrived before the call; messages before it are skipped from then on.
  waitFor(match, timeout) {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + (timeout || 4000);
      const check = () => {
        const index = this.messages.findIndex((message, position) => position >= this.cursor && match(message));
        if (index > -1) {
          this.cursor = index + 1;
          resolve(this.messages[index]);
        } else if (Date.now() > deadline) {
          reject(new Error(this.name + " never received the expected live update."));
        } else {
          setTimeout(check, 20);
        }
      };
      check();
    });
  }

  reportUpdate(reportId, status) {
    return this.waitFor((message) => message.type === "report" && message.report.id === reportId && message.report.status === status);
  }
}

function photoForm(fields, files) {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, String(value)));
  files.forEach(([field, buffer, name, type]) => form.append(field, new Blob([buffer], { type: type }), name));
  return form;
}

function reportForm(extra, files) {
  return photoForm(
    Object.assign(
      {
        title: "Deep pothole by the school gate",
        road: "Mabini Street",
        location: "Santiago, Malolos City",
        description: "A deep pothole right where tricycles stop for students.",
        severity: "High",
        latitude: spot.latitude,
        longitude: spot.longitude,
      },
      extra,
    ),
    files || [],
  );
}

const admin = new Device("admin");
const crew = new Device("crew");
const otherCrew = new Device("other crew");
const resident = new Device("resident");
const neighbour = new Device("second resident");
const visitor = new Device("visitor");
let reportId;

before(async function () {
  await db.setupDatabase();
  for (const table of ["sessions", "photos", "report_notes", "report_history", "reports", "users"]) {
    await db.query("DELETE FROM " + table);
  }
  const accounts = [
    ["admin", "Ana Admin", "admin@test.ph", "admin", null],
    ["crew", "Carlo Crew", "crew@test.ph", "maintenance", "North road crew"],
    ["otherCrew", "Olga Crew", "olga@test.ph", "maintenance", "South road crew"],
    ["resident", "Rita Resident", "rita@test.ph", "citizen", null],
    ["neighbour", "Nilo Neighbour", "nilo@test.ph", "citizen", null],
  ];
  const hash = await hashPassword(password);
  for (const [key, name, email, role, team] of accounts) {
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

  await admin.signIn("admin@test.ph");
  await crew.signIn("crew@test.ph");
  await otherCrew.signIn("olga@test.ph");
  await resident.signIn("rita@test.ph");
  await neighbour.signIn("nilo@test.ph");
  for (const device of [admin, crew, otherCrew, resident, neighbour, visitor]) {
    await device.connect();
  }
});

after(async function () {
  sockets.forEach((socket) => socket.terminate());
  if (server) {
    await server.close();
  }
  if (!process.env.KEEP_TEST_DB) {
    await db.query("DROP DATABASE IF EXISTS `" + config.db.database + "`");
  }
  await db.pool.end();
  fs.rmSync(storageDir, { recursive: true, force: true });
});

/* ---------- The workflow ---------- */

test("1. a resident reports road damage with photos, and every device sees it live", async function () {
  assert.equal((await visitor.request("POST", "/api/reports", reportForm())).status, 401, "visitors can't report");
  assert.equal((await crew.request("POST", "/api/reports", reportForm())).status, 403, "crews can't report");

  const notAnImage = await resident.request("POST", "/api/reports", reportForm({}, [["photos", Buffer.from("<script>"), "evil.jpg", "image/jpeg"]]));
  assert.equal(notAnImage.status, 400);
  assert.match(notAnImage.body.error, /isn't a JPEG, PNG, or WebP/);

  const created = await resident.request(
    "POST",
    "/api/reports",
    reportForm({}, [
      ["photos", jpeg, "pothole.jpg", "image/jpeg"],
      ["photos", png, "close-up.png", "image/png"],
    ]),
  );
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const report = created.body.report;
  reportId = report.id;
  assert.match(reportId, /^RPT-\d+$/);
  assert.equal(report.status, "submitted");
  assert.equal(report.reporter, "Rita Resident");

  // Photos are stored as files on the server, not in the browser or database.
  assert.equal(report.evidencePhotos.length, 2);
  for (const photo of report.evidencePhotos) {
    assert.match(photo.src, /^\/uploads\/\d{4}\/\d{2}\/evidence-[0-9a-f]+\.(jpg|png)$/);
    assert.ok(fs.existsSync(path.join(photosDir, photo.src.replace("/uploads/", ""))), "photo file saved in storage");
    const download = await fetch(base + photo.src);
    assert.equal(download.status, 200);
    assert.match(download.headers.get("content-type"), /^image\/(jpeg|png)/);
  }
  const rows = await db.query("SELECT file_path, size_bytes FROM photos WHERE report_id = ?", [Number(reportId.slice(4))]);
  assert.equal(rows.length, 2);

  // Live on every other device, shaped for each role.
  const forAdmin = await admin.reportUpdate(reportId, "submitted");
  assert.equal(forAdmin.report.reporter, "Rita Resident");
  const forVisitor = await visitor.reportUpdate(reportId, "submitted");
  assert.equal(forVisitor.report.reporter, undefined, "visitors never see who reported it");
  assert.equal(forVisitor.report.reporterId, undefined);
  await crew.reportUpdate(reportId, "submitted");
  const forNeighbour = await neighbour.reportUpdate(reportId, "submitted");
  assert.equal(forNeighbour.report.reporter, undefined, "other residents don't see the reporter");
});

test("2. a similar report nearby is a possible duplicate until the resident confirms it", async function () {
  const duplicate = await neighbour.request("POST", "/api/reports", reportForm({ latitude: spot.latitude + 0.0004 }));
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.duplicateId, reportId);
  assert.equal(duplicate.body.possibleDuplicates[0].id, reportId);
  assert.ok(duplicate.body.possibleDuplicates[0].distance > 35 && duplicate.body.possibleDuplicates[0].distance < 55);

  // A different kind of problem at almost the same spot isn't a duplicate.
  const sign = await neighbour.request(
    "POST",
    "/api/reports",
    reportForm({
      title: "Fallen road sign",
      description: "The stop sign at the corner was knocked over by a truck.",
      severity: "Low",
      latitude: spot.latitude + 0.0002,
    }),
  );
  assert.equal(sign.status, 201, JSON.stringify(sign.body));

  // The resident checked the existing report and says theirs is different.
  const confirmed = await neighbour.request(
    "POST",
    "/api/reports",
    reportForm({ latitude: spot.latitude + 0.0004, confirmDuplicate: "true" }),
  );
  assert.equal(confirmed.status, 201, JSON.stringify(confirmed.body));
  const admins = await admin.request("GET", "/api/reports/" + confirmed.body.report.id);
  assert.match(admins.body.report.history[0].note, new RegExp("Possible duplicate of " + reportId));

  // Close both, so they don't change the rest of the workflow.
  assert.equal((await admin.request("POST", "/api/reports/" + sign.body.report.id + "/status", { status: "rejected" })).status, 200);
  assert.equal((await admin.request("POST", "/api/reports/" + confirmed.body.report.id + "/status", { status: "duplicate" })).status, 200);
});

test("3. only the administrator can review and verify, and steps can't be skipped", async function () {
  assert.equal((await resident.request("POST", "/api/reports/" + reportId + "/status", { status: "verified" })).status, 403);
  assert.equal((await crew.request("POST", "/api/reports/" + reportId + "/status", { status: "verified" })).status, 403);
  assert.equal((await visitor.request("POST", "/api/reports/" + reportId + "/status", { status: "verified" })).status, 401);

  const early = await admin.request("POST", "/api/reports/" + reportId + "/assign", { crewId: ids.crew });
  assert.equal(early.status, 409, "can't assign before verifying");
  const resolveEarly = await admin.request("POST", "/api/reports/" + reportId + "/status", { status: "resolved" });
  assert.equal(resolveEarly.status, 409, "can't resolve before a repair is submitted");
  const verifyEarly = await admin.request("POST", "/api/reports/" + reportId + "/status", { status: "verified" });
  assert.equal(verifyEarly.status, 409, "can't verify before marking it under review");
  assert.match(verifyEarly.body.error, /under review before verifying/);

  const review = await admin.request("POST", "/api/reports/" + reportId + "/status", { status: "under_review" });
  assert.equal(review.status, 200);
  assert.equal(review.body.report.status, "under_review");
  await resident.reportUpdate(reportId, "under_review");

  const verify = await admin.request("POST", "/api/reports/" + reportId + "/status", { status: "verified" });
  assert.equal(verify.status, 200);
  assert.equal(verify.body.report.history.at(-1).actor, "Ana Admin", "history records who decided");
  await resident.reportUpdate(reportId, "verified");
  await visitor.reportUpdate(reportId, "verified");
});

test("4. internal notes stay with administrators", async function () {
  const note = await admin.request("POST", "/api/reports/" + reportId + "/notes", { note: "Coordinate with the school." });
  assert.equal(note.status, 201);
  assert.equal(note.body.report.notes.at(-1).note, "Coordinate with the school.");
  assert.equal((await crew.request("POST", "/api/reports/" + reportId + "/notes", { note: "hi" })).status, 403);

  const publicCopy = await visitor.request("GET", "/api/reports/" + reportId);
  assert.equal(publicCopy.body.report.notes, undefined);
  const residentCopy = await resident.request("GET", "/api/reports/" + reportId);
  assert.equal(residentCopy.body.report.notes, undefined);
  assert.equal(residentCopy.body.report.reporter, "Rita Resident", "the reporter sees their own name");
});

test("5. the administrator assigns a crew, and the crew sees the job live", async function () {
  assert.equal((await admin.request("POST", "/api/reports/" + reportId + "/assign", { crewId: ids.resident })).status, 400, "only crews can be assigned");
  const assign = await admin.request("POST", "/api/reports/" + reportId + "/assign", { crewId: ids.crew });
  assert.equal(assign.status, 200);
  assert.equal(assign.body.report.status, "assigned");
  assert.equal(assign.body.report.assignedTo, ids.crew);
  assert.equal(assign.body.report.assignedName, "Carlo Crew");
  const live = await crew.reportUpdate(reportId, "assigned");
  assert.equal(live.report.assignedTo, ids.crew);
});

test("6. only the assigned crew can start and submit the repair", async function () {
  assert.equal((await otherCrew.request("POST", "/api/reports/" + reportId + "/start")).status, 409, "another crew can't start it");
  assert.equal((await admin.request("POST", "/api/reports/" + reportId + "/start")).status, 403);

  const start = await crew.request("POST", "/api/reports/" + reportId + "/start");
  assert.equal(start.status, 200);
  assert.equal(start.body.report.status, "in_progress");
  await admin.reportUpdate(reportId, "in_progress");
  await resident.reportUpdate(reportId, "in_progress");

  const missingAfter = await crew.request(
    "POST",
    "/api/reports/" + reportId + "/repair",
    photoForm({ notes: "Patched." }, [["before", jpeg, "before.jpg", "image/jpeg"]]),
  );
  assert.equal(missingAfter.status, 400, "needs at least one after photo");

  const stranger = await otherCrew.request(
    "POST",
    "/api/reports/" + reportId + "/repair",
    photoForm({ notes: "Patched." }, [
      ["before", jpeg, "before.jpg", "image/jpeg"],
      ["after", jpeg, "after.jpg", "image/jpeg"],
    ]),
  );
  assert.equal(stranger.status, 409);

  const submit = await crew.request(
    "POST",
    "/api/reports/" + reportId + "/repair",
    photoForm({ notes: "Cut out the damaged section and laid hot-mix asphalt." }, [
      ["before", jpeg, "before-1.jpg", "image/jpeg"],
      ["after", jpeg, "after-1.jpg", "image/jpeg"],
      ["after", png, "after-2.png", "image/png"],
    ]),
  );
  assert.equal(submit.status, 200, JSON.stringify(submit.body));
  const repair = submit.body.report.repair;
  assert.equal(submit.body.report.status, "repair_submitted");
  assert.equal(repair.notes, "Cut out the damaged section and laid hot-mix asphalt.");
  assert.equal(repair.beforePhotos.length, 1);
  assert.equal(repair.afterPhotos.length, 2);
  assert.ok(repair.afterPhotos.every((photo) => photo.src.startsWith("/uploads/")));
  const live = await admin.reportUpdate(reportId, "repair_submitted");
  assert.equal(live.report.repair.afterPhotos.length, 2);
});

test("7. the administrator can send the repair back, and the crew resubmits", async function () {
  const sendBack = await admin.request("POST", "/api/reports/" + reportId + "/status", {
    status: "in_progress",
    note: "The patch edge is uneven.",
  });
  assert.equal(sendBack.status, 200);
  assert.equal(sendBack.body.report.history.at(-1).note, "The patch edge is uneven.");
  // The crew sees the job come back, with the reason.
  const live = await crew.waitFor(
    (message) =>
      message.type === "report" &&
      message.report.id === reportId &&
      message.report.status === "in_progress" &&
      message.report.history.at(-1).note === "The patch edge is uneven.",
  );
  assert.equal(live.report.history.at(-1).actor, "Ana Admin");

  // The website sends after-repair photos only (up to ten).
  const afterNames = ["after-3.jpg", "after-4.jpg", "after-5.jpg", "after-6.jpg", "after-7.jpg", "after-8.jpg"];
  const tooMany = await crew.request(
    "POST",
    "/api/reports/" + reportId + "/repair",
    photoForm(
      { notes: "Leveled the patch edge with the lane." },
      Array.from({ length: 11 }, (item, index) => ["after", jpeg, "extra-" + index + ".jpg", "image/jpeg"]),
    ),
  );
  assert.equal(tooMany.status, 400);
  assert.equal(tooMany.body.error, "Choose no more than 10 photos.");

  const resubmit = await crew.request(
    "POST",
    "/api/reports/" + reportId + "/repair",
    photoForm(
      { notes: "Leveled the patch edge with the lane." },
      afterNames.map((name) => ["after", jpeg, name, "image/jpeg"]),
    ),
  );
  assert.equal(resubmit.status, 200, JSON.stringify(resubmit.body));
  assert.equal(resubmit.body.report.repair.notes, "Leveled the patch edge with the lane.");
  assert.deepEqual(
    resubmit.body.report.repair.afterPhotos.map((photo) => photo.name),
    afterNames,
    "only the latest repair photos are shown",
  );
  assert.deepEqual(resubmit.body.report.repair.beforePhotos, [], "before photos are optional");
  const [{ kept }] = await db.query("SELECT COUNT(*) AS kept FROM photos WHERE report_id = ? AND replaced_at IS NOT NULL", [
    Number(reportId.slice(4)),
  ]);
  assert.equal(kept, 3, "earlier repair photos are kept for the record");
});

test("8. the administrator verifies the repair and resolves the report", async function () {
  const resolve = await admin.request("POST", "/api/reports/" + reportId + "/status", { status: "resolved" });
  assert.equal(resolve.status, 200);
  assert.equal(resolve.body.report.status, "resolved");
  await resident.reportUpdate(reportId, "resolved");
  await crew.reportUpdate(reportId, "resolved");
  await visitor.reportUpdate(reportId, "resolved");

  const again = await admin.request("POST", "/api/reports/" + reportId + "/status", { status: "resolved" });
  assert.equal(again.status, 409, "a closed report can't be resolved twice");

  const { body } = await resident.request("GET", "/api/state");
  const mine = body.reports.find((report) => report.id === reportId);
  assert.deepEqual(
    mine.history.map((entry) => entry.status),
    ["submitted", "under_review", "verified", "assigned", "in_progress", "repair_submitted", "in_progress", "repair_submitted", "resolved"],
  );
  assert.deepEqual(
    mine.history.map((entry) => entry.actor),
    ["Rita Resident", "Ana Admin", "Ana Admin", "Ana Admin", "Carlo Crew", "Carlo Crew", "Ana Admin", "Carlo Crew", "Ana Admin"],
  );

  // The road can be reported again once the earlier report is closed.
  const reopened = await neighbour.request("POST", "/api/reports", reportForm({ title: "Pothole is back after the rains" }));
  assert.equal(reopened.status, 201);
});

function feedbackFiles() {
  return fs
    .readdirSync(photosDir, { recursive: true })
    .filter((name) => String(name).includes("-feedback-"));
}

test("8b. the resident gives feedback on the finished repair once, and only they and the administrator see it", async function () {
  const url = "/api/reports/" + reportId + "/feedback";
  const answer = { rating: 5, outcome: "fixed" };
  assert.equal((await neighbour.request("POST", url, answer)).status, 403, "only the resident who filed it");
  assert.equal((await admin.request("POST", url, answer)).status, 403, "staff can't give feedback");
  assert.equal((await visitor.request("POST", url, answer)).status, 401);
  assert.equal((await resident.request("POST", url, { rating: 9, outcome: "fixed" })).status, 400);
  assert.equal((await resident.request("POST", url, { rating: 4 })).status, 400, "is the road fully repaired? is required");
  assert.equal((await resident.request("POST", url, { rating: 4, outcome: "maybe" })).status, 400);
  assert.equal((await resident.request("POST", url, { rating: 4, outcome: "fixed", tags: ["fast", "free-lunch"] })).status, 400, "only listed tags");
  assert.equal((await resident.request("POST", url, { rating: 4, outcome: "fixed", comment: "x".repeat(501) })).status, 400);
  const notPhoto = photoForm(answer, [["photos", Buffer.from("not an image"), "notes.txt", "text/plain"]]);
  assert.equal((await resident.request("POST", url, notPhoto)).status, 400);
  const fourPhotos = photoForm(answer, [1, 2, 3, 4].map((n) => ["photos", jpeg, "repair-" + n + ".jpg", "image/jpeg"]));
  const tooMany = await resident.request("POST", url, fourPhotos);
  assert.equal(tooMany.status, 400);
  assert.match(tooMany.body.error, /no more than 3 photos/);
  assert.equal(feedbackFiles().length, 0, "nothing is kept from refused feedback");

  const sent = await resident.request(
    "POST",
    url,
    photoForm({ rating: 4, outcome: "partial", tags: "smooth,debris,smooth", comment: "Smooth now, but gravel was left by the curb." }, [
      ["photos", png, "repaired.png", "image/png"],
    ]),
  );
  assert.equal(sent.status, 201, JSON.stringify(sent.body));
  const feedback = sent.body.report.feedback;
  assert.equal(feedback.rating, 4);
  assert.equal(feedback.outcome, "partial");
  assert.deepEqual(feedback.tags, ["smooth", "debris"]);
  assert.equal(feedback.comment, "Smooth now, but gravel was left by the curb.");
  assert.equal(feedback.photos.length, 1);
  assert.equal(feedback.photos[0].name, "repaired.png");
  assert.equal((await visitor.request("GET", feedback.photos[0].src)).status, 200);
  const otherPhotos = sent.body.report.evidencePhotos.concat(sent.body.report.repair.afterPhotos);
  assert.ok(otherPhotos.every((photo) => photo.src !== feedback.photos[0].src), "kept apart from report and repair photos");
  const live = await admin.waitFor((message) => message.type === "report" && message.report.id === reportId && message.report.feedback);
  assert.equal(live.report.feedback.outcome, "partial", "the administrator sees it live");
  assert.deepEqual(live.report.feedback.tags, ["smooth", "debris"]);
  assert.equal(live.report.feedback.photos.length, 1);

  const again = await resident.request("POST", url, photoForm(answer, [["photos", jpeg, "again.jpg", "image/jpeg"]]));
  assert.equal(again.status, 409, "only one feedback per report");
  assert.equal(feedbackFiles().length, 1, "the refused photo isn't kept");
  assert.equal((await visitor.request("GET", "/api/reports/" + reportId)).body.report.feedback, undefined);
  assert.equal((await neighbour.request("GET", "/api/reports/" + reportId)).body.report.feedback, undefined);
  const stored = await db.one("SELECT outcome, tags FROM report_feedback WHERE report_id = ?", [Number(reportId.slice(4))]);
  assert.deepEqual({ outcome: stored.outcome, tags: stored.tags }, { outcome: "partial", tags: "smooth,debris" });
});

test("9. rejected and duplicate reports close with the reason shown to the resident", async function () {
  const extra = await resident.request("POST", "/api/reports", reportForm({ title: "Crack near the plaza", latitude: 14.9, longitude: 120.9 }));
  assert.equal(extra.status, 201);
  const early = await resident.request("POST", "/api/reports/" + extra.body.report.id + "/feedback", { rating: 3, outcome: "fixed" });
  assert.equal(early.status, 409, "no rating before the repair is resolved");
  const reject = await admin.request("POST", "/api/reports/" + extra.body.report.id + "/status", {
    status: "rejected",
    note: "No road damage found during inspection.",
  });
  assert.equal(reject.status, 200);
  const live = await resident.reportUpdate(extra.body.report.id, "rejected");
  assert.equal(live.report.history.at(-1).note, "No road damage found during inspection.");
  const verifyClosed = await admin.request("POST", "/api/reports/" + extra.body.report.id + "/status", { status: "verified" });
  assert.equal(verifyClosed.status, 409);
});

test("a retried upload with the same Idempotency-Key files the report only once", async function () {
  const drain = { title: "Collapsed drain cover", latitude: 14.78, longitude: 120.85 };
  const photo = [["photos", jpeg, "drain.jpg", "image/jpeg"]];
  const key = { "Idempotency-Key": "retry-test-0001" };
  const first = await resident.request("POST", "/api/reports", reportForm(drain, photo), key);
  assert.equal(first.status, 201, JSON.stringify(first.body));
  // The app never got the answer and sends the same form again.
  const retry = await resident.request("POST", "/api/reports", reportForm(drain, photo), key);
  assert.equal(retry.status, 200, JSON.stringify(retry.body));
  assert.equal(retry.body.report.id, first.body.report.id);
  assert.equal(retry.body.report.evidencePhotos.length, 1, "the retry's photos aren't added again");

  // A new form at the same spot, or another resident's form with the same
  // key, is still a likely duplicate.
  const newForm = await resident.request("POST", "/api/reports", reportForm(drain), { "Idempotency-Key": "retry-test-0002" });
  assert.equal(newForm.status, 409);
  assert.equal((await neighbour.request("POST", "/api/reports", reportForm(drain), key)).status, 409);
  const badKey = await resident.request("POST", "/api/reports", reportForm({ latitude: 14.77 }), { "Idempotency-Key": "a b" });
  assert.equal(badKey.status, 400);

  // Two copies of the same upload arriving at once file one report.
  const sign = { title: "Fallen road sign", latitude: 14.76, longitude: 120.83 };
  const twinKey = { "Idempotency-Key": "retry-test-0003" };
  const twins = await Promise.all([
    resident.request("POST", "/api/reports", reportForm(sign), twinKey),
    resident.request("POST", "/api/reports", reportForm(sign), twinKey),
  ]);
  assert.deepEqual(twins.map((twin) => twin.status).sort(), [200, 201], JSON.stringify(twins.map((twin) => twin.body)));
  assert.equal(twins[0].body.report.id, twins[1].body.report.id);
});

test("a report can carry five phone-sized photos at once, and a sixth is refused", async function () {
  // About the size of a photo resized by the app (1280 px JPEG).
  const phonePhoto = Buffer.concat([jpeg.subarray(0, 4), Buffer.alloc(300 * 1024, 7)]);
  const five = [1, 2, 3, 4, 5].map((n) => ["photos", phonePhoto, "pothole-" + n + ".jpg", "image/jpeg"]);
  const report = await resident.request(
    "POST",
    "/api/reports",
    reportForm({ title: "Pothole field", latitude: 14.74, longitude: 120.81 }, five),
    { "Idempotency-Key": "five-photos-0001" },
  );
  assert.equal(report.status, 201, JSON.stringify(report.body));
  assert.equal(report.body.report.evidencePhotos.length, 5);
  for (const photo of report.body.report.evidencePhotos) {
    const file = await fetch(base + photo.src);
    assert.equal(file.status, 200, photo.src);
    assert.equal((await file.arrayBuffer()).byteLength, phonePhoto.length);
  }

  const six = five.concat([["photos", png, "extra.png", "image/png"]]);
  const tooMany = await resident.request("POST", "/api/reports", reportForm({ latitude: 14.72, longitude: 120.79 }, six));
  assert.equal(tooMany.status, 400);
  assert.equal(tooMany.body.error, "Choose no more than 5 photos.");
});

test("a retried repair upload with the same Idempotency-Key is applied once", async function () {
  const job = await resident.request("POST", "/api/reports", reportForm({ title: "Broken curb", latitude: 14.7, longitude: 120.77 }));
  assert.equal(job.status, 201);
  const id = job.body.report.id;
  assert.equal((await admin.request("POST", "/api/reports/" + id + "/status", { status: "under_review" })).status, 200);
  assert.equal((await admin.request("POST", "/api/reports/" + id + "/status", { status: "verified" })).status, 200);
  assert.equal((await admin.request("POST", "/api/reports/" + id + "/assign", { crewId: ids.crew })).status, 200);
  assert.equal((await crew.request("POST", "/api/reports/" + id + "/start")).status, 200);

  const repairForm = () =>
    photoForm({ notes: "Rebuilt the curb." }, [
      ["before", jpeg, "before.jpg", "image/jpeg"],
      ["after", png, "after.png", "image/png"],
    ]);
  const submissions = (report) => report.history.filter((entry) => entry.status === "repair_submitted").length;
  const key = { "Idempotency-Key": "repair-test-0001" };
  const first = await crew.request("POST", "/api/reports/" + id + "/repair", repairForm(), key);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.report.status, "repair_submitted");

  // The app never got the answer and sends the same repair again.
  const retry = await crew.request("POST", "/api/reports/" + id + "/repair", repairForm(), key);
  assert.equal(retry.status, 200, "a retry gets the submitted repair, not 'no longer assigned'");
  assert.equal(retry.body.report.repair.afterPhotos.length, 1, "the retry's photos aren't added");
  assert.equal(submissions(retry.body.report), 1);

  // Without the key, or from another crew, a second submission is refused.
  assert.equal((await crew.request("POST", "/api/reports/" + id + "/repair", repairForm())).status, 409);
  assert.equal((await otherCrew.request("POST", "/api/reports/" + id + "/repair", repairForm(), key)).status, 409);

  // Sent back for more work: the next update, with a new key, goes through.
  assert.equal((await admin.request("POST", "/api/reports/" + id + "/status", { status: "in_progress", note: "Paint it." })).status, 200);
  const again = await crew.request("POST", "/api/reports/" + id + "/repair", repairForm(), { "Idempotency-Key": "repair-test-0002" });
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.equal(submissions(again.body.report), 2);
});

/* ---------- Accounts and sign-in ---------- */

test("sign-in checks the password and the account's role decides access", async function () {
  const wrong = await new Device("guesser").request("POST", "/api/auth/login", { email: "admin@test.ph", password: "nope1234" });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.body.error, "Incorrect email or password.");
  const me = await crew.request("GET", "/api/auth/me");
  assert.equal(me.body.user.role, "maintenance");
  assert.equal((await crew.request("GET", "/api/users")).status, 403, "only admins list accounts");
  const users = await admin.request("GET", "/api/users");
  assert.equal(users.status, 200);
  assert.ok(users.body.users.every((user) => user.password_hash === undefined && user.passwordHash === undefined));
});

test("the session cookie is HttpOnly and other websites can't use it", async function () {
  const login = await new Device("cookie check").signIn("nilo@test.ph");
  const cookie = login.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  const crossSite = await neighbour.request("POST", "/api/reports", reportForm({ latitude: 14.95 }), { Origin: "https://evil.example" });
  assert.equal(crossSite.status, 403);
});

test("the mobile app signs in with a token and gets live updates", async function () {
  const phone = new Device("phone");
  const login = await phone.signIn("crew@test.ph", { "X-ResQRoad-Client": "mobile" });
  assert.ok(login.body.token, "the app gets a token");
  assert.equal(phone.cookie, "", "and no cookie");
  phone.token = login.body.token;
  assert.equal((await phone.request("GET", "/api/auth/me")).body.user.email, "crew@test.ph");

  // An app can also authenticate the live connection with a first message.
  const socket = new WebSocket(base.replace("http", "ws") + "/api/live");
  sockets.push(socket);
  phone.socket = socket;
  socket.on("message", (data) => phone.messages.push(JSON.parse(String(data))));
  await phone.waitFor((message) => message.type === "hello" && message.user === null);
  socket.send(JSON.stringify({ type: "auth", token: login.body.token }));
  await phone.waitFor((message) => message.type === "hello" && message.user && message.user.role === "maintenance");
});

test("residents register themselves with a strong password", async function () {
  const newcomer = new Device("newcomer");
  const weak = await newcomer.request("POST", "/api/auth/register", { name: "New Person", email: "new@test.ph", password: "short" });
  assert.equal(weak.status, 400);
  const created = await newcomer.request("POST", "/api/auth/register", { name: "New Person", email: "new@test.ph", password: password });
  assert.equal(created.status, 201);
  assert.equal(created.body.user.role, "citizen");
  assert.equal((await newcomer.request("GET", "/api/auth/me")).body.user.email, "new@test.ph", "signed in right away");
  const taken = await new Device("again").request("POST", "/api/auth/register", { name: "Copy", email: "new@test.ph", password: password });
  assert.equal(taken.status, 409);
  const stored = await db.one("SELECT password_hash FROM users WHERE email = 'new@test.ph'");
  assert.match(stored.password_hash, /^\$2[aby]\$10\$/, "passwords are stored as bcrypt hashes");
});

test("a deactivated resident is signed out on every device at once", async function () {
  const signedOut = neighbour.waitFor((message) => message.type === "signed-out");
  const deactivate = await admin.request("PATCH", "/api/users/" + ids.neighbour, { active: false });
  assert.equal(deactivate.status, 200);
  await signedOut;
  assert.equal((await neighbour.request("GET", "/api/auth/me")).body.user, null);
  const retry = await new Device("retry").request("POST", "/api/auth/login", { email: "nilo@test.ph", password: password });
  assert.equal(retry.status, 403);
  assert.match(retry.body.error, /deactivated/);
  assert.equal((await admin.request("PATCH", "/api/users/" + ids.neighbour, { active: true })).status, 200);
});

test("the administrator adds and deletes crew accounts", async function () {
  const weak = await admin.request("POST", "/api/users", { name: "Dan Diaz", email: "dan@test.ph", team: "East road crew", password: "crew123" });
  assert.equal(weak.status, 400, "no more shared weak default password");
  const added = await admin.request("POST", "/api/users", { name: "Dan Diaz", email: "dan@test.ph", team: "East road crew", password: "Temp4567" });
  assert.equal(added.status, 201);
  const live = await visitor.waitFor((message) => message.type === "accounts" && message.crews.some((item) => item.name === "Dan Diaz"));
  assert.equal(live.users, undefined, "visitors only get the public crew list");
  const dan = new Device("dan");
  await dan.request("POST", "/api/auth/login", { email: "dan@test.ph", password: "Temp4567" });
  assert.equal((await dan.request("GET", "/api/auth/me")).body.user.team, "East road crew");

  // A crew with an open job can't be deleted.
  const job = await resident.request("POST", "/api/reports", reportForm({ title: "Sinkhole", latitude: 14.82, longitude: 120.95 }));
  await admin.request("POST", "/api/reports/" + job.body.report.id + "/status", { status: "under_review" });
  await admin.request("POST", "/api/reports/" + job.body.report.id + "/status", { status: "verified" });
  await admin.request("POST", "/api/reports/" + job.body.report.id + "/assign", { crewId: added.body.user.id });
  assert.equal((await admin.request("DELETE", "/api/users/" + added.body.user.id)).status, 409);
  await admin.request("POST", "/api/reports/" + job.body.report.id + "/assign", { crewId: ids.crew });
  assert.equal((await admin.request("DELETE", "/api/users/" + added.body.user.id)).status, 200);
  assert.equal((await dan.request("GET", "/api/auth/me")).body.user, null, "deleted crews are signed out");
});

test("people change their own password, and admins can reset a forgotten one", async function () {
  const phone = new Device("rita's phone");
  const laptop = new Device("rita's laptop");
  await phone.signIn("rita@test.ph");
  await laptop.signIn("rita@test.ph");
  const wrong = await phone.request("POST", "/api/auth/password", { currentPassword: "nope1234", newPassword: "Better5678" });
  assert.equal(wrong.status, 400);
  const changed = await phone.request("POST", "/api/auth/password", { currentPassword: password, newPassword: "Better5678" });
  assert.equal(changed.status, 200);
  assert.equal((await phone.request("GET", "/api/auth/me")).body.user.email, "rita@test.ph", "this device stays signed in");
  assert.equal((await laptop.request("GET", "/api/auth/me")).body.user, null, "other devices are signed out");
  assert.equal((await new Device("old").request("POST", "/api/auth/login", { email: "rita@test.ph", password: password })).status, 401);

  assert.equal((await crew.request("POST", "/api/users/" + ids.otherCrew + "/password", { password: "Reset9876" })).status, 403);
  assert.equal((await admin.request("POST", "/api/users/" + ids.admin + "/password", { password: "Reset9876" })).status, 404);
  const reset = await admin.request("POST", "/api/users/" + ids.otherCrew + "/password", { password: "Reset9876" });
  assert.equal(reset.status, 200);
  assert.equal((await otherCrew.request("GET", "/api/auth/me")).body.user, null, "signed out after the reset");
  const fresh = await new Device("olga again").request("POST", "/api/auth/login", { email: "olga@test.ph", password: "Reset9876" });
  assert.equal(fresh.status, 200);
});

test("signing out ends the session", async function () {
  const device = new Device("laptop");
  await device.signIn("nilo@test.ph");
  const cookie = device.cookie;
  await device.request("POST", "/api/auth/logout");
  const reused = new Device("stolen cookie");
  reused.cookie = cookie;
  assert.equal((await reused.request("GET", "/api/auth/me")).body.user, null);
});

test("only the website's pages are served, never server files", async function () {
  assert.equal((await fetch(base + "/")).status, 200);
  for (const page of ["/login.html", "/register.html", "/track.html"]) {
    assert.equal((await fetch(base + page)).status, 200, page);
  }
  assert.equal((await fetch(base + "/assets/js/data-store.js")).status, 200);
  for (const hidden of ["/.env", "/.env.example", "/package.json", "/server/db.js", "/database/schema.sql", "/tools/seed.js", "/storage/photos"]) {
    assert.equal((await fetch(base + hidden)).status, 404, hidden);
  }
});

test("workspace pages open only for their signed-in role and are never cached", async function () {
  const browsers = { admin: new Device("admin browser"), crew: new Device("crew browser"), citizen: new Device("resident browser") };
  await browsers.admin.signIn("admin@test.ph");
  await browsers.crew.signIn("crew@test.ph");
  await browsers.citizen.signIn("nilo@test.ph");
  const workspaces = { "/admin.html": "admin", "/maintenance.html": "crew", "/citizen.html": "citizen" };
  for (const [page, role] of Object.entries(workspaces)) {
    const signedOut = await fetch(base + page, { redirect: "manual" });
    assert.equal(signedOut.status, 302, page + " signed out");
    assert.equal(signedOut.headers.get("location"), "/login.html?next=" + page.slice(1));
    assert.equal(signedOut.headers.get("cache-control"), "no-store");

    const opened = await fetch(base + page, { redirect: "manual", headers: { Cookie: browsers[role].cookie } });
    assert.equal(opened.status, 200, page + " for its role");
    assert.equal(opened.headers.get("cache-control"), "no-store");

    const other = browsers[role === "citizen" ? "admin" : "citizen"];
    assert.equal((await fetch(base + page, { redirect: "manual", headers: { Cookie: other.cookie } })).status, 302, page + " other role");
  }

  // After signing out, the same cookie no longer opens the workspace.
  const laptop = new Device("signed-out laptop");
  await laptop.signIn("crew@test.ph");
  const cookie = laptop.cookie;
  await laptop.request("POST", "/api/auth/logout");
  assert.equal((await fetch(base + "/maintenance.html", { redirect: "manual", headers: { Cookie: cookie } })).status, 302);
});
