// Starts the ResQRoad server: website + API + live updates.

import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import { config } from "./config.js";
import { addMissingColumns, pool, explainDatabaseError } from "./db.js";
import { createApp } from "./app.js";
import { attachLive } from "./live.js";
import { deleteExpiredSessions } from "./auth.js";
import { photosDir } from "./photos.js";

function networkAddresses() {
  const addresses = [];
  Object.values(os.networkInterfaces()).forEach(function (list) {
    (list || []).forEach(function (item) {
      if (item.family === "IPv4" && !item.internal) {
        addresses.push(item.address);
      }
    });
  });
  return addresses;
}

export async function startServer(options) {
  const port = options && options.port !== undefined ? options.port : config.port;
  const host = (options && options.host) || config.host;
  const quiet = Boolean(options && options.quiet);

  await pool.query("SELECT 1 FROM users LIMIT 1");
  await addMissingColumns(pool);
  fs.mkdirSync(photosDir, { recursive: true });

  const server = http.createServer(createApp());
  const live = attachLive(server);
  const cleanup = setInterval(function () {
    deleteExpiredSessions().catch(function () {});
  }, 6 * 60 * 60 * 1000);
  cleanup.unref();

  await new Promise(function (resolve, reject) {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });

  const actualPort = server.address().port;
  if (!quiet) {
    console.log("ResQRoad is running at http://localhost:" + actualPort + "/");
    if (host === "0.0.0.0") {
      networkAddresses().forEach(function (address) {
        console.log("  On other devices on this network: http://" + address + ":" + actualPort + "/");
      });
    }
    console.log("  Database: " + config.db.database + " on " + config.db.host + ":" + config.db.port);
  }

  return {
    port: actualPort,
    close: async function () {
      clearInterval(cleanup);
      live.close();
      await new Promise(function (resolve) {
        server.close(resolve);
      });
    },
  };
}

export function startFromCommandLine(port) {
  startServer({ port: port }).catch(function (error) {
    if (error && error.code === "EADDRINUSE") {
      console.error("Port " + (port || config.port) + " is already in use. Stop the other server or set PORT in .env.");
    } else {
      console.error("ResQRoad couldn't start: " + explainDatabaseError(error));
    }
    process.exit(1);
  });
}
