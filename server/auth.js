// Accounts and sign-in: password hashing, session tokens, and role checks.
//
// Each sign-in creates a random session token. Browsers keep it in an
// HttpOnly cookie; the mobile app sends it as `Authorization: Bearer <token>`.
// The database only stores a SHA-256 hash of the token.

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { config } from "./config.js";
import { one, query } from "./db.js";
import { firebaseConfig } from "../firebase/firebase-config.js";

export const cookieName = "resqroad_session";
const dayMs = 24 * 60 * 60 * 1000;

export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra || null;
  }
}

/* ---------- Passwords ---------- */

export function hashPassword(password) {
  return bcrypt.hash(String(password), 10);
}

export function checkPassword(password, hash) {
  return bcrypt.compare(String(password), hash);
}

// Compared against when an email isn't found, so a wrong email takes as long
// as a wrong password.
const dummyHash = bcrypt.hashSync("resqroad-timing-guard", 10);

// Accounts copied from Firebase (`npm run import:firebase`) keep their
// Firebase password: their password_hash is "firebase:<Firebase user ID>"
// until the person first signs in here. That sign-in is checked once with
// Firebase, and the password is then stored as a bcrypt hash like any other.
export const firebasePasswordPrefix = "firebase:";
const firebaseSignInUrl =
  process.env.FIREBASE_AUTH_URL || "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword";

async function firebasePasswordMatches(email, password) {
  let response;
  try {
    response = await fetch(firebaseSignInUrl + "?key=" + encodeURIComponent(firebaseConfig.apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password, returnSecureToken: true }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    throw new HttpError(503, "Your password couldn't be checked right now. Check the server's internet connection and try again.");
  }
  if (response.ok) {
    return true;
  }
  const body = await response.json().catch(function () {
    return {};
  });
  const code = String((body.error && body.error.message) || "");
  if (code.startsWith("TOO_MANY_ATTEMPTS")) {
    throw new HttpError(429, "Too many attempts. Wait a few minutes and try again.");
  }
  if (response.status >= 500) {
    throw new HttpError(503, "Your password couldn't be checked right now. Try again in a minute.");
  }
  return false;
}

// Checks a password against an account row (bcrypt, or a Firebase password
// that hasn't been moved over yet).
export async function verifyPassword(row, password) {
  if (String(row.password_hash).startsWith(firebasePasswordPrefix)) {
    if (!(await firebasePasswordMatches(row.email, password))) {
      return false;
    }
    await query("UPDATE users SET password_hash = ? WHERE id = ? AND password_hash = ?", [
      await hashPassword(password),
      row.id,
      row.password_hash,
    ]);
    return true;
  }
  return checkPassword(password, row.password_hash);
}

export async function verifyLogin(email, password) {
  const user = await one("SELECT * FROM users WHERE email = ?", [email]);
  if (!user) {
    await checkPassword(password, dummyHash);
    return null;
  }
  return (await verifyPassword(user, password)) ? user : null;
}

export function validatePassword(password) {
  const value = String(password || "");
  if (value.length < 8 || !/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    throw new HttpError(400, "Use at least 8 characters with a letter and a number.");
  }
  if (value.length > 128) {
    throw new HttpError(400, "Keep the password under 128 characters.");
  }
  return value;
}

export function normalizeEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) || value.length > 120) {
    throw new HttpError(400, "Enter a valid email address.");
  }
  return value;
}

// The account details the website and app see (never the password hash).
export function profile(row) {
  if (!row) {
    return null;
  }
  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    role: row.role,
    team: row.team || "",
    active: Boolean(row.active) && !row.deleted_at,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  };
}

/* ---------- Sessions ---------- */

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

export async function createSession(userId, client, userAgent) {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + config.sessionDays * dayMs);
  await query("INSERT INTO sessions (token_hash, user_id, client, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)", [
    tokenHash,
    userId,
    client === "mobile" ? "mobile" : "web",
    String(userAgent || "").slice(0, 255) || null,
    expiresAt,
  ]);
  return { token: token, tokenHash: tokenHash, expiresAt: expiresAt };
}

export async function endSession(tokenHash) {
  if (tokenHash) {
    await query("DELETE FROM sessions WHERE token_hash = ?", [tokenHash]);
  }
}

// Signs a user out everywhere (or everywhere except one session).
export async function endUserSessions(userId, exceptTokenHash) {
  await query("DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?", [userId, exceptTokenHash || ""]);
}

export async function deleteExpiredSessions() {
  await query("DELETE FROM sessions WHERE expires_at < UTC_TIMESTAMP(3)");
}

