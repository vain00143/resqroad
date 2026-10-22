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

// Runs `work(connection)` in a transaction; rolls back if it throws.
export async function transaction(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback().catch(function () {});
    throw error;
  } finally {
    connection.release();
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
    await addMissingColumns(connection);
  } finally {
    await connection.end();
  }
}

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
];

export async function addMissingColumns(connection) {
  for (const item of addedColumns) {
    const [rows] = await connection.query(
      "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
      [item.table, item.column],
    );
    if (!rows.length) {
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
