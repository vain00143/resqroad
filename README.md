# ResQRoad

ResQRoad is a road damage reporting and maintenance management system for local
government. Residents report road problems, and the LGU's Road Maintenance
Office verifies, assigns, tracks, and resolves them from a central workspace.

The website is plain HTML, CSS, and JavaScript (no build step), served by a
small **Node.js** server backed by a **MySQL** database. The same server is the
API for the ResQRoad mobile app, so the website and the app share one database,
one set of accounts, and the same live updates.

- **Real accounts**: passwords are stored as bcrypt hashes in MySQL, and the
  server checks every request against the account's role.
- **Photos on the server**: evidence and repair photos are uploaded to
  `storage/photos/`, not kept in the browser.
- **Live on every device**: when anyone changes something, every open page and
  app on any phone or computer updates within a moment (over a WebSocket).

## Run locally

You need [Node.js](https://nodejs.org/) 20.12 or newer and MySQL 8.0 or newer
(MariaDB 10.4+ from XAMPP also works).

1. **Start MySQL.** For the MySQL 8.0 service: open **Services**
   (`services.msc`), find **MySQL80**, and click **Start** (set its startup type
   to *Automatic* so it starts with Windows). If XAMPP's MySQL is running, stop
   it first: both use port 3306.
2. **Configure the connection.** Copy `.env.example` to `.env` and set
   `DB_PASSWORD` to your MySQL `root` password (the one chosen when MySQL was
   installed). `.env` is never committed.
3. **Install and set up** (from this folder):

   ```powershell
   npm install
   npm run db:setup       # creates the `resqroad` database and tables
   npm run create-admin   # creates your administrator account
   npm run seed           # optional: sample accounts and 21 sample reports
   ```

4. **Start the server:**

   ```powershell
   npm start
   ```

   Then open <http://localhost:8000/>. The server also prints addresses such as
   `http://192.168.1.13:8000/` that phones and other computers **on the same
   Wi-Fi** can open (allow Node.js through Windows Firewall when asked). Note:
   phones only allow "Use my location" on `localhost` or HTTPS, so on a LAN
   address residents drop a pin on the map instead.

`npm run dev` restarts the server automatically when server files change.

## Pages

| Page | Who | What it does |
| --- | --- | --- |
| `index.html` | Everyone | Public landing page: live numbers, how it works, a live map of verified reports, recently fixed roads, and a report tracker. |
| `login.html` | Everyone | One sign-in for residents, administrators, and maintenance crews. The account decides which workspace opens. |
| `register.html` | Residents | Create a free resident account (signs you in right away). |
| `citizen.html` | Residents | Report a road problem (title, severity, map pin or GPS, photos) and follow every report you've filed. |
| `track.html` | Everyone | Look up any report by ID (e.g. `track.html?id=RPT-1048`) and see its public progress. |
| `admin.html` | Administrator | Dashboard, Analytics & Reports, Review Reports, Assignment, Map, and User management. |
| `maintenance.html` | Maintenance crews | Overview, assigned jobs (start repairs, submit notes with before/after photos), and repair sites. |
| `admin-login.html`, `maintenance-login.html` | — | Old sign-in addresses; they redirect to `login.html`. |

## Accounts

Everyone signs in on `login.html`; there is no role picker. The server checks
the email and password, and the account's role decides which workspace opens.
Sign-ins last 30 days (renewed while in use) or until you log out.

- **Administrators** are created with `npm run create-admin` (it can also
  reset an administrator's password). They can't be created from the website.
- **Maintenance crews**: the administrator adds them in **User management**
  with a temporary password (8+ characters with a letter and a number) and
  shares it with that person privately. A crew account with open jobs can't be
  deleted until its work is reassigned or finished. A deleted crew account can
  no longer sign in; its name stays on past reports, and its email can't be
  reused.
- **Residents** create their own accounts on `register.html` (8+ characters
  with a letter and a number). The administrator can deactivate or reactivate
  them; a deactivated resident is signed out on every device at once and can't
  sign in or submit reports.
- Anyone signed in can change their password through the API
  (`POST /api/auth/password`), which signs out their other devices; an
  administrator can set a new temporary password for a crew member or resident
  who forgot theirs (`POST /api/users/:id/password`).

Too many wrong passwords for the same email from the same address (8 in 15
minutes) pause sign-in attempts for a while.

### Sample accounts (`npm run seed` only)

For demos and testing, `npm run seed` adds these accounts. Don't run it on a
real deployment, or change these passwords afterwards.

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@resqroad.ph` | `admin123` |
| Maintenance crew | `juan.reyes@resqroad.ph`, `ana.cruz@resqroad.ph`, `leo.santos@resqroad.ph` | `crew123` |
| Resident | `maria.santos@example.com` (and the other sample residents) | `citizen123` |
| Deactivated resident | `pedro.garcia@example.com` | `citizen123` (sign-in is refused) |

`npm run seed -- --reset` deletes every report, note, and uploaded photo and
reloads the 21 sample reports (accounts are kept).

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
4. The assigned crew starts the repair and submits notes plus before-and-after
   photos (at least one of each).
5. The administrator checks it under **Review Reports → Repairs to verify**, then
   resolves it or requests more work (the note is shown on the crew's job). A
   resubmitted repair replaces the photos shown; earlier ones are kept on the
   server for the record.

The server enforces every rule above (who may make each change, and which step
can follow which), for the website and the mobile app alike. Every decision is
recorded in the report's history with the name of the person who made it.
Administrators can also add internal notes, which only administrators can read.

## Database (MySQL)

The schema is in `database/schema.sql` (`npm run db:setup` applies it; it's
safe to run again). All times are stored in UTC.

| Table | What it holds |
| --- | --- |
| `users` | Every account: `name`, `email` (unique), `password_hash` (bcrypt), `role` (`admin` \| `maintenance` \| `citizen`), `team` (crews), `active`, `created_at`, `deleted_at` (deleted crew accounts). |
| `sessions` | Signed-in devices: a SHA-256 hash of each session token (never the token itself), `user_id`, `client` (`web` \| `mobile`), `expires_at`. |
| `reports` | Reports. The public ID is `RPT-` + `id` (new reports continue from the highest number). `title`, `road`, `location`, `latitude`, `longitude`, `severity`, `description`, `status`, `reporter_id` → `users`, `assigned_to` → `users`, `assigned_name`, `repair_notes`, `repair_submitted_at`, `reported_at`, `updated_at`. |
| `report_history` | Each workflow step: `report_id`, `status`, `description`, `actor` (name), `actor_id`, `note` (reason shown to the resident or crew), `created_at`. |
| `report_notes` | Internal staff notes (administrators only): `report_id`, `note`, `actor`, `created_at`. |
| `photos` | Evidence (`kind` = `evidence`) and repair (`before` \| `after`) photos: `report_id`, original `name`, `file_path` (inside `storage/photos/`), `mime_type`, `size_bytes`, `uploaded_by`, `replaced_at` (earlier repair photos after a resubmission). Sample reports list file names only (`file_path` is empty) and the website shows stock road photos for them. |

**What each person can see.** Reports are public (the landing page, map, and
tracker need them), but the reporter's identity is only shown to
administrators and to the reporter, internal notes only to administrators, and
account details only to administrators and the account's owner.

**Photos** are checked on the server (JPEG, PNG, or WebP, up to 8 MB and five
per set), saved as `storage/photos/YYYY/MM/<random name>`, and served from
`/uploads/...`. Back up the `storage/` folder together with the database.

## Architecture

```
Website (HTML/CSS/JS)            ResQRoad server (Node.js)              MySQL
Mobile app (React Native)        ──────────────────────────             ─────
  │                              server/app.js     pages + /api  ───►   resqroad database
  ├─ JSON API (/api/...)   ───►  server/accounts.js sign-in, accounts
  ├─ photo uploads         ───►  server/reports.js  workflow rules
  │                              server/photos.js   ───► storage/photos/
  └─ live updates   ◄── WebSocket server/live.js (/api/live)
```

`RoadWatchStore` (`assets/js/data-store.js`) loads everything once
(`GET /api/state`), then keeps its in-memory copy current with the live updates,
so pages read it instantly and re-render whenever anything changes, on every
device. Most changes appear on screen immediately and are then saved; if the
server rejects a change, the real data comes back and an error is shown. If the
connection drops (a phone going offline), it reconnects and catches up.

The mobile app uses the same API with a token instead of a cookie; see
[`docs/API.md`](docs/API.md).

## Tests

```powershell
npm test
```

Runs the whole workflow end to end against a real MySQL server (the one in
`.env`, in a separate `resqroad_test` database that's created and dropped by
the test): a resident reports damage with photos, the administrator reviews,
verifies, and assigns it, the crew starts and submits the repair, the
administrator sends it back once, and then resolves it, with every other
device receiving each step live. It also checks the permission rules, photo
storage, duplicate detection, sign-in for the website and the app,
deactivation, crew accounts, and that server files are never served.

## Moving data from Firebase

The previous version stored its data in Firebase (project `resqroad-bulsu`).
Its configuration and security rules are kept in `firebase/` for reference.
To copy that data into MySQL:

```powershell
npm run import:firebase                    # signs in as the Firebase admin; copies everything
npm run import:firebase -- --public-only   # no sign-in: reports, history, and photos only
```

Add `--replace` to delete the reports already in MySQL first. Firebase never
reveals passwords, so imported accounts get new temporary passwords that the
tool prints once (the administrator who signs in keeps the password typed in).
Accounts whose email already exists in MySQL are linked and keep their
password. Photos stored in Firestore become image files in `storage/photos/`.

## Deploying

Firebase Hosting only serves static files, so it can't run this version. Host
the Node.js server and a MySQL 8 database together, for example on a VPS, a
school or LGU server, or a platform such as Railway or Render with a managed
MySQL database. Set the `.env` values there, run `npm run db:setup` and
`npm run create-admin`, start it with `npm start`, and put it behind HTTPS
(then set `COOKIE_SECURE=true`).

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
serve.js                      Starts the server (npm start)
server/index.js               Server start-up and network addresses
server/app.js                 Website pages, /api, /uploads, error handling
server/accounts.js            Sign-in, registration, account management, GET /api/state
server/reports.js             Reports and the workflow rules
server/photos.js              Photo checks and storage
server/live.js                Live updates over WebSocket
server/auth.js                Passwords, sessions, role checks, sign-in limits
server/db.js, config.js       MySQL connection and .env settings
database/schema.sql           MySQL tables
tools/db-setup.js             npm run db:setup
tools/create-admin.js         npm run create-admin
tools/seed.js, seed-data.js   npm run seed (sample accounts and reports)
tools/import-firebase.js      npm run import:firebase
tests/workflow.test.js        npm test
docs/API.md                   API for the mobile app
firebase/                     The previous Firebase configuration (reference)
assets/css/core.css           Design tokens, base styles, shared components
assets/css/app.css            Workspace shell (sidebar, top bar) and views
assets/css/site.css           Landing page, sign-in, citizen portal, tracker
assets/js/data-store.js       RoadWatchStore: API client, live cache, workflow helpers
assets/js/auth.js             RoadWatchAuth: sign-in and role checks
assets/js/ui.js               Toasts, dialogs, lightbox, maps, formatting
assets/js/menus.js            Accessible custom select menus
assets/js/shell.js            Theme, sidebar, popovers, Ctrl+K palette, notifications
assets/js/charts.js           SVG charts (trend, columns, donut, bars, sparklines)
assets/js/*.js                One script per page (admin, maintenance, citizen, …)
storage/photos/               Uploaded photos (created automatically; not committed)
```

## Acknowledgements

- [Express](https://expressjs.com/), [mysql2](https://sidorares.github.io/node-mysql2/),
  [ws](https://github.com/websockets/ws), [Multer](https://github.com/expressjs/multer),
  and [bcrypt.js](https://github.com/dcodeIO/bcrypt.js) for the server.
- [Leaflet](https://leafletjs.com/) for maps, with map data © [OpenStreetMap](https://www.openstreetmap.org/copyright)
  contributors. If the map can't load, a built-in schematic map is shown.
- Fonts: [Poppins](https://fonts.google.com/specimen/Poppins) and
  [Archivo](https://fonts.google.com/specimen/Archivo) via Google Fonts; Nofex
  from the ResQRoad brand sheet.
- Icons are drawn in the style of [Lucide](https://lucide.dev/) (ISC license).
- Sample road photos on demo reports are linked from public news websites.
