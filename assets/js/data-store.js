/* ResQRoad data store, backed by the ResQRoad server (MySQL database, JSON
   API under /api, live updates over a WebSocket).

   Pages keep using the same RoadWatchStore API as before. The store keeps an
   in-memory copy of the data that the server keeps up to date in real time,
   on every device, so reads stay synchronous: call `await
   RoadWatchStore.ready()` once, then getState() always returns the latest
   data. Most changes are applied to the local copy immediately and then
   saved; if the server rejects a change, the real data is restored and the
   person sees an error message.

   The server decides what each account may see and do (see server/ and
   README.md for the database schema and the API). */

const openStatuses = ["submitted", "under_review", "verified", "assigned", "in_progress", "repair_submitted"];
const closedStatuses = ["resolved", "rejected", "duplicate"];
const crewOpenStatuses = ["assigned", "in_progress", "repair_submitted"];
const statuses = {
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

/* ---------- Server requests ---------- */

const apiBase = "/api/";

async function api(path, options) {
  const settings = options || {};
  const init = { method: settings.method || "GET", credentials: "same-origin", headers: {} };
  if (settings.json !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(settings.json);
  } else if (settings.form) {
    init.body = settings.form;
  }
  let response;
  try {
    response = await fetch(apiBase + path, init);
  } catch (error) {
    throw new Error("Can't reach the ResQRoad server. Check your internet connection.");
  }
  let body = null;
  try {
    body = await response.json();
  } catch (error) {
    body = null;
  }
  if (!response.ok) {
    const failure = new Error((body && body.error) || "Something went wrong. Try again.");
    failure.status = response.status;
    if (body && body.duplicateId) {
      failure.duplicateId = body.duplicateId;
    }
    throw failure;
  }
  return body || {};
}

/* ---------- Live cache ---------- */

const cache = {
  profile: null, // { id, name, email, role, active, team, createdAt }
  reports: new Map(),
  crews: new Map(),
  users: new Map(), // admins only
};
const changeListeners = new Set();
let derived = null;
let resolveReady;
const readyPromise = new Promise(function (resolve) {
  resolveReady = resolve;
});
let emitScheduled = false;

function emit() {
  derived = null;
  if (emitScheduled) {
    return;
  }
  emitScheduled = true;
  queueMicrotask(function () {
    emitScheduled = false;
    changeListeners.forEach(function (listener) {
      try {
        listener();
      } catch (error) {
        console.error("A ResQRoad change listener failed.", error);
      }
    });
  });
}

function setMap(map, list) {
  map.clear();
  (list || []).forEach(function (item) {
    map.set(item.id, item);
  });
}

// Keeps the newest copy of a report. `force` is for the server's answer to
// this page's own change.
function putReport(report, force) {
  const current = cache.reports.get(report.id);
  if (!force && current && current.updatedAt && report.updatedAt && Date.parse(current.updatedAt) > Date.parse(report.updatedAt)) {
    return;
  }
  cache.reports.set(report.id, report);
}

function applyAccounts(message) {
  setMap(cache.crews, message.crews);
  if (message.users) {
    setMap(cache.users, message.users);
  }
}

let lastLoad = 0;

async function loadState() {
  lastLoad = Date.now();
  const state = await api("state");
  const previous = cache.reports;
  cache.profile = state.user || null;
  cache.reports = new Map();
  (state.reports || []).forEach(function (report) {
    const current = previous.get(report.id);
    const keepCurrent = current && Date.parse(current.updatedAt) > Date.parse(report.updatedAt);
    cache.reports.set(report.id, keepCurrent ? current : report);
  });
  setMap(cache.crews, state.crews);
  setMap(cache.users, state.users || []);
  emit();
}

function resync() {
  return loadState().catch(function (error) {
    console.error("Could not refresh ResQRoad data.", error);
  });
}

/* ---------- Live updates (WebSocket) ---------- */

let socket = null;
let connectedOnce = false;
let retryDelay = 1000;
let retryTimer = null;
let firstHello = null;

function liveUrl() {
  return (window.location.protocol === "https:" ? "wss://" : "ws://") + window.location.host + apiBase + "live";
}

function onLiveMessage(event) {
  let message;
  try {
    message = JSON.parse(event.data);
  } catch (error) {
    return;
  }
  if (message.type === "hello") {
    retryDelay = 1000;
    if (firstHello) {
      firstHello();
      firstHello = null;
    } else {
      // Reconnected: catch up on anything missed while offline.
      resync();
    }
    connectedOnce = true;
  } else if (message.type === "report" && message.report) {
    putReport(message.report);
    emit();
  } else if (message.type === "accounts") {
    applyAccounts(message);
    emit();
  } else if (message.type === "signed-out") {
    // Signed out on this device or another one, or the account was
    // deactivated: reload as a visitor (protected pages then redirect).
    cache.profile = null;
    cache.users.clear();
    resync();
  }
}

function scheduleReconnect() {
  if (retryTimer) {
    return;
  }
  retryTimer = window.setTimeout(function () {
    retryTimer = null;
    connectLive();
  }, retryDelay);
  retryDelay = Math.min(retryDelay * 2, 15000);
  // Still refresh now and then if live updates can't connect at all.
  if (connectedOnce && Date.now() - lastLoad > 20000) {
    resync();
  }
}

function connectLive() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }
  try {
    socket = new WebSocket(liveUrl());
  } catch (error) {
    scheduleReconnect();
    return;
  }
  socket.addEventListener("message", onLiveMessage);
  socket.addEventListener("close", function () {
    socket = null;
    if (firstHello) {
      firstHello();
      firstHello = null;
    }
    scheduleReconnect();
  });
}

