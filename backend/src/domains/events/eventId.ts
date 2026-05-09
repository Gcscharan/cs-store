import { createHash } from "crypto";

/**
 * Generates a deterministic UUID-shaped ID from a stable key.
 * Same key always produces the same ID — enables outbox deduplication
 * across transaction retries and concurrent requests.
 *
 * Format: 8-4-4-4-12 hex (UUID v5-style, but using SHA-256 for simplicity)
 */
export function stableEventId(key: string): string {
  const hash = createHash("sha256").update(key).digest("hex");
  // Format as UUID-shaped string: 8-4-4-4-12
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join("-");
}
