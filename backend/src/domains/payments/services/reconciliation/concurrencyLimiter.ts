/**
 * Global concurrency limiter for the Payment Reconciliation System.
 *
 * Prevents DB and Razorpay API saturation when multiple sub-services run
 * concurrently. Uses a pure-TypeScript semaphore — no external dependencies.
 *
 * Design reference: §15.4 (Global Concurrency Limiter — Issue 4)
 */

export class ConcurrencyLimiter {
  private running = 0;
  private readonly max: number;
  private queue: Array<() => void> = [];

  constructor(max: number) {
    if (max < 1) {
      throw new RangeError(`ConcurrencyLimiter: max must be >= 1, got ${max}`);
    }
    this.max = max;
  }

  /**
   * Run `fn` as soon as a concurrency slot is available.
   * If all slots are occupied, the call queues and waits until one frees up.
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /** Current number of active (running) executions. */
  get activeCount(): number {
    return this.running;
  }

  /** Number of calls waiting for a slot. */
  get pendingCount(): number {
    return this.queue.length;
  }

  private acquire(): Promise<void> {
    if (this.running < this.max) {
      this.running++;
      return Promise.resolve();
    }
    // Queue the resolve callback; it will be called by release() when a slot opens.
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) {
      // Hand the slot directly to the next waiter — running count stays the same.
      next();
    } else {
      this.running--;
    }
  }
}

// ---------------------------------------------------------------------------
// Global singleton instances — shared across all sub-services in the process.
// ---------------------------------------------------------------------------

/**
 * Limits concurrent outbound Razorpay API calls.
 * Default: 5 concurrent calls.
 * Re-initialised at startup via `initializeLimiters` if config overrides are provided.
 */
export let razorpayLimiter = new ConcurrencyLimiter(5);

/**
 * Limits concurrent corrective DB writes (applyFix callbacks).
 * Default: 10 concurrent writes.
 * Re-initialised at startup via `initializeLimiters` if config overrides are provided.
 */
export let dbWriteLimiter = new ConcurrencyLimiter(10);

// ---------------------------------------------------------------------------
// Startup initialisation
// ---------------------------------------------------------------------------

/**
 * Re-creates the global limiter singletons with values from `ReconciliationConfig`.
 * Call this once at process startup before any sub-service runs.
 *
 * @param config - Subset of ReconciliationConfig relevant to concurrency limits.
 */
export function initializeLimiters(config: {
  maxConcurrentRazorpayCalls?: number;
  maxConcurrentDbWrites?: number;
}): void {
  if (config.maxConcurrentRazorpayCalls !== undefined) {
    razorpayLimiter = new ConcurrencyLimiter(config.maxConcurrentRazorpayCalls);
  }
  if (config.maxConcurrentDbWrites !== undefined) {
    dbWriteLimiter = new ConcurrencyLimiter(config.maxConcurrentDbWrites);
  }
}
