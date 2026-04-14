/**
 * Offline Mutation Queue — Delivery Resilience Layer
 *
 * Persists failed delivery mutations to AsyncStorage so they can be
 * replayed in FIFO order when connectivity is restored.
 *
 * Queue key: `delivery_offline_queue`
 * Cap: 20 entries — oldest is dropped when cap is reached.
 *
 * Requirements: 9b.1, 9b.2, 9b.7
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const QUEUE_KEY = 'delivery_offline_queue';
export const MAX_QUEUE_SIZE = 20;

export interface OfflineQueueEntry {
  id: string;
  action: string;       // e.g. 'pickupOrder', 'startDelivery', 'markArrived'
  orderId: string;
  args: Record<string, any>;
  enqueuedAt: string;   // ISO 8601
  retryCount: number;
}

/**
 * Generate a simple unique ID without external dependencies.
 * Uses timestamp + random suffix for uniqueness.
 */
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Read the queue from AsyncStorage.
 * Returns [] and logs error on corrupted JSON (Requirement 9b — handle corrupted JSON).
 */
async function readQueue(): Promise<OfflineQueueEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OfflineQueueEntry[];
  } catch (e) {
    console.error('[OfflineMutationQueue] Corrupted queue data, resetting to []', e);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([])).catch(() => {});
    return [];
  }
}

/**
 * Write the queue to AsyncStorage.
 */
async function writeQueue(queue: OfflineQueueEntry[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export const offlineMutationQueue = {
  /**
   * Add a new entry to the queue.
   * If the queue is at capacity (20), the oldest entry is dropped first.
   * Requirement: 9b.1, 9b.2, 9b.7
   */
  async enqueue(
    entry: Pick<OfflineQueueEntry, 'action' | 'orderId' | 'args'>,
  ): Promise<void> {
    const queue = await readQueue();

    if (queue.length >= MAX_QUEUE_SIZE) {
      console.warn(
        '[OfflineMutationQueue] Cap of 20 reached, dropping oldest entry',
        { dropped: queue[0]?.id },
      );
      queue.shift(); // drop oldest (FIFO cap enforcement)
    }

    const newEntry: OfflineQueueEntry = {
      id: generateId(),
      action: entry.action,
      orderId: entry.orderId,
      args: entry.args,
      enqueuedAt: new Date().toISOString(),
      retryCount: 0,
    };

    queue.push(newEntry);
    await writeQueue(queue);
  },

  /**
   * Return all queued entries in FIFO order.
   * Requirement: 9b.3
   */
  async getAll(): Promise<OfflineQueueEntry[]> {
    return readQueue();
  },

  /**
   * Remove an entry by id (called on 2xx or 4xx/5xx response).
   * Requirements: 9b.4, 9b.5
   */
  async remove(id: string): Promise<void> {
    const queue = await readQueue();
    await writeQueue(queue.filter((e) => e.id !== id));
  },

  /**
   * Increment retryCount for an entry (called on network error — keep in queue).
   * Requirement: 9b.6
   */
  async incrementRetry(id: string): Promise<void> {
    const queue = await readQueue();
    const entry = queue.find((e) => e.id === id);
    if (entry) {
      entry.retryCount += 1;
      await writeQueue(queue);
    }
  },
};
