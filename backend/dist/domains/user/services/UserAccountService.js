"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserAccountService = void 0;
const UserRepository_1 = require("../repositories/UserRepository");
const CartRepository_1 = require("../repositories/CartRepository");
const OrderRepository_1 = require("../repositories/OrderRepository");
const PaymentRepository_1 = require("../repositories/PaymentRepository");
const NotificationRepository_1 = require("../repositories/NotificationRepository");
const OtpRepository_1 = require("../repositories/OtpRepository");
const PendingUserRepository_1 = require("../repositories/PendingUserRepository");
const mongoose_1 = __importDefault(require("mongoose"));
const otpController_1 = require("../../security/controllers/otpController");
const jwt = __importStar(require("jsonwebtoken"));
class UserAccountService {
    constructor() {
        this.userRepository = new UserRepository_1.UserRepository();
        this.cartRepository = new CartRepository_1.CartRepository();
        this.orderRepository = new OrderRepository_1.OrderRepository();
        this.paymentRepository = new PaymentRepository_1.PaymentRepository();
        this.notificationRepository = new NotificationRepository_1.NotificationRepository();
        this.otpRepository = new OtpRepository_1.OtpRepository();
        this.pendingUserRepository = new PendingUserRepository_1.PendingUserRepository();
    }
    async verifyMobile(userId, verificationData) {
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
                const result = await (0, otpController_1.verifyOtp)(user.phone, otp, "verification");
                if (!result.valid) {
                    throw new Error(result.error || "Invalid OTP");
                }
                user.mobileVerified = true;
                await this.userRepository.save(user);
                await this.otpRepository.deleteMany({ phone: user.phone, type: "verification", isUsed: false });
                const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
                const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-refresh-secret";
                const accessToken = jwt.sign({ userId: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "24h" });
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
            const result = await (0, otpController_1.verifyOtp)(phone, otp, "verification");
            if (!result.valid) {
                throw new Error(result.error || "Invalid OTP");
            }
            let pendingUser = null;
            if (pendingUserId) {
                pendingUser = await this.pendingUserRepository.findOne({ _id: pendingUserId, phone });
            }
            else {
                pendingUser = await this.pendingUserRepository.findOne({ phone });
            }
            if (!pendingUser) {
                throw new Error("Pending signup not found for this phone");
            }
            const user = new (await Promise.resolve().then(() => __importStar(require("../../../models/User")))).User({
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
            const accessToken = jwt.sign({ userId: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "24h" });
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
        }
        catch (error) {
            console.error("Error verifying mobile:", error);
            throw error;
        }
    }
    async deleteAccount(userId) {
        const session = await mongoose_1.default.startSession();
        try {
            const user = await this.userRepository.findById(userId, session);
            if (!user) {
                throw new Error("User not found");
            }
            await session.startTransaction();
            const cartDeleteResult = await this.cartRepository.deleteMany({ userId }, session);
            const orderAnonymizeResult = await this.orderRepository.updateMany({ userId }, {
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
            }, {}, session);
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
        }
        catch (error) {
            await session.abortTransaction();
            console.error("Error deleting account:", error);
            throw error;
        }
        finally {
            session.endSession();
        }
    }
    async getNotificationPreferences(userId) {
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
        }
        catch (error) {
            console.error("Error fetching notification preferences:", error);
            throw error;
        }
    }
    async updateNotificationPreferences(userId, updateData) {
        try {
            const user = await this.userRepository.findById(userId);
            if (!user) {
                return null;
            }
            const { preferences } = updateData;
            if (preferences) {
                user.notificationPreferences = preferences;
            }
            else {
                const updatedPreferences = user.notificationPreferences || {
                    email: { enabled: true, categories: {} },
                    sms: { enabled: false, categories: {} },
                    push: { enabled: true, categories: {} },
                    whatsapp: { enabled: false, categories: {} },
                };
                for (const channelId in updatedPreferences) {
                    const channel = updatedPreferences[channelId];
                    if (!channel)
                        continue;
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
        }
        catch (error) {
            console.error("Error updating notification preferences:", error);
            throw error;
        }
    }
}
exports.UserAccountService = UserAccountService;
