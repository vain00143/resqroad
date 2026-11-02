// The ResQRoad web server: the website, the JSON API under /api, and uploaded
// photos under /uploads.

import fs from "node:fs";
import path from "node:path";
import express from "express";
import multer from "multer";
import { config, rootDir } from "./config.js";
import { HttpError, authenticate, readToken, userForToken } from "./auth.js";
import { accountRoutes } from "./accounts.js";
import { reportRoutes } from "./reports.js";
import { photoFromDatabase, photosDir, photoUrlPrefix } from "./photos.js";
import { explainDatabaseError, query } from "./db.js";

// Only the website's own pages are served from the project folder (never
// .env, the server code, or the database files).
const pages = new Set(
  fs.readdirSync(rootDir).filter(function (name) {
    return name.endsWith(".html");
  }),
);

// Each workspace page and the role that may open it.
const workspacePages = {
  "admin.html": "admin",
  "maintenance.html": "maintenance",
  "citizen.html": "citizen",
};

function noCache(response) {
  response.setHeader("Cache-Control", "no-cache");
}

// The signed-in website user for a page request, or null.
async function pageUser(request) {
  const found = readToken(request);
  if (!found || found.via !== "cookie") {
    return null;
  }
  const session = await userForToken(found.token);
  return session ? session.user : null;
}

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);

  app.use(function (request, response, next) {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    response.setHeader("X-Frame-Options", "SAMEORIGIN");
    next();
  });

  /* ---------- API ---------- */

  const api = express.Router();
  api.use(function (request, response, next) {
    response.setHeader("Cache-Control", "no-store");
    // Other web origins listed in CORS_ORIGINS (e.g. an Expo web build).
    const origin = request.headers.origin;
    if (origin && config.corsOrigins.includes(origin)) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Access-Control-Allow-Credentials", "true");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-ResQRoad-Client, Idempotency-Key");
      response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
      response.setHeader("Vary", "Origin");
      if (request.method === "OPTIONS") {
        response.status(204).end();
        return;
      }
    }
    next();
  });
  api.use(express.json({ limit: "100kb" }));
  api.use(authenticate);
  api.get("/health", function (request, response) {
    response.json({ ok: true });
  });
  // Also checks MySQL, so an uptime monitor calling it keeps a free hosted
  // database from being powered off as idle.
  api.get("/health/db", async function (request, response) {
    await query("SELECT 1");
    response.json({ ok: true, database: true });
  });
  api.use(accountRoutes);
  api.use(reportRoutes);
  api.use(function () {
    throw new HttpError(404, "Not found.");
  });
  api.use(function (error, request, response, next) {
    if (response.headersSent) {
      next(error);
      return;
    }
    if (error instanceof multer.MulterError) {
      const messages = {
        LIMIT_FILE_SIZE: "Each photo must be smaller than " + Math.round(config.maxPhotoBytes / 1048576) + " MB.",
        LIMIT_FILE_COUNT: "Choose no more than " + config.maxPhotosPerSet + " photos.",
        LIMIT_UNEXPECTED_FILE: "Choose no more than " + config.maxPhotosPerSet + " photos.",
      };
      response.status(400).json({ error: messages[error.code] || "The photos couldn't be uploaded." });
      return;
    }
    if (error instanceof HttpError) {
      response.status(error.status).json(Object.assign({ error: error.message }, error.extra));
      return;
    }
    if (error && error.type === "entity.parse.failed") {
      response.status(400).json({ error: "The request wasn't valid JSON." });
      return;
    }
    if (error && error.type === "entity.too.large") {
      response.status(413).json({ error: "The request is too large." });
      return;
    }
    console.error("API error on " + request.method + " " + request.originalUrl + ":", explainDatabaseError(error));
    response.status(500).json({ error: "Something went wrong on the server. Try again." });
  });
  app.use("/api", api);

  /* ---------- Photos and the website ---------- */

  // Photos kept in MySQL (PHOTO_STORAGE=database) come first; files on disk
  // are the fallback.
  app.use(photoUrlPrefix, async function (request, response, next) {
    if (config.photoStorage !== "database" || (request.method !== "GET" && request.method !== "HEAD")) {
      next();
      return;
    }
    let filePath;
    try {
      filePath = decodeURIComponent(request.path.replace(/^\/+/, ""));
    } catch (error) {
      next();
      return;
    }
    const photo =
      /^[\w./-]+$/.test(filePath) && !filePath.includes("..") ? await photoFromDatabase(filePath) : null;
    if (!photo) {
      next();
      return;
    }
    response.setHeader("Content-Type", photo.mime_type);
    response.setHeader("Cache-Control", "public, max-age=2592000, immutable");
    response.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'");
    response.send(photo.data);
  });
  app.use(
    photoUrlPrefix,
    express.static(photosDir, {
      index: false,
      dotfiles: "ignore",
      fallthrough: false,
      immutable: true,
      maxAge: "30d",
      setHeaders: function (response) {
        response.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'");
      },
    }),
  );

  app.use(
    "/assets",
    express.static(path.join(rootDir, "assets"), {
      index: false,
      dotfiles: "ignore",
      setHeaders: function (response, file) {
        if (/\.(js|css)$/.test(file)) {
          noCache(response);
        }
      },
    }),
  );

  // `root` keeps the hidden-file check to the file name, so the site still
  // works from a folder whose path contains a dot folder.
  app.get("/", function (request, response) {
    noCache(response);
    response.sendFile("index.html", { root: rootDir });
  });
  app.get("/:page", async function (request, response, next) {
    const page = request.params.page;
    if (!pages.has(page)) {
      next();
      return;
    }
    const role = workspacePages[page];
    if (!role) {
      noCache(response);
      response.sendFile(page, { root: rootDir });
      return;
    }
    // Workspaces are never stored by the browser, so after signing out the
    // Back button asks the server again, and anyone who isn't signed in with
    // the right role is sent to the sign-in page.
    response.setHeader("Cache-Control", "no-store");
    let user = null;
    try {
      user = await pageUser(request);
    } catch (error) {
      // The database is unreachable: serve the page, which shows the problem
      // and checks the sign-in again itself.
      console.error("Couldn't check the sign-in for " + page + ":", explainDatabaseError(error));
      response.sendFile(page, { root: rootDir });
      return;
    }
    if (!user || user.role !== role) {
      response.redirect(302, "/login.html?next=" + encodeURIComponent(page));
      return;
    }
    response.sendFile(page, { root: rootDir });
  });

  app.use(function (error, request, response, next) {
    if (error && (error.status === 404 || error.statusCode === 404)) {
      response.status(404).type("text/plain").send("Not found");
      return;
    }
    next(error);
  });
  app.use(function (request, response) {
    response.status(404).type("text/plain").send("Not found");
  });

  return app;
}
