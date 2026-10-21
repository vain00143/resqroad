// Sign-in, registration, and account management.

import express from "express";
import {
  HttpError,
  checkAttempts,
  verifyPassword,
  clearFailures,
  clearedCookie,
  createSession,
  endSession,
  endUserSessions,
  hashPassword,
  normalizeEmail,
  profile,
  recordFailure,
  requireRole,
  sessionCookie,
  validatePassword,
  verifyLogin,
} from "./auth.js";
import { one, query } from "./db.js";
import { broadcast, signOutDevices } from "./live.js";
import { crewOpenStatuses, forViewer, loadReports } from "./reports.js";

/* ---------- Shared lookups ---------- */

// The public crew directory: names and teams, shown on reports and maps.
export async function loadCrews() {
  const rows = await query(
    "SELECT id, name, team FROM users WHERE role = 'maintenance' AND active = 1 AND deleted_at IS NULL ORDER BY team, name",
  );
  return rows.map(function (row) {
    return { id: String(row.id), name: row.name, team: row.team || "" };
  });
}

// Every account, for administrators.
export async function loadUsers() {
  const rows = await query("SELECT * FROM users ORDER BY name");
  return rows.map(function (row) {
    return Object.assign(profile(row), { deleted: Boolean(row.deleted_at) });
  });
}

export async function publishAccounts() {
  const [crews, users] = await Promise.all([loadCrews(), loadUsers()]);
  broadcast(function (viewer) {
    return viewer && viewer.role === "admin"
      ? { type: "accounts", crews: crews, users: users }
      : { type: "accounts", crews: crews };
  });
}

function isMobile(request) {
  return String(request.get("X-ResQRoad-Client") || "").toLowerCase() === "mobile";
}

// Starts a session: a cookie for the website, a token in the response for
// the mobile app.
async function signInResponse(request, response, user, status) {
  const mobile = isMobile(request);
  const session = await createSession(user.id, mobile ? "mobile" : "web", request.get("User-Agent"));
  const body = { user: profile(user) };
  if (mobile) {
    body.token = session.token;
    body.expiresAt = session.expiresAt.toISOString();
  } else {
    response.append("Set-Cookie", sessionCookie(session.token, session.expiresAt));
  }
  response.status(status || 200).json(body);
}

function cleanName(value) {
  const name = String(value || "").trim().replace(/\s+/g, " ");
  if (name.length < 2) {
    throw new HttpError(400, "Enter a full name.");
  }
  if (name.length > 80) {
    throw new HttpError(400, "Keep the name under 80 characters.");
  }
  return name;
}

function duplicateEmail(error) {
  return error && error.code === "ER_DUP_ENTRY";
}

function parseUserId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw new HttpError(404, "Account not found.");
  }
  return id;
}

export const accountRoutes = express.Router();

/* ---------- Everything a screen needs in one request ---------- */

accountRoutes.get("/state", async function (request, response) {
  const viewer = request.user;
  const [reports, crews, users] = await Promise.all([
    loadReports(),
    loadCrews(),
    viewer && viewer.role === "admin" ? loadUsers() : null,
  ]);
  const body = {
    user: viewer,
    reports: reports.map(function (report) {
      return forViewer(report, viewer);
    }),
    crews: crews,
  };
  if (users) {
    body.users = users;
  }
  response.json(body);
});

/* ---------- Sign-in ---------- */

accountRoutes.get("/auth/me", function (request, response) {
  response.json({ user: request.user });
});

accountRoutes.post("/auth/login", async function (request, response) {
  const body = request.body || {};
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password) {
    throw new HttpError(400, "Enter your email and password.");
  }
  checkAttempts(request, email);
  const user = await verifyLogin(email, password);
  if (!user) {
    recordFailure(request, email);
    throw new HttpError(401, "Incorrect email or password.");
  }
  if (user.deleted_at) {
    throw new HttpError(403, "This account is no longer active. Contact the Road Maintenance Office.");
  }
  if (!user.active) {
    throw new HttpError(403, "This account has been deactivated. Contact the Road Maintenance Office to reactivate it.");
  }
  clearFailures(request, email);
  await signInResponse(request, response, user);
});

accountRoutes.post("/auth/logout", async function (request, response) {
  if (request.session) {
    const tokenHash = request.session.tokenHash;
    await endSession(tokenHash);
    signOutDevices(function (ws) {
      return ws.tokenHash === tokenHash;
    });
  }
  response.append("Set-Cookie", clearedCookie());
  response.json({ ok: true });
});

// Residents create their own accounts and are signed in right away.
accountRoutes.post("/auth/register", async function (request, response) {
  const body = request.body || {};
  const name = cleanName(body.name);
  const email = normalizeEmail(body.email);
  const password = validatePassword(body.password);
  let result;
  try {
    result = await query("INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, 'citizen', 1)", [
      name,
      email,
      await hashPassword(password),
    ]);
  } catch (error) {
    if (duplicateEmail(error)) {
      throw new HttpError(409, "An account already uses this email. Sign in instead.");
    }
    throw error;
  }
  const user = await one("SELECT * FROM users WHERE id = ?", [result.insertId]);
  await publishAccounts();
  await signInResponse(request, response, user, 201);
});

