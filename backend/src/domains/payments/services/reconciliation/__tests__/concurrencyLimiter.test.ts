/**
 * Unit tests for ConcurrencyLimiter
 *
 * Tests that the semaphore correctly limits concurrent executions,
 * that all queued tasks eventually complete, and that errors are
 * propagated while releasing the slot for the next waiter.
 */

import { ConcurrencyLimiter } from '../concurrencyLimiter';

describe('ConcurrencyLimiter', () => {
  describe('constructor', () => {
    it('creates a limiter with the given max', () => {
      const limiter = new ConcurrencyLimiter(3);
      expect(limiter.activeCount).toBe(0);
      expect(limiter.pendingCount).toBe(0);
    });

    it('throws RangeError when max < 1', () => {
      expect(() => new ConcurrencyLimiter(0)).toThrow(RangeError);
      expect(() => new ConcurrencyLimiter(-1)).toThrow(RangeError);
    });

    it('accepts max = 1 (serial execution)', () => {
      expect(() => new ConcurrencyLimiter(1)).not.toThrow();
    });
  });

  describe('max concurrent executions never exceeds configured limit', () => {
    it('never exceeds max=1 with concurrent promises', async () => {
      const limiter = new ConcurrencyLimiter(1);
      let maxObserved = 0;
      let current = 0;

      const task = () =>
        limiter.run(async () => {
          current++;
          maxObserved = Math.max(maxObserved, current);
          // Yield to allow other tasks to potentially start
          await new Promise((resolve) => setImmediate(resolve));
          current--;
        });

      await Promise.all([task(), task(), task(), task(), task()]);

      expect(maxObserved).toBe(1);
    });

    it('never exceeds max=3 with 10 concurrent promises', async () => {
      const limiter = new ConcurrencyLimiter(3);
      let maxObserved = 0;
      let current = 0;

      const task = () =>
        limiter.run(async () => {
          current++;
          maxObserved = Math.max(maxObserved, current);
          await new Promise((resolve) => setImmediate(resolve));
          current--;
        });

      const tasks = Array.from({ length: 10 }, () => task());
      await Promise.all(tasks);

      expect(maxObserved).toBeLessThanOrEqual(3);
    });

    it('activeCount reflects running tasks', async () => {
      const limiter = new ConcurrencyLimiter(2);
      let resolveFirst!: () => void;
      let resolveSecond!: () => void;

      const first = limiter.run(
        () => new Promise<void>((resolve) => { resolveFirst = resolve; })
      );
      const second = limiter.run(
        () => new Promise<void>((resolve) => { resolveSecond = resolve; })
      );

      // Give the event loop a tick to start both tasks
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(limiter.activeCount).toBe(2);

      resolveFirst();
      await first;
      expect(limiter.activeCount).toBe(1);

      resolveSecond();
      await second;
      expect(limiter.activeCount).toBe(0);
    });
  });

  describe('all queued tasks eventually complete', () => {
    it('completes all tasks when more tasks than max are queued', async () => {
      const limiter = new ConcurrencyLimiter(2);
      const completed: number[] = [];

      const tasks = Array.from({ length: 8 }, (_, i) =>
        limiter.run(async () => {
          await new Promise<void>((resolve) => setImmediate(resolve));
          completed.push(i);
        })
      );

      await Promise.all(tasks);

      expect(completed).toHaveLength(8);
      // All indices 0-7 should be present (order may vary)
      expect(completed.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });

    it('returns values from all tasks', async () => {
      const limiter = new ConcurrencyLimiter(2);

      const results = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          limiter.run(async () => i * 2)
        )
      );

      expect(results).toEqual([0, 2, 4, 6, 8]);
    });

    it('pendingCount decreases as tasks complete', async () => {
      const limiter = new ConcurrencyLimiter(1);
      const resolvers: Array<() => void> = [];

      // Queue 3 tasks — only 1 can run at a time
      const tasks = Array.from({ length: 3 }, () =>
        limiter.run(
          () => new Promise<void>((resolve) => { resolvers.push(resolve); })
        )
      );

      // Give the event loop a tick to start the first task
      await new Promise<void>((resolve) => setImmediate(resolve));

      // 1 running, 2 pending
      expect(limiter.activeCount).toBe(1);
      expect(limiter.pendingCount).toBe(2);

      resolvers[0]();
      await new Promise<void>((resolve) => setImmediate(resolve));

      // 1 running, 1 pending
      expect(limiter.activeCount).toBe(1);
      expect(limiter.pendingCount).toBe(1);

      resolvers[1]();
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(limiter.activeCount).toBe(1);
      expect(limiter.pendingCount).toBe(0);

      resolvers[2]();
      await Promise.all(tasks);

      expect(limiter.activeCount).toBe(0);
      expect(limiter.pendingCount).toBe(0);
    });
  });

  describe('errors in fn are propagated and the slot is released', () => {
    it('propagates the error thrown by fn', async () => {
      const limiter = new ConcurrencyLimiter(2);

      await expect(
        limiter.run(async () => {
          throw new Error('task failed');
        })
      ).rejects.toThrow('task failed');
    });

    it('releases the slot after an error so the next task can run', async () => {
      const limiter = new ConcurrencyLimiter(1);

      // First task throws
      await expect(
        limiter.run(async () => {
          throw new Error('first task error');
        })
      ).rejects.toThrow('first task error');

      // Slot should be released — second task should run without hanging
      const result = await limiter.run(async () => 'second task result');
      expect(result).toBe('second task result');
    });

    it('activeCount returns to 0 after an error', async () => {
      const limiter = new ConcurrencyLimiter(2);

      await expect(
        limiter.run(async () => { throw new Error('boom'); })
      ).rejects.toThrow('boom');

      expect(limiter.activeCount).toBe(0);
    });

    it('queued tasks still run after a preceding task errors', async () => {
      const limiter = new ConcurrencyLimiter(1);
      const results: string[] = [];

      const failingTask = limiter.run(async () => {
        throw new Error('failing');
      });

      const successTask = limiter.run(async () => {
        results.push('success');
      });

      await expect(failingTask).rejects.toThrow('failing');
      await successTask;

      expect(results).toEqual(['success']);
    });

    it('handles multiple concurrent errors without deadlocking', async () => {
      const limiter = new ConcurrencyLimiter(2);

      const errors = await Promise.allSettled([
        limiter.run(async () => { throw new Error('error 1'); }),
        limiter.run(async () => { throw new Error('error 2'); }),
        limiter.run(async () => { throw new Error('error 3'); }),
      ]);

      expect(errors.every((r) => r.status === 'rejected')).toBe(true);
      expect(limiter.activeCount).toBe(0);
      expect(limiter.pendingCount).toBe(0);
    });
  });
});
