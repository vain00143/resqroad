// Reports and the repair workflow:
//
//   Submitted → Under Review → Verified → Assigned → In Progress
//     → Repair Submitted → Resolved          (or Rejected / Duplicate)
//
// The server decides who may make each change, so the rules hold for the
// website and the mobile app alike.

import express from "express";
import { HttpError, requireRole } from "./auth.js";
import { config } from "./config.js";
import { one, query, transaction } from "./db.js";
import { broadcast } from "./live.js";
import { checkPhotos, photoUpload, photoUrl, removePhotoFiles, savePhotos, storePhotoData } from "./photos.js";
import { findSimilarReports } from "../assets/js/duplicates.js";

export const statuses = [
  "submitted",
  "under_review",
  "verified",
  "assigned",
  "in_progress",
  "repair_submitted",
  "resolved",
  "rejected",
  "duplicate",
];
export const openStatuses = ["submitted", "under_review", "verified", "assigned", "in_progress", "repair_submitted"];
export const crewOpenStatuses = ["assigned", "in_progress", "repair_submitted"];

const statusLabels = {
  submitted: "Submitted",
  under_review: "Under Review",
  verified: "Verified",
  assigned: "Assigned",
  in_progress: "In Progress",
  repair_submitted: "Repair Submitted",
  resolved: "Resolved",
  rejected: "Rejected",
  duplicate: "Duplicate",
};

// Administrator decisions: the new status and the statuses it can come from.
// A report is verified only after it has been marked under review.
const adminTransitions = {
  under_review: ["submitted"],
  verified: ["under_review"],
  rejected: ["submitted", "under_review"],
  duplicate: ["submitted", "under_review"],
  resolved: ["repair_submitted"],
  in_progress: ["repair_submitted"], // "Request more work"
};

const defaultDescriptions = {
  under_review: "Administrator started reviewing this report.",
  verified: "Administrator confirmed the reported road damage.",
  rejected: "Administrator rejected this report.",
  duplicate: "Administrator marked this report as a duplicate.",
  resolved: "Administrator verified the repair and closed the report.",
  in_progress: "Administrator requested additional repair work.",
};

/* ---------- Reading and shaping reports ---------- */

export function reportCode(id) {
  return "RPT-" + id;
}

function parseReportId(value) {
  const match = /^(?:RPT-)?(\d{1,9})$/i.exec(String(value || "").trim());
  if (!match) {
    throw new HttpError(404, "Report not found.");
  }
  return Number(match[1]);
}

function iso(value) {
  return value ? new Date(value).toISOString() : null;
}

function photoOut(row) {
  // Sample reports only list file names; the website shows stock photos.
  if (!row.file_path) {
    return row.name;
  }
  return { id: String(row.id), name: row.name, src: photoUrl(row.file_path) };
}

// Loads complete reports (with history, photos, and notes) for the given rows.
async function hydrate(rows) {
  if (!rows.length) {
    return [];
  }
  const ids = rows.map(function (row) {
    return row.id;
  });
  const [history, photos, notes, feedback] = await Promise.all([
    query("SELECT * FROM report_history WHERE report_id IN (?) ORDER BY created_at, id", [ids]),
    query("SELECT * FROM photos WHERE report_id IN (?) AND replaced_at IS NULL ORDER BY sort_order, id", [ids]),
    query("SELECT * FROM report_notes WHERE report_id IN (?) ORDER BY created_at, id", [ids]),
    query("SELECT * FROM report_feedback WHERE report_id IN (?)", [ids]),
  ]);
  const byReport = new Map(
    rows.map(function (row) {
      return [row.id, { history: [], evidence: [], before: [], after: [], notes: [], feedback: null }];
    }),
  );
  feedback.forEach(function (row) {
    byReport.get(row.report_id).feedback = { rating: row.rating, comment: row.comment || "", at: iso(row.created_at) };
  });
  history.forEach(function (row) {
    const entry = { status: row.status, description: row.description, actor: row.actor, at: iso(row.created_at) };
    if (row.note) {
      entry.note = row.note;
    }
    byReport.get(row.report_id).history.push(entry);
  });
  photos.forEach(function (row) {
    byReport.get(row.report_id)[row.kind].push(photoOut(row));
  });
  notes.forEach(function (row) {
    byReport.get(row.report_id).notes.push({ id: String(row.id), note: row.note, actor: row.actor, at: iso(row.created_at) });
  });

  return rows.map(function (row) {
    const extra = byReport.get(row.id);
    return {
      id: reportCode(row.id),
      title: row.title,
      road: row.road,
      location: row.location,
      coordinates: { lat: Number(row.latitude), lng: Number(row.longitude) },
      severity: row.severity,
      description: row.description,
      reporterId: row.reporter_id ? String(row.reporter_id) : null,
      reporterName: row.reporter_name || null,
      reportedAt: iso(row.reported_at),
      evidencePhotos: extra.evidence,
      status: row.status,
      assignedTo: row.assigned_to ? String(row.assigned_to) : null,
      assignedName: row.assigned_name || null,
      repair: row.repair_submitted_at
        ? {
            notes: row.repair_notes || "",
            beforePhotos: extra.before,
            afterPhotos: extra.after,
            submittedAt: iso(row.repair_submitted_at),
          }
        : null,
      history: extra.history,
      notes: extra.notes,
      feedback: extra.feedback,
      updatedAt: iso(row.updated_at),
    };
  });
}

