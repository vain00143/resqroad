/* ResQRoad data store, backed by Firebase (Authentication + Cloud Firestore).

   Pages keep using the same RoadWatchStore API as before. Firestore listeners
   keep an in-memory copy of the data up to date in real time, so reads stay
   synchronous: call `await RoadWatchStore.ready()` once, then getState()
   always returns the latest data. Changes are applied to the local copy
   immediately and then saved; if the server rejects a change, the listener
   restores the real data and the person sees an error message.

   Collections (see firestore.rules and README.md for the full schema):
     users/{uid}      private profile: name, email, role, active, team
     crews/{uid}      public crew directory: name, team
     reports/{RPT-n}  report, status, assignment, repair, and history
     notes/{id}       internal staff notes on reports (admins only)
     photos/{id}      resized photos as data URLs
     counters/reports next report number */

import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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
const defaultCrewPassword = "crew123";

/* ---------- Live cache ---------- */

const cache = {
  profile: null, // { uid, name, email, role, active, team }
  reports: new Map(),
  crews: new Map(),
  users: new Map(), // admins only
  notes: [], // admins only
  photos: new Map(),
};
const changeListeners = new Set();
let derived = null;
let unsubscribers = [];
let authGeneration = 0;
let resolveReady;
const readyPromise = new Promise(function (resolve) {
  resolveReady = resolve;
});
let emitScheduled = false;

function markDirty() {
  derived = null;
}

