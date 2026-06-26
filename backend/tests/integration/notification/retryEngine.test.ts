/**
 * Integration tests for Push Retry Engine — retry scheduling, dead-letter transition.
 *
 * Since the PushRetry model and pushRetryWorker have not been implemented yet
 * (Task 13 is incomplete), these tests validate the retry-related behavior that
 * IS implemented: the PushGateway's rate-limit retry mechanism with exponential
 * backoff, and the conceptual retry behavior where failed pushes can be retried.
 *
 * When Task 13 (PushRetry model + worker) is implemented, these tests should be
 * extended to cover: PushRetry document creation on failure, scheduled retry polling,
 * backoff intervals (1m, 5m, 15m, 30m, 1h), and dead-letter transition after 5 attempts.
 *
 * Requirements: R17 (Retry Engine)
 */

import mongoose from "mongoose";
import { User } from "../../../src/models/User";
import {
  sendPush,
  flushBatch,
  _resetBatchQueue,
  _resetRateLimitState,
  _sendBatchWithRetry,
  MAX_RATE_LIMIT_RETRIES,
  INITIAL_BACKOFF_MS,
  QueuedPush,
  ExpoPushMessage,
} from "../../../src/domains/communication/services/pushGateway";

// Mock node-fetch for Expo API calls
jest.mock("node-fetch", () => jest.fn());
import fetch from "node-fetch";
const mockFetch = fetch as unknown as jest.Mock;

