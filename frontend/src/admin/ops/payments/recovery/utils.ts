export function maskId(id: string, opts?: { prefix?: number; suffix?: number }): string {
  const s = String(id || "");
  if (!s) return "";
  const prefix = opts?.prefix ?? 6;
  const suffix = opts?.suffix ?? 4;
  if (s.length <= prefix + suffix + 3) return s;
  return `${s.slice(0, prefix)}…${s.slice(-suffix)}`;
}

export function formatIsoDate(iso: string | Date | undefined | null): string {
  if (!iso) return "";
  const d = iso instanceof Date ? iso : new Date(String(iso));
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString();
}

export function formatAgeMinutes(ageMinutes: number | undefined | null): string {
  const n = Number(ageMinutes);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 60) return `${Math.floor(n)}m`;
  const h = Math.floor(n / 60);
  const m = Math.floor(n % 60);
  return `${h}h ${m}m`;
}

export function stableKey(...parts: Array<string | number | undefined | null>): string {
  return parts.map((p) => String(p ?? "")).join("|");
}
