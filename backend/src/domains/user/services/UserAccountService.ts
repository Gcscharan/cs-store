import { UserRepository } from "../repositories/UserRepository";
import { CartRepository } from "../repositories/CartRepository";
import { OrderRepository } from "../repositories/OrderRepository";
import { PaymentRepository } from "../repositories/PaymentRepository";
import { NotificationRepository } from "../repositories/NotificationRepository";
import { OtpRepository } from "../repositories/OtpRepository";
import { PendingUserRepository } from "../repositories/PendingUserRepository";
import mongoose from "mongoose";
import { verifyOtp } from "../../security/controllers/otpController";
import * as jwt from "jsonwebtoken";

export interface MobileVerificationData {
  otp: string;
  phone?: string;
  pendingUserId?: string;
}

export interface MobileVerificationResult {
  message: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    isAdmin: boolean;
    addresses: any[];
    isProfileComplete: boolean;
    mobileVerified: boolean;
  };
  accessToken: string;
  refreshToken: string;
}

export interface AccountDeletionResult {
  success: boolean;
  message: string;
  forceLogout: boolean;
  details: {
    cartsDeleted: number;
    ordersAnonymized: number;
    paymentsDeleted: number;
    otpsDeleted: number;
    notificationsDeleted: number;
    userDeleted: boolean;
  };
}

export interface NotificationPreferencesResponse {
  success: boolean;
  preferences: any;
}

export interface NotificationUpdateData {
  preferences?: any;
}

export class UserAccountService {
  private userRepository: UserRepository;
  private cartRepository: CartRepository;
  private orderRepository: OrderRepository;
  private paymentRepository: PaymentRepository;
  private notificationRepository: NotificationRepository;
  private otpRepository: OtpRepository;
  private pendingUserRepository: PendingUserRepository;

  constructor() {
    this.userRepository = new UserRepository();
    this.cartRepository = new CartRepository();
    this.orderRepository = new OrderRepository();
    this.paymentRepository = new PaymentRepository();
    this.notificationRepository = new NotificationRepository();
    this.otpRepository = new OtpRepository();
    this.pendingUserRepository = new PendingUserRepository();
  }

  async verifyMobile(userId: string | null, verificationData: MobileVerificationData): Promise<MobileVerificationResult> {
    try {
      const { otp, phone, pendingUserId } = verificationData;

      if (!otp) {
        throw new Error("OTP is required");
      }

      if (userId) {
        const user = await this.userRepository.findById(userId);
        if (!user) {
          throw new Error("User not found");
        }
        if (!user.phone) {
          throw new Error("User does not have a registered phone");
        }

        const result = await verifyOtp(user.phone, otp, "verification");
        if (!result.valid) {
          throw new Error(result.error || "Invalid OTP");
        }

        user.mobileVerified = true;
        await this.userRepository.save(user);
        await this.otpRepository.deleteMany({ phone: user.phone, type: "verification", isUsed: false });

        const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
        const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-refresh-secret";
        const accessToken = jwt.sign(
          { userId: user._id, email: user.email, role: user.role },
          JWT_SECRET,
          { expiresIn: "24h" }
        );
        const refreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, { expiresIn: "7d" });

        const isProfileComplete = !!(user.name && user.phone);

        return {
          message: "Mobile number verified successfully",
          user: {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            isAdmin: user.role === "admin",
            addresses: user.addresses,
            isProfileComplete,
            mobileVerified: true,
          },
          accessToken,
          refreshToken,
        };
      }

      if (!phone) {
        throw new Error("Phone is required for verification");
      }

      const result = await verifyOtp(phone, otp, "verification");
      if (!result.valid) {
        throw new Error(result.error || "Invalid OTP");
      }

      let pendingUser = null as any;
      if (pendingUserId) {
        pendingUser = await this.pendingUserRepository.findOne({ _id: pendingUserId, phone });
      } else {
        pendingUser = await this.pendingUserRepository.findOne({ phone });
      }

      if (!pendingUser) {
        throw new Error("Pending signup not found for this phone");
      }

      const user = new (await import("../../../models/User")).User({
        name: pendingUser.name,
        email: pendingUser.email,
        phone: pendingUser.phone,
        passwordHash: pendingUser.passwordHash,
        addresses: pendingUser.addresses || [],
        mobileVerified: true,
      });
      await this.userRepository.save(user);

      await this.pendingUserRepository.deleteOne({ _id: pendingUser._id });
      await this.otpRepository.deleteMany({ phone, type: "verification", isUsed: false });

      const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
      const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-refresh-secret";
      const accessToken = jwt.sign(
        { userId: user._id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: "24h" }
      );
      const refreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, { expiresIn: "7d" });

