# ResQRoad API

The ResQRoad server is the shared backend for the website and the mobile app.
Everything is JSON over HTTP under `/api`, plus one WebSocket for live updates.
The server enforces who can do what, so the app only needs to show the right
screens.

Examples use `http://192.168.1.13:8000` (the server's address on the local
network; it prints it when it starts). Use HTTPS in production.

## Signing in from the app

Send `X-ResQRoad-Client: mobile` when signing in or registering. The response
then contains a **token** instead of setting a cookie. Store it securely (for
example with `expo-secure-store`) and send it on every request:

```http
POST /api/auth/login
Content-Type: application/json
X-ResQRoad-Client: mobile

{ "email": "juan.reyes@resqroad.ph", "password": "…" }
```

```json
{
  "user": { "id": "2", "name": "Juan Reyes", "email": "juan.reyes@resqroad.ph", "role": "maintenance", "team": "North road crew", "active": true, "createdAt": "…" },
  "token": "q3Yb…",
  "expiresAt": "2026-11-21T08:00:00.000Z"
}
```

```http
GET /api/state
Authorization: Bearer q3Yb…
```

Tokens last 30 days and are renewed while used. A `401` means the session
ended (signed out, expired, password changed, or account deactivated): send the
person back to the sign-in screen.

## Errors

Failed requests return an HTTP error status and a message that can be shown
as-is:

```json
{ "error": "This job is no longer assigned to you." }
```

| Status | Meaning |
| --- | --- |
| 400 | Something in the request is missing or invalid. |
| 401 | Not signed in, or the session ended. |
| 403 | Signed in, but this account's role can't do that. |
| 404 | The report or account doesn't exist. |
| 409 | The report changed meanwhile (for example someone else already verified it), or it's a likely duplicate (`duplicateId` is included). |
| 429 | Too many sign-in attempts; wait a few minutes. |

## Data shapes

A **report** (what everyone may see):

```json
{
  "id": "RPT-1054",
  "title": "Large pothole at the Bulihan junction",
  "road": "Bulihan Road",
  "location": "Bulihan, Malolos City",
  "coordinates": { "lat": 14.878, "lng": 120.84 },
  "severity": "High",
  "description": "…",
  "reportedAt": "2026-10-22T01:53:00.000Z",
  "evidencePhotos": [{ "id": "130", "name": "pothole.jpg", "src": "/uploads/2026/10/evidence-ac10….jpg" }],
  "status": "assigned",
  "assignedTo": "2",
  "assignedName": "Juan Reyes",
  "repair": null,
  "history": [{ "status": "submitted", "description": "Report received from a citizen.", "actor": "Maria Santos", "at": "…" }],
  "updatedAt": "…"
}
```

- Photo `src` is a path on the server: prefix it with the server address.
  Sample reports may list a plain file name (a string) instead of a photo
  object; show a placeholder for those.
- `repair`, once submitted: `{ "notes", "beforePhotos", "afterPhotos", "submittedAt" }`.
- A history entry may have a `note`: the reason for a rejection, or what the
  crew still needs to fix.
- Administrators, and the resident who filed it, also get `reporterId` and
  `reporter` (name). Administrators also get `notes` (internal notes).

Statuses: `submitted`, `under_review`, `verified`, `assigned`, `in_progress`,
`repair_submitted`, `resolved`, `rejected`, `duplicate`.

## Endpoints

