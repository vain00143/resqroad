// Creates an administrator account (or resets an existing administrator's
// password). Administrators can't be created from the website.
//
//   npm run create-admin
//   npm run create-admin -- --name "Juana Dela Cruz" --email admin@lgu.gov.ph
//
// The password is typed in (never passed on the command line).

import { hashPassword, normalizeEmail, validatePassword } from "../server/auth.js";
import { explainDatabaseError, one, pool, query } from "../server/db.js";
import { ask, askHidden } from "./prompt.js";

function option(name) {
  const index = process.argv.indexOf("--" + name);
  return index > -1 ? process.argv[index + 1] : "";
}

async function main() {
  const name = (option("name") || (await ask("Administrator's full name: "))).trim();
  const email = normalizeEmail(option("email") || (await ask("Email: ")));
  if (name.length < 2) {
    throw new Error("Enter a full name.");
  }

  const password = await askHidden("Password (8+ characters, a letter and a number): ");
  validatePassword(password);
  const again = await askHidden("Type the password again: ");
  if (again !== password) {
    throw new Error("The passwords don't match.");
  }

  const existing = await one("SELECT id, role FROM users WHERE email = ?", [email]);
  const hash = await hashPassword(password);
  if (existing && existing.role !== "admin") {
    throw new Error("That email already belongs to a " + existing.role + " account.");
  }
  if (existing) {
    await query("UPDATE users SET name = ?, password_hash = ?, active = 1, deleted_at = NULL WHERE id = ?", [name, hash, existing.id]);
    await query("DELETE FROM sessions WHERE user_id = ?", [existing.id]);
    console.log("Updated the administrator " + email + ".");
  } else {
    await query("INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, 'admin', 1)", [name, email, hash]);
    console.log("Created the administrator " + email + ". Sign in at /login.html.");
  }
}

main()
  .catch(function (error) {
    console.error(explainDatabaseError(error));
    process.exitCode = 1;
  })
  .finally(function () {
    return pool.end();
  });
