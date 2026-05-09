/**
 * Delivery Configuration Constants
 * 
 * Configuration for the multi-attempt failure flow feature.
 * These constants control retry behavior, backoff delays, and UI update intervals.
 */

/**
 * Raw configuration values (can be overridden by environment or remote config)
 */
const RAW_CONFIG = {
  MAX_DELIVERY_ATTEMPTS: 3,
  RETRY_BACKOFF_SECONDS: 600, // 10 minutes — matches backend RETRY_COOLDOWN_MS (was 30, caused silent rejections)
  COUNTDOWN_UPDATE_INTERVAL: 1000,
};

/**
 * Validates and normalizes MAX_DELIVERY_ATTEMPTS
 * Must be >= 1, defaults to 3 if invalid
 */
function validateMaxAttempts(value: number): number {
  if (typeof value !== 'number' || isNaN(value) || value < 1) {
    console.warn(
      `[DeliveryConfig] Invalid MAX_DELIVERY_ATTEMPTS: ${value}. Defaulting to 3.`
    );
    return 3;
  }
  return Math.floor(value);
}

/**
 * Validates and normalizes RETRY_BACKOFF_SECONDS
 * Must be >= 60 (1 minute minimum), defaults to 600 (10 minutes) if invalid
 */
function validateRetryBackoff(value: number): number {
  if (typeof value !== 'number' || isNaN(value) || value < 60) {
    console.warn(
      `[DeliveryConfig] Invalid RETRY_BACKOFF_SECONDS: ${value}. Defaulting to 600.`
    );
    return 600;
  }
  return Math.floor(value);
}

/**
 * Validates and normalizes COUNTDOWN_UPDATE_INTERVAL
 * Must be >= 100, defaults to 1000 if invalid
 */
function validateCountdownInterval(value: number): number {
  if (typeof value !== 'number' || isNaN(value) || value < 100) {
    console.warn(
      `[DeliveryConfig] Invalid COUNTDOWN_UPDATE_INTERVAL: ${value}. Defaulting to 1000.`
    );
    return 1000;
  }
  return Math.floor(value);
}

/**
 * Validated and typed delivery configuration
 * 
 * @property MAX_DELIVERY_ATTEMPTS - Maximum delivery attempts before escalation (default: 3, min: 1)
 * @property RETRY_BACKOFF_SECONDS - Retry backoff delay in seconds (default: 30, min: 10)
 * @property COUNTDOWN_UPDATE_INTERVAL - Countdown update interval in milliseconds (default: 1000, min: 100)
 */
export const DELIVERY_CONFIG = Object.freeze({
  MAX_DELIVERY_ATTEMPTS: validateMaxAttempts(RAW_CONFIG.MAX_DELIVERY_ATTEMPTS),
  RETRY_BACKOFF_SECONDS: validateRetryBackoff(RAW_CONFIG.RETRY_BACKOFF_SECONDS),
  COUNTDOWN_UPDATE_INTERVAL: validateCountdownInterval(RAW_CONFIG.COUNTDOWN_UPDATE_INTERVAL),
} as const);

/**
 * Type for the delivery configuration
 */
export type DeliveryConfig = typeof DELIVERY_CONFIG;
