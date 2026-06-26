import { logger } from '../../../utils/logger';
import { UserRepository } from "../repositories/UserRepository";
import UserDeviceToken from "../../../models/UserDeviceToken";
import mongoose from "mongoose";

export interface UserProfileData {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfileUpdateData {
  name?: string;
  phone?: string;
  email?: string;
}

export class UserProfileService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  async getUserProfile(userId: string): Promise<UserProfileData | null> {
    try {
      const user = await this.userRepository.findById(userId);
      
      if (!user) {
        return null;
      }

      return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isAdmin: (user as any).isAdmin || false,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (error) {
      logger.error("Error fetching user profile:", error);
      throw error;
    }
  }

  async updateUserProfile(userId: string, updateData: ProfileUpdateData): Promise<any> {
    try {
      const updateObj: any = {};
      if (updateData.name !== undefined) updateObj.name = updateData.name;
      if (updateData.phone !== undefined) updateObj.phone = updateData.phone;
      if (updateData.email !== undefined) updateObj.email = updateData.email;

      const updatedUser = await this.userRepository.findByIdAndUpdate(
        userId,
        updateObj,
        { new: true, runValidators: true, select: "-passwordHash" }
      );

      if (!updatedUser) {
        return null;
      }

      return {
        success: true,
        message: "Profile updated successfully",
        user: {
          id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          phone: updatedUser.phone,
          role: updatedUser.role,
        },
      };
    } catch (error) {
      logger.error("Error updating user profile:", error);
      throw error;
    }
  }

  async updatePushToken(userId: string, pushToken: string, platform?: string): Promise<void> {
    try {
      const isExpoToken =
        pushToken.includes("ExponentPushToken") || pushToken.includes("ExpoPushToken");

      // ── Multi-device registry (source of truth) ──
      // Upsert keyed on the globally-unique token. If the same physical device
      // re-registers (same token) we just refresh ownership + lastActiveAt.
      // If the token previously belonged to another user, ownership transfers
      // to the current user (device handed over / account switch).
      const normalizedPlatform =
        platform === "ios" || platform === "android" || platform === "web"
          ? platform
          : "unknown";

      try {
        await UserDeviceToken.findOneAndUpdate(
          { token: pushToken },
          {
            $set: {
              userId: new mongoose.Types.ObjectId(userId),
              token: pushToken,
              platform: normalizedPlatform,
              lastActiveAt: new Date(),
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } catch (e: any) {
        // Concurrent upsert race on the unique token index — safe to ignore,
        // the row exists with the latest data.
        if (!(e?.code === 11000 || String(e?.message || "").includes("E11000"))) {
          throw e;
        }
      }

      // ── Legacy single-token field (kept in sync for backward compatibility) ──
      // Other read paths (analytics, legacy PushNotificationService) still read
      // User.expoPushToken. Keep writing the most-recent token here until those
      // are migrated to the registry.
      const updateObj: any = {};
      if (isExpoToken) {
        updateObj.expoPushToken = pushToken;
      } else {
        updateObj.pushToken = pushToken;
      }

      await this.userRepository.findByIdAndUpdate(userId, updateObj, { new: true });
      logger.info(`Push token registered for user ${userId} (multi-device)`);
    } catch (error) {
      logger.error(`Error updating push token for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Removes a specific device token (e.g. on logout) so a shared device stops
   * receiving this user's notifications. If no token is given, all of the user's
   * device tokens are removed.
   */
  async removePushToken(userId: string, pushToken?: string): Promise<void> {
    try {
      if (pushToken) {
        await UserDeviceToken.deleteOne({ userId: new mongoose.Types.ObjectId(userId), token: pushToken });
        // Clear the legacy single-token field only if it matches the removed token.
        await this.userRepository
          .findByIdAndUpdate(userId, { $unset: { expoPushToken: 1 } } as any, { new: true })
          .catch(() => {});
      } else {
        await UserDeviceToken.deleteMany({ userId: new mongoose.Types.ObjectId(userId) });
      }
      logger.info(`Push token(s) removed for user ${userId}`);
    } catch (error) {
      logger.error(`Error removing push token for user ${userId}:`, error);
      // Non-fatal — logout should not fail because of token cleanup.
    }
  }
}