function reconnectNow() {
  if (!socket) {
    window.clearTimeout(retryTimer);
    retryTimer = null;
    retryDelay = 1000;
    connectLive();
  }
}

document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible") {
    reconnectNow();
  }
});
window.addEventListener("online", reconnectNow);

// Connect first, then load, so no change can slip in between.
async function start() {
  await new Promise(function (resolve) {
    firstHello = resolve;
    window.setTimeout(resolve, 2500);
    connectLive();
  });
  firstHello = null;
  try {
    await loadState();
  } catch (error) {
    console.error("Could not load ResQRoad data.", error);
    document.addEventListener("DOMContentLoaded", function () {
      if (window.RoadWatchUI) {
        window.RoadWatchUI.showMessage(error.message, "error");
      }
    });
    if (window.RoadWatchUI && document.readyState !== "loading") {
      window.RoadWatchUI.showMessage(error.message, "error");
    }
  }
  resolveReady();
}

start();

function ready() {
  return readyPromise;
}

/* ---------- Derived state for pages ---------- */

function citizenName(reporterId) {
  if (!reporterId) {
    return "Resident";
  }
  const user = cache.users.get(reporterId);
  if (user) {
    return user.name;
  }
  if (cache.profile && cache.profile.id === reporterId) {
    return cache.profile.name;
  }
  return "Resident";
}

function buildState() {
  const reports = Array.from(cache.reports.values())
    .map(function (raw) {
      const notes = (raw.notes || []).map(function (note) {
        return { status: "note", description: "Added an internal note.", actor: note.actor, at: note.at, note: note.note };
      });
      const history = (raw.history || []).concat(notes);
      history.sort(function (first, second) {
        return Date.parse(first.at) - Date.parse(second.at);
      });
      const report = Object.assign({}, raw, {
        reporter: raw.reporter || citizenName(raw.reporterId),
        history: history,
      });
      delete report.notes;
      return report;
    })
    .sort(function (first, second) {
      return Date.parse(second.reportedAt) - Date.parse(first.reportedAt);
    });

  const personnel = Array.from(cache.crews.values())
    .map(function (crew) {
      const user = cache.users.get(crew.id);
      const own = cache.profile && cache.profile.id === crew.id ? cache.profile : null;
      return {
        id: crew.id,
        name: crew.name,
        team: crew.team,
        email: user ? user.email : own ? own.email : "",
        createdAt: user ? user.createdAt : own ? own.createdAt : null,
      };
    })
    .sort(function (first, second) {
      return first.team.localeCompare(second.team);
    });

  let citizens;
  if (cache.profile && cache.profile.role === "admin") {
    citizens = Array.from(cache.users.values())
      .filter(function (user) {
        return user.role === "citizen" && !user.deleted;
      })
      .map(function (user) {
        return { id: user.id, name: user.name, email: user.email, active: user.active !== false, createdAt: user.createdAt };
      })
      .sort(function (first, second) {
        return first.name.localeCompare(second.name);
      });
  } else if (cache.profile && cache.profile.role === "citizen") {
    citizens = [
      {
        id: cache.profile.id,
        name: cache.profile.name,
        email: cache.profile.email,
        active: cache.profile.active !== false,
        createdAt: cache.profile.createdAt,
      },
    ];
  } else {
    citizens = [];
  }

  return { reports: reports, personnel: personnel, citizens: citizens };
}