      const isProfileComplete = !!(user.name && user.phone);

      return {
        message: "Account created and mobile verified successfully",
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isAdmin: user.role === "admin",
          addresses: user.addresses,
          isProfileComplete,
          mobileVerified: true,
        },
        accessToken,
        refreshToken,
      };
    } catch (error) {
      console.error("Error verifying mobile:", error);
      throw error;
    }
  }

  async deleteAccount(userId: string): Promise<AccountDeletionResult> {
    const session = await mongoose.startSession();
    
    try {
      const user = await this.userRepository.findById(userId, session);
      if (!user) {
        throw new Error("User not found");
      }

      await session.startTransaction();

      const cartDeleteResult = await this.cartRepository.deleteMany({ userId }, session);

      const orderAnonymizeResult = await this.orderRepository.updateMany(
        { userId },
        {
          $set: {
            userId: null,
            "address.name": "DELETED_USER",
            "address.phone": "DELETED_USER",
          },
          $unset: {
            customerName: "",
            customerEmail: "",
            customerPhone: "",
          }
        },
        {},
        session
      );

      const paymentDeleteResult = await this.paymentRepository.deleteMany({ userId }, session);

      const otpDeleteResult = await this.otpRepository.deleteMany({ phone: user.phone }, session);

      const notificationDeleteResult = await this.notificationRepository.deleteMany({ userId }, session);

      await this.userRepository.findByIdAndDelete(userId, session);

      await session.commitTransaction();

      return {
        success: true,
        message: "Account deleted successfully. All personal data has been removed.",
        forceLogout: true,
        details: {
          cartsDeleted: cartDeleteResult.deletedCount,
          ordersAnonymized: orderAnonymizeResult.modifiedCount,
          paymentsDeleted: paymentDeleteResult.deletedCount,
          otpsDeleted: otpDeleteResult.deletedCount,
          notificationsDeleted: notificationDeleteResult.deletedCount,
          userDeleted: true,
        }
      };

    } catch (error) {
      await session.abortTransaction();
      console.error("Error deleting account:", error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getNotificationPreferences(userId: string): Promise<NotificationPreferencesResponse> {
    try {
      const user = await this.userRepository.findById(userId);
      
      if (!user) {
        return { success: false, preferences: null };
      }

      return {
        success: true,
        preferences: user.notificationPreferences || {
          email: { enabled: true, categories: {} },
          sms: { enabled: false, categories: {} },
          push: { enabled: true, categories: {} },
          whatsapp: { enabled: false, categories: {} },
        },
      };
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      throw error;
    }
  }

  async updateNotificationPreferences(userId: string, updateData: NotificationUpdateData): Promise<any> {
    try {
      const user = await this.userRepository.findById(userId);
      
      if (!user) {
        return null;
      }

      const { preferences } = updateData;

      if (preferences) {
        user.notificationPreferences = preferences;
      } else {
        const updatedPreferences = user.notificationPreferences || {
          email: { enabled: true, categories: {} },
          sms: { enabled: false, categories: {} },
          push: { enabled: true, categories: {} },
          whatsapp: { enabled: false, categories: {} },
        };

        for (const channelId in updatedPreferences) {
          const channel = updatedPreferences[channelId];
          if (!channel) continue;

          if (!channel.categories) {
            channel.categories = {};
          }

          for (const categoryKey in channel.categories) {
            const category = channel.categories[categoryKey];
            if (typeof category === "object" && category !== null) {
              if (!category.subcategories) {
                category.subcategories = {};
              }
            }
          }
        }

        user.notificationPreferences = updatedPreferences;
      }

      await this.userRepository.save(user);

      return {
        success: true,
        message: "Notification preferences updated successfully",
        preferences: user.notificationPreferences,
      };
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      throw error;
    }
  }
}
