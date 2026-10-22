// Talks to the ResQRoad server (docs/API.md at the repo root). Every request
// carries the sign-in token; failures become errors whose message can be
// shown to people as-is.

import NetInfo from "@react-native-community/netinfo";

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;

  constructor(message: string, status: number, data: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

// Why a request got no answer: the phone has no internet, the server didn't
// answer (stopped, wrong address, phone on another network, or the free
// hosted server still waking up), or it ran past its time limit.
export type NetworkProblem = "offline" | "unreachable" | "timeout";

export class NetworkError extends Error {
  problem: NetworkProblem;

  constructor(message: string, problem: NetworkProblem = "unreachable") {
    super(message);
    this.problem = problem;
  }
}

type Config = {
  baseUrl: string;
  token: string | null;
  onUnauthorized: () => void;
};

const config: Config = { baseUrl: "", token: null, onUnauthorized: () => {} };

// When the server last answered; see wakeServer.
let awakeAt = 0;

export function configureApi(update: Partial<Config>) {
  if (update.baseUrl !== undefined && update.baseUrl !== config.baseUrl) {
    awakeAt = 0;
    configureReachability(update.baseUrl);
  }
  Object.assign(config, update);
}

// NetInfo's "internet reachable" check asks the ResQRoad server itself, not
// Google (Android's own check, used by default, also goes to Google), so a
// network that can reach the server is never called offline. Because the
// check fails while the hosted server is asleep too, only "no network at all"
// (isConnected false) is treated as offline; see offlineError.
function configureReachability(baseUrl: string) {
  if (!baseUrl) {
    return;
  }
  NetInfo.configure({
    reachabilityUrl: baseUrl + "/api/health",
    reachabilityTest: async (response) => response.status === 200,
    useNativeReachability: false,
  });
}

export function getServerUrl() {
  return config.baseUrl;
}

// Accepts "192.168.1.15:8000", "http://192.168.1.15:8000/", or a URL ending
// in /api, and returns "http://192.168.1.15:8000".
export function normalizeServerUrl(input: string): string {
  let value = input.trim();
  if (!value) {
    return "";
  }
  if (!/^https?:\/\//i.test(value)) {
    value = "http://" + value;
  }
  return value.replace(/\/+$/, "").replace(/\/api$/i, "");
}

// An HTTPS address is the hosted copy (on the internet); plain http is a laptop
// on the local network.
export function isHostedServer(baseUrl: string) {
  return /^https:\/\//i.test(baseUrl);
}

// The free hosted server sleeps when nobody uses it and takes about a minute
// to wake (sometimes more), so requests to it wait longer.
export function defaultTimeout(baseUrl: string) {
  return isHostedServer(baseUrl) ? 90000 : 15000;
}

// Photo uploads may have to wait for the hosted server to wake up first.
export function uploadTimeout(baseUrl: string) {
  return isHostedServer(baseUrl) ? 90000 : 30000;
}

// Photo `src` values are paths on the server, or full addresses if photos are
// kept elsewhere (such as object storage).
export function serverAsset(path: string) {
  return /^https?:\/\//i.test(path) ? path : config.baseUrl + path;
}

function requestHeaders(token: string | null) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    // Makes sign-in and registration return a token instead of a cookie.
    "X-ResQRoad-Client": "mobile",
  };
  if (token) {
    headers.Authorization = "Bearer " + token;
  }
  return headers;
}

function describeError(error: unknown) {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const cause = error.cause instanceof Error ? " (cause: " + error.cause.message + ")" : "";
  return error.name + ": " + error.message + cause;
}

function unreachableMessage(baseUrl: string) {
  return (
    "Can't reach the ResQRoad server at " +
    baseUrl +
    (isHostedServer(baseUrl)
      ? ". If this phone's internet is working, the server may still be starting up; try again in a minute."
      : ". Make sure the server is running and this phone is on the same Wi-Fi, or change the address under Server settings.")
  );
}

function timeoutMessage(baseUrl: string) {
  return isHostedServer(baseUrl)
    ? "The ResQRoad server took too long to answer. It may be waking up or the connection is slow; try again."
    : "The ResQRoad server at " + baseUrl + " took too long to answer. Check that it's still running and try again.";
}

// Null unless the phone has no network at all (Wi-Fi and mobile data off, or
// airplane mode). "Internet not reachable" isn't enough: that check asks the
// server, which also fails while it's asleep.
async function offlineError(): Promise<NetworkError | null> {
  const state = await NetInfo.fetch().catch(() => null);
  if (state && state.isConnected === false) {
    return new NetworkError(
      "This phone isn't connected to the internet. Turn on Wi-Fi or mobile data and try again.",
      "offline",
    );
  }
  return null;
}

// Messages fetch implementations use when the connection itself failed:
// expo/fetch ("fetch failed: …"), React Native ("Network request failed"),
// and browsers ("Failed to fetch", "Load failed", "NetworkError when …").
const connectionFailure = /fetch failed|network request failed|failed to fetch|load failed|networkerror/i;

// Logs what really went wrong (in `npx expo start`, or `adb logcat` for the
// APK) and turns it into a message people can act on. Anything that isn't a
// connection failure is a problem building the request, and says so instead
// of blaming the network.
async function requestFailed(error: unknown, baseUrl: string, path: string, timedOut: boolean): Promise<Error> {
  console.warn("ResQRoad request " + path + " failed" + (timedOut ? " (timed out)" : "") + ": " + describeError(error));
  if (timedOut) {
    return new NetworkError(timeoutMessage(baseUrl), "timeout");
  }
  if (error instanceof Error && !(error instanceof NetworkError) && !connectionFailure.test(error.message)) {
    return new Error("The app couldn't send this request (" + error.message + "). Try again, or update the app.");
  }
  return (await offlineError()) ?? new NetworkError(unreachableMessage(baseUrl), "unreachable");
}

