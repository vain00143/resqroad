# ResQRoad

ResQRoad is a road damage reporting and maintenance management system for local
government. Residents report road problems, and the LGU's Road Maintenance
Office verifies, assigns, tracks, and resolves them from a central workspace.

**Live site:** <https://resqroad-bulsu.web.app>

The website is plain HTML, CSS, and JavaScript (no build step) backed by
**Firebase**: Authentication for real accounts, Cloud Firestore as the shared
database for the website and the mobile app, and Hosting for the live site. It
runs entirely on Firebase's free (Spark) plan.

## Run locally

From this folder, start a local web server (the pages use JavaScript modules,
so opening the HTML files directly won't work):

```powershell
node serve.js
```

Then open <http://localhost:8000/>. The local copy uses the same live database
as the deployed site. (`python -m http.server 8000` also works.)

## Pages

| Page | Who | What it does |
| --- | --- | --- |
| `index.html` | Everyone | Public landing page: live numbers, how it works, a live map of verified reports, recently fixed roads, and a report tracker. |
| `login.html` | Everyone | One sign-in for residents, administrators, and maintenance crews. The account decides which workspace opens. |
| `register.html` | Residents | Create a free resident account (signs you in right away). |
| `citizen.html` | Residents | Report a road problem (title, severity, map pin or GPS, photos) and follow every report you've filed. |
| `track.html` | Everyone | Look up any report by ID (e.g. `track.html?id=RPT-1048`) and see its public progress. |
| `admin.html` | Administrator | Dashboard, Analytics & Reports, Review Reports, Assignment, Map, and User management. |
| `maintenance.html` | Maintenance crews | Overview, assigned jobs (start repairs, submit notes with before/after photos), and job locations. |
| `admin-login.html`, `maintenance-login.html` | — | Old sign-in addresses; they redirect to `login.html`. |

## Accounts

Everyone signs in on `login.html`; there is no role picker. Firebase
Authentication checks the email and password, and the account's profile in
Firestore decides which workspace opens. Sessions persist until you log out.

Demo accounts (also shown to the instructor for testing):

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@resqroad.ph` | `admin123` |
| Maintenance crew | `juan.reyes@resqroad.ph`, `ana.cruz@resqroad.ph`, `leo.santos@resqroad.ph` | `crew123` |
| Resident | `maria.santos@example.com` (and the other sample residents) | `citizen123` |
| Deactivated resident | `pedro.garcia@example.com` | `citizen123` (sign-in is refused) |

- Residents create their own accounts on `register.html` (8+ characters with a
  letter and a number).
- The administrator adds maintenance accounts in **User management**; new crew
  accounts sign in with `crew123`. A crew account with open jobs can't be
  deleted until its work is reassigned or finished. Deleting a crew account
  removes its profile, so it can no longer sign in to any workspace (its
  Firebase sign-in record stays, so that email can't be reused).
- The administrator can deactivate or reactivate residents. A deactivated
  resident is signed out immediately and can't sign in or submit reports.

## The workflow

`Submitted → Under Review → Verified → Assigned → In Progress → Repair Submitted → Resolved`,
with `Rejected` and `Duplicate` as closing outcomes.

1. A resident files a report from `citizen.html`. Reports within about 100 m of
   another **open** report are blocked as likely duplicates.
2. The administrator reviews it under **Review Reports → Needs review**, then
   marks it under review, verifies, rejects (with an optional reason shown to
   the resident), or marks it a duplicate.
3. Verified reports appear under **Assignment**, where the administrator assigns
   or reassigns a crew. The crew workload panel shows open jobs per crew.
4. The crew starts the repair and submits notes plus before-and-after photos.
5. The administrator checks it under **Review Reports → Repairs to verify**, then
   resolves it or requests more work (the note is shown on the crew's job).

Every decision is recorded in the report's history. Administrators can also add
internal notes, which only administrators can read. All screens update live
when anyone changes the data.

## Database (Cloud Firestore)

Region: `asia-southeast1` (Singapore). Security rules: `firestore.rules`.

| Collection | Document ID | Fields | Who can read / write |
| --- | --- | --- | --- |
| `users` | Firebase user ID | `name`, `email`, `role` (`admin` \| `maintenance` \| `citizen`), `active`, `team` (crews), `createdAt`, `deleted` | Read: the owner and admins. Residents create their own resident profile; admins manage the rest. |
| `crews` | Firebase user ID | `name`, `team` | Public read (crew names on reports); admins write. |
| `reports` | `RPT-1048`, … | `id`, `title`, `road`, `location`, `coordinates {lat, lng}`, `severity`, `description`, `reporterId` → `users`, `reportedAt`, `evidencePhotos [{name, photoId}]`, `status`, `assignedTo` → `users`, `assignedName`, `repair {notes, beforePhotos, afterPhotos, submittedAt}`, `history [{status, description, actor, at, note}]`, `updatedAt` | Public read (no names or emails are stored here). Residents create; crews may only move their own job from Assigned → In Progress → Repair Submitted; admins update anything. |
| `notes` | auto ID | `reportId` → `reports`, `note`, `actor`, `at` | Admins only. |
| `photos` | auto ID | `reportId` → `reports`, `kind` (`evidence` \| `before` \| `after`), `name`, `src` (resized JPEG data URL), `uploadedBy` → `users`, `createdAt` | Public read; signed-in users upload their own. |
| `counters` | `reports` | `next` (last report number used) | Signed-in read; incremented in a transaction when a report is filed. |

Photos are resized in the browser and stored in Firestore (each under 1 MB)
instead of Cloud Storage, because Storage now requires a paid plan.

## Architecture

```
Browser (HTML/CSS/JS)                        Firebase (resqroad-bulsu)
──────────────────────                       ─────────────────────────
Pages (admin, maintenance, citizen, …)       Hosting   → serves the website
  └─ RoadWatchStore (assets/js/data-store.js)
       ├─ Firebase Auth SDK  ───────────────► Authentication (email/password)
       └─ Firestore SDK      ◄── live ──────► Cloud Firestore + security rules
```

`RoadWatchStore` keeps a live copy of the data using Firestore listeners, so
pages read it instantly and re-render whenever anything changes. Changes appear
on screen immediately and are then saved; if the security rules reject a
change, the real data is restored and an error is shown.

## Deploying and managing data

Requires Node.js and the Firebase CLI (`npm install -g firebase-tools`, then
`firebase login` with the Google account that owns the project).

```powershell
npm install                 # once, for the seed tool
npm run deploy              # website + security rules
npm run deploy:hosting      # website only
npm run deploy:rules        # security rules only
npm run seed -- --reset     # reload the 21 sample reports (keeps accounts)
```

### Setting up a new Firebase project

1. Create a project, register a web app, and paste its config into
   `assets/js/firebase-config.js`; set the project ID in `.firebaserc`.
2. Create the Firestore database and turn on **Email/Password** under
   Authentication → Sign-in method.
3. The first admin profile can't be created under the real rules, so seed once
   with temporary rules, then restore the real ones right away:

```powershell
npm run deploy:bootstrap-rules
npm run seed
npm run deploy:rules
```

## Brand and design

The design follows `ResQRoad Brandsheet.pdf`:

- **Colors**: the Road Orange scale (`#7B3621` → `#EFC88B`), Pastel Rust,
  Black, Blush Mist, and Asphalt Gray are tokens at the top of
  `assets/css/core.css`. Severity and each workflow status keep their own hues.
- **Type**: headlines use **Nofex** when it's installed, otherwise **Archivo
  Expanded**, which has the same wide, heavy build; body copy and UI use
  **Poppins**.
- **Logo**: `assets/images/resqroad-mark.png` (the Q mark and favicon),
  `resqroad-logotype.png` (light backgrounds), `resqroad-logotype-white.png`
  (dark backgrounds).
- **Themes**: light and dark, following the system setting until someone picks
  one with the sun/moon button. Every page works at phone width.

## Code layout

```
assets/css/core.css           Design tokens, base styles, shared components
assets/css/app.css            Workspace shell (sidebar, top bar) and views
assets/css/site.css           Landing page, sign-in, citizen portal, tracker
assets/js/firebase-config.js  Firebase project settings
assets/js/data-store.js       RoadWatchStore: Firestore data, workflow rules
assets/js/auth.js             RoadWatchAuth: sign-in and role checks
assets/js/ui.js               Toasts, dialogs, lightbox, maps, formatting
assets/js/menus.js            Accessible custom select menus
assets/js/shell.js            Theme, sidebar, popovers, Ctrl+K palette, notifications
assets/js/charts.js           SVG charts (trend, columns, donut, bars, sparklines)
assets/js/*.js                One script per page (admin, maintenance, citizen, …)
firestore.rules               Database security rules
tools/seed.js, seed-data.js   Demo accounts and sample reports
serve.js                      Local static server (Node.js, no dependencies)
```

## Acknowledgements

- [Firebase](https://firebase.google.com/) (Authentication, Cloud Firestore,
  Hosting) by Google.
- [Leaflet](https://leafletjs.com/) for maps, with map data © [OpenStreetMap](https://www.openstreetmap.org/copyright)
  contributors. If the map can't load, a built-in schematic map is shown.
- Fonts: [Poppins](https://fonts.google.com/specimen/Poppins) and
  [Archivo](https://fonts.google.com/specimen/Archivo) via Google Fonts; Nofex
  from the ResQRoad brand sheet.
- Icons are drawn in the style of [Lucide](https://lucide.dev/) (ISC license).
- Sample road photos on demo reports are linked from public news websites.