const reportSelect = "SELECT r.*, u.name AS reporter_name FROM reports r LEFT JOIN users u ON u.id = r.reporter_id ";

export async function loadReports() {
  return hydrate(await query(reportSelect + "ORDER BY r.reported_at DESC, r.id DESC"));
}

export async function loadReport(id) {
  return (await hydrate(await query(reportSelect + "WHERE r.id = ?", [id])))[0] || null;
}

// What a given viewer may see of a report. Reports are public, but reporter
// details and the resident's feedback are only for administrators and the
// reporter, and internal notes only for administrators.
export function forViewer(report, viewer) {
  const isAdmin = Boolean(viewer && viewer.role === "admin");
  const isReporter = Boolean(viewer && report.reporterId && viewer.id === report.reporterId);
  const shaped = Object.assign({}, report);
  delete shaped.notes;
  delete shaped.reporterName;
  delete shaped.reporterId;
  delete shaped.feedback;
  if (isAdmin || isReporter) {
    shaped.reporterId = report.reporterId;
    shaped.reporter = report.reporterName || "Resident";
    shaped.feedback = report.feedback || null;
  }
  if (isAdmin) {
    shaped.notes = report.notes;
  }
  return shaped;
}

// Pushes the latest copy of a report to every connected device.
export async function publishReport(id) {
  const report = await loadReport(id);
  if (report) {
    broadcast(function (viewer) {
      return { type: "report", report: forViewer(report, viewer) };
    });
  }
  return report;
}

/* ---------- Input checks ---------- */

function text(value, label, max, required) {
  const clean = String(value === undefined || value === null ? "" : value)
    .replace(/\r\n/g, "\n")
    .trim();
  if (required && !clean) {
    throw new HttpError(400, label + " is required.");
  }
  if (clean.length > max) {
    throw new HttpError(400, label + " must be " + max + " characters or fewer.");
  }
  return clean;
}

// The app's Idempotency-Key header: one key per report or repair form, sent
// again with every retry of that form's upload. Null when the request has none.
function idempotencyKey(request) {
  const value = request.get("Idempotency-Key");
  if (value === undefined) {
    return null;
  }
  if (!/^[\w-]{8,64}$/.test(value)) {
    throw new HttpError(400, "The Idempotency-Key header must be 8 to 64 letters, numbers, dashes, or underscores.");
  }
  return value;
}

async function lockReport(connection, id) {
  const [rows] = await connection.query("SELECT * FROM reports WHERE id = ? FOR UPDATE", [id]);
  if (!rows[0]) {
    throw new HttpError(404, "This report is no longer available.");
  }
  return rows[0];
}

function stale(report) {
  return new HttpError(
    409,
    reportCode(report.id) + " is already " + statusLabels[report.status] + ". The latest version is now on screen.",
  );
}

function addHistory(connection, reportId, status, description, user, note) {
  return connection.query(
    "INSERT INTO report_history (report_id, status, description, actor, actor_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))",
    [reportId, status, description, user.name, user.id, note || null],
  );
}

// Adds the photos' rows (and, with PHOTO_STORAGE=database, their bytes).
async function insertPhotos(connection, reportId, kind, photos, user) {
  for (const [index, photo] of photos.entries()) {
    const [result] = await connection.query(
      "INSERT INTO photos (report_id, kind, name, file_path, mime_type, size_bytes, sort_order, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [reportId, kind, photo.name, photo.filePath, photo.mime, photo.size, index, user.id],
    );
    await storePhotoData(connection, result.insertId, photo);
  }
}

