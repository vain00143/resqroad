// Creates the ResQRoad demo accounts and sample reports in Firebase.
//
//   npm run seed            create missing accounts; add sample reports only
//                           if the database has none yet
//   npm run seed -- --reset also delete every report, note, and photo, then
//                           reload the sample reports (accounts are kept)
//
// Runs as the administrator, so the first run on a brand-new project needs
// the bootstrap rules (see README.md, "Setting up a new Firebase project").

import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, signOut } from "firebase/auth";
import { getFirestore, collection, doc, getDoc, getDocs, writeBatch } from "firebase/firestore";
import { firebaseConfig } from "../assets/js/firebase-config.js";
import { accounts, sampleReports, daysAgo } from "./seed-data.js";

const reset = process.argv.includes("--reset");
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function ensureAccount(email, password, name) {
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: name });
    console.log("  created  " + email);
    return credential.user.uid;
  } catch (error) {
    if (error.code !== "auth/email-already-in-use") {
      throw error;
    }
    const credential = await signInWithEmailAndPassword(auth, email, password);
    console.log("  exists   " + email);
    return credential.user.uid;
  } finally {
    await signOut(auth);
  }
}

async function deleteAll(name) {
  const snapshot = await getDocs(collection(db, name));
  let batch = writeBatch(db);
  let count = 0;
  for (const item of snapshot.docs) {
    batch.delete(item.ref);
    count += 1;
    if (count % 400 === 0) {
      await batch.commit();
      batch = writeBatch(db);
    }
  }
  await batch.commit();
  console.log("  cleared  " + name + " (" + count + ")");
}

async function main() {
  console.log("Accounts");
  const uids = { citizens: {}, crews: {} };
  uids.admin = await ensureAccount(accounts.admin.email, accounts.admin.password, accounts.admin.name);
  for (const crew of accounts.crews) {
    uids.crews[crew.key] = await ensureAccount(crew.email, accounts.crewPassword, crew.name);
  }
  for (const citizen of accounts.citizens) {
    uids.citizens[citizen.email] = await ensureAccount(citizen.email, accounts.citizenPassword, citizen.name);
  }

  await signInWithEmailAndPassword(auth, accounts.admin.email, accounts.admin.password);

  console.log("Profiles");
  const profiles = writeBatch(db);
  profiles.set(doc(db, "users", uids.admin), {
    name: accounts.admin.name,
    email: accounts.admin.email,
    role: "admin",
    active: true,
    createdAt: daysAgo(300),
  });
  for (const crew of accounts.crews) {
    profiles.set(doc(db, "users", uids.crews[crew.key]), {
      name: crew.name,
      email: crew.email,
      team: crew.team,
      role: "maintenance",
      active: true,
      createdAt: daysAgo(290),
    });
    profiles.set(doc(db, "crews", uids.crews[crew.key]), { name: crew.name, team: crew.team });
  }
  for (const citizen of accounts.citizens) {
    profiles.set(doc(db, "users", uids.citizens[citizen.email]), {
      name: citizen.name,
      email: citizen.email,
      role: "citizen",
      active: citizen.active,
      createdAt: daysAgo(citizen.joinedDaysAgo),
    });
  }
  await profiles.commit();
  console.log("  saved    " + (1 + accounts.crews.length * 2 + accounts.citizens.length) + " documents");

  console.log("Reports");
  if (reset) {
    await deleteAll("reports");
    await deleteAll("notes");
    await deleteAll("photos");
  } else {
    const existing = await getDocs(collection(db, "reports"));
    if (!existing.empty) {
      console.log("  skipped  " + existing.size + " reports already exist (use --reset to reload samples)");
      process.exit(0);
    }
  }

  const reports = writeBatch(db);
  let highest = 1000;
  for (const sample of sampleReports()) {
    const crew = sample.crewKey ? accounts.crews.find((item) => item.key === sample.crewKey) : null;
    const report = Object.assign({}, sample, {
      reporterId: uids.citizens[sample.reporterEmail] || null,
      assignedTo: crew ? uids.crews[crew.key] : null,
      assignedName: crew ? crew.name : null,
      updatedAt: new Date().toISOString(),
    });
    delete report.reporterEmail;
    delete report.crewKey;
    reports.set(doc(db, "reports", report.id), report);
    highest = Math.max(highest, Number(report.id.replace("RPT-", "")));
  }
  const counterRef = doc(db, "counters", "reports");
  const counter = await getDoc(counterRef);
  if (reset || !counter.exists() || counter.data().next < highest) {
    reports.set(counterRef, { next: highest });
  }
  await reports.commit();
  console.log("  saved    " + sampleReports().length + " sample reports");
  process.exit(0);
}

main().catch(function (error) {
  console.error("\nSeeding failed:", error.code || "", error.message);
  if (error.code === "auth/operation-not-allowed" || error.code === "auth/configuration-not-found") {
    console.error("Turn on Email/Password sign-in in the Firebase console first (Authentication > Sign-in method).");
  }
  if (error.code === "permission-denied") {
    console.error("The admin profile may not exist yet. Deploy the bootstrap rules first (see README.md).");
  }
  process.exit(1);
});
