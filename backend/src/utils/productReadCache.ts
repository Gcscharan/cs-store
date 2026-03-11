import { logger } from './logger';
import crypto from "crypto";
import redisClient from "../config/redis";

const MAX_CACHE_PAYLOAD_BYTES = 512 * 1024;

let warnedOnce = false;

function warnOnce(msg: string, err?: unknown) {
  if (warnedOnce) return;
  warnedOnce = true;
  if (err) {
    logger.warn(msg, err);
    return;
  }
  logger.warn(msg);
}

function stableNormalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stableNormalize);

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    out[k] = stableNormalize(obj[k]);
  }
  return out;
}

function stableJsonStringify(value: unknown): string {
  return JSON.stringify(stableNormalize(value));
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function normalizeTags(tags: unknown): string | null {
  if (typeof tags !== "string") return null;
  const parts = tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .sort();
  return parts.length ? parts.join(",") : null;
}

export function buildProductsListCacheKey(params: {
  page: number;
  limit: number;
  category?: unknown;
  minPrice?: unknown;
  maxPrice?: unknown;
  sortBy?: unknown;
  sortOrder?: unknown;
  tags?: unknown;
}): string {
  const normalized = {
    page: Number(params.page || 1),
    limit: Number(params.limit || 10),
    category: typeof params.category === "string" && String(params.category).trim() ? String(params.category).trim() : null,
    minPrice: params.minPrice === undefined || params.minPrice === null || params.minPrice === "" ? null : Number(params.minPrice),
    maxPrice: params.maxPrice === undefined || params.maxPrice === null || params.maxPrice === "" ? null : Number(params.maxPrice),
    sortBy: typeof params.sortBy === "string" && String(params.sortBy).trim() ? String(params.sortBy).trim() : null,
    sortOrder: typeof params.sortOrder === "string" && String(params.sortOrder).trim() ? String(params.sortOrder).trim() : null,
    tags: normalizeTags(params.tags),
  };

  const json = stableJsonStringify(normalized);
  const hash = sha256Hex(json).slice(0, 24);
  return `products:list:v1:${hash}`;
}

export function buildProductDetailCacheKey(productId: string): string {
  return `product:v1:${String(productId)}`;
}

export function buildCategoriesCacheKey(): string {
  return "products:categories:v1";
}

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await redisClient.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch (e) {
      await redisClient.del(key);
      warnOnce("[CACHE] Corrupted JSON; deleted key:", key);
      return null;
    }
  } catch (e) {
    warnOnce("[CACHE] Redis get failed (non-fatal):", e);
    return null;
  }
}

export async function cacheSetJson(key: string, value: unknown, ttlSeconds: number): Promise<boolean> {
  try {
    const json = JSON.stringify(value);
    const bytes = Buffer.byteLength(json, "utf8");
    if (bytes > MAX_CACHE_PAYLOAD_BYTES) {
      return false;
    }

    await redisClient.set(key, json, { EX: Math.max(1, Number(ttlSeconds || 1)) });
    return true;
  } catch (e) {
    warnOnce("[CACHE] Redis set failed (non-fatal):", e);
    return false;
  }
}

export async function cacheDelByPattern(pattern: string): Promise<void> {
  try {
    const keys: string[] = [];
    for await (const key of redisClient.scanIterator({ MATCH: pattern })) {
      keys.push(String(key));
    }
    if (keys.length) {
      await redisClient.del(keys);
    }
  } catch (e) {
    warnOnce("[CACHE] Redis delByPattern failed (non-fatal):", e);
  }
}
