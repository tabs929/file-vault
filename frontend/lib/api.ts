const ABSOLUTE_API_URL = /^https?:\/\//;

function requireAbsoluteApiUrl(
  raw: string | undefined,
  name: string
): string {
  const configured = raw?.trim();
  if (!configured || !ABSOLUTE_API_URL.test(configured)) {
    throw new Error(`${name} must be set to an absolute http(s) URL`);
  }
  return configured.replace(/\/$/, "");
}

// In production (Vercel), use the same-origin /api proxy to avoid cross-origin
// cookie issues. In development (Docker), call the backend directly.
const BROWSER_API_URL =
  typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? '/api'
    : requireAbsoluteApiUrl(process.env.NEXT_PUBLIC_API_URL, "NEXT_PUBLIC_API_URL");

/** Server-side fetches (RSC). In Docker use the api service name. */
const SERVER_API_URL = requireAbsoluteApiUrl(
  process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL,
  process.env.API_INTERNAL_URL ? "API_INTERNAL_URL" : "NEXT_PUBLIC_API_URL"
);

function resolveApiUrl(): string {
  return typeof window === "undefined" ? SERVER_API_URL : BROWSER_API_URL;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type FetchOptions = RequestInit & {
  serverCookies?: string;
};

async function apiFetch<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { serverCookies, ...init } = options;
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };

  const hasBody = init.body !== undefined && init.body !== null;
  if (hasBody && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (serverCookies) {
    headers.Cookie = serverCookies;
  }

  const response = await fetch(`${resolveApiUrl()}${path}`, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    let detail: unknown;
    try {
      detail = await response.json();
    } catch {
      detail = undefined;
    }
    const message =
      typeof detail === "object" &&
      detail !== null &&
      "detail" in detail &&
      typeof (detail as { detail: unknown }).detail === "string"
        ? (detail as { detail: string }).detail
        : response.statusText;
    throw new ApiError(response.status, message, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export { apiFetch, BROWSER_API_URL as API_URL };