/* ---------- Routes ---------- */

export const reportRoutes = express.Router();

// Every report (public).
reportRoutes.get("/reports", async function (request, response) {
  const reports = await loadReports();
  response.json({
    reports: reports.map(function (report) {
      return forViewer(report, request.user);
    }),
  });
});

reportRoutes.get("/reports/:id", async function (request, response) {
  const report = await loadReport(parseReportId(request.params.id));
  if (!report) {
    throw new HttpError(404, "Report not found.");
  }
  response.json({ report: forViewer(report, request.user) });
});

// Open reports within the duplicate radius are looked up in a box this many
// degrees wide on each side (about 160 m in Bulacan).
const nearbySpan = 0.0015;

function duplicateSummary(match) {
  return { id: match.report.id, title: match.report.title, status: match.report.status, distance: match.distance };
}

// A resident files a report (multipart form: fields plus up to five `photos`).
// A report that looks like a possible duplicate of an open report nearby is
// refused with 409 and `possibleDuplicates`, unless the resident looked at
// them and sent the form again with `confirmDuplicate=true`.
reportRoutes.post("/reports", requireRole("citizen"), photoUpload(["photos"]), async function (request, response) {
  const body = request.body || {};
  const user = request.user;
  const confirmedDifferent = String(body.confirmDuplicate || "") === "true";
  const title = text(body.title, "Title", 120, true);
  const road = text(body.road, "Road", 120, true);
  const location = text(body.location, "Location", 160, true);
  const description = text(body.description, "Description", 2000, true);
  const severity = body.severity;
  const latitude = Math.round(Number(body.latitude) * 1e6) / 1e6;
  const longitude = Math.round(Number(body.longitude) * 1e6) / 1e6;
  if (!["Low", "Medium", "High"].includes(severity)) {
    throw new HttpError(400, "Choose a valid report severity.");
  }
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < 14.5 ||
    latitude > 15.2 ||
    longitude < 120.3 ||
    longitude > 121.2
  ) {
    throw new HttpError(400, "Enter valid GPS coordinates for Bulacan.");
  }
  const clientKey = idempotencyKey(request);
  // A retry of an upload that already filed its report (the app never got
  // the answer): send that report again.
  if (clientKey) {
    const earlier = await one("SELECT id FROM reports WHERE reporter_id = ? AND client_key = ?", [user.id, clientKey]);
    if (earlier) {
      response.json({ report: forViewer(await loadReport(earlier.id), user) });
      return;
    }
  }
  const photos = checkPhotos(request.files && request.files.photos);

  const saved = await savePhotos(photos, "evidence");
  let reportId;
  let repeated = false;
  try {
    reportId = await transaction(async function (connection) {
      // A pothole can come back after a repair, so only open reports count.
      const [nearby] = await connection.query(
        "SELECT id, title, description, severity, status, latitude, longitude, reporter_id, client_key FROM reports " +
          "WHERE status IN (?) AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ? FOR UPDATE",
        [openStatuses, latitude - nearbySpan, latitude + nearbySpan, longitude - nearbySpan, longitude + nearbySpan],
      );
      // The same upload arriving twice at once: the first copy filed it.
      const twin = clientKey
        ? nearby.find(function (row) {
            return row.client_key === clientKey && String(row.reporter_id) === user.id;
          })
        : null;
      if (twin) {
        repeated = true;
        return twin.id;
      }
      const matches = findSimilarReports(
        { title: title, description: description, severity: severity, latitude: latitude, longitude: longitude },
        nearby.map(function (row) {
          return Object.assign({}, row, { id: reportCode(row.id) });
        }),
      );
      if (matches.length && !confirmedDifferent) {
        const first = matches[0];
        throw new HttpError(
          409,
          "A possible duplicate report already exists near this location (" +
            first.report.id +
            ", about " +
            first.distance +
            " m away). Check it before adding another report.",
          { duplicateId: first.report.id, possibleDuplicates: matches.map(duplicateSummary) },
        );
      }
      const [result] = await connection.query(
        "INSERT INTO reports (title, road, location, latitude, longitude, severity, description, status, reporter_id, client_key, reported_at, updated_at) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))",
        [title, road, location, latitude, longitude, severity, description, user.id, clientKey],
      );
      // The administrator sees which reports the resident was shown.
      const duplicateNote = matches.length
        ? "Possible duplicate of " +
          matches
            .map(function (match) {
              return match.report.id + " (about " + match.distance + " m away)";
            })
            .join(", ") +
          ". The resident checked and submitted this report as a different problem."
        : null;
      await addHistory(connection, result.insertId, "submitted", "Report received from a citizen.", user, duplicateNote);
      await insertPhotos(connection, result.insertId, "evidence", saved, user);
      return result.insertId;
    });
  } catch (error) {
    await removePhotoFiles(saved);
    throw error;
  }
  if (repeated) {
    await removePhotoFiles(saved);
    response.json({ report: forViewer(await loadReport(reportId), user) });
    return;
  }

  const report = await publishReport(reportId);
  response.status(201).json({ report: forViewer(report, user) });
});

