// Talks to the ResQRoad server (docs/API.md at the repo root). Every request
// carries the sign-in token; failures become errors whose message can be
// shown to people as-is.

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;

  constructor(message: string, status: number, data: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

// The server couldn't be reached at all (wrong address, server stopped,
// phone on another network).
export class NetworkError extends Error {}

type Config = {
  baseUrl: string;
  token: string | null;
  onUnauthorized: () => void;
};

const config: Config = { baseUrl: "", token: null, onUnauthorized: () => {} };

export function configureApi(update: Partial<Config>) {
  Object.assign(config, update);
}

export function getServerUrl() {
  return config.baseUrl;
}

// Accepts "192.168.1.13:8000", "http://192.168.1.13:8000/", or a URL ending
// in /api, and returns "http://192.168.1.13:8000".
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

// Photo `src` values are paths on the server.
export function serverAsset(path: string) {
  return config.baseUrl + path;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  form?: FormData;
  baseUrl?: string;
  token?: string | null;
  timeoutMs?: number;
};

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const baseUrl = options.baseUrl ?? config.baseUrl;
  const token = options.token === undefined ? config.token : options.token;
  if (!baseUrl) {
    throw new NetworkError("Set the ResQRoad server address first.");
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    // Makes sign-in and registration return a token instead of a cookie.
    "X-ResQRoad-Client": "mobile",
  };
  if (token) {
    headers.Authorization = "Bearer " + token;
  }
  let body: string | FormData | undefined;
  if (options.form) {
    body = options.form;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);
  let response: Response;
  try {
    response = await fetch(baseUrl + "/api" + path, {
      method: options.method ?? (body ? "POST" : "GET"),
      headers,
      body,
      signal: controller.signal,
    });
  } catch {
    throw new NetworkError("Can't reach the ResQRoad server. Check the server address and your Wi-Fi.");
  } finally {
    clearTimeout(timer);
  }

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    // A 401 on any signed-in request means the session ended.
    if (response.status === 401 && token && path !== "/auth/login") {
      config.onUnauthorized();
    }
    const message = typeof data.error === "string" ? data.error : "Something went wrong. Try again.";
    throw new ApiError(message, response.status, data);
  }
  return data as T;
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}
