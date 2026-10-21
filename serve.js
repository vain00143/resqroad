// Minimal static file server for running ResQRoad locally without Python.
// Usage: node serve.js [port]   (default port 8000)

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] || process.env.PORT || 8000);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

http
  .createServer(function (request, response) {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    } catch (error) {
      response.writeHead(400).end("Bad request");
      return;
    }
    if (pathname.endsWith("/")) {
      pathname += "index.html";
    }
    const filePath = path.normalize(path.join(root, pathname));
    // Never serve anything outside the project folder.
    if (!filePath.startsWith(root + path.sep)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    fs.stat(filePath, function (error, stats) {
      if (error || !stats.isFile()) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
        return;
      }
      response.writeHead(200, {
        "Content-Type": types[path.extname(filePath).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      fs.createReadStream(filePath).pipe(response);
    });
  })
  .listen(port, function () {
    console.log("ResQRoad is running at http://localhost:" + port + "/");
  });