// Administrator decisions: under review, verify, reject, duplicate, resolve,
// or send back for more work. Body: { status, description?, note? }.
reportRoutes.post("/reports/:id/status", requireRole("admin"), async function (request, response) {
  const id = parseReportId(request.params.id);
  const body = request.body || {};
  const status = body.status;
  if (!Object.prototype.hasOwnProperty.call(adminTransitions, status)) {
    throw new HttpError(400, "Choose a valid report status.");
  }
  const description = text(body.description, "Description", 255, false) || defaultDescriptions[status];
  const note = text(body.note, "Note", 1000, false);
  await transaction(async function (connection) {
    const report = await lockReport(connection, id);
    if (report.status === status && status === "under_review") {
      return;
    }
    if (status === "verified" && report.status === "submitted") {
      throw new HttpError(409, "Mark " + reportCode(report.id) + " under review before verifying it.");
    }
    if (!adminTransitions[status].includes(report.status)) {
      throw stale(report);
    }
    await connection.query("UPDATE reports SET status = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?", [status, id]);
    await addHistory(connection, id, status, description, request.user, note);
  });
  const report = await publishReport(id);
  response.json({ report: forViewer(report, request.user) });
});

// Internal note (administrators only). Body: { note }.
reportRoutes.post("/reports/:id/notes", requireRole("admin"), async function (request, response) {
  const id = parseReportId(request.params.id);
  const note = text(request.body && request.body.note, "Note", 1000, true);
  const report = await one("SELECT id FROM reports WHERE id = ?", [id]);
  if (!report) {
    throw new HttpError(404, "This report is no longer available.");
  }
  await query(
    "INSERT INTO report_notes (report_id, note, actor, actor_id, created_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3))",
    [id, note, request.user.name, request.user.id],
  );
  const updated = await publishReport(id);
  response.status(201).json({ report: forViewer(updated, request.user) });
});

// The resident who filed a report rates its repair once it is resolved.
// Body: { rating (1 to 5), comment? }. One rating per report.
reportRoutes.post("/reports/:id/feedback", requireRole("citizen"), async function (request, response) {
  const id = parseReportId(request.params.id);
  const body = request.body || {};
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new HttpError(400, "Choose a rating from 1 to 5 stars.");
  }
  const comment = text(body.comment, "Comment", 500, false);
  await transaction(async function (connection) {
    const report = await lockReport(connection, id);
    if (String(report.reporter_id) !== request.user.id) {
      throw new HttpError(403, "Only the resident who filed this report can rate its repair.");
    }
    if (report.status !== "resolved") {
      throw new HttpError(409, "You can rate the repair once the report is resolved.");
    }
    const [existing] = await connection.query("SELECT id FROM report_feedback WHERE report_id = ?", [id]);
    if (existing.length) {
      throw new HttpError(409, "You already sent feedback for this repair. Thank you!");
    }
    await connection.query(
      "INSERT INTO report_feedback (report_id, user_id, rating, comment, created_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3))",
      [id, request.user.id, rating, comment || null],
    );
  });
  const report = await publishReport(id);
  response.status(201).json({ report: forViewer(report, request.user) });
});

