// Settings for the ResQRoad server, read from .env (see .env.example).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const envFile = path.join(rootDir, ".env");
if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

function list(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

// Express "trust proxy" setting: a number of proxy hops (behind a host such
// as Railway, 1) or a keyword like "loopback" (the default, for this computer).
function proxySetting(value) {
  if (!value) {
    return "loopback";
  }
  return /^\d+$/.test(value) ? Number(value) : value;
}

export const config = {
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "resqroad",
  },
  host: process.env.HOST || "0.0.0.0",
  port: Number(process.env.PORT || 8000),
  cookieSecure: process.env.COOKIE_SECURE === "true",
  corsOrigins: list(process.env.CORS_ORIGINS),
  trustProxy: proxySetting(process.env.TRUST_PROXY),
  storageDir: path.resolve(rootDir, process.env.STORAGE_DIR || "storage"),
  sessionDays: 30,
  maxPhotoBytes: 8 * 1024 * 1024,
  maxPhotosPerSet: 5,
};
