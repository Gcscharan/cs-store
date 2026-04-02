/**
 * Database Helpers
 * 
 * Provides timeout protection and circuit breaker pattern for database operations.
 * Prevents API freezes from slow queries and cascading failures from DB issues.
 * 
 * Key Features:
 * - 2-second timeout on all DB operations
 * - Circuit breaker prevents thread exhaustion
 * - Graceful degradation on failures
 */

// Circuit breaker state
let failureCount = 0;
let lastFailureTime = 0;

const FAILURE_THRESHOLD = 5;
const COOLDOWN_MS = 30 * 1000; // 30 seconds

/**
 * Timeout Wrapper
 * 
 * Wraps a promise with a timeout. If the promise doesn't resolve within
 * the specified time, it rejects with a timeout error.
 * 
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds (default: 2000)
 * @param operation - Operation name for error message
 * @returns Promise that resolves or rejects based on race condition
 */
export const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number = 2000,
  operation: string = 'Operation'
): Promise<T> => {
  const timeoutPromise = new Promise<T>((_, reject) =>
    setTimeout(() => {
      reject(new Error(`${operation} timeout after ${timeoutMs}ms`));
    }, timeoutMs)
  );

  return Promise.race([promise, timeoutPromise]);
};

/**
 * Circuit Breaker Wrapper
 * 
 * Implements circuit breaker pattern to prevent cascading failures.
 * After FAILURE_THRESHOLD consecutive failures, the circuit "opens" and
 * skips DB calls for COOLDOWN_MS milliseconds, allowing fast fallback.
 * 
 * Circuit States:
 * - CLOSED: Normal operation, calls go through
 * - OPEN: After 5 failures, skip DB for 30 seconds
 * - HALF-OPEN: After cooldown, try one request to test recovery
 * 
 * @param fn - Function that returns a promise (typically a DB query)
 * @returns Promise that resolves to result or null on failure
 */
export const withCircuitBreaker = async <T>(
  fn: () => Promise<T>
): Promise<T | null> => {
  const now = Date.now();

  // Circuit OPEN → skip DB (fast fail)
  if (
    failureCount >= FAILURE_THRESHOLD &&
    now - lastFailureTime < COOLDOWN_MS
  ) {
    // Log circuit breaker open state
    const { logWarn } = require('./structuredLogger');
    logWarn('CIRCUIT_BREAKER_OPEN', {
      failureCount,
      cooldownRemaining: COOLDOWN_MS - (now - lastFailureTime),
      threshold: FAILURE_THRESHOLD,
    });
    
    // Circuit is open, return null immediately
    return null;
  }

  try {
    // Attempt operation with timeout
    const result = await withTimeout(fn(), 2000, 'Database operation');

    // Success → reset failure count
    failureCount = 0;

    return result;
  } catch (error) {
    // Failure → increment counter
    failureCount++;
    lastFailureTime = now;
    
    // Log if circuit just opened
    if (failureCount === FAILURE_THRESHOLD) {
      const { logError } = require('./structuredLogger');
      logError('CIRCUIT_BREAKER_OPENED', {
        failureCount,
        threshold: FAILURE_THRESHOLD,
        cooldownDuration: COOLDOWN_MS,
      });
    }

    // Return null for graceful degradation
    return null;
  }
};

/**
 * Get Circuit Breaker Status
 * 
 * Utility function to check circuit breaker state (useful for monitoring/logging)
 * 
 * @returns Object with circuit breaker status
 */
export const getCircuitBreakerStatus = () => {
  const now = Date.now();
  const isOpen =
    failureCount >= FAILURE_THRESHOLD &&
    now - lastFailureTime < COOLDOWN_MS;

  return {
    failureCount,
    isOpen,
    timeUntilRetry: isOpen ? COOLDOWN_MS - (now - lastFailureTime) : 0,
  };
};

/**
 * Reset Circuit Breaker
 * 
 * Manually reset the circuit breaker (useful for testing or manual recovery)
 */
export const resetCircuitBreaker = () => {
  failureCount = 0;
  lastFailureTime = 0;
};
