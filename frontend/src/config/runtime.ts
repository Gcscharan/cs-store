const DEFAULT_API_BASE_URL = "";

function normalizeApiOrigin(value: unknown): string {
  let v = String(value ?? "").trim();
  if ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }

  if (/^VITE_API_URL\s*=/.test(v)) {
    v = v.replace(/^VITE_API_URL\s*=/, "").trim();
  }

  v = v.replace(/\/+$/, "");
  if (v.endsWith("/api")) {
    v = v.slice(0, -4);
  }

  return v;
}

const normalizedApiBaseUrl =
  normalizeApiOrigin(import.meta.env.VITE_API_URL) || DEFAULT_API_BASE_URL;

export const API_BASE_URL =
  import.meta.env.DEV &&
  (normalizedApiBaseUrl === "http://localhost:5000" ||
    normalizedApiBaseUrl === "http://127.0.0.1:5000")
    ? "http://localhost:5001"
    : normalizedApiBaseUrl;

if (!API_BASE_URL && !import.meta.env.DEV) {
  throw new Error("Missing required frontend env: VITE_API_URL");
}

console.log("API BASE URL:", API_BASE_URL);

export function getApiOrigin(): string {
  return API_BASE_URL;
}

export function getApiBaseUrl(): string {
  const origin = getApiOrigin();
  return origin ? `${origin}/api` : "/api";
}

export function toApiUrl(pathname: string): string {
  const p = String(pathname || "");
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  if (p.startsWith("/api")) {
    const origin = getApiOrigin();
    return origin ? `${origin}${p}` : p;
  }
  if (!p.startsWith("/")) return `${getApiBaseUrl()}/${p}`;
  return `${getApiBaseUrl()}${p}`;
}
