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
  } finally {
    await connection.end();
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
