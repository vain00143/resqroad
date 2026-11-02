// MySQL connection pool and small query helpers.

import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { config, rootDir } from "./config.js";

const settings = {
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  charset: "utf8mb4",
  // Dates come back as JavaScript Dates in UTC, and are stored in UTC.
  timezone: "Z",
  decimalNumbers: true,
  ssl: config.db.ssl,
};

export const pool = mysql.createPool(
  Object.assign({}, settings, {
    database: config.db.database,
    connectionLimit: 10,
    waitForConnections: true,
  }),
);

pool.on("connection", function (connection) {
  connection.query("SET time_zone = '+00:00'");
});

export async function query(sql, params) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function one(sql, params) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

// Runs `work(connection)` in a transaction; rolls back if it throws. When two
// requests lock the same rows at once (e.g. the same upload sent twice),
// MySQL cancels one with a deadlock; that one runs again from the start and
// then sees what the other saved.
export async function transaction(work) {
  for (let attempt = 1; ; attempt += 1) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback().catch(function () {});
      if (!(error && error.code === "ER_LOCK_DEADLOCK" && attempt < 3)) {
        throw error;
      }
    } finally {
      connection.release();
    }
  }
}

// Creates the database if needed and applies database/schema.sql.
export async function setupDatabase() {
  const connection = await mysql.createConnection(Object.assign({}, settings, { multipleStatements: true }));
  try {
    const name = config.db.database;
    if (!/^[A-Za-z0-9_]+$/.test(name)) {
      throw new Error("DB_NAME may only contain letters, numbers, and underscores.");
    }
    await connection.query(
      "CREATE DATABASE IF NOT EXISTS `" + name + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
    );
    await connection.query("USE `" + name + "`");
    const schema = fs.readFileSync(path.join(rootDir, "database", "schema.sql"), "utf8");
    await connection.query(schema);
    await upgradeSchema(connection);
  } finally {
    await connection.end();
  }
}

// Tables added to database/schema.sql after the first release, created on
// every server start too, in case db:setup wasn't run after updating.
const addedTables = [
  "CREATE TABLE IF NOT EXISTS report_feedback (" +
    "id INT UNSIGNED NOT NULL AUTO_INCREMENT, " +
    "report_id INT UNSIGNED NOT NULL, " +
    "user_id INT UNSIGNED NULL, " +
    "rating TINYINT UNSIGNED NOT NULL COMMENT '1 (poor) to 5 (excellent)', " +
    "comment TEXT NULL, " +
    "created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), " +
    "PRIMARY KEY (id), " +
    "UNIQUE KEY feedback_report (report_id), " +
    "KEY feedback_user (user_id), " +
    "CONSTRAINT feedback_rating CHECK (rating BETWEEN 1 AND 5), " +
    "CONSTRAINT feedback_report_fk FOREIGN KEY (report_id) REFERENCES reports (id) ON DELETE CASCADE, " +
    "CONSTRAINT feedback_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL" +
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
];

// Columns added to database/schema.sql after the first release.
// CREATE TABLE IF NOT EXISTS leaves existing tables alone, so databases set up
// earlier get them here (and on every server start, in case db:setup wasn't
// run after updating).
const addedColumns = [
  {
    table: "reports",
    column: "client_key",
    alter:
      "ALTER TABLE reports ADD COLUMN client_key VARCHAR(64) NULL " +
      "COMMENT 'Idempotency-Key from the app: a retried upload returns this report' AFTER reporter_id, " +
      "ADD UNIQUE KEY reports_client_key (reporter_id, client_key)",
  },
  {
    table: "reports",
    column: "repair_client_key",
    alter:
      "ALTER TABLE reports ADD COLUMN repair_client_key VARCHAR(64) NULL " +
      "COMMENT 'Idempotency-Key of the latest repair upload' AFTER repair_notes",
  },
  {
    table: "report_feedback",
    column: "outcome",
    alter:
      "ALTER TABLE report_feedback ADD COLUMN outcome ENUM('fixed', 'partial', 'unresolved') NULL " +
      "COMMENT 'Is the road fully repaired? NULL on ratings sent before this was asked' AFTER rating",
  },
  {
    table: "report_feedback",
    column: "tags",
    alter:
      "ALTER TABLE report_feedback ADD COLUMN tags VARCHAR(255) NULL " +
      "COMMENT 'Quick tags, comma separated (fast, quality, smooth, ...)' AFTER outcome",
  },
];

// ENUM columns that gained a value after the first release.
const widenedColumns = [
  {
    table: "photos",
    column: "kind",
    value: "feedback",
    alter: "ALTER TABLE photos MODIFY COLUMN kind ENUM('evidence', 'before', 'after', 'feedback') NOT NULL",
  },
];

// Brings a database set up by an earlier version up to date.
export async function upgradeSchema(connection) {
  for (const statement of addedTables) {
    await connection.query(statement);
  }
  for (const item of addedColumns) {
    const [rows] = await connection.query(
      "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
      [item.table, item.column],
    );
    if (!rows.length) {
      await connection.query(item.alter);
    }
  }
  for (const item of widenedColumns) {
    const [rows] = await connection.query(
      "SELECT COLUMN_TYPE AS type FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
      [item.table, item.column],
    );
    if (rows.length && !String(rows[0].type).includes("'" + item.value + "'")) {
      await connection.query(item.alter);
    }
  }
}

// Turns MySQL connection errors into instructions a person can act on.
export function explainDatabaseError(error) {
  const where = config.db.host + ":" + config.db.port;
  if (error && (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT")) {
    return (
      "Can't reach MySQL at " + where + ". Start MySQL (the MySQL80 service in Windows Services, or MySQL in the " +
      "XAMPP Control Panel) and check DB_HOST and DB_PORT in .env."
    );
  }
  if (error && error.code === "ER_ACCESS_DENIED_ERROR") {
    return "MySQL refused the username or password. Check DB_USER and DB_PASSWORD in .env.";
  }
  if (error && error.code === "ER_BAD_DB_ERROR") {
    return "The database `" + config.db.database + "` doesn't exist yet. Run `npm run db:setup` first.";
  }
  if (error && error.code === "ER_NO_SUCH_TABLE") {
    return "The ResQRoad tables are missing. Run `npm run db:setup` first.";
  }
  return (error && error.message) || String(error);
}
