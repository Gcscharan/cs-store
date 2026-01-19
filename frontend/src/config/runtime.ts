const DEFAULT_API_BASE_URL = import.meta.env.DEV
  ? "http://localhost:5001"
  : "https://cps-store-backend.onrender.com";

export const API_BASE_URL = import.meta.env.VITE_API_URL || DEFAULT_API_BASE_URL;

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
  if (p.startsWith("/api")) return p;
  if (!p.startsWith("/")) return `${getApiBaseUrl()}/${p}`;
  return `${getApiBaseUrl()}${p}`;
}
