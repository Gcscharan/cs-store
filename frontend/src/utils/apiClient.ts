/**
 * Production-grade API client with retry logic, timeout handling, and error recovery
 */

interface RetryConfig {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  retryableStatuses?: number[];
}

interface FetchOptions extends RequestInit {
  retry?: RetryConfig;
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 30000, // 30 seconds
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Check if error is retryable
 */
const isRetryable = (status: number | undefined, retryableStatuses: number[]): boolean => {
  if (!status) return true; // Network errors are retryable
  return retryableStatuses.includes(status);
};

/**
 * Fetch with timeout
 */
const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('Request timeout', 408);
    }
    throw error;
  }
};

/**
 * Robust fetch with retry logic
 */
export const apiFetch = async (
  url: string,
  options: FetchOptions = {}
): Promise<Response> => {
  const { retry, ...fetchOptions } = options;
  const config = { ...DEFAULT_RETRY_CONFIG, ...retry };
  
  // Add ngrok skip warning header
  if (!fetchOptions.headers) fetchOptions.headers = {};
  (fetchOptions.headers as any)["ngrok-skip-browser-warning"] = "true";

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, fetchOptions, config.timeout);
      
      // If response is ok or not retryable, return it
      if (response.ok || !isRetryable(response.status, config.retryableStatuses)) {
        return response;
      }
      
      // Store error for potential retry
      lastError = new ApiError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status
      );
      
      // If this is the last attempt, throw
      if (attempt === config.maxRetries) {
        throw lastError;
      }
      
      // Wait before retry with exponential backoff
      await sleep(config.retryDelay * Math.pow(2, attempt));
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      // If not retryable or last attempt, throw
      if (
        error instanceof ApiError &&
        !isRetryable(error.status, config.retryableStatuses)
      ) {
        throw error;
      }
      
      if (attempt === config.maxRetries) {
        throw lastError;
      }
      
      // Wait before retry
      await sleep(config.retryDelay * Math.pow(2, attempt));
    }
  }
  
  throw lastError || new Error('Request failed');
};

/**
 * Typed API response handler
 */
export const handleApiResponse = async <T = any>(
  response: Response
): Promise<T> => {
  if (!response.ok) {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: response.statusText };
    }
    
    throw new ApiError(
      errorData.error || errorData.message || `HTTP ${response.status}`,
      response.status,
      errorData
    );
  }
  
  try {
    return await response.json();
  } catch {
    // If response is not JSON, return empty object
    return {} as T;
  }
};

/**
 * Complete API call with retry and error handling
 */
export const apiCall = async <T = any>(
  url: string,
  options: FetchOptions = {}
): Promise<T> => {
  const response = await apiFetch(url, options);
  return handleApiResponse<T>(response);
};

/**
 * Prevent double submission utility
 */
export class SubmissionGuard {
  private pending = new Set<string>();
  
  async guard<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (this.pending.has(key)) {
      throw new Error('Operation already in progress');
    }
    
    this.pending.add(key);
    try {
      return await fn();
    } finally {
      this.pending.delete(key);
    }
  }
}

export { ApiError };