// Assign or reassign a verified report to a crew. Body: { crewId }.
reportRoutes.post("/reports/:id/assign", requireRole("admin"), async function (request, response) {
  const id = parseReportId(request.params.id);
  const crewId = Number(request.body && request.body.crewId);
  await transaction(async function (connection) {
    const report = await lockReport(connection, id);
    if (report.status !== "verified" && report.status !== "assigned") {
      throw new HttpError(409, "Verify this report before assigning maintenance personnel.");
    }
    const [crews] = await connection.query(
      "SELECT id, name FROM users WHERE id = ? AND role = 'maintenance' AND active = 1 AND deleted_at IS NULL",
      [crewId || 0],
    );
    const crew = crews[0];
    if (!crew) {
      throw new HttpError(400, "Choose an available maintenance person.");
    }
    await connection.query(
      "UPDATE reports SET status = 'assigned', assigned_to = ?, assigned_name = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?",
      [crew.id, crew.name, id],
    );
    await addHistory(connection, id, "assigned", "Assigned to " + crew.name + ".", request.user);
  });
  const report = await publishReport(id);
  response.json({ report: forViewer(report, request.user) });
});

// The assigned crew starts the repair.
reportRoutes.post("/reports/:id/start", requireRole("maintenance"), async function (request, response) {
  const id = parseReportId(request.params.id);
  await transaction(async function (connection) {
    const report = await lockReport(connection, id);
    if (String(report.assigned_to) !== request.user.id || report.status !== "assigned") {
      throw new HttpError(409, "This job is no longer assigned to you.");
    }
    await connection.query("UPDATE reports SET status = 'in_progress', updated_at = UTC_TIMESTAMP(3) WHERE id = ?", [id]);
    await addHistory(connection, id, "in_progress", "Repair work started.", request.user);
  });
  const report = await publishReport(id);
  response.json({ report: forViewer(report, request.user) });
});

// The assigned crew submits the repair (multipart: `notes`, plus one to ten
// `after` photos). The resident's photos already show the damage, so `before`
// photos are optional; the mobile app still sends them.
reportRoutes.post(
  "/reports/:id/repair",
  requireRole("maintenance"),
  photoUpload(["before", { name: "after", maxCount: config.maxAfterPhotos }]),
  async function (request, response) {
    const id = parseReportId(request.params.id);
    const notes = text(request.body && request.body.notes, "Repair notes", 2000, true);
    const before = checkPhotos(request.files && request.files.before);
    const after = checkPhotos(request.files && request.files.after);
    if (!after.length) {
      throw new HttpError(400, "Add repair notes and at least one after-repair photo.");
    }
    const clientKey = idempotencyKey(request);
    // A retry of a repair that already went through: send the report again.
    if (clientKey) {
      const earlier = await one("SELECT id FROM reports WHERE id = ? AND assigned_to = ? AND repair_client_key = ?", [
        id,
        request.user.id,
        clientKey,
      ]);
      if (earlier) {
        response.json({ report: forViewer(await loadReport(id), request.user) });
        return;
      }
    }
    const prefix = reportCode(id);
    const savedBefore = await savePhotos(before, prefix + "-before");
    let savedAfter = [];
    let repeated = false;
    try {
      savedAfter = await savePhotos(after, prefix + "-after");
      await transaction(async function (connection) {
        const report = await lockReport(connection, id);
        // The same upload arriving twice at once: the first copy went through.
        if (clientKey && report.repair_client_key === clientKey && String(report.assigned_to) === request.user.id) {
          repeated = true;
          return;
        }
        if (String(report.assigned_to) !== request.user.id || report.status !== "in_progress") {
          throw new HttpError(409, "This repair is no longer assigned to you.");
        }
        // A resubmission replaces the earlier repair photos (the files are kept).
        await connection.query(
          "UPDATE photos SET replaced_at = UTC_TIMESTAMP(3) WHERE report_id = ? AND kind IN ('before', 'after') AND replaced_at IS NULL",
          [id],
        );
        await insertPhotos(connection, id, "before", savedBefore, request.user);
        await insertPhotos(connection, id, "after", savedAfter, request.user);
        await connection.query(
          "UPDATE reports SET status = 'repair_submitted', repair_notes = ?, repair_client_key = ?, repair_submitted_at = UTC_TIMESTAMP(3), updated_at = UTC_TIMESTAMP(3) WHERE id = ?",
          [notes, clientKey, id],
        );
        await addHistory(connection, id, "repair_submitted", "Repair submitted for admin verification.", request.user);
      });
    } catch (error) {
      await removePhotoFiles(savedBefore.concat(savedAfter));
      throw error;
    }
    if (repeated) {
      await removePhotoFiles(savedBefore.concat(savedAfter));
      response.json({ report: forViewer(await loadReport(id), request.user) });
      return;
    }
    const report = await publishReport(id);
    response.json({ report: forViewer(report, request.user) });
  },
);