// Returns { user, tokenHash } for a valid session token, or null.
export async function userForToken(token) {
  if (!token || typeof token !== "string" || token.length > 200) {
    return null;
  }
  const tokenHash = hashToken(token);
  const row = await one(
    "SELECT u.*, s.last_seen_at FROM sessions s JOIN users u ON u.id = s.user_id " +
      "WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP(3)",
    [tokenHash],
  );
  if (!row || !row.active || row.deleted_at) {
    return null;
  }
  // Sessions stay alive while they're used (checked at most once an hour).
  if (Date.now() - new Date(row.last_seen_at).getTime() > dayMs / 24) {
    await query("UPDATE sessions SET last_seen_at = UTC_TIMESTAMP(3), expires_at = ? WHERE token_hash = ?", [
      new Date(Date.now() + config.sessionDays * dayMs),
      tokenHash,
    ]);
  }
  return { user: profile(row), tokenHash: tokenHash };
}

function parseCookies(header) {
  const cookies = {};
  String(header || "")
    .split(";")
    .forEach(function (part) {
      const index = part.indexOf("=");
      if (index > 0) {
        const name = part.slice(0, index).trim();
        try {
          cookies[name] = decodeURIComponent(part.slice(index + 1).trim());
        } catch (error) {
          cookies[name] = "";
        }
      }
    });
  return cookies;
}

// Finds the session token on a request: a Bearer header (mobile app) or the
// sign-in cookie (website).
export function readToken(request) {
  const header = request.headers.authorization || "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (match) {
    return { token: match[1], via: "bearer" };
  }
  const cookie = parseCookies(request.headers.cookie)[cookieName];
  return cookie ? { token: cookie, via: "cookie" } : null;
}

// Browsers send an Origin header; it must be this site (or an allowed one)
// before a cookie is trusted for a change. Apps without cookies are fine.
export function originAllowed(request) {
  const origin = request.headers.origin;
  if (!origin) {
    return true;
  }
  if (config.corsOrigins.includes(origin)) {
    return true;
  }
  try {
    return new URL(origin).host === request.headers.host;
  } catch (error) {
    return false;
  }
}

export function sessionCookie(token, expiresAt) {
  return (
    cookieName +
    "=" +
    encodeURIComponent(token) +
    "; Path=/; HttpOnly; SameSite=Lax; Expires=" +
    expiresAt.toUTCString() +
    (config.cookieSecure ? "; Secure" : "")
  );
}

export function clearedCookie() {
  return cookieName + "=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" + (config.cookieSecure ? "; Secure" : "");
}

/* ---------- Middleware ---------- */

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Attaches request.user (or null) and request.session for every API call.
export async function authenticate(request, response, next) {
  request.user = null;
  request.session = null;
  const found = readToken(request);
  if (found) {
    if (found.via === "cookie" && unsafeMethods.has(request.method) && !originAllowed(request)) {
      throw new HttpError(403, "This request came from another website and was blocked.");
    }
    const session = await userForToken(found.token);
    if (session) {
      request.user = session.user;
      request.session = { tokenHash: session.tokenHash, via: found.via };
    } else if (found.via === "cookie") {
      // Expired or revoked: forget the stale cookie.
      response.append("Set-Cookie", clearedCookie());
    }
  }
  next();
}

export function requireRole() {
  const roles = Array.from(arguments);
  return function (request, response, next) {
    if (!request.user) {
      throw new HttpError(401, "Your session has ended. Sign in again to continue.");
    }
    if (roles.length && !roles.includes(request.user.role)) {
      throw new HttpError(403, "Your account doesn't have permission to do that.");
    }
    next();
  };
}

/* ---------- Sign-in attempt limits ---------- */

const attempts = new Map();
const attemptWindowMs = 15 * 60 * 1000;
const maxFailures = 8;

function attemptKey(request, email) {
  return (request.ip || "") + "|" + email;
}

export function checkAttempts(request, email) {
  const entry = attempts.get(attemptKey(request, email));
  if (entry && Date.now() - entry.first < attemptWindowMs && entry.count >= maxFailures) {
    throw new HttpError(429, "Too many attempts. Wait a few minutes and try again.");
  }
}

export function recordFailure(request, email) {
  const key = attemptKey(request, email);
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.first >= attemptWindowMs) {
    attempts.set(key, { count: 1, first: Date.now() });
  } else {
    entry.count += 1;
  }
}

export function clearFailures(request, email) {
  attempts.delete(attemptKey(request, email));
}

setInterval(function () {
  const cutoff = Date.now() - attemptWindowMs;
  attempts.forEach(function (entry, key) {
    if (entry.first < cutoff) {
      attempts.delete(key);
    }
  });
}, attemptWindowMs).unref();
