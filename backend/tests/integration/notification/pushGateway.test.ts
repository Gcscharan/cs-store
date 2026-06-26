/**
 * Integration tests for Push Gateway — batching, token cleanup, rate-limit handling.
 *
 * These tests exercise the PushGateway against a real MongoDB instance (via test setup)
 * to verify User document interactions (token lookup, token removal) and the batching
 * behavior with mocked Expo Push API responses.
 *
 * Requirements: R10 (Push Notification Delivery)
 */

import mongoose from "mongoose";
import { User } from "../../../src/models/User";
import {
  sendPush,
  flushBatch,
  _resetBatchQueue,
  _resetRateLimitState,
  _getBatchQueueLength,
  PushMessage,
} from "../../../src/domains/communication/services/pushGateway";

// Mock node-fetch for Expo API calls
jest.mock("node-fetch", () => jest.fn());
import fetch from "node-fetch";
const mockFetch = fetch as unknown as jest.Mock;

describe("PushGateway Integration", () => {
  beforeEach(async () => {
    _resetBatchQueue();
    _resetRateLimitState();
    jest.clearAllMocks();
  });

  afterEach(() => {
    _resetBatchQueue();
    _resetRateLimitState();
  });

  describe("Batching with real User lookups", () => {
    it("should batch multiple push messages and send in a single Expo API call", async () => {
      // Create real users with push tokens in the database
      const user1 = await (global as any).createTestUser({
        email: "push-batch-1@test.com",
        expoPushToken: "ExponentPushToken[batch-user-1]",
      });
      const user2 = await (global as any).createTestUser({
        email: "push-batch-2@test.com",
        expoPushToken: "ExponentPushToken[batch-user-2]",
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          data: [
            { status: "ok", id: "ticket-1" },
            { status: "ok", id: "ticket-2" },
          ],
        }),
      });

      // Queue two push messages
      const promise1 = sendPush({
        userId: String(user1._id),
        title: "Order Confirmed",
        body: "Your order #1 is confirmed",
        category: "order",
        sound: true,
      });

      const promise2 = sendPush({
        userId: String(user2._id),
        title: "Payment Success",
        body: "Payment of ₹200 received",
        category: "payment",
        sound: true,
      });

      // Wait for user lookups to complete
      await new Promise((r) => setTimeout(r, 100));

      // Both should be queued
      expect(_getBatchQueueLength()).toBe(2);

      // Flush the batch
      await flushBatch();
      await Promise.all([promise1, promise2]);

      // Should send a single API call with both messages
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody).toHaveLength(2);

      // Order in the batch isn't guaranteed due to async user lookups, so check by content
      const tokens = requestBody.map((m: any) => m.to);
      expect(tokens).toContain("ExponentPushToken[batch-user-1]");
      expect(tokens).toContain("ExponentPushToken[batch-user-2]");

      const channels = requestBody.map((m: any) => m.channelId);
      expect(channels).toContain("orders");
      expect(channels).toContain("payments");
    });

    it("should skip users without push tokens (no queueing)", async () => {
      const userNoToken = await (global as any).createTestUser({
        email: "push-no-token@test.com",
        // No expoPushToken set
      });

      await sendPush({
        userId: String(userNoToken._id),
        title: "Test",
        body: "Body",
        category: "order",
      });

      // Should not be queued since user has no token
      expect(_getBatchQueueLength()).toBe(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should include correct Android channel based on notification category", async () => {
      const user = await (global as any).createTestUser({
        email: "push-channel@test.com",
        expoPushToken: "ExponentPushToken[channel-test]",
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          data: [{ status: "ok", id: "t1" }],
        }),
      });

      const promise = sendPush({
        userId: String(user._id),
        title: "Promo Alert",
        body: "50% off today",
        category: "promo",
        sound: false,
      });

      await new Promise((r) => setTimeout(r, 100));
      await flushBatch();
      await promise;

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody[0].channelId).toBe("promotions");
      expect(requestBody[0].sound).toBeNull();
    });
  });

  describe("Token cleanup on DeviceNotRegistered", () => {
    it("should remove expoPushToken from user document when Expo returns DeviceNotRegistered", async () => {
      const user = await (global as any).createTestUser({
        email: "push-invalid-token@test.com",
        expoPushToken: "ExponentPushToken[invalid-token]",
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          data: [
            {
              status: "error",
              message: "Device not registered",
              details: { error: "DeviceNotRegistered" },
            },
          ],
        }),
      });

      const promise = sendPush({
        userId: String(user._id),
        title: "Test",
        body: "Body",
        category: "order",
      });

      await new Promise((r) => setTimeout(r, 100));
      await flushBatch();
      await promise; // Should resolve (graceful handling)

      // Verify the token was removed from the database
      const updatedUser = await User.findById(user._id).select("expoPushToken").lean();
      expect(updatedUser?.expoPushToken).toBeUndefined();
    });

    it("should not remove token for non-DeviceNotRegistered errors", async () => {
      const user = await (global as any).createTestUser({
        email: "push-other-error@test.com",
        expoPushToken: "ExponentPushToken[valid-but-big]",
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          data: [
            {
              status: "error",
              message: "Message too large",
              details: { error: "MessageTooBig" },
            },
          ],
        }),
      });

      const promise = sendPush({
        userId: String(user._id),
        title: "Test",
        body: "Body",
        category: "order",
      });

      // Attach catch handler immediately to prevent unhandled rejection
      let rejectedError: Error | null = null;
      const safePromise = promise.catch((err) => {
        rejectedError = err;
      });

      await new Promise((r) => setTimeout(r, 100));
      await flushBatch();
      await safePromise;

      // Should have been rejected with a push error
      expect(rejectedError).toBeInstanceOf(Error);
      expect(rejectedError!.message).toContain("Message too large");

      // Token should NOT be removed
      const updatedUser = await User.findById(user._id).select("expoPushToken").lean();
      expect(updatedUser?.expoPushToken).toBe("ExponentPushToken[valid-but-big]");
    });
  });

  describe("Rate-limit handling", () => {
    it("should retry with backoff on 429 response and succeed on subsequent attempt", async () => {
      const user = await (global as any).createTestUser({
        email: "push-ratelimit@test.com",
        expoPushToken: "ExponentPushToken[rate-limited]",
      });

      // First call: 429, second call: success
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: jest.fn().mockResolvedValue({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({
            data: [{ status: "ok", id: "t1" }],
          }),
        });

      const promise = sendPush({
        userId: String(user._id),
        title: "Rate Limit Test",
        body: "Should retry",
        category: "order",
      });

      await new Promise((r) => setTimeout(r, 100));
      await flushBatch();
      await promise;

      // Should have made 2 fetch calls (initial 429 + retry success)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should reject all queued messages after exhausting rate-limit retries", async () => {
      const user = await (global as any).createTestUser({
        email: "push-ratelimit-exhaust@test.com",
        expoPushToken: "ExponentPushToken[exhausted]",
      });

      // Always return 429
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        json: jest.fn().mockResolvedValue({}),
      });

      const promise = sendPush({
        userId: String(user._id),
        title: "Will Fail",
        body: "Rate limit exhausted",
        category: "order",
      });

      await new Promise((r) => setTimeout(r, 100));
      await flushBatch();

      // Should reject after max retries
      let rejected = false;
      try {
        await promise;
      } catch (err) {
        rejected = true;
        expect((err as Error).message).toContain("Rate limit retries exhausted");
      }
      expect(rejected).toBe(true);

      // Should have attempted multiple times
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