function emit() {
  markDirty();
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

function stopListeners() {
  unsubscribers.forEach(function (unsubscribe) {
    unsubscribe();
  });
  unsubscribers = [];
}

// Subscribes to a collection or document; resolves after the first snapshot
// (or the first error, so a denied listener never blocks the page).
function listen(target, apply) {
  return new Promise(function (resolve) {
    let settled = false;
    const unsubscribe = onSnapshot(
      target,
      function (snapshot) {
        apply(snapshot);
        emit();
        if (!settled) {
          settled = true;
          resolve();
        }
      },
      function (error) {
        console.error("ResQRoad live data stopped.", error);
        if (!settled) {
          settled = true;
          resolve();
        }
      },
    );
    unsubscribers.push(unsubscribe);
  });
}

function mapCollection(map, snapshot) {
  map.clear();
  snapshot.forEach(function (item) {
    map.set(item.id, Object.assign({ id: item.id }, item.data()));
  });
}

async function startListeners() {
  const waits = [
    listen(collection(db, "reports"), function (snapshot) {
      mapCollection(cache.reports, snapshot);
    }),
    listen(collection(db, "crews"), function (snapshot) {
      mapCollection(cache.crews, snapshot);
    }),
  ];
  const profile = cache.profile;
  if (profile && profile.active) {
    waits.push(
      listen(collection(db, "photos"), function (snapshot) {
        mapCollection(cache.photos, snapshot);
      }),
    );
    if (profile.role === "admin") {
      waits.push(
        listen(collection(db, "users"), function (snapshot) {
          mapCollection(cache.users, snapshot);
        }),
        listen(collection(db, "notes"), function (snapshot) {
          cache.notes = [];
          snapshot.forEach(function (item) {
            cache.notes.push(Object.assign({ id: item.id }, item.data()));
          });
        }),
      );
    }
    // Watch your own profile so a deactivated account is signed out at once.
    listen(doc(db, "users", profile.uid), function (snapshot) {
      const data = snapshot.exists() ? snapshot.data() : null;
      if (!data || data.deleted || data.active === false) {
        cache.profile = null;
        firebaseSignOut(auth).catch(function () {});
        return;
      }
      cache.profile = Object.assign({ uid: profile.uid }, data);
    });
  }
  // Don't hang forever without a connection.
  await Promise.race([
    Promise.all(waits),
    new Promise(function (resolve) {
      setTimeout(resolve, 10000);
    }),
  ]);
}

onAuthStateChanged(auth, async function (user) {
  const generation = ++authGeneration;
  stopListeners();
  cache.profile = null;
  cache.users.clear();
  cache.notes = [];
  if (user) {
    try {
      const snapshot = await getDoc(doc(db, "users", user.uid));
      const data = snapshot.exists() ? snapshot.data() : null;
      if (data && !data.deleted && data.active !== false) {
        cache.profile = Object.assign({ uid: user.uid }, data);
      }
    } catch (error) {
      console.error("Could not load the ResQRoad profile.", error);
    }
  }
  if (generation !== authGeneration) {
    return;
  }
  await startListeners();
  if (generation !== authGeneration) {
    return;
  }
  resolveReady();
  emit();
});

function ready() {
  return readyPromise;
}

/* ---------- Derived state for pages ---------- */

function resolvePhotos(list) {
  return (list || []).map(function (photo) {
    if (photo && typeof photo === "object" && photo.photoId) {
      const stored = cache.photos.get(photo.photoId);
      return stored && stored.src ? { name: photo.name, src: stored.src } : photo.name;
    }
    return photo;
  });
}

function citizenName(reporterId) {
  if (!reporterId) {
    return "Resident";
  }
  const user = cache.users.get(reporterId);
  if (user) {
    return user.name;
  }
  if (cache.profile && cache.profile.uid === reporterId) {
    return cache.profile.name;
  }
  return "Resident";
}

function buildState() {
  const notesByReport = new Map();
  cache.notes.forEach(function (note) {
    if (!notesByReport.has(note.reportId)) {
      notesByReport.set(note.reportId, []);
    }
    notesByReport.get(note.reportId).push({
      status: "note",
      description: "Added an internal note.",
      actor: note.actor,
      at: note.at,
      note: note.note,
    });
  });

  const reports = Array.from(cache.reports.values())
    .map(function (raw) {
      const history = (raw.history || []).concat(notesByReport.get(raw.id) || []);
      history.sort(function (first, second) {
        return Date.parse(first.at) - Date.parse(second.at);
      });
      return Object.assign({}, raw, {
        reporter: citizenName(raw.reporterId),
        evidencePhotos: resolvePhotos(raw.evidencePhotos),
        repair: raw.repair
          ? Object.assign({}, raw.repair, {
              beforePhotos: resolvePhotos(raw.repair.beforePhotos),
              afterPhotos: resolvePhotos(raw.repair.afterPhotos),
            })
          : null,
        history: history,
      });
    })
    .sort(function (first, second) {
      return Date.parse(second.reportedAt) - Date.parse(first.reportedAt);
    });

  const personnel = Array.from(cache.crews.values())
    .map(function (crew) {
      const user = cache.users.get(crew.id);
      return {
        id: crew.id,
        name: crew.name,
        team: crew.team,
        email: user ? user.email : crew.id === (cache.profile && cache.profile.uid) ? cache.profile.email : "",
        createdAt: user ? user.createdAt : null,
      };
    })
    .sort(function (first, second) {
      return first.team.localeCompare(second.team);
    });

  let citizens;
  if (cache.profile && cache.profile.role === "admin") {
    citizens = Array.from(cache.users.values())
      .filter(function (user) {
        return user.role === "citizen";
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
        id: cache.profile.uid,
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

const authMessages = {
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/invalid-login-credentials": "Incorrect email or password.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/user-not-found": "Incorrect email or password.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
  "auth/network-request-failed": "Can't reach the server. Check your internet connection.",
  "auth/email-already-in-use": "An account already uses this email.",
  "auth/weak-password": "Use at least 8 characters with a letter and a number.",
  "auth/operation-not-allowed": "Email sign-in isn't enabled for this project yet.",
};

function friendlyError(error) {
  if (error && authMessages[error.code]) {
    return new Error(authMessages[error.code]);
  }
  if (error && error.code === "permission-denied") {
    return new Error("You don't have permission to do that. Sign in again and retry.");
  }
  if (error && error.code === "unavailable") {
    return new Error("Can't reach the database. Check your internet connection.");
  }
  return error instanceof Error ? error : new Error("Something went wrong. Try again.");
}

// Saves in the background; the live listener restores the real data if the
// save is rejected, and the person is told what happened.
function persist(promise) {
  return promise.then(
    function () {
      return true;
    },
    function (error) {
      console.error("Could not save the ResQRoad change.", error);
      const message = friendlyError(error).message;
      if (window.RoadWatchUI) {
        window.RoadWatchUI.showMessage(message, "error");
      }
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

// Applies `fields` to the cached report right away, then saves them.
function saveReport(report, fields) {
  report.updatedAt = now();
  emit();
  const data = { updatedAt: report.updatedAt };
  fields.forEach(function (field) {
    data[field] = report[field] === undefined ? null : report[field];
  });
  return persist(updateDoc(doc(db, "reports", report.id), data));
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function photoRefs(photos, reportId, kind) {
  const uploads = [];
  const refs = (photos || []).map(function (photo) {
    if (photo && typeof photo === "object" && photo.src) {
      const ref = doc(collection(db, "photos"));
      const record = {
        reportId: reportId,
        kind: kind,
        name: photo.name,
        src: photo.src,
        uploadedBy: cache.profile.uid,
        createdAt: now(),
      };
      cache.photos.set(ref.id, Object.assign({ id: ref.id }, record));
      uploads.push([ref, record]);
      return { name: photo.name, photoId: ref.id };
    }
    return typeof photo === "string" ? photo : photo.name;
  });
  return { refs: refs, uploads: uploads };
}

async function uploadPhotos(uploads) {
  // Each photo is its own document (under 1 MB); batches keep requests small.
  for (let index = 0; index < uploads.length; index += 4) {
    const batch = writeBatch(db);
    uploads.slice(index, index + 4).forEach(function (item) {
      batch.set(item[0], item[1]);
    });
    await batch.commit();
  }
}

/* ---------- Report workflow ---------- */

function setStatus(reportId, status, description, actor, note) {
  if (!Object.prototype.hasOwnProperty.call(statuses, status)) {
    throw new Error("Choose a valid report status.");
  }
  requireRole(["admin"]);
  const report = rawReport(reportId);
  report.status = status;
  report.history = (report.history || []).concat([
    historyEntry(status, description, actorName(actor), note ? String(note).trim() : ""),
  ]);
  saveReport(report, ["status", "history"]);
  return report;
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
  rawReport(reportId);
  const ref = doc(collection(db, "notes"));
  const record = { reportId: reportId, note: note, actor: actorName(actor), at: now() };
  cache.notes.push(Object.assign({ id: ref.id }, record));
  emit();
  persist(setDoc(ref, record));
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
  report.assignedTo = personnelId;
  report.assignedName = crew.name;
  report.status = "assigned";
  report.history = (report.history || []).concat([
    historyEntry("assigned", "Assigned to " + crew.name + ".", "Administrator"),
  ]);
  saveReport(report, ["assignedTo", "assignedName", "status", "history"]);
  return report;
}

function startRepair(reportId, personnelId) {
  requireRole(["maintenance"]);
  const report = rawReport(reportId);
  if (report.assignedTo !== personnelId || report.status !== "assigned") {
    throw new Error("This job is no longer assigned to you.");
  }
  report.status = "in_progress";
  report.history = (report.history || []).concat([historyEntry("in_progress", "Repair work started.", actorName())]);
  saveReport(report, ["status", "history"]);
  return report;
}

async function submitRepair(reportId, personnelId, repair) {
  requireRole(["maintenance"]);
  const report = rawReport(reportId);
  if (report.assignedTo !== personnelId || report.status !== "in_progress") {
    throw new Error("This repair is no longer assigned to you.");
  }
  const before = photoRefs(repair.beforePhotos, reportId, "before");
  const after = photoRefs(repair.afterPhotos, reportId, "after");
  try {
    await uploadPhotos(before.uploads.concat(after.uploads));
  } catch (error) {
    throw friendlyError(error);
  }
  report.status = "repair_submitted";
  report.repair = {
    notes: String(repair.notes || "").trim(),
    beforePhotos: before.refs,
    afterPhotos: after.refs,
    submittedAt: now(),
  };
  report.history = (report.history || []).concat([
    historyEntry("repair_submitted", "Repair submitted for admin verification.", actorName()),
  ]);
  const saved = await saveReport(report, ["status", "repair", "history"]);
  if (!saved) {
    throw new Error("The repair couldn't be submitted. Try again.");
  }
  return report;
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

  // A pothole can come back after a repair, so only open reports count.
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

  const counterRef = doc(db, "counters", "reports");
  const base = {
    title: title,
    road: road,
    location: location,
    coordinates: { lat: Math.round(latitude * 1e6) / 1e6, lng: Math.round(longitude * 1e6) / 1e6 },
    severity: severity,
    description: description,
    reporterId: cache.profile.uid,
    reportedAt: now(),
    evidencePhotos: [],
    status: "submitted",
    assignedTo: null,
    assignedName: null,
    repair: null,
    history: [historyEntry("submitted", "Report received from a citizen.", cache.profile.name)],
  };

  let reportId;
  try {
    reportId = await runTransaction(db, async function (transaction) {
      const counter = await transaction.get(counterRef);
      const next = (counter.exists() ? counter.data().next : 1000) + 1;
      const id = "RPT-" + next;
      transaction.update(counterRef, { next: next });
      transaction.set(doc(db, "reports", id), Object.assign({ id: id }, base));
      return id;
    });
  } catch (error) {
    throw friendlyError(error);
  }

  const evidence = photoRefs(photos, reportId, "evidence");
  let photosSaved = true;
  try {
    await uploadPhotos(evidence.uploads);
    if (evidence.refs.length) {
      await updateDoc(doc(db, "reports", reportId), { evidencePhotos: evidence.refs });
    }
  } catch (error) {
    console.error("Could not upload the report photos.", error);
    photosSaved = false;
  }

  const report = Object.assign({ id: reportId }, base, { evidencePhotos: evidence.refs });
  cache.reports.set(reportId, report);
  emit();
  const result = getReport(reportId) || report;
  if (!photosSaved) {
    result.photosTrimmed = true;
  }
  return result;
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
  let credential;
  try {
    credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: name });
  } catch (error) {
    if (error.code === "auth/email-already-in-use") {
      throw new Error("An account already uses this email. Sign in instead.");
    }
    throw friendlyError(error);
  }
  const profile = { name: name, email: email, role: "citizen", active: true, createdAt: now() };
  try {
    await setDoc(doc(db, "users", credential.user.uid), profile);
  } catch (error) {
    throw friendlyError(error);
  }
  return Object.assign({ id: credential.user.uid }, profile);
}

async function addPersonnel(input) {
  requireRole(["admin"]);
  const name = String(input.name || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const team = String(input.team || "").trim();
  if (!name || !email || !team) {
    throw new Error("Enter a name, email, and maintenance team.");
  }
  if (!isEmail(email)) {
    throw new Error("Enter a valid email address.");
  }

  // A second Firebase app creates the account without signing the admin out.
  const provisioning = initializeApp(firebaseConfig, "provisioning-" + Date.now());
  const provisioningAuth = getAuth(provisioning);
  let uid;
  try {
    const credential = await createUserWithEmailAndPassword(provisioningAuth, email, defaultCrewPassword);
    await updateProfile(credential.user, { displayName: name });
    uid = credential.user.uid;
  } catch (error) {
    throw friendlyError(error);
  } finally {
    await firebaseSignOut(provisioningAuth).catch(function () {});
    await deleteApp(provisioning).catch(function () {});
  }

  const createdAt = now();
  const batch = writeBatch(db);
  batch.set(doc(db, "users", uid), { name: name, email: email, team: team, role: "maintenance", active: true, createdAt: createdAt });
  batch.set(doc(db, "crews", uid), { name: name, team: team });
  try {
    await batch.commit();
  } catch (error) {
    throw friendlyError(error);
  }
  return { id: uid, name: name, email: email, team: team, createdAt: createdAt };
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
  // The sign-in account stays in Firebase Authentication, but without an
  // active profile it can no longer open any workspace.
  const batch = writeBatch(db);
  batch.update(doc(db, "users", personnelId), { active: false, deleted: true, deletedAt: now() });
  batch.delete(doc(db, "crews", personnelId));
  cache.reports.forEach(function (report) {
    if (report.assignedTo === personnelId) {
      report.assignedName = crew.name;
      batch.update(doc(db, "reports", report.id), { assignedName: crew.name });
    }
  });
  try {
    await batch.commit();
  } catch (error) {
    throw friendlyError(error);
  }
  return Object.assign({ id: personnelId }, crew);
}

function setCitizenActive(citizenId, active) {
  requireRole(["admin"]);
  const user = cache.users.get(citizenId);
  if (!user || user.role !== "citizen") {
    throw new Error("This citizen account is no longer available.");
  }
  user.active = Boolean(active);
  emit();
  persist(updateDoc(doc(db, "users", citizenId), { active: user.active }));
  return { id: citizenId, name: user.name, email: user.email, active: user.active };
}

/* ---------- Queries ---------- */

function reporterName(report) {
  return citizenName(report.reporterId);
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
  let credential;
  try {
    credential = await signInWithEmailAndPassword(auth, normalized, password);
  } catch (error) {
    throw friendlyError(error);
  }
  const snapshot = await getDoc(doc(db, "users", credential.user.uid)).catch(function () {
    return null;
  });
  const data = snapshot && snapshot.exists() ? snapshot.data() : null;
  if (!data || data.deleted) {
    await firebaseSignOut(auth);
    throw new Error("This account is no longer active. Contact the Road Maintenance Office.");
  }
  if (data.active === false) {
    await firebaseSignOut(auth);
    throw new Error("This account has been deactivated. Contact the Road Maintenance Office to reactivate it.");
  }
  return toUser(Object.assign({ uid: credential.user.uid }, data));
}

function toUser(profile) {
  return profile
    ? { role: profile.role, userId: profile.uid, name: profile.name, team: profile.team || "", email: profile.email }
    : null;
}

function currentUser() {
  return toUser(cache.profile);
}

function signOut() {
  return firebaseSignOut(auth);
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