// Render answers 502–504 while the hosted server is starting or redeploying.
const gatewayStatuses = [502, 503, 504];

function readResponse<T>(status: number, data: Record<string, unknown>, token: string | null, path: string): T {
  if (status >= 200 && status < 300) {
    awakeAt = Date.now();
    return data as T;
  }
  console.warn("ResQRoad request " + path + " answered " + status + ": " + JSON.stringify(data));
  // A 401 on any signed-in request means the session ended.
  if (status === 401 && token && path !== "/auth/login") {
    config.onUnauthorized();
  }
  let message = typeof data.error === "string" ? data.error : "Something went wrong. Try again.";
  if (gatewayStatuses.includes(status)) {
    message = "The ResQRoad server is starting up or busy (error " + status + "). Try again in a moment.";
  } else if (status >= 500) {
    message = "Server error " + status + ": " + message;
  }
  throw new ApiError(message, status, data);
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  baseUrl?: string;
  token?: string | null;
  timeoutMs?: number;
};

// JSON requests. Photo uploads go through `upload` instead.
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const baseUrl = options.baseUrl ?? config.baseUrl;
  const token = options.token === undefined ? config.token : options.token;
  if (!baseUrl) {
    throw new NetworkError("Set the ResQRoad server address first.");
  }

  const headers = requestHeaders(token);
  let body: string | undefined;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? defaultTimeout(baseUrl));
  let response: Response;
  try {
    response = await fetch(baseUrl + "/api" + path, {
      method: options.method ?? (body ? "POST" : "GET"),
      headers,
      body,
      signal: controller.signal,
    });
  } catch (error) {
    throw await requestFailed(error, baseUrl, path, timedOut);
  } finally {
    clearTimeout(timer);
  }

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return readResponse<T>(response.status, data, token, path);
}

type UploadOptions = {
  timeoutMs?: number;
  // Lets the server recognize a retry of a request it already carried out.
  idempotencyKey?: string;
  // From 0 to 1 as the form is sent.
  onProgress?: (fraction: number) => void;
};

// Multipart forms with photos. Expo's fetch can't send React Native's
// { uri, name, type } photo parts (it throws "Unsupported FormDataPart
// implementation" before anything is sent), so these use XMLHttpRequest,
// which streams the files from disk and reports upload progress. Never set
// Content-Type here: the multipart boundary is added automatically.
export async function upload<T>(path: string, form: FormData, options: UploadOptions = {}): Promise<T> {
  const baseUrl = config.baseUrl;
  const token = config.token;
  if (!baseUrl) {
    throw new NetworkError("Set the ResQRoad server address first.");
  }
  const offline = await offlineError();
  if (offline) {
    throw offline;
  }

  const headers = requestHeaders(token);
  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }
  const { status, text } = await new Promise<{ status: number; text: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", baseUrl + "/api" + path);
    Object.entries(headers).forEach(([name, value]) => xhr.setRequestHeader(name, value));
    xhr.timeout = options.timeoutMs ?? uploadTimeout(baseUrl);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        options.onProgress?.(event.loaded / event.total);
      }
    };
    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText });
    xhr.onerror = () => {
      void requestFailed(new Error("Network request failed"), baseUrl, path, false).then(reject);
    };
    xhr.ontimeout = () => {
      void requestFailed(new Error("Upload timed out"), baseUrl, path, true).then(reject);
    };
    xhr.send(form);
  });

  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    data = {};
  }
  return readResponse<T>(status, data, token, path);
}

// The free hosted server sleeps after about 15 minutes without visitors and
// takes 30–60 seconds to start. Screens about to upload call this early so
// the wait happens while people fill in the form; it resolves at once if the
// server answered anything in the last few minutes. A start that runs past
// the time limit gets one more wait before "took too long" is shown.
let waking: Promise<void> | null = null;

function pingHealth() {
  // GET /api/health
  return api("/health", { token: null, timeoutMs: uploadTimeout(config.baseUrl) });
}

export function wakeServer(): Promise<void> {
  if (Date.now() - awakeAt < 5 * 60 * 1000) {
    return Promise.resolve();
  }
  waking ??= pingHealth()
    .catch((error) => {
      if (error instanceof NetworkError && error.problem === "timeout") {
        return pingHealth();
      }
      throw error;
    })
    .then(() => undefined)
    .finally(() => {
      waking = null;
    });
  return waking;
}

// Shown while an upload waits for the server or tries again.
export const wakingMessage =
  "Waking up the ResQRoad server. It sleeps when nobody's using it and can take up to a minute to start.";

export function retryMessage(attempt: number, of: number) {
  return "No answer from the server yet. Trying again (" + attempt + " of " + of + ")…";
}

// Worth sending again: the server didn't answer or is restarting. Never
// errors it answered on purpose, such as a 4xx about the form.
export function isTemporary(error: unknown) {
  if (error instanceof NetworkError) {
    return error.problem !== "offline";
  }
  return error instanceof ApiError && gatewayStatuses.includes(error.status);
}

// Runs `send` up to three times, waiting a little longer before each retry.
// Only for requests the server can recognize as repeats (an idempotency key).
export async function withRetries<T>(
  send: () => Promise<T>,
  onRetry?: (attempt: number, of: number) => void,
): Promise<T> {
  const delays = [3000, 8000];
  for (let attempt = 0; ; attempt++) {
    try {
      return await send();
    } catch (error) {
      if (attempt >= delays.length || !isTemporary(error)) {
        throw error;
      }
      onRetry?.(attempt + 2, delays.length + 1);
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }
  }
}

// A key for one report form, sent with every attempt to submit it. It only
// has to be unique among one resident's reports.
export function newIdempotencyKey() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}
