/**
 * Socket.IO Redis Adapter wiring.
 *
 * Without a shared adapter, `io.to('user_{id}').emit(...)` only reaches sockets
 * connected to the SAME Node process. The moment the backend runs more than one
 * instance (autoscaling / multiple containers / k8s replicas), real-time
 * notifications (toast + badge) silently fail for users connected to a different
 * instance than the one that processed the event.
 *
 * The Redis adapter fixes this by broadcasting emits over Redis pub/sub so every
 * instance delivers to its own connected clients.
 *
 * Design notes:
 * - Uses DEDICATED duplicated Redis connections (pub/sub clients must not be
 *   shared with the app's command client — a subscribed client can't run normal
 *   commands).
 * - Graceful: if Redis/adapter setup fails, we log and continue in single-instance
 *   mode rather than crashing. Single-instance behavior is unchanged.
 * - Controlled by SOCKET_REDIS_ADAPTER_ENABLED (defaults to enabled in production,
 *   disabled in test). Set to "false" to force single-instance even in prod.
 */

import type { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { redis } from "./redis";
import { logger } from "../utils/logger";

function isAdapterEnabled(): boolean {
  const flag = process.env.SOCKET_REDIS_ADAPTER_ENABLED;
  if (flag === "false") return false;
  if (flag === "true") return true;
  // Default: enabled unless running tests.
  return process.env.NODE_ENV !== "test";
}

/**
 * Attaches the Redis adapter to the given Socket.IO server.
 * Safe to call once at startup after `io` is created. Never throws.
 */
export async function attachSocketRedisAdapter(io: SocketIOServer): Promise<boolean> {
  if (!isAdapterEnabled()) {
    logger.info("[SocketAdapter] Redis adapter disabled — running single-instance socket mode");
    return false;
  }

  try {
    // The base `redis` client is the app's command client. Duplicate it twice
    // for the adapter's pub and sub channels.
    const pubClient = redis.duplicate();
    const subClient = redis.duplicate();

    // Don't let adapter client errors crash the process.
    pubClient.on("error", (err) =>
      logger.error("[SocketAdapter] pub client error:", err?.message || err)
    );
    subClient.on("error", (err) =>
      logger.error("[SocketAdapter] sub client error:", err?.message || err)
    );

    await Promise.all([
      pubClient.isOpen ? Promise.resolve() : pubClient.connect(),
      subClient.isOpen ? Promise.resolve() : subClient.connect(),
    ]);

    io.adapter(createAdapter(pubClient, subClient));

    logger.info("[SocketAdapter] ✅ Socket.IO Redis adapter attached — multi-instance real-time enabled");
    return true;
  } catch (err) {
    // Fail open: continue in single-instance mode. Real-time still works on a
    // single instance; we just lose cross-instance fan-out until Redis recovers.
    logger.error("[SocketAdapter] Failed to attach Redis adapter — falling back to single-instance mode", {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
