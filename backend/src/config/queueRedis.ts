/**
 * Queue Redis Configuration
 * 
 * Separate Redis connection for BullMQ queues
 * Uses IORedis (required by BullMQ)
 */

import IORedis from 'ioredis';
import { logger } from '../utils/logger';

const resolvedRedisUrl =
  process.env.REDIS_URL || (process.env.NODE_ENV === 'development' ? 'redis://127.0.0.1:6379' : undefined);

if (!resolvedRedisUrl) {
  throw new Error('REDIS_URL is required for queue system');
}

/**
 * Create IORedis connection for BullMQ
 * BullMQ requires IORedis, not the standard redis client
 */
export function createQueueRedisConnection(): IORedis {
  const connection = new IORedis(resolvedRedisUrl as string, {
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,    // Required for BullMQ
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 100, 3000);
      logger.warn(`[QueueRedis] Retry attempt ${times}, waiting ${delay}ms`);
      return delay;
    },
  });

  connection.on('connect', () => {
    logger.info('[QueueRedis] ⚡ Connected successfully');
  });

  connection.on('ready', () => {
    logger.info('[QueueRedis] ✅ Ready for queue operations');
  });

  connection.on('error', (err) => {
    logger.error('[QueueRedis] ⚠️ Error:', err.message);
  });

  connection.on('close', () => {
    logger.warn('[QueueRedis] Connection closed');
  });

  connection.on('reconnecting', () => {
    logger.info('[QueueRedis] Reconnecting...');
  });

  return connection;
}

// Export a singleton connection for common usage
export const queueRedisConnection = createQueueRedisConnection();

/**
 * Queue connection configuration
 * Shared across all queues
 */
export const queueConnectionConfig = {
  connection: createQueueRedisConnection(),
};

/**
 * Health check for queue Redis connection
 */
export async function checkQueueRedisHealth(): Promise<{ healthy: boolean; error?: string }> {
  try {
    const connection = queueConnectionConfig.connection;
    
    if (connection.status !== 'ready') {
      return {
        healthy: false,
        error: `Redis status: ${connection.status}`,
      };
    }

    // Ping test
    const result = await connection.ping();
    if (result !== 'PONG') {
      return {
        healthy: false,
        error: 'Ping test failed',
      };
    }

    return { healthy: true };
  } catch (error: any) {
    return {
      healthy: false,
      error: error.message,
    };
  }
}

export default queueConnectionConfig;
