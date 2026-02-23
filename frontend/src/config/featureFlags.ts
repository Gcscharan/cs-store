function envBool(name: string, defaultValue: boolean): boolean {
  const raw = String((import.meta as any).env?.[name] ?? "").trim().toLowerCase();
  if (!raw) return defaultValue;
  if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") return true;
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") return false;
  return defaultValue;
}

export function isRefundsUiEnabled(): boolean {
  // UI-only kill switch. Default true to avoid behavior changes.
  return envBool("VITE_REFUNDS_UI_ENABLED", true);
}
