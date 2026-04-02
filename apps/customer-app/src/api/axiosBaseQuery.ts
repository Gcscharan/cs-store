import '../utils/sentryPolyfill';
import { BaseQueryFn } from '@reduxjs/toolkit/query/react';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { storage } from '../utils/storage';
import { logEvent } from '../utils/analytics';
import { Sentry } from '../utils/sentry';

type AxiosBaseQueryArgs = {
  baseUrl: string;
};

export interface AxiosBaseQueryError {
  status: number;
  data: any;
}

// ── Retry Configuration ──
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // 1s → 2s → 4s

/**
 * Determines if a failed request is safe to retry.
 * 
 * Rules (NON-NEGOTIABLE):
 * - GET requests: ALWAYS retryable
 * - Mutations with Idempotency-Key header: retryable (server guarantees at-most-once)
 * - All other mutations (POST/PUT/DELETE): NEVER retry (could double-charge, ghost orders)
 * - 4xx errors (client errors): NEVER retry (won't fix themselves)
 * - Network errors / 5xx: retryable (transient failures)
 */
const isRetryable = (
  method: string,
  headers: Record<string, any> | undefined,
  errorStatus: number | undefined,
): boolean => {
  // Never retry client errors (400, 401, 403, 404, 409, 422, etc.)
  if (errorStatus && errorStatus >= 400 && errorStatus < 500) return false;

  const upperMethod = String(method).toUpperCase();

  // GETs are always safe to retry
  if (upperMethod === 'GET' || upperMethod === 'HEAD') return true;

  // Mutations: only retry if they have an idempotency key
  if (headers?.['Idempotency-Key']) return true;

  // All other mutations: NEVER retry
  return false;
};

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export const axiosBaseQuery = (
  { baseUrl }: AxiosBaseQueryArgs
): BaseQueryFn<
  {
    url: string;
    method?: AxiosRequestConfig['method'];
    data?: AxiosRequestConfig['data'];
    body?: AxiosRequestConfig['data'];
    params?: AxiosRequestConfig['params'];
    headers?: AxiosRequestConfig['headers'];
  },
  unknown,
  AxiosBaseQueryError
> =>
  async ({ url, method = 'GET', data, body, params, headers }) => {
    const requestBody = body ?? data;
    const isFormData =
      typeof FormData !== 'undefined' && requestBody instanceof FormData;

    let lastError: AxiosError | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const accessToken = await storage.getItem('accessToken');

        const fullUrl = baseUrl + url;

        // Debug logging
        console.log("🌐 API REQUEST:", {
          baseUrl,
          url,
          fullUrl,
          method,
          attempt: attempt + 1,
          time: Date.now()
        });

        const mergedHeaders: AxiosRequestConfig['headers'] = {
          ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
          ...(headers || {}),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        };

        // Allow custom timeout via X-Request-Timeout header (for voice UX)
        const customTimeout = headers?.['X-Request-Timeout'];
        const requestTimeout = customTimeout ? parseInt(String(customTimeout), 10) : 15000;

        const result = await axios({
          url: fullUrl,
          method,
          data: requestBody,
          params,
          headers: mergedHeaders,
          timeout: requestTimeout, // Use custom timeout if provided, otherwise 15s
        });

        // Success — log retries if any occurred
        if (attempt > 0) {
          logEvent('api_retry_success', {
            method: String(method).toUpperCase(),
            url,
            attempts: attempt + 1,
          });
        }

        return { data: result.data };
      } catch (axiosError) {
        const err = axiosError as AxiosError;
        lastError = err;

        const errorStatus = err.response?.status;
        const canRetry = isRetryable(method ?? 'GET', headers as any, errorStatus);

        // If we can retry and haven't exhausted attempts, back off and retry
        if (canRetry && attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt); // 1s, 2s, 4s
          logEvent('api_retry_attempt', {
            method: String(method).toUpperCase(),
            url,
            attempt: attempt + 1,
            status: errorStatus ?? 0,
            delayMs: delay,
          });
          await sleep(delay);
          continue;
        }

        // Cannot retry or exhausted retries — return error
        logEvent('api_error', {
          method: String(method).toUpperCase(),
          url,
          status: errorStatus ?? 503,
          attempts: attempt + 1,
          retried: attempt > 0,
        });

        console.error("❌ API REQUEST FAILED:", {
          baseUrl,
          url,
          fullUrl: baseUrl + url,
          method,
          status: errorStatus ?? 503,
          message: err.message,
          code: (err as any).code,
          attempts: attempt + 1,
        });

        // Add Sentry breadcrumb for observability trail
        if (process.env.EXPO_PUBLIC_SENTRY_DSN && !__DEV__) {
          Sentry.addBreadcrumb({
            category: 'api',
            message: `API failed: ${String(method).toUpperCase()} ${url}`,
            level: 'error',
            data: { status: errorStatus ?? 503, attempts: attempt + 1 },
          });
        }

        if (!err.response) {
          return {
            error: {
              status: 503,
              data: 'Network error. Please check your connection.',
            },
          };
        }

        return {
          error: {
            status: err.response?.status ?? 500,
            data: err.response?.data ?? err.message,
          },
        };
      }
    }

    // Fallback (should never reach here)
    return {
      error: {
        status: 503,
        data: lastError?.message || 'Request failed after retries',
      },
    };
  };