function getState() {
  if (!derived) {
    derived = buildState();
  }
  return derived;
}

function getReport(reportId) {
  const normalized = String(reportId || "").trim().toUpperCase();
  return (
    getState().reports.find(function (report) {
      return report.id === normalized;
    }) || null
  );
}

/* ---------- Helpers for changes ---------- */

function showError(message) {
  if (window.RoadWatchUI) {
    window.RoadWatchUI.showMessage(message, "error");
  }
}

// Fetches the real copy of a report (after a rejected change).
function restoreReport(reportId) {
  return api("reports/" + encodeURIComponent(reportId))
    .then(function (body) {
      putReport(body.report, true);
      emit();
    })
    .catch(function () {
      return resync();
    });
}

// Saves a report change in the background; the server's copy replaces the
// local one, or the real data comes back if the change was rejected.
function saveReportChange(reportId, request) {
  return request.then(
    function (body) {
      putReport(body.report, true);
      emit();
      return true;
    },
    function (error) {
      console.error("Could not save the ResQRoad change.", error);
      showError(error.message);
      restoreReport(reportId);
      return false;
    },
  );
}

function now() {
  return new Date().toISOString();
}

function actorName(fallback) {
  return (cache.profile && cache.profile.name) || fallback || "ResQRoad";
}

function requireRole(roles) {
  if (!cache.profile) {
    throw new Error("Your session has ended. Sign in again to continue.");
  }
  if (!roles.includes(cache.profile.role)) {
    throw new Error("Your account doesn't have permission to do that.");
  }
}

function rawReport(reportId) {
  const report = cache.reports.get(reportId);
  if (!report) {
    throw new Error("This report is no longer available.");
  }
  return report;
}

function historyEntry(status, description, actor, note) {
  const entry = { status: status, description: description, actor: actor, at: now() };
  if (note) {
    entry.note = note;
  }
  return entry;
}

