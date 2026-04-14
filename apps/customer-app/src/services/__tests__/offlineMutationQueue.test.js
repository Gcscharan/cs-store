/**
 * Unit tests for offlineMutationQueue service
 * Requirements: 9b.1, 9b.2, 9b.3, 9b.4, 9b.5, 9b.6, 9b.7
 */

const AsyncStorage = require('@react-native-async-storage/async-storage');
const { offlineMutationQueue, QUEUE_KEY, MAX_QUEUE_SIZE } = require('../offlineMutationQueue');

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

function makeEntry(overrides = {}) {
  return {
    id: `test-${Date.now()}-${Math.random()}`,
    action: 'pickupOrder',
    orderId: 'order-123',
    args: {},
    enqueuedAt: new Date().toISOString(),
    retryCount: 0,
    ...overrides,
  };
}

describe('offlineMutationQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.setItem.mockResolvedValue(undefined);
  });

  // ── enqueue ──

  describe('enqueue', () => {
    it('enqueues entry with correct shape (id, action, orderId, args, enqueuedAt, retryCount)', async () => {
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify([]));

      await offlineMutationQueue.enqueue({
        action: 'pickupOrder',
        orderId: 'order-abc',
        args: { idempotencyKey: 'key-1' },
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        QUEUE_KEY,
        expect.stringContaining('"action":"pickupOrder"'),
      );

      const written = JSON.parse(AsyncStorage.setItem.mock.calls[0][1]);
      expect(written).toHaveLength(1);
      const entry = written[0];
      expect(entry.id).toBeTruthy();
      expect(entry.action).toBe('pickupOrder');
      expect(entry.orderId).toBe('order-abc');
      expect(entry.args).toEqual({ idempotencyKey: 'key-1' });
      expect(entry.enqueuedAt).toBeTruthy();
      expect(entry.retryCount).toBe(0);
    });

    it('drops oldest entry when cap of 20 is reached', async () => {
      // Fill queue with 20 entries
      const existing = Array.from({ length: MAX_QUEUE_SIZE }, (_, i) =>
        makeEntry({ id: `entry-${i}`, orderId: `order-${i}` }),
      );
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(existing));

      await offlineMutationQueue.enqueue({
        action: 'markArrived',
        orderId: 'order-new',
        args: {},
      });

      const written = JSON.parse(AsyncStorage.setItem.mock.calls[0][1]);
      // Still 20 entries
      expect(written).toHaveLength(MAX_QUEUE_SIZE);
      // Oldest (entry-0) was dropped
      expect(written.find((e) => e.id === 'entry-0')).toBeUndefined();
      // New entry is at the end
      expect(written[written.length - 1].orderId).toBe('order-new');
      // Warn was logged
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cap of 20 reached'),
        expect.anything(),
      );
    });

    it('appends to existing queue without dropping when under cap', async () => {
      const existing = [makeEntry({ id: 'existing-1' })];
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(existing));

      await offlineMutationQueue.enqueue({
        action: 'startDelivery',
        orderId: 'order-xyz',
        args: {},
      });

      const written = JSON.parse(AsyncStorage.setItem.mock.calls[0][1]);
      expect(written).toHaveLength(2);
      expect(written[0].id).toBe('existing-1');
    });
  });

  // ── getAll ──

  describe('getAll', () => {
    it('returns all entries in FIFO order', async () => {
      const entries = [
        makeEntry({ id: 'first', enqueuedAt: '2024-01-01T00:00:00.000Z' }),
        makeEntry({ id: 'second', enqueuedAt: '2024-01-01T00:01:00.000Z' }),
        makeEntry({ id: 'third', enqueuedAt: '2024-01-01T00:02:00.000Z' }),
      ];
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(entries));

      const result = await offlineMutationQueue.getAll();

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('first');
      expect(result[1].id).toBe('second');
      expect(result[2].id).toBe('third');
    });

    it('returns empty array when queue is empty', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);

      const result = await offlineMutationQueue.getAll();

      expect(result).toEqual([]);
    });

    it('resets queue to [] and logs error on corrupted JSON', async () => {
      AsyncStorage.getItem.mockResolvedValue('{ invalid json !!!');

      const result = await offlineMutationQueue.getAll();

      expect(result).toEqual([]);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Corrupted queue data'),
        expect.anything(),
      );
      // Should reset storage
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(QUEUE_KEY, JSON.stringify([]));
    });
  });

  // ── remove ──

  describe('remove', () => {
    it('removes entry by id', async () => {
      const entries = [
        makeEntry({ id: 'keep-1' }),
        makeEntry({ id: 'remove-me' }),
        makeEntry({ id: 'keep-2' }),
      ];
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(entries));

      await offlineMutationQueue.remove('remove-me');

      const written = JSON.parse(AsyncStorage.setItem.mock.calls[0][1]);
      expect(written).toHaveLength(2);
      expect(written.find((e) => e.id === 'remove-me')).toBeUndefined();
      expect(written[0].id).toBe('keep-1');
      expect(written[1].id).toBe('keep-2');
    });

    it('is a no-op when id does not exist', async () => {
      const entries = [makeEntry({ id: 'existing' })];
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(entries));

      await offlineMutationQueue.remove('nonexistent');

      const written = JSON.parse(AsyncStorage.setItem.mock.calls[0][1]);
      expect(written).toHaveLength(1);
    });
  });

  // ── incrementRetry ──

  describe('incrementRetry', () => {
    it('increments retryCount for the matching entry', async () => {
      const entries = [
        makeEntry({ id: 'entry-a', retryCount: 0 }),
        makeEntry({ id: 'entry-b', retryCount: 2 }),
      ];
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(entries));

      await offlineMutationQueue.incrementRetry('entry-a');

      const written = JSON.parse(AsyncStorage.setItem.mock.calls[0][1]);
      const entryA = written.find((e) => e.id === 'entry-a');
      const entryB = written.find((e) => e.id === 'entry-b');
      expect(entryA.retryCount).toBe(1);
      expect(entryB.retryCount).toBe(2); // unchanged
    });

    it('is a no-op when id does not exist', async () => {
      const entries = [makeEntry({ id: 'entry-a', retryCount: 1 })];
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(entries));

      await offlineMutationQueue.incrementRetry('nonexistent');

      // setItem is not called when entry is not found (no mutation needed)
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });
  });
});
