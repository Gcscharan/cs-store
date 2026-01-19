import { createClient } from "redis";

const g = globalThis as any;

function createInMemoryRedisClient(): any {
  if (!g.__redisKv) g.__redisKv = new Map<string, string>();
  if (!g.__redisExpiries) g.__redisExpiries = new Map<string, number>();

  const kv: Map<string, string> = g.__redisKv;
  const expiries: Map<string, number> = g.__redisExpiries;

  const isExpired = (key: string): boolean => {
    const exp = expiries.get(key);
    if (!exp) return false;
    if (Date.now() <= exp) return false;
    kv.delete(key);
    expiries.delete(key);
    return true;
  };

  const client: any = {
    connect: async () => true,
    disconnect: async () => true,
    get: async (key: string) => {
      const k = String(key);
      isExpired(k);
      return kv.has(k) ? kv.get(k) : null;
    },
    set: async (key: string, value: string, opts?: any) => {
      const k = String(key);
      kv.set(k, String(value));
      if (opts && typeof opts === "object" && Number.isFinite(Number((opts as any).EX))) {
        expiries.set(k, Date.now() + Number((opts as any).EX) * 1000);
      } else {
        expiries.delete(k);
      }
      return true;
    },
    del: async (key: any) => {
      const keys = Array.isArray(key) ? key.map(String) : [String(key)];
      let removed = 0;
      for (const k of keys) {
        const existed = kv.delete(k);
        expiries.delete(k);
        if (existed) removed++;
      }
      return removed;
    },
    exists: async (key: string) => {
      const k = String(key);
      isExpired(k);
      return kv.has(k) ? 1 : 0;
    },
    incr: async (key: string) => {
      const k = String(key);
      isExpired(k);
      const cur = Number(kv.get(k) || 0);
      const next = Number.isFinite(cur) ? cur + 1 : 1;
      kv.set(k, String(next));
      return next;
    },
    incrBy: async (key: string, by: number) => {
      const k = String(key);
      isExpired(k);
      const cur = Number(kv.get(k) || 0);
      const inc = Number(by || 0);
      const next = (Number.isFinite(cur) ? cur : 0) + inc;
      kv.set(k, String(next));
      return next;
    },
    expire: async (key: string, seconds: number) => {
      const k = String(key);
      if (!kv.has(k)) return false;
      const s = Math.max(1, Number(seconds || 1));
      expiries.set(k, Date.now() + s * 1000);
      return true;
    },
    ttl: async (key: string) => {
      const k = String(key);
      isExpired(k);
      const exp = expiries.get(k);
      if (!kv.has(k)) return -2;
      if (!exp) return -1;
      return Math.max(0, Math.floor((exp - Date.now()) / 1000));
    },
    scanIterator: async function* (opts?: any) {
      const match = opts && typeof opts === "object" ? String((opts as any).MATCH || "*") : "*";
      const pattern = new RegExp(
        "^" +
          match
            .replace(/[.+^${}()|[\\]\\]/g, "\\$&")
            .replace(/\*/g, ".*")
            .replace(/\?/g, ".") +
          "$"
      );
      for (const k of kv.keys()) {
        isExpired(k);
        if (pattern.test(k)) yield k;
      }
    },
    on: () => undefined,
    once: () => undefined,
    emit: () => undefined,
    quit: async () => true,
    isOpen: true,
    isReady: true,
    __kv: kv,
    __expiries: expiries,
  };

  return client;
}

export const redis = createClient({
  url: process.env.REDIS_URL,
  socket: {
    tls: true,
    keepAlive: 10_000,
    reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
  },
});

redis.on("connect", () => {
  console.log("⚡ Redis connected successfully");
});

redis.on("error", (err) => {
  console.warn("⚠️ Redis error (non-fatal):", err.message);
});

const baseRedisClient =
  process.env.NODE_ENV === "test"
    ? createInMemoryRedisClient()
    : !process.env.REDIS_URL
      ? createInMemoryRedisClient()
      : redis;

let warnedOnce = false;

function failOpenDefault(method: string): any {
  if (method === "get") return null;
  if (method === "set") return null;
  if (method === "del") return 0;
  if (method === "exists") return 0;
  if (method === "incr") return 0;
  if (method === "incrBy") return 0;
  if (method === "expire") return false;
  if (method === "ttl") return -2;
  return null;
}

function wrapFailOpen(client: any): any {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop !== "string") return value;
      if (typeof value !== "function") return value;

      if (prop === "scanIterator") {
        return (...args: any[]) => {
          try {
            const it = value.apply(target, args);
            return (async function* () {
              try {
                for await (const k of it) yield k;
              } catch (e: any) {
                if (!warnedOnce) {
                  warnedOnce = true;
                  console.warn("⚠️ Redis unavailable; continuing without Redis (non-fatal)");
                }
                console.warn("⚠️ Redis scanIterator failed (non-fatal):", e?.message || e);
              }
            })();
          } catch (e: any) {
            if (!warnedOnce) {
              warnedOnce = true;
              console.warn("⚠️ Redis unavailable; continuing without Redis (non-fatal)");
            }
            console.warn("⚠️ Redis scanIterator threw (non-fatal):", e?.message || e);
            return (async function* () {})();
          }
        };
      }

      return (...args: any[]) => {
        try {
          const out = value.apply(target, args);
          if (!out || typeof out.then !== "function") return out;

          return out.catch((e: any) => {
            if (!warnedOnce) {
              warnedOnce = true;
              console.warn("⚠️ Redis unavailable; continuing without Redis (non-fatal)");
            }
            console.warn("⚠️ Redis command failed (non-fatal):", prop, e?.message || e);
            return failOpenDefault(prop);
          });
        } catch (e: any) {
          if (!warnedOnce) {
            warnedOnce = true;
            console.warn("⚠️ Redis unavailable; continuing without Redis (non-fatal)");
          }
          console.warn("⚠️ Redis command threw (non-fatal):", prop, e?.message || e);
          return failOpenDefault(prop);
        }
      };
    },
  });
}

const redisClient = wrapFailOpen(baseRedisClient);

if (process.env.NODE_ENV === "production" && !process.env.REDIS_URL) {
  console.warn("⚠️  REDIS_URL is not set; continuing without Redis (non-fatal)");
}

// Auto-connect without top-level await (best-effort)
(async () => {
  try {
    if (baseRedisClient === redis && !redis.isOpen) {
      await redis.connect();
    }
  } catch (error: any) {
    console.warn("⚠️ Redis auto-connect failed (non-fatal):", error?.message || error);
  }
})();

export default redisClient;
