export function getApiOrigin(): string {
  console.log("API BASE URL:", typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_BASE_URL : undefined);

  const raw = String(
    (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_BASE_URL : "") ||
      import.meta.env.VITE_API_URL ||
      ""
  ).trim();
  if (raw) return raw.replace(/\/+$/, "");
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
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
