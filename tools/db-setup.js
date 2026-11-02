// Creates the ResQRoad database and tables (database/schema.sql) on the MySQL
// server in .env. Safe to run again; existing data is kept.
//
//   npm run db:setup

import { config } from "../server/config.js";
import { explainDatabaseError, pool, setupDatabase } from "../server/db.js";

try {
  await setupDatabase();
  console.log("Database `" + config.db.database + "` is ready on " + config.db.host + ":" + config.db.port + ".");
  console.log("Next: `npm run create-admin` to add an administrator, or `npm run seed` for sample data.");
} catch (error) {
  console.error("Database setup failed: " + explainDatabaseError(error));
  process.exitCode = 1;
} finally {
  await pool.end();
}
