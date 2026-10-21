# Previous Firebase backend (reference only)

ResQRoad used Firebase (project `resqroad-bulsu`: Authentication, Cloud
Firestore, and Hosting) before it moved to its own Node.js server and MySQL.
These files are kept for reference:

- `firestore.rules`, `firestore.indexes.json`: the old database security rules.
- `firebase.json`, `.firebaserc`, `firebase.bootstrap.json`, `bootstrap.rules`:
  the old Firebase CLI configuration.
- `firebase-config.js`: the project's public web settings, used by
  `npm run import:firebase` to copy the Firestore data into MySQL.

The website no longer uses Firebase. Don't run `firebase deploy` from here:
Firebase Hosting can't run the new server, so a deployed copy wouldn't work.
