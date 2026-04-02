import { logger } from '../../../utils/logger';
import { UserRepository } from "../repositories/UserRepository";

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

  async updatePushToken(userId: string, pushToken: string): Promise<void> {
    try {
      // For Expo, we store it in expoPushToken. 
      // If it's a generic token, we store it in pushToken.
      // Expo tokens usually look like ExponentPushToken[xxx]
      const isExpoToken = pushToken.includes('ExponentPushToken') || pushToken.includes('ExpoPushToken');
      
      const updateObj: any = {};
      if (isExpoToken) {
        updateObj.expoPushToken = pushToken;
      } else {
        updateObj.pushToken = pushToken;
      }

      await this.userRepository.findByIdAndUpdate(userId, updateObj, { new: true });
       logger.info(`Push token updated for user ${userId}`);
    } catch (error) {
      logger.error(`Error updating push token for user ${userId}:`, error);
      throw error;
    }
  }
}
