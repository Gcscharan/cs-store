import { getApiOrigin } from "../../../../config/runtime";

type QueryParamValue = string | number | boolean | undefined | null;

function buildQuery(params?: Record<string, QueryParamValue>): string {
  if (!params) return "";

  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    usp.set(k, String(v));
  }

  const s = usp.toString();
  return s ? `?${s}` : "";
}

function internalUrl(pathname: string): string {
  const p = String(pathname || "");
  const origin = getApiOrigin();
  if (!origin) return p;
  return `${origin}${p}`;
}

export async function internalGetJson<T>(args: {
  pathname: string;
  params?: Record<string, QueryParamValue>;
  accessToken?: string | null;
  signal?: AbortSignal;
}): Promise<{ data: T; nextCursor?: string }> {
  const url = internalUrl(`${args.pathname}${buildQuery(args.params)}`);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "content-type": "application/json",
      ...(args.accessToken ? { authorization: `Bearer ${args.accessToken}` } : {}),
    },
    signal: args.signal,
  });

  if (res.status === 401 || res.status === 403) {
    window.location.assign("/admin/login");
    throw new Error("UNAUTHORIZED");
  }

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      msg = String(body?.error || body?.message || msg);
    } catch {
    }
    throw new Error(msg);
  }

  const nextCursor = res.headers.get("x-next-cursor") || undefined;
  const data = (await res.json()) as T;
  return { data, nextCursor };
}

export async function internalGetBlob(args: {
  pathname: string;
  params?: Record<string, QueryParamValue>;
  accessToken?: string | null;
  signal?: AbortSignal;
}): Promise<{ blob: Blob; filename?: string }> {
  const url = internalUrl(`${args.pathname}${buildQuery(args.params)}`);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      ...(args.accessToken ? { authorization: `Bearer ${args.accessToken}` } : {}),
    },
    signal: args.signal,
  });

  if (res.status === 401 || res.status === 403) {
    window.location.assign("/admin/login");
    throw new Error("UNAUTHORIZED");
  }

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      msg = String(body?.error || body?.message || msg);
    } catch {
    }
    throw new Error(msg);
  }

  const cd = res.headers.get("content-disposition") || "";
  const match = /filename="?([^";]+)"?/i.exec(cd);
  const filename = match?.[1] ? String(match[1]) : undefined;

  const blob = await res.blob();
  return { blob, filename };
}

export async function internalPostJson<T>(args: {
  pathname: string;
  body: unknown;
  accessToken?: string | null;
  signal?: AbortSignal;
}): Promise<{ data: T }> {
  const url = internalUrl(args.pathname);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(args.accessToken ? { authorization: `Bearer ${args.accessToken}` } : {}),
    },
    body: JSON.stringify(args.body ?? {}),
    signal: args.signal,
  });

  if (res.status === 401 || res.status === 403) {
    window.location.assign("/admin/login");
    throw new Error("UNAUTHORIZED");
  }

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      msg = String(body?.error || body?.message || msg);
    } catch {
    }
    throw new Error(msg);
  }

  const data = (await res.json()) as T;
  return { data };
}