// Shows a change right away (until the server's copy arrives).
function applyLocally(report, fields, entry) {
  const updated = Object.assign({}, report, fields);
  if (entry) {
    updated.history = (report.history || []).concat([entry]);
  }
  cache.reports.set(report.id, updated);
  emit();
  return updated;
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

// Photos chosen on the page are resized data URLs; upload them as files.
async function appendPhotos(form, field, photos) {
  for (const photo of photos || []) {
    if (photo && typeof photo === "object" && photo.src) {
      const blob = await (await fetch(photo.src)).blob();
      form.append(field, blob, photo.name || "photo.jpg");
    }
  }
}

/* ---------- Report workflow ---------- */

function setStatus(reportId, status, description, actor, note) {
  if (!Object.prototype.hasOwnProperty.call(statuses, status)) {
    throw new Error("Choose a valid report status.");
  }
  requireRole(["admin"]);
  const report = rawReport(reportId);
  const cleanNote = note ? String(note).trim() : "";
  const updated = applyLocally(report, { status: status }, historyEntry(status, description, actorName(actor), cleanNote));
  saveReportChange(
    reportId,
    api("reports/" + reportId + "/status", {
      method: "POST",
      json: { status: status, description: description, note: cleanNote },
    }),
  );
  return updated;
}

function addNote(reportId, text, actor) {
  const note = String(text || "").trim();
  if (!note) {
    throw new Error("Write a note before saving it.");
  }
  if (note.length > 1000) {
    throw new Error("Keep notes under 1,000 characters.");
  }
  requireRole(["admin"]);
  const report = rawReport(reportId);
  const record = { reportId: reportId, note: note, actor: actorName(actor), at: now() };
  applyLocally(report, { notes: (report.notes || []).concat([{ id: "pending", note: note, actor: record.actor, at: record.at }]) });
  saveReportChange(reportId, api("reports/" + reportId + "/notes", { method: "POST", json: { note: note } }));
  return record;
}

function assignReport(reportId, personnelId) {
  requireRole(["admin"]);
  const report = rawReport(reportId);
  if (report.status !== "verified" && report.status !== "assigned") {
    throw new Error("Verify this report before assigning maintenance personnel.");
  }
  const crew = cache.crews.get(personnelId);
  if (!crew) {
    throw new Error("Choose an available maintenance person.");
  }
  const updated = applyLocally(
    report,
    { assignedTo: personnelId, assignedName: crew.name, status: "assigned" },
    historyEntry("assigned", "Assigned to " + crew.name + ".", actorName()),
  );
  saveReportChange(reportId, api("reports/" + reportId + "/assign", { method: "POST", json: { crewId: personnelId } }));
  return updated;
}

function startRepair(reportId, personnelId) {
  requireRole(["maintenance"]);
  const report = rawReport(reportId);
  if (report.assignedTo !== personnelId || report.status !== "assigned") {
    throw new Error("This job is no longer assigned to you.");
  }
  const updated = applyLocally(report, { status: "in_progress" }, historyEntry("in_progress", "Repair work started.", actorName()));
  saveReportChange(reportId, api("reports/" + reportId + "/start", { method: "POST" }));
  return updated;
}

async function submitRepair(reportId, personnelId, repair) {
  requireRole(["maintenance"]);
  const report = rawReport(reportId);
  if (report.assignedTo !== personnelId || report.status !== "in_progress") {
    throw new Error("This repair is no longer assigned to you.");
  }
  const form = new FormData();
  form.append("notes", String(repair.notes || "").trim());
  await appendPhotos(form, "before", repair.beforePhotos);
  await appendPhotos(form, "after", repair.afterPhotos);
  const body = await api("reports/" + reportId + "/repair", { method: "POST", form: form });
  putReport(body.report, true);
  emit();
  return getReport(reportId) || body.report;
}

async function addReport(input) {
  requireRole(["citizen"]);
  if (cache.profile.active === false) {
    throw new Error("Your account has been deactivated. Contact the Road Maintenance Office to reactivate it.");
  }
  const title = String(input.title || "").trim();
  const road = String(input.road || "").trim();
  const location = String(input.location || "").trim();
  const description = String(input.description || "").trim();
  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  const severity = input.severity;
  const photos = input.evidencePhotos || [];

  if (!title || !road || !location || !description) {
    throw new Error("Complete all required report fields before submitting.");
  }
  if (!["Low", "Medium", "High"].includes(severity)) {
    throw new Error("Choose a valid report severity.");
  }
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < 14.5 ||
    latitude > 15.2 ||
    longitude < 120.3 ||
    longitude > 121.2
  ) {
    throw new Error("Enter valid GPS coordinates for Bulacan.");
  }
  if (photos.length > 5) {
    throw new Error("Choose no more than five evidence photos.");
  }

  // Quick check against the reports already on screen; the server checks
  // again when the report is saved.
  const duplicate = Array.from(cache.reports.values()).find(function (report) {
    return (
      openStatuses.includes(report.status) &&
      Math.abs(report.coordinates.lat - latitude) < 0.001 &&
      Math.abs(report.coordinates.lng - longitude) < 0.001
    );
  });
  if (duplicate) {
    const error = new Error(
      "A report already exists very close to this location (" + duplicate.id + "). Check the map before adding another report.",
    );
    error.duplicateId = duplicate.id;
    throw error;
  }

  const form = new FormData();
  form.append("title", title);
  form.append("road", road);
  form.append("location", location);
  form.append("description", description);
  form.append("severity", severity);
  form.append("latitude", String(latitude));
  form.append("longitude", String(longitude));
  await appendPhotos(form, "photos", photos);
  const body = await api("reports", { method: "POST", form: form });
  putReport(body.report, true);
  emit();
  return getReport(body.report.id) || body.report;
}

/* ---------- Accounts ---------- */

async function registerCitizen(input) {
  const name = String(input.name || "").trim().replace(/\s+/g, " ");
  const email = String(input.email || "").trim().toLowerCase();
  const password = String(input.password || "");
  if (name.length < 2) {
    throw new Error("Enter your full name.");
  }
  if (name.length > 80) {
    throw new Error("Keep your name under 80 characters.");
  }
  if (!isEmail(email)) {
    throw new Error("Enter a valid email address.");
  }
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error("Use at least 8 characters with a letter and a number.");
  }
  const body = await api("auth/register", { method: "POST", json: { name: name, email: email, password: password } });
  cache.profile = body.user;
  emit();
  return body.user;
}