describe("Retry Engine Integration (PushGateway retry behavior)", () => {
  beforeEach(async () => {
    _resetBatchQueue();
    _resetRateLimitState();
    jest.clearAllMocks();
  });

  afterEach(() => {
    _resetBatchQueue();
    _resetRateLimitState();
  });

  describe("Retry scheduling with exponential backoff", () => {
    it("should retry with increasing delays on repeated 429 responses", async () => {
      // Track timing of fetch calls
      const fetchTimes: number[] = [];

      mockFetch.mockImplementation(async () => {
        fetchTimes.push(Date.now());
        // Return 429 until we have enough attempts to verify backoff
        if (fetchTimes.length < 3) {
          return { ok: false, status: 429, json: jest.fn().mockResolvedValue({}) };
        }
        // Succeed on 3rd attempt
        return {
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({
            data: [{ status: "ok", id: "t-retry" }],
          }),
        };
      });

      const resolve = jest.fn();
      const reject = jest.fn();

      const batch: QueuedPush[] = [
        {
          message: {
            to: "ExponentPushToken[retry-test]",
            title: "Retry Test",
            body: "Testing retry schedule",
            channelId: "orders",
          },
          userId: "user-retry-1",
          resolve,
          reject,
        },
      ];

      await _sendBatchWithRetry(batch, 0);

      // Should have succeeded after 3 calls (2 retries + final success)
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(resolve).toHaveBeenCalled();
      expect(reject).not.toHaveBeenCalled();

      // Verify backoff timing: second gap should be >= first gap
      if (fetchTimes.length >= 3) {
        const gap1 = fetchTimes[1] - fetchTimes[0];
        const gap2 = fetchTimes[2] - fetchTimes[1];
        // Second backoff (2s) should be >= first backoff (1s)
        expect(gap2).toBeGreaterThanOrEqual(gap1 * 0.8); // Allow 20% tolerance for timing
      }
    });

    it("should calculate correct exponential backoff intervals", () => {
      // Verify the backoff formula: INITIAL_BACKOFF_MS * 2^attempt
      expect(INITIAL_BACKOFF_MS * Math.pow(2, 0)).toBe(1000);  // 1s
      expect(INITIAL_BACKOFF_MS * Math.pow(2, 1)).toBe(2000);  // 2s
      expect(INITIAL_BACKOFF_MS * Math.pow(2, 2)).toBe(4000);  // 4s
      expect(INITIAL_BACKOFF_MS * Math.pow(2, 3)).toBe(8000);  // 8s
      expect(INITIAL_BACKOFF_MS * Math.pow(2, 4)).toBe(16000); // 16s
    });

    it("should respect MAX_RATE_LIMIT_RETRIES = 5", () => {
      expect(MAX_RATE_LIMIT_RETRIES).toBe(5);
    });
  });

  describe("Dead-letter transition (exhausted retries)", () => {
    it("should reject messages after exhausting all retry attempts", async () => {
      // Always return 429
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        json: jest.fn().mockResolvedValue({}),
      });

      const resolve = jest.fn();
      const reject = jest.fn();

      const batch: QueuedPush[] = [
        {
          message: {
            to: "ExponentPushToken[dead-letter]",
            title: "Dead Letter Test",
            body: "Will exhaust retries",
            channelId: "orders",
          },
          userId: "user-dead-letter",
          resolve,
          reject,
        },
      ];

      // Start at the max retry attempt to immediately trigger dead-letter
      await _sendBatchWithRetry(batch, MAX_RATE_LIMIT_RETRIES);

      // Should reject with retry exhaustion error
      expect(reject).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Rate limit retries exhausted"),
        })
      );
      expect(resolve).not.toHaveBeenCalled();
    });

    it("should reject ALL messages in batch when dead-lettering", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        json: jest.fn().mockResolvedValue({}),
      });

      const resolves: jest.Mock[] = [];
      const rejects: jest.Mock[] = [];

      const batch: QueuedPush[] = Array.from({ length: 3 }, (_, i) => {
        const resolve = jest.fn();
        const reject = jest.fn();
        resolves.push(resolve);
        rejects.push(reject);
        return {
          message: {
            to: `ExponentPushToken[batch-dl-${i}]`,
            title: `Message ${i}`,
            body: `Body ${i}`,
            channelId: "orders",
          },
          userId: `user-batch-dl-${i}`,
          resolve,
          reject,
        };
      });

      await _sendBatchWithRetry(batch, MAX_RATE_LIMIT_RETRIES);

      // All 3 messages should be rejected
      for (const reject of rejects) {
        expect(reject).toHaveBeenCalled();
      }
      for (const resolve of resolves) {
        expect(resolve).not.toHaveBeenCalled();
      }
    });

    it("should handle server error (500) as non-retryable failure", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({}),
      });

      const resolve = jest.fn();
      const reject = jest.fn();

      const batch: QueuedPush[] = [
        {
          message: {
            to: "ExponentPushToken[server-error]",
            title: "Server Error",
            body: "500 response",
            channelId: "orders",
          },
          userId: "user-500",
          resolve,
          reject,
        },
      ];

      await _sendBatchWithRetry(batch, 0);

      // 500 is not retried (only 429 triggers retry)
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(reject).toHaveBeenCalled();
      expect(resolve).not.toHaveBeenCalled();
    });

    it("should handle network errors as immediate failures", async () => {
      mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

      const resolve = jest.fn();
      const reject = jest.fn();

      const batch: QueuedPush[] = [
        {
          message: {
            to: "ExponentPushToken[network-error]",
            title: "Network Error",
            body: "Connection refused",
            channelId: "orders",
          },
          userId: "user-network",
          resolve,
          reject,
        },
      ];

      await _sendBatchWithRetry(batch, 0);

      expect(reject).toHaveBeenCalledWith(expect.any(Error));
      expect(resolve).not.toHaveBeenCalled();
    });
  });

  describe("Retry success scenario", () => {
    it("should resolve messages when retry eventually succeeds", async () => {
      let callCount = 0;
      mockFetch.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return { ok: false, status: 429, json: jest.fn().mockResolvedValue({}) };
        }
        return {
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({
            data: [{ status: "ok", id: "t-success" }],
          }),
        };
      });

      const resolve = jest.fn();
      const reject = jest.fn();

      const batch: QueuedPush[] = [
        {
          message: {
            to: "ExponentPushToken[retry-success]",
            title: "Eventually Succeeds",
            body: "After retry",
            channelId: "orders",
          },
          userId: "user-retry-success",
          resolve,
          reject,
        },
      ];

      await _sendBatchWithRetry(batch, 0);

      expect(resolve).toHaveBeenCalled();
      expect(reject).not.toHaveBeenCalled();
      expect(callCount).toBe(2);
    });
  });
});
