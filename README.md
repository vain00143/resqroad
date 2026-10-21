# ResQRoad

ResQRoad is a road damage reporting and maintenance management system for local
government. Residents report road problems, and the LGU's Road Maintenance
Office verifies, assigns, tracks, and resolves them from a central workspace.

This is a front-end prototype built with plain HTML, CSS, and JavaScript. There
is no backend, database, or build step: data lives in the browser, and the
sign-in is a mock (see [Sign-in](#sign-in)).

## Run locally

Open the folder through a local web server so browser storage and the map work
reliably. Either of these works from this folder:

```powershell
node serve.js
```

```powershell
python -m http.server 8000
```

Then open <http://localhost:8000/>. (`serve.js` is a tiny dependency-free
static server for computers without Python.)

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
| `admin-login.html`, `maintenance-login.html` | — | Old sign-in addresses; they redirect to `login.html` so existing links keep working. |

## Sign-in

Everyone signs in on `login.html`; there is no role picker. `RoadWatchAuth.signIn`
in `assets/js/auth.js` looks up the email and opens the matching workspace.
Visiting `login.html` while signed in goes straight to that workspace, and
logging out returns to the sign-in page (residents return to the home page).

The sign-in page does not display the test accounts, so keep them handy:

- Administrator: `admin@resqroad.ph` / `admin123`
- Maintenance: any maintenance email (for example `juan.reyes@resqroad.ph`,
  `ana.cruz@resqroad.ph`, `leo.santos@resqroad.ph`) / `crew123`
- Residents: any sample citizen (for example `maria.santos@example.com`) /
  `citizen123`, or register a new account. `pedro.garcia@example.com` is a
  deactivated sample account, so it can't sign in.

New maintenance accounts (User management) use the shared `crew123` password.
Citizen accounts can't be created from the admin workspace; administrators can
deactivate or reactivate them, and a deactivated resident can no longer sign in
or submit reports. A maintenance account with open assignments must have its
work reassigned or finished before it can be deleted.

These credentials are fixed values or values stored in the browser, not real
authentication. The session lives in the current tab's `sessionStorage`.

## The workflow

`Submitted → Under Review → Verified → Assigned → In Progress → Repair Submitted → Resolved`,
with `Rejected` and `Duplicate` as closing outcomes.

1. A resident files a report from `citizen.html`. Reports within about 100 m of
   another **open** report are blocked as likely duplicates (a pothole that
   comes back after a repair can be reported again).
2. The administrator reviews it under **Review Reports → Needs review**, then
   marks it under review, verifies, rejects (with an optional reason shown to
   the resident), or marks it a duplicate.
3. Verified reports appear under **Assignment**, where the administrator assigns
   or reassigns a crew. The crew workload panel shows open jobs per crew.
4. The crew starts the repair and submits notes plus before-and-after photos.
5. The administrator checks it under **Review Reports → Repairs to verify**, then
   resolves it or requests more work (the note is shown on the crew's job).

Every decision is recorded in the report's activity history. Administrators can
also add internal notes, which are never shown publicly.

## What's in each workspace

**Administrator** — a dashboard with KPIs, a submitted-vs-resolved trend, a
"needs attention" queue, recent reports, and live activity; the review queues
(card or table view, search, severity/status filters, sorting); assignment with
crew workload; a live map with severity filters and a report list; analytics
(resolution rate, time to verify and resolve, monthly chart, severity, status,
top locations, crew performance) with CSV export and print; and user
management. Press <kbd>Ctrl</kbd>+<kbd>K</kbd> to search reports, people, and
pages. The bell lists new citizen reports and crew updates. "Reset demo data" in
the account menu restores the original sample data.

**Maintenance** — an overview with an "Up next" job, job tabs (Active, Awaiting
review, Completed, All), directions links, drag-and-drop photo upload with
previews, and a map of job locations. Unsaved repair notes and photos survive
data refreshes.

**Residents** — a guided report form with a map pin picker (open reports are
shown as orange dots), "use my location", photo upload, a confirmation with the
report ID, and a "My reports" list with each report's progress. Status changes
made by staff in another tab appear immediately with a notification.

## Brand and design

The design follows `ResQRoad Brandsheet.pdf`:

- **Colors** — the Road Orange scale (`#7B3621` → `#EFC88B`), Pastel Rust,
  Black, Blush Mist, and Asphalt Gray are defined as tokens at the top of
  `assets/css/core.css`. Buttons use `#B34F2F` so white text meets WCAG AA.
  Severity (high/medium/low) and each workflow status keep their own hues so
  they stay easy to tell apart.
- **Type** — headlines use **Nofex**; body copy and UI use **Poppins** (Google
  Fonts). Nofex isn't on a public font CDN, so the site uses it when it's
  installed and otherwise falls back to **Archivo Expanded**, which has the same
  wide, heavy build. To ship Nofex with the site, add the licensed web font to
  `assets/fonts/` and add it to the `@font-face` rule at the top of `core.css`.
- **Logo** — `assets/images/resqroad-mark.png` (the Q mark, also the favicon),
  `resqroad-logotype.png` (light backgrounds), and `resqroad-logotype-white.png`
  (dark backgrounds).
- **Themes** — light and dark, following the system setting until someone picks
  one with the sun/moon button.

## Code layout

```
assets/css/core.css      Design tokens, base styles, and shared components
assets/css/app.css       Workspace shell (sidebar, top bar) and workspace views
assets/css/site.css      Landing page, sign-in, citizen portal, and tracker
assets/js/icons.js       Inline SVG icon set
assets/js/data-store.js  RoadWatchStore: data, workflow rules, and migrations
assets/js/auth.js        RoadWatchAuth: mock sign-in and role checks
assets/js/ui.js          RoadWatchUI: toasts, dialogs, lightbox, maps, formatting
assets/js/menus.js       Accessible custom select menus
assets/js/shell.js       Theme, sidebar, popovers, Ctrl+K palette, notifications
assets/js/charts.js      SVG charts (trend, columns, donut, bars, sparklines)
assets/js/*.js           One script per page (admin, maintenance, citizen, …)
serve.js                 Optional local static server (Node.js, no dependencies)
```

## Maps

Maps use [Leaflet](https://leafletjs.com/) with OpenStreetMap tiles (loaded from
the internet, with attribution). If the map library or tiles can't load, every
map falls back to the original schematic map of Bulacan, so pins and popups
still work offline.

## Stored data

Reports, accounts, and changes are saved in browser `localStorage` under the
same key as before (`roadwatch-demo-v1`), shared by every page on the same
browser and origin, so data saved by the earlier version carries over and is
upgraded automatically. Open tabs update each other live. Changes stay in that
browser; nothing is sent to a server. Reset everything with **Reset demo data**
in the administrator's account menu, or by clearing the site's browser storage.

Photos chosen by residents and crews are resized in the browser and saved with
the report, so administrators can view them. If browser storage runs out, the
report is still saved with the photo file names only. Sample reports use sample
road photos.