| Method and path | Who | What it does |
| --- | --- | --- |
| `GET /api/health` | Anyone | `{ "ok": true }` when the server is up. |
| `GET /api/state` | Anyone | Everything a screen needs: `{ user, reports, crews }`, plus `users` for administrators. `user` is `null` when signed out. |
| `POST /api/auth/login` | Anyone | `{ email, password }` → `{ user }` (+ `token` for the app). |
| `POST /api/auth/register` | Anyone | `{ name, email, password }` → creates a resident account and signs in. |
| `POST /api/auth/logout` | Signed in | Ends this session. |
| `GET /api/auth/me` | Anyone | `{ user }` or `{ user: null }`. |
| `POST /api/auth/password` | Signed in | `{ currentPassword, newPassword }`; signs out the account's other devices. |
| `GET /api/reports` | Anyone | `{ reports }`. |
| `GET /api/reports/:id` | Anyone | `{ report }` (`:id` is `RPT-1054` or `1054`). |
| `POST /api/reports` | Resident | Multipart form: `title`, `road`, `location`, `description`, `severity` (`Low`\|`Medium`\|`High`), `latitude`, `longitude`, and up to five `photos` files. → `201 { report }`. An optional `Idempotency-Key` header (8–64 letters, numbers, `-`, `_`; one per report form) makes retries safe: sending the same key again returns `200 { report }` with the report it already filed. |
| `POST /api/reports/:id/status` | Admin | `{ status, note? }`: `under_review`, `verified`, `rejected`, `duplicate` (from submitted/under review), `resolved` or `in_progress` (= request more work, from repair submitted). |
| `POST /api/reports/:id/notes` | Admin | `{ note }`: internal note. |
| `POST /api/reports/:id/assign` | Admin | `{ crewId }`: assign or reassign a verified report. |
| `POST /api/reports/:id/start` | Assigned crew | Start the repair. |
| `POST /api/reports/:id/repair` | Assigned crew | Multipart form: `notes`, and one to five `before` and `after` files each. An optional `Idempotency-Key` header (one per repair update) makes retries safe: the same key again returns `200 { report }` instead of "no longer assigned". |
| `GET /api/crews` | Anyone | `{ crews: [{ id, name, team }] }`. |
| `GET /api/users` | Admin | `{ users }` (never includes passwords). |
| `POST /api/users` | Admin | `{ name, email, team, password }`: add a crew account with a temporary password. |
| `PATCH /api/users/:id` | Admin | `{ active }`: deactivate or reactivate a resident. |
| `POST /api/users/:id/password` | Admin | `{ password }`: new temporary password for a crew member or resident. |
| `DELETE /api/users/:id` | Admin | Delete a crew account (only when it has no open jobs). |

Changes return the updated `{ report }`, so the app can show it right away.

### Uploading photos from React Native

```js
const form = new FormData();
form.append("title", title);
// … the other fields …
photos.forEach((photo) => form.append("photos", { uri: photo.uri, name: "photo.jpg", type: "image/jpeg" }));
const xhr = new XMLHttpRequest();
xhr.open("POST", server + "/api/reports");
xhr.setRequestHeader("Authorization", "Bearer " + token);
xhr.setRequestHeader("Idempotency-Key", formKey);
xhr.send(form);
```

Send it with `XMLHttpRequest`, not `fetch`: from Expo SDK 58 the global
`fetch` is `expo/fetch`, which throws "Unsupported FormDataPart
implementation" for `{ uri, name, type }` parts before sending anything.
Don't set `Content-Type` yourself; the multipart boundary is added for you.

Photos must be JPEG, PNG, or WebP (checked from the file contents) and under
8 MB each. Resize large camera photos first (for example with
`expo-image-manipulator`) to save mobile data.

## Live updates

Open a WebSocket to `/api/live` (`ws://` on HTTP, `wss://` on HTTPS). The app
can authenticate in either of two ways:

```js
const socket = new WebSocket(server.replace(/^http/, "ws") + "/api/live", null, {
  headers: { Authorization: "Bearer " + token },
});
// or, after it opens:
socket.send(JSON.stringify({ type: "auth", token }));
```

Messages from the server:

| `type` | Payload | What to do |
| --- | --- | --- |
| `hello` | `{ user }` | Connected (or authenticated). After a reconnect, reload `GET /api/state` to catch up. |
| `report` | `{ report }` | A report was created or changed: replace your copy (it's already filtered for this account). |
| `accounts` | `{ crews, users? }` | The crew list (and, for administrators, all accounts) changed. |
| `signed-out` | — | This session ended (signed out elsewhere, deactivated, or deleted). Go to the sign-in screen. |

Send `{ "type": "ping" }` to get `{ "type": "pong" }` if you need an
application-level keep-alive. The server also pings every 30 seconds and drops
connections that stop answering. Reconnect with a growing delay when the
connection closes.
