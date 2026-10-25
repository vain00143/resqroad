// The signed-in session and the data every screen shares: the account, all
// reports this account may see, and the crew list. Kept current by the live
// connection, and reloaded after reconnecting or returning to the app.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";

import { api, configureApi, NetworkError, normalizeServerUrl } from "@/lib/api";
import { connectLive, type LiveConnection, type LiveStatus } from "@/lib/live";
import type { Crew, Report, User } from "@/lib/reports";
import { readItem, removeItem, storageKeys, writeItem } from "@/lib/storage";
import { announce, describeChange } from "@/lib/updates";

type Status = "loading" | "signedOut" | "signedIn";

type StateResponse = { user: User | null; reports: Report[]; crews: Crew[] };
type SignInResponse = { user: User; token: string; expiresAt: string };

type Session = {
  status: Status;
  serverUrl: string;
  user: User | null;
  reports: Report[];
  crews: Crew[];
  // True once reports have loaded from the server at least once.
  loaded: boolean;
  connection: LiveStatus;
  // Shown on the sign-in screen, e.g. why the session ended.
  notice: string | null;
  setServerUrl: (url: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  reconnect: () => Promise<void>;
  upsertReport: (report: Report) => void;
};

const SessionContext = createContext<Session | null>(null);

const defaultServer = normalizeServerUrl(process.env.EXPO_PUBLIC_API_URL ?? "");
const sessionEnded = "Your session has ended. Sign in again to continue.";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [serverUrl, setServerUrlState] = useState(defaultServer);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [crews, setCrews] = useState<Crew[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [connection, setConnection] = useState<LiveStatus>("connecting");
  const [notice, setNotice] = useState<string | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const live = useRef<LiveConnection | null>(null);
  // The latest values, for comparing what a live update changed.
  const latest = useRef({ user, reports });
  latest.current = { user, reports };

  // Forgets the session on this phone.
  const endLocally = useCallback(async (message: string | null) => {
    live.current?.close();
    configureApi({ token: null });
    setToken(null);
    setUser(null);
    setReports([]);
    setCrews([]);
    setLoaded(false);
    setNotice(message);
    setStatus("signedOut");
    await Promise.all([removeItem(storageKeys.token), removeItem(storageKeys.user)]);
  }, []);

  const refresh = useCallback(() => {
    if (!inFlight.current) {
      inFlight.current = (async () => {
        try {
          const state = await api<StateResponse>("/state");
          if (!state.user) {
            await endLocally(sessionEnded);
            return;
          }
          setUser(state.user);
          setReports(state.reports);
          setCrews(state.crews);
          setLoaded(true);
          await writeItem(storageKeys.user, JSON.stringify(state.user));
        } catch (error) {
          if (error instanceof NetworkError) {
            setConnection("offline");
          }
          throw error;
        } finally {
          inFlight.current = null;
        }
      })();
    }
    return inFlight.current;
  }, [endLocally]);

  // Reopen a saved session when the app starts.
  useEffect(() => {
    configureApi({ onUnauthorized: () => void endLocally(sessionEnded) });
    (async () => {
      const [savedServer, savedDefault, savedToken, savedUser] = await Promise.all([
        readItem(storageKeys.server),
        readItem(storageKeys.serverDefault),
        readItem(storageKeys.token),
        readItem(storageKeys.user),
      ]);
      // An app update with a new built-in address (say, the server moved from
      // a laptop online) replaces an address saved under the old one, along
      // with the sign-in, which only works on the server that made it.
      if ((savedServer || savedToken) && savedDefault !== defaultServer) {
        await Promise.all([
          removeItem(storageKeys.server),
          removeItem(storageKeys.serverDefault),
          removeItem(storageKeys.token),
          removeItem(storageKeys.user),
        ]);
        setServerUrlState(defaultServer);
        configureApi({ baseUrl: defaultServer });
        setNotice("ResQRoad moved to a new server. Sign in again to continue.");
        setStatus("signedOut");
        return;
      }
      // Server settings exist only in development builds; an installed APK
      // always uses its built-in address.
      const server = (__DEV__ && savedServer) || defaultServer;
      setServerUrlState(server);
      configureApi({ baseUrl: server });

      let cachedUser: User | null = null;
      try {
        cachedUser = savedUser ? (JSON.parse(savedUser) as User) : null;
      } catch {
        cachedUser = null;
      }
      if (!savedToken || !cachedUser) {
        setStatus("signedOut");
        return;
      }
      configureApi({ token: savedToken });
      setToken(savedToken);
      setUser(cachedUser);
      setStatus("signedIn");
      // Offline is fine here: the screens show the offline state and retry.
      refresh().catch(() => {});
    })();
  }, [endLocally, refresh]);

  const upsertReport = useCallback((report: Report) => {
    setReports((current) => {
      const index = current.findIndex((item) => item.id === report.id);
      if (index === -1) {
        return [report, ...current];
      }
      const next = current.slice();
      next[index] = report;
      return next;
    });
  }, []);

  // One live connection while signed in.
  useEffect(() => {
    if (status !== "signedIn" || !token || !serverUrl) {
      return;
    }
    const connection = connectLive(serverUrl, token, {
      // After a reconnect, catch up on anything missed.
      onHello: () => void refresh().catch(() => {}),
      onReport: (report) => {
        const { user: viewer, reports: current } = latest.current;
        const update = viewer ? describeChange(current.find((item) => item.id === report.id), report, viewer) : null;
        upsertReport(report);
        if (update) {
          announce(update);
        }
      },
      onCrews: setCrews,
      onSignedOut: () => void endLocally("You were signed out of ResQRoad. Sign in again to continue."),
      onStatus: setConnection,
    });
    live.current = connection;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        connection.reconnectNow();
        refresh().catch(() => {});
      }
    });
    return () => {
      subscription.remove();
      connection.close();
      live.current = null;
    };
  }, [status, token, serverUrl, refresh, upsertReport, endLocally]);

  const startSession = useCallback(
    async (response: SignInResponse) => {
      if (response.user.role === "admin") {
        // The app is for residents and crews; don't keep this session.
        await api("/auth/logout", { method: "POST", token: response.token }).catch(() => {});
        throw new Error("Administrators use the ResQRoad website. Open " + serverUrl + " in a browser.");
      }
      configureApi({ token: response.token });
      await Promise.all([
        writeItem(storageKeys.token, response.token),
        writeItem(storageKeys.user, JSON.stringify(response.user)),
        writeItem(storageKeys.serverDefault, defaultServer),
      ]);
      setNotice(null);
      setToken(response.token);
      setUser(response.user);
      setStatus("signedIn");
      refresh().catch(() => {});
    },
    [serverUrl, refresh],
  );

  const value = useMemo<Session>(
    () => ({
      status,
      serverUrl,
      user,
      reports,
      crews,
      loaded,
      connection,
      notice,
      async setServerUrl(url) {
        const normalized = normalizeServerUrl(url);
        configureApi({ baseUrl: normalized });
        setServerUrlState(normalized);
        await Promise.all([
          writeItem(storageKeys.server, normalized),
          writeItem(storageKeys.serverDefault, defaultServer),
        ]);
      },
      async signIn(email, password) {
        await startSession(await api<SignInResponse>("/auth/login", { body: { email, password }, token: null }));
      },
      async register(name, email, password) {
        await startSession(
          await api<SignInResponse>("/auth/register", { body: { name, email, password }, token: null }),
        );
      },
      async signOut() {
        live.current?.close();
        await api("/auth/logout", { method: "POST", timeoutMs: 5000 }).catch(() => {});
        await endLocally(null);
      },
      refresh,
      async reconnect() {
        await refresh();
        live.current?.reconnectNow();
      },
      upsertReport,
    }),
    [status, serverUrl, user, reports, crews, loaded, connection, notice, startSession, endLocally, refresh, upsertReport],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error("useSession must be used inside SessionProvider.");
  }
  return session;
}
