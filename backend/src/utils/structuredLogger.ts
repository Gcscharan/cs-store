/**
 * Structured Logger
 * 
 * Provides JSON-formatted logging for production log aggregation tools
 * (ELK, Datadog, CloudWatch). Includes log sampling to prevent cost explosion.
 * 
 * Key Features:
 * - JSON format for easy parsing
 * - ISO 8601 timestamps
 * - 10% sampling for info logs (prevents log explosion at scale)
 * - 100% logging for warn/error (never miss critical events)
 * - Required fields: event, timestamp, environment, service, level
 */

interface LogEntry {
  event: string;
  timestamp: string;
  environment: string;
  service: string;
  level: 'info' | 'warn' | 'error';
  [key: string]: any;
}

// Log sampling rate (10% for info logs, 100% for warn/error)
const LOG_SAMPLE_RATE = 0.1;

/**
 * Structured Log Function
 * 
 * Outputs JSON-formatted logs with required fields. Implements sampling
 * for info-level logs to prevent cost explosion at scale.
 * 
 * Cost Control:
 * - Without sampling: 10k req/min → 600k logs/hour
 * - With 10% sampling: 10k req/min → 60k logs/hour (10x reduction)
 * 
 * @param level - Log level (info, warn, error)
 * @param event - Event name (e.g., "PINCODE_CACHE_HIT")
 * @param data - Additional event-specific data
 */
export const structuredLog = (
  level: 'info' | 'warn' | 'error',
  event: string,
  data?: Record<string, any>
): void => {
  // Sample info logs to prevent log explosion at scale
  // Always log warn/error (critical events)
  if (level === 'info' && Math.random() > LOG_SAMPLE_RATE) {
    return; // Skip this log (90% of info logs dropped)
  }

  const entry: LogEntry = {
    event,
    timestamp: new Date().toISOString(), // ISO 8601 format
    environment: process.env.NODE_ENV || 'development',
    service: 'pincode-api',
    level,
    ...data,
  };

  const output = JSON.stringify(entry);

  switch (level) {
    case 'error':
      console.error(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    default:
      console.log(output);
  }
};

/**
 * Convenience method for info-level logs
 * 
 * @param event - Event name
 * @param data - Additional data
 */
export const logInfo = (event: string, data?: Record<string, any>): void => {
  structuredLog('info', event, data);
};

/**
 * Convenience method for warn-level logs
 * 
 * @param event - Event name
 * @param data - Additional data
 */
export const logWarn = (event: string, data?: Record<string, any>): void => {
  structuredLog('warn', event, data);
};

/**
 * Convenience method for error-level logs
 * 
 * @param event - Event name
 * @param data - Additional data
 */
export const logError = (event: string, data?: Record<string, any>): void => {
  structuredLog('error', event, data);
};
