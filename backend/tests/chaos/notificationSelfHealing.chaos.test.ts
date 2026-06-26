/**
 * Chaos: Notification self-healing.
 *
 * Proves the autonomous-recovery paths added during the notification hardening
 * actually work under failure conditions:
 *
 *   1. Redis unavailable → unread count falls back to MongoDB (no crash, correct value).
 *   2. Expo "DeviceNotRegistered" → only the dead device token is removed from the
 *      multi-device registry; the user's other devices keep working.
 *
 * These are the "no human intervention" recovery behaviors from the audit.
 */

import mongoose from "mongoose";

// ── Mock the redis client used by unreadCountCache ──
jest.mock("../../src/config/redis", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    exists: jest.fn(),
    del: jest.fn(),
  },
}));

// ── Mock Notification model for unread-count fallback ──
jest.mock("../../src/models/Notification", () => ({
  __esModule: true,
  default: {
    countDocuments: jest.fn(),
  },
}));

// ── Mock User + UserDeviceToken for token cleanup ──
jest.mock("../../src/models/User", () => ({
  User: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  },
}));
jest.mock("../../src/models/UserDeviceToken", () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
    deleteOne: jest.fn(),
  },
}));

jest.mock("../../src/utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import redisClient from "../../src/config/redis";
import Notification from "../../src/models/Notification";
import { User } from "../../src/models/User";
import UserDeviceToken from "../../src/models/UserDeviceToken";
import { getUnreadCountCached } from "../../src/domains/communication/services/unreadCountCache";
import { _cleanupInvalidToken } from "../../src/domains/communication/services/pushGateway";

const mockRedisGet = (redisClient as any).get as jest.Mock;
const mockRedisSet = (redisClient as any).set as jest.Mock;
const mockCount = (Notification as any).countDocuments as jest.Mock;
const mockDeviceDeleteOne = (UserDeviceToken as any).deleteOne as jest.Mock;
const mockUserUpdateOne = (User as any).updateOne as jest.Mock;

describe("Chaos: Notification self-healing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Redis failure → MongoDB fallback for unread count", () => {
    test("returns correct count from Mongo when Redis GET throws", async () => {
      // Redis is "down" — every get rejects.
      mockRedisGet.mockRejectedValue(new Error("ECONNREFUSED"));
      mockRedisSet.mockRejectedValue(new Error("ECONNREFUSED"));
      // Mongo still has the truth.
      mockCount.mockResolvedValue(7);

      const userId = new mongoose.Types.ObjectId().toString();
      const count = await getUnreadCountCached(userId);

      // System recovered automatically: served the correct count from Mongo.
      expect(count).toBe(7);
      expect(mockCount).toHaveBeenCalled();
    });

    test("does not throw when both Redis and cache-population fail", async () => {
      mockRedisGet.mockRejectedValue(new Error("Redis down"));
      mockRedisSet.mockRejectedValue(new Error("Redis down"));
      mockCount.mockResolvedValue(0);

      const userId = new mongoose.Types.ObjectId().toString();
      await expect(getUnreadCountCached(userId)).resolves.toBe(0);
    });

    test("falls back to Mongo on a corrupt (non-numeric) cached value", async () => {
      mockRedisGet.mockResolvedValue("not-a-number");
      mockRedisSet.mockResolvedValue("OK");
      mockCount.mockResolvedValue(3);

      const userId = new mongoose.Types.ObjectId().toString();
      const count = await getUnreadCountCached(userId);
      expect(count).toBe(3);
    });
  });

  describe("Invalid token cleanup → only the dead device is removed", () => {
    test("DeviceNotRegistered removes exactly the offending token, not all devices", async () => {
      mockDeviceDeleteOne.mockResolvedValue({ deletedCount: 1 });
      mockUserUpdateOne.mockResolvedValue({ modifiedCount: 0 });

      const userId = new mongoose.Types.ObjectId().toString();
      const deadToken = "ExponentPushToken[DEAD_DEVICE]";

      await _cleanupInvalidToken(userId, deadToken);

      // Only the dead token row is deleted from the multi-device registry.
      expect(mockDeviceDeleteOne).toHaveBeenCalledWith({ token: deadToken });
      // Legacy field only cleared if it matches the dead token (scoped update).
      expect(mockUserUpdateOne).toHaveBeenCalledWith(
        { _id: userId, expoPushToken: deadToken },
        { $unset: { expoPushToken: 1 } }
      );
    });

    test("cleanup never throws even if the DB delete fails", async () => {
      mockDeviceDeleteOne.mockRejectedValue(new Error("DB error"));
      mockUserUpdateOne.mockResolvedValue({ modifiedCount: 0 });

      const userId = new mongoose.Types.ObjectId().toString();
      await expect(
        _cleanupInvalidToken(userId, "ExponentPushToken[X]")
      ).resolves.toBeUndefined();
    });
  });
});