async function addPersonnel(input) {
  requireRole(["admin"]);
  const name = String(input.name || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const team = String(input.team || "").trim();
  const password = String(input.password || "");
  if (!name || !email || !team) {
    throw new Error("Enter a name, email, and maintenance team.");
  }
  if (!isEmail(email)) {
    throw new Error("Enter a valid email address.");
  }
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error("Use a temporary password of at least 8 characters with a letter and a number.");
  }
  const body = await api("users", { method: "POST", json: { name: name, email: email, team: team, password: password } });
  const user = body.user;
  cache.users.set(user.id, Object.assign({ deleted: false }, user));
  cache.crews.set(user.id, { id: user.id, name: user.name, team: user.team });
  emit();
  return { id: user.id, name: user.name, email: user.email, team: user.team, createdAt: user.createdAt };
}

async function deletePersonnel(personnelId) {
  requireRole(["admin"]);
  const crew = cache.crews.get(personnelId);
  if (!crew) {
    throw new Error("This maintenance account is no longer available.");
  }
  const hasOpenAssignments = Array.from(cache.reports.values()).some(function (report) {
    return report.assignedTo === personnelId && crewOpenStatuses.includes(report.status);
  });
  if (hasOpenAssignments) {
    throw new Error("Reassign or finish this person's open jobs before deleting the account.");
  }
  await api("users/" + encodeURIComponent(personnelId), { method: "DELETE" });
  cache.crews.delete(personnelId);
  const user = cache.users.get(personnelId);
  if (user) {
    cache.users.set(personnelId, Object.assign({}, user, { active: false, deleted: true }));
  }
  emit();
  return Object.assign({ id: personnelId }, crew);
}

function setCitizenActive(citizenId, active) {
  requireRole(["admin"]);
  const user = cache.users.get(citizenId);
  if (!user || user.role !== "citizen") {
    throw new Error("This citizen account is no longer available.");
  }
  const previous = user.active;
  const updated = Object.assign({}, user, { active: Boolean(active) });
  cache.users.set(citizenId, updated);
  emit();
  api("users/" + encodeURIComponent(citizenId), { method: "PATCH", json: { active: updated.active } }).catch(function (error) {
    showError(error.message);
    const current = cache.users.get(citizenId);
    if (current) {
      cache.users.set(citizenId, Object.assign({}, current, { active: previous }));
      emit();
    }
  });
  return { id: citizenId, name: user.name, email: user.email, active: updated.active };
}

/* ---------- Queries ---------- */

function reporterName(report) {
  return report.reporter || citizenName(report.reporterId);
}

function reportsByCitizen(citizen, state) {
  return (state || getState()).reports.filter(function (report) {
    return report.reporterId === citizen.id;
  });
}

function onExternalChange(callback) {
  changeListeners.add(callback);
}

/* ---------- Sign-in ---------- */

async function signIn(email, password) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized || !password) {
    throw new Error("Enter your email and password.");
  }
  const body = await api("auth/login", { method: "POST", json: { email: normalized, password: password } });
  cache.profile = body.user;
  emit();
  return toUser(body.user);
}

function toUser(profile) {
  return profile
    ? { role: profile.role, userId: profile.id, name: profile.name, team: profile.team || "", email: profile.email }
    : null;
}

function currentUser() {
  return toUser(cache.profile);
}

async function signOut() {
  try {
    await api("auth/logout", { method: "POST" });
  } finally {
    cache.profile = null;
    cache.users.clear();
  }
}

window.RoadWatchStore = {
  ready: ready,
  getState: getState,
  getReport: getReport,
  statuses: statuses,
  openStatuses: openStatuses,
  closedStatuses: closedStatuses,
  crewOpenStatuses: crewOpenStatuses,
  setStatus: setStatus,
  addNote: addNote,
  addReport: addReport,
  addPersonnel: addPersonnel,
  deletePersonnel: deletePersonnel,
  registerCitizen: registerCitizen,
  setCitizenActive: setCitizenActive,
  assignReport: assignReport,
  startRepair: startRepair,
  submitRepair: submitRepair,
  reporterName: reporterName,
  reportsByCitizen: reportsByCitizen,
  onExternalChange: onExternalChange,
};

window.RoadWatchBackend = {
  signIn: signIn,
  signOut: signOut,
  currentUser: currentUser,
};
