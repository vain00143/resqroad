// Live updates from the server over a WebSocket (/api/live). Reconnects with
// a growing delay whenever the connection drops.

import type { Crew, Report, User } from "@/lib/reports";

export type LiveStatus = "connecting" | "online" | "offline";

type Handlers = {
  onHello: (user: User) => void;
  onReport: (report: Report) => void;
  onCrews: (crews: Crew[]) => void;
  onSignedOut: () => void;
  onStatus: (status: LiveStatus) => void;
};

export type LiveConnection = {
  close: () => void;
  reconnectNow: () => void;
};

// React Native's WebSocket takes headers as a third argument.
type NativeWebSocket = new (url: string, protocols: null, options: { headers: Record<string, string> }) => WebSocket;

export function connectLive(baseUrl: string, token: string, handlers: Handlers): LiveConnection {
  const url = baseUrl.replace(/^http/i, "ws") + "/api/live";
  let socket: WebSocket | null = null;
  let closed = false;
  let attempt = 0;
  let failed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function open() {
    // After a failure, stay "offline" until the server actually answers.
    if (!failed) {
      handlers.onStatus("connecting");
    }
    let sentAuth = false;
    // Browsers ignore the headers, so the token is also sent as a message
    // when the first greeting comes back without a user.
    const ws = new (WebSocket as unknown as NativeWebSocket)(url, null, {
      headers: { Authorization: "Bearer " + token },
    });
    socket = ws;

    ws.onmessage = (event) => {
      if (closed) {
        return;
      }
      let message: { type?: string; user?: User | null; report?: Report; crews?: Crew[] };
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (message.type === "hello") {
        if (message.user) {
          attempt = 0;
          failed = false;
          handlers.onStatus("online");
          handlers.onHello(message.user);
        } else if (!sentAuth) {
          sentAuth = true;
          ws.send(JSON.stringify({ type: "auth", token }));
        } else {
          stop();
          handlers.onSignedOut();
        }
      } else if (message.type === "report" && message.report) {
        handlers.onReport(message.report);
      } else if (message.type === "accounts" && message.crews) {
        handlers.onCrews(message.crews);
      } else if (message.type === "signed-out") {
        stop();
        handlers.onSignedOut();
      }
    };

    ws.onclose = () => {
      if (socket === ws) {
        socket = null;
      }
      if (closed) {
        return;
      }
      failed = true;
      handlers.onStatus("offline");
      const delay = Math.min(30000, 1000 * 2 ** attempt);
      attempt += 1;
      timer = setTimeout(open, delay);
    };
  }

  function stop() {
    closed = true;
    clearTimeout(timer);
    socket?.close();
    socket = null;
  }

  open();

  return {
    close: stop,
    // Used when the app comes back to the foreground.
    reconnectNow() {
      if (!closed && !socket) {
        clearTimeout(timer);
        attempt = 0;
        open();
      }
    },
  };
}
