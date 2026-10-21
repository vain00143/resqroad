// Live updates over WebSocket (ws://<server>/api/live).
//
// Every open page and app screen keeps one connection. When anything changes,
// the server pushes the new data to every connected device, shaped for each
// viewer's role (for example, internal notes only go to administrators).
//
// Browsers are recognised by their sign-in cookie. The mobile app can send
// `Authorization: Bearer <token>` with the connection, or send
// {"type":"auth","token":"<token>"} as its first message.

import { WebSocketServer } from "ws";
import { originAllowed, readToken, userForToken } from "./auth.js";

const sockets = new Set();

function send(socket, message) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function hello(socket) {
  send(socket, { type: "hello", user: socket.user });
}

export function attachLive(server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });

  server.on("upgrade", async function (request, socket, head) {
    let pathname = "";
    try {
      pathname = new URL(request.url, "http://localhost").pathname;
    } catch (error) {
      pathname = "";
    }
    if (pathname !== "/api/live") {
      socket.destroy();
      return;
    }
    let session = null;
    const found = readToken(request);
    // A cookie only counts when the page is on this site (stops other
    // websites from opening a connection as the signed-in person).
    if (found && (found.via === "bearer" || originAllowed(request))) {
      session = await userForToken(found.token).catch(function () {
        return null;
      });
    }
    wss.handleUpgrade(request, socket, head, function (ws) {
      ws.user = session ? session.user : null;
      ws.tokenHash = session ? session.tokenHash : null;
      ws.alive = true;
      sockets.add(ws);
      hello(ws);

      ws.on("pong", function () {
        ws.alive = true;
      });
      ws.on("message", async function (data) {
        let message;
        try {
          message = JSON.parse(String(data));
        } catch (error) {
          return;
        }
        if (message && message.type === "auth") {
          const result = await userForToken(message.token).catch(function () {
            return null;
          });
          ws.user = result ? result.user : null;
          ws.tokenHash = result ? result.tokenHash : null;
          hello(ws);
        } else if (message && message.type === "ping") {
          send(ws, { type: "pong" });
        }
      });
      ws.on("close", function () {
        sockets.delete(ws);
      });
      ws.on("error", function () {
        sockets.delete(ws);
      });
    });
  });

  // Drop connections that stopped answering (phones going offline, etc.).
  const heartbeat = setInterval(function () {
    sockets.forEach(function (ws) {
      if (!ws.alive) {
        ws.terminate();
        sockets.delete(ws);
        return;
      }
      ws.alive = false;
      ws.ping();
    });
  }, 30000);
  heartbeat.unref();

  return {
    close: function () {
      clearInterval(heartbeat);
      sockets.forEach(function (ws) {
        ws.terminate();
      });
      sockets.clear();
      wss.close();
    },
  };
}

// Sends `build(user)` to every device; `build` returns null to skip one.
export function broadcast(build) {
  sockets.forEach(function (ws) {
    try {
      const message = build(ws.user);
      if (message) {
        send(ws, message);
      }
    } catch (error) {
      console.error("A live update failed.", error);
    }
  });
}

// Tells devices whose session ended (sign-out, deactivation) and stops
// sending them private data.
export function signOutDevices(match) {
  sockets.forEach(function (ws) {
    if (ws.user && match(ws)) {
      ws.user = null;
      ws.tokenHash = null;
      send(ws, { type: "signed-out" });
    }
  });
}

export function connectionCount() {
  return sockets.size;
}