// Anyone signed in can change their own password. Other devices are signed out.
accountRoutes.post("/auth/password", requireRole(), async function (request, response) {
  const body = request.body || {};
  const row = await one("SELECT * FROM users WHERE id = ?", [request.user.id]);
  if (!row || !(await verifyPassword(row, String(body.currentPassword || "")))) {
    throw new HttpError(400, "Your current password is incorrect.");
  }
  const password = validatePassword(body.newPassword);
  await query("UPDATE users SET password_hash = ? WHERE id = ?", [await hashPassword(password), row.id]);
  const keep = request.session.tokenHash;
  await endUserSessions(row.id, keep);
  signOutDevices(function (ws) {
    return ws.user.id === request.user.id && ws.tokenHash !== keep;
  });
  response.json({ ok: true });
});

/* ---------- Account management (administrators) ---------- */

accountRoutes.get("/crews", async function (request, response) {
  response.json({ crews: await loadCrews() });
});

accountRoutes.get("/users", requireRole("admin"), async function (request, response) {
  response.json({ users: await loadUsers() });
});

// Adds a maintenance crew account with a temporary password the
// administrator shares with that person. Body: { name, email, team, password }.
accountRoutes.post("/users", requireRole("admin"), async function (request, response) {
  const body = request.body || {};
  const name = cleanName(body.name);
  const email = normalizeEmail(body.email);
  const team = String(body.team || "").trim().replace(/\s+/g, " ");
  if (!team || team.length > 80) {
    throw new HttpError(400, "Enter a maintenance team (up to 80 characters).");
  }
  const password = validatePassword(body.password);
  let info;
  try {
    info = await query(
      "INSERT INTO users (name, email, password_hash, role, team, active) VALUES (?, ?, ?, 'maintenance', ?, 1)",
      [name, email, await hashPassword(password), team],
    );
  } catch (error) {
    if (duplicateEmail(error)) {
      throw new HttpError(409, "An account already uses this email.");
    }
    throw error;
  }
  const user = await one("SELECT * FROM users WHERE id = ?", [info.insertId]);
  await publishAccounts();
  response.status(201).json({ user: profile(user) });
});

// Deactivate or reactivate a resident. Body: { active }.
accountRoutes.patch("/users/:id", requireRole("admin"), async function (request, response) {
  const id = parseUserId(request.params.id);
  const active = Boolean(request.body && request.body.active);
  const row = await one("SELECT * FROM users WHERE id = ? AND deleted_at IS NULL", [id]);
  if (!row || row.role !== "citizen") {
    throw new HttpError(404, "This citizen account is no longer available.");
  }
  await query("UPDATE users SET active = ? WHERE id = ?", [active ? 1 : 0, id]);
  if (!active) {
    // A deactivated resident is signed out everywhere at once.
    await endUserSessions(id);
    signOutDevices(function (ws) {
      return ws.user.id === String(id);
    });
  }
  const user = await one("SELECT * FROM users WHERE id = ?", [id]);
  await publishAccounts();
  response.json({ user: profile(user) });
});

// Sets a new temporary password for a crew member or resident who forgot
// theirs. Body: { password }. They are signed out on every device.
accountRoutes.post("/users/:id/password", requireRole("admin"), async function (request, response) {
  const id = parseUserId(request.params.id);
  const password = validatePassword(request.body && request.body.password);
  const row = await one("SELECT * FROM users WHERE id = ? AND deleted_at IS NULL", [id]);
  if (!row || row.role === "admin") {
    throw new HttpError(404, "This account is no longer available.");
  }
  await query("UPDATE users SET password_hash = ? WHERE id = ?", [await hashPassword(password), id]);
  await endUserSessions(id);
  signOutDevices(function (ws) {
    return ws.user.id === String(id);
  });
  response.json({ ok: true });
});

// Deletes a crew account. Its row stays (marked deleted) so report history
// keeps the crew's name; it can no longer sign in.
accountRoutes.delete("/users/:id", requireRole("admin"), async function (request, response) {
  const id = parseUserId(request.params.id);
  const row = await one("SELECT * FROM users WHERE id = ? AND deleted_at IS NULL", [id]);
  if (!row || row.role !== "maintenance") {
    throw new HttpError(404, "This maintenance account is no longer available.");
  }
  const open = await one("SELECT COUNT(*) AS count FROM reports WHERE assigned_to = ? AND status IN (?)", [
    id,
    crewOpenStatuses,
  ]);
  if (open.count > 0) {
    throw new HttpError(409, "Reassign or finish this person's open jobs before deleting the account.");
  }
  await query("UPDATE users SET active = 0, deleted_at = UTC_TIMESTAMP(3) WHERE id = ?", [id]);
  await endUserSessions(id);
  signOutDevices(function (ws) {
    return ws.user.id === String(id);
  });
  await publishAccounts();
  response.json({ ok: true });
});
