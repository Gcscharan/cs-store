import mongoose, { Document, Schema } from "mongoose";

/**
 * UserDeviceToken — multi-device push token registry for end users
 * (customers and delivery partners).
 *
 * Replaces the single `User.expoPushToken` string field, which could only
 * hold one device at a time (last-login-wins). Each physical device a user
 * logs in on gets its own row, so push notifications fan out to every device.
 *
 * Idempotency / ownership:
 * - `token` is globally unique. If a token re-registers under a different user
 *   (device handed to another account), the upsert reassigns it to the new user
 *   instead of creating a duplicate.
 *
 * Cleanup:
 * - On Expo `DeviceNotRegistered`, only the offending token row is removed —
 *   other devices for the same user keep working.
 * - A TTL on `lastActiveAt` prunes stale devices after 90 days of inactivity.
 */

export interface IUserDeviceToken extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  token: string;
  platform: "ios" | "android" | "web" | "unknown";
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserDeviceTokenSchema = new Schema<IUserDeviceToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true, // a physical device token belongs to exactly one user at a time
    },
    platform: {
      type: String,
      enum: ["ios", "android", "web", "unknown"],
      default: "unknown",
    },
    lastActiveAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: "userdevicetokens",
  }
);

// Fast lookup of all active tokens for a user (push fan-out).
UserDeviceTokenSchema.index({ userId: 1, lastActiveAt: -1 });

// TTL: prune devices inactive for 90 days. Each successful registration /
// notification refreshes lastActiveAt, keeping live devices alive.
UserDeviceTokenSchema.index({ lastActiveAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const UserDeviceToken = mongoose.model<IUserDeviceToken>(
  "UserDeviceToken",
  UserDeviceTokenSchema
);

export default UserDeviceToken;
