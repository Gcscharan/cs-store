export function maskUpiVpa(raw: string): string {
  const v = String(raw || "").trim();
  if (!v) return "";

  const at = v.indexOf("@");
  const local = at >= 0 ? v.slice(0, at) : v;
  const domain = at >= 0 ? v.slice(at + 1) : "";

  const first = local.length > 0 ? local[0] : "*";
  const maskedLocal = `${first}***`;

  if (!domain) return maskedLocal;
  return `${maskedLocal}@${domain}`;
}
