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
exports.deleteAccount = exports.getMe = exports.completeProfile = exports.checkPhoneExists = exports.verifyAuthOTP = exports.sendAuthOTP = exports.changePassword = exports.googleCallback = exports.logout = exports.refresh = exports.oauth = exports.login = exports.signup = void 0;
const jwt = __importStar(require("jsonwebtoken"));
const bcrypt = __importStar(require("bcryptjs"));
const User_1 = require("../../../models/User");
const Pincode_1 = require("../../../models/Pincode");
const Otp_1 = __importDefault(require("../../../models/Otp"));
const sms_1 = require("../../../utils/sms");
const sendEmailOTP_1 = require("../../../utils/sendEmailOTP");
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-refresh-secret";
const signup = async (req, res) => {
    try {
        const { name, email, phone, password, addresses } = req.body;
        // Validate required fields for email/password registration
        if (!name || !email || !phone || !password) {
            res.status(400).json({
                message: "Name, email, phone, and password are required for registration",
            });
            return;
        }
        // Validate phone number format for Indian mobile numbers
        if (!/^[6-9]\d{9}$/.test(phone)) {
            res.status(400).json({
                message: "Invalid phone number format. Please enter a valid 10-digit mobile number starting with 6-9.",
            });
            return;
        }
        // Validate pincode in default address (only if addresses are provided)
        if (addresses && addresses.length > 0) {
            const defaultAddress = addresses.find((addr) => addr.isDefault);
            if (defaultAddress) {
                const pincodeExists = await Pincode_1.Pincode.findOne({
                    pincode: defaultAddress.pincode,
                });
                if (!pincodeExists) {
                    res.status(400).json({ message: "Unable to deliver to this location." });
                    return;
                }
            }
        }
        // Check if user already exists with this email
        const existingUserByEmail = await User_1.User.findOne({ email });
        if (existingUserByEmail) {
            res.status(400).json({ message: "Email already exists" });
            return;
        }
        // Check if user already exists with this phone number
        const existingUserByPhone = await User_1.User.findOne({ phone });
        if (existingUserByPhone) {
            res.status(400).json({ message: "Phone number already exists" });
            return;
        }
        // Hash password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        // Create user directly
        const user = await User_1.User.create({
            name,
            email,
            phone,
            passwordHash,
            addresses: addresses || [],
            role: "customer",
        });
        // Return success response
        res.status(201).json({
            message: "User created successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
            },
        });
        return;
    }
    catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({ error: "Registration failed" });
        return;
    }
};
exports.signup = signup;
const login = async (req, res) => {
    try {
        const { email, phone, password } = req.body;
        // Find user by email or phone
        const user = await User_1.User.findOne({
            $or: [{ email }, { phone }],
        });
        if (!user || !user.passwordHash) {
            res.status(400).json({ message: "Invalid email or password" });
            return;
        }
        // Check password with bcrypt
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            res.status(400).json({ message: "Invalid email or password" });
            return;
        }
        // Generate tokens
        const accessToken = jwt.sign({ userId: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "24h" } // Extended from 15m to 24h to prevent frequent expiration
        );
        const refreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, {
            expiresIn: "7d",
        });
        const isProfileComplete = !!(user.name && user.phone);
        res.json({
            message: "Login successful",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                isAdmin: user.role === "admin",
                addresses: user.addresses,
                isProfileComplete,
            },
            token: accessToken,
            refreshToken,
        });
    }
    catch (error) {
        res.status(500).json({ error: "Login failed" });
        return;
    }
};
exports.login = login;
const oauth = async (req, res) => {
    try {
        const { provider, providerId, name, email, phone } = req.body;
        // Check if user exists with this OAuth provider
        let user = await User_1.User.findOne({
            "oauthProviders.provider": provider,
            "oauthProviders.providerId": providerId,
        });
        if (!user) {
            // Check if user exists with same email
            user = await User_1.User.findOne({ email });
            if (user) {
                // Link OAuth provider to existing user
                user.oauthProviders = user.oauthProviders || [];
                user.oauthProviders.push({ provider, providerId });
                await user.save();
            }
            else {
                // Create new user
                user = new User_1.User({
                    name,
                    email,
                    phone,
                    oauthProviders: [{ provider, providerId }],
                });
                await user.save();
            }
        }
        // Generate tokens
        const accessToken = jwt.sign({ userId: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "24h" } // Extended from 15m to 24h to prevent frequent expiration
        );
        const refreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, {
            expiresIn: "7d",
        });
        res.json({
            message: "OAuth login successful",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                addresses: user.addresses,
                isProfileComplete: user.isProfileComplete,
            },
            accessToken,
            refreshToken,
        });
    }
    catch (error) {
        res.status(500).json({ error: "OAuth login failed" });
        return;
    }
};
exports.oauth = oauth;
const refresh = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            res.status(400).json({ message: "Refresh token is required" });
            return;
        }
        // Check if refresh token is blacklisted
        try {
            const redisClient = require('../../../config/redis').default;
            const isBlacklisted = await redisClient.get(`blacklist:refresh:${refreshToken}`);
            if (isBlacklisted) {
                res.status(401).json({ message: "Refresh token revoked - please login again" });
                return;
            }
        }
        catch (redisError) {
            // Redis not available, proceed with token verification
        }
        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
        const userId = decoded.userId || decoded.id;
        const user = await User_1.User.findById(userId);
        if (!user) {
            res.status(401).json({ message: "Invalid refresh token" });
            return;
        }
        const accessToken = jwt.sign({ userId: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "24h" } // Extended from 15m to 24h to prevent frequent expiration
        );
        // Generate new refresh token
        const newRefreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, { expiresIn: "7d" });
        res.json({
            message: "Token refreshed",
            accessToken,
        });
    }
    catch (error) {
        res.status(401).json({ message: "Invalid refresh token" });
        return;
    }
};
exports.refresh = refresh;
const logout = async (req, res) => {
    try {
        // Get user from auth middleware
        const userId = req.user?._id || req.userId;
        // Extract tokens from request body and headers
        const { refreshToken } = req.body;
        const authHeader = req.headers.authorization;
        const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
        // Import Redis client for token blacklisting
        const redisClient = require('../../../config/redis').default;
        let tokensRevoked = 0;
        // Blacklist access token (24h expiry)
        if (accessToken) {
            try {
                await redisClient.set(`blacklist:access:${accessToken}`, 'revoked', 24 * 60 * 60); // 24h TTL
                tokensRevoked++;
            }
            catch (error) {
                // Failed to blacklist access token
            }
        }
        // Blacklist refresh token (7d expiry)
        if (refreshToken) {
            try {
                await redisClient.set(`blacklist:refresh:${refreshToken}`, 'revoked', 7 * 24 * 60 * 60); // 7d TTL
                tokensRevoked++;
            }
            catch (error) {
                // Failed to blacklist refresh token
            }
        }
        // Additional security: Invalidate all user sessions (optional)
        if (userId) {
            try {
                await redisClient.set(`user_session_revoked:${userId}`, Date.now().toString(), 7 * 24 * 60 * 60);
            }
            catch (error) {
                // Failed to invalidate user session
            }
        }
        res.json({
            success: true,
            message: "Logout successful",
            tokensRevoked
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Logout failed - unable to revoke session"
        });
    }
};
exports.logout = logout;
// OAuth callback handlers
const googleCallback = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            // Redirect to frontend with error
            const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
            res.redirect(`${frontendUrl}/auth/callback?error=authentication_failed`);
            return;
        }
        // Generate tokens
        const accessToken = jwt.sign({ userId: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "24h" } // Extended from 15m to 24h to prevent frequent expiration
        );
        const refreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, {
            expiresIn: "7d",
        });
        // Redirect to frontend with tokens and user data
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        const redirectUrl = new URL(`${frontendUrl}/auth/callback`);
        redirectUrl.searchParams.set("token", accessToken);
        redirectUrl.searchParams.set("refreshToken", refreshToken);
        redirectUrl.searchParams.set("userId", user._id.toString());
        redirectUrl.searchParams.set("name", user.name || "");
        redirectUrl.searchParams.set("email", user.email || "");
        redirectUrl.searchParams.set("phone", user.phone || "");
        redirectUrl.searchParams.set("role", user.role || "customer");
        redirectUrl.searchParams.set("isAdmin", (user.role === "admin").toString());
        redirectUrl.searchParams.set("isProfileComplete", (user.isProfileComplete || false).toString());
        res.redirect(redirectUrl.toString());
    }
    catch (error) {
        console.error("Google OAuth callback error:", error);
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        res.redirect(`${frontendUrl}/auth/callback?error=callback_failed`);
        return;
    }
};
exports.googleCallback = googleCallback;
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.userId || req.user?._id;
        if (!userId) {
            return res.status(401).json({ message: "User not authenticated" });
        }
        // Validate input
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                message: "Current password and new password are required",
            });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({
                message: "New password must be at least 6 characters long",
            });
        }
        // Find user
        const user = await User_1.User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        // Verify current password
        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({ message: "Current password is incorrect" });
        }
        // Hash new password
        const saltRounds = 12;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
        // Update password
        user.passwordHash = newPasswordHash;
        await user.save();
        res.json({
            message: "Password changed successfully",
        });
    }
    catch (error) {
        console.error("Change password error:", error);
        res.status(500).json({ error: "Failed to change password" });
        return;
    }
};
exports.changePassword = changePassword;
// Send OTP for authentication (login/signup)
const sendAuthOTP = async (req, res) => {
    try {
        const { phone, email } = req.body;
        // Get the user input (either phone or email)
        const userInput = phone || email;
        if (!userInput) {
            return res.status(400).json({ message: "Phone or email is required" });
        }
        // Detect input type: phone or email
        // Use validatePhoneNumber for proper international format support
        const isPhone = (0, sms_1.validatePhoneNumber)(userInput);
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userInput);
        if (!isPhone && !isEmail) {
            return res.status(400).json({
                message: "Invalid phone or email format",
            });
        }
        // Find user by phone or email
        const user = await User_1.User.findOne({
            $or: [{ phone: userInput }, { email: userInput }],
        });
        if (!user) {
            return res.status(404).json({
                error: "Account not found. Please sign up first.",
                action: "signup_required",
                email: isEmail ? userInput : undefined,
            });
        }
        // Generate 6-digit OTP
        const otp = (0, sms_1.generateOTP)();
        // Create OTP record
        const otpRecord = new Otp_1.default({
            phone: user.phone,
            otp,
            type: "login",
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        });
        await otpRecord.save();
        // Send OTP based on input type
        if (isPhone) {
            // Send OTP via SMS
            const message = `Your CS Store login OTP is ${otp}. Valid for 10 minutes. Do not share this OTP with anyone.`;
            await (0, sms_1.sendSMS)(userInput, message);
        }
        else if (isEmail) {
            // Send OTP via Email using Gmail SMTP
            await (0, sendEmailOTP_1.sendEmailOTP)(userInput, otp);
        }
        res.json({
            message: "OTP sent successfully",
            expiresIn: 600, // 10 minutes in seconds
            sentTo: isPhone ? "phone" : "email",
        });
    }
    catch (error) {
        res.status(500).json({
            message: "Failed to send OTP",
            details: process.env.NODE_ENV === "development" ? error.message : undefined
        });
        return;
    }
};
exports.sendAuthOTP = sendAuthOTP;
// Verify OTP for authentication
const verifyAuthOTP = async (req, res) => {
    try {
        const { phone, email, otp } = req.body;
        if (!otp) {
            return res.status(400).json({ error: "OTP is required" });
        }
        if (!phone && !email) {
            return res.status(400).json({ error: "Phone or email is required" });
        }
        // Find user by phone or email
        const user = await User_1.User.findOne({
            $or: [{ phone }, { email }],
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        // Find OTP record
        const otpRecord = await Otp_1.default.findOne({
            phone: user.phone,
            type: "login",
            isUsed: false,
            expiresAt: { $gt: new Date() },
        }).sort({ createdAt: -1 });
        if (!otpRecord) {
            return res.status(400).json({
                error: "Invalid or expired OTP",
            });
        }
        // Check attempts
        if (otpRecord.attempts >= 3) {
            return res.status(400).json({
                error: "Maximum OTP attempts exceeded. Please request a new OTP.",
            });
        }
        // Verify OTP
        if (otpRecord.otp !== otp) {
            otpRecord.attempts += 1;
            await otpRecord.save();
            return res.status(400).json({
                error: `Invalid OTP. ${3 - otpRecord.attempts} attempts remaining.`,
            });
        }
        // Mark OTP as used
        otpRecord.isUsed = true;
        await otpRecord.save();
        // Generate tokens
        const accessToken = jwt.sign({ userId: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "24h" } // Extended from 15m to 24h to prevent frequent expiration
        );
        const refreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, {
            expiresIn: "7d",
        });
        const isProfileComplete = !!(user.name && user.phone);
        res.json({
            message: "Login successful",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                isAdmin: user.role === "admin",
                addresses: user.addresses,
                isProfileComplete,
            },
            accessToken,
            refreshToken,
        });
    }
    catch (error) {
        console.error("Verify auth OTP error:", error);
        res.status(500).json({ error: "Failed to verify OTP" });
        return;
    }
};
exports.verifyAuthOTP = verifyAuthOTP;
// Check if phone number exists
const checkPhoneExists = async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ error: "Phone number is required" });
        }
        // Validate phone number format
        if (!/^[6-9]\d{9}$/.test(phone)) {
            return res.status(400).json({ error: "Invalid phone number format" });
        }
        // Check if phone exists in User collection
        const existingUser = await User_1.User.findOne({ phone });
        return res.status(200).json({
            exists: !!existingUser,
            message: existingUser
                ? "This phone number is already registered"
                : "Phone number is available",
        });
    }
    catch (error) {
        console.error("Check phone exists error:", error);
        return res.status(500).json({ error: "Failed to check phone number" });
    }
};
exports.checkPhoneExists = checkPhoneExists;
// Complete user profile for OAuth users
const completeProfile = async (req, res) => {
    try {
        const userId = req.user?._id; // from auth middleware
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const { fullName, phone, email } = req.body;
        const updatedUser = await User_1.User.findByIdAndUpdate(userId, {
            fullName,
            phone,
            email,
            isProfileComplete: true,
        }, { new: true });
        return res.json({
            success: true,
            user: updatedUser,
        });
    }
    catch (err) {
        console.error("completeProfile error:", err);
        res.status(500).json({ message: "Server error" });
    }
};
exports.completeProfile = completeProfile;
// Get current user profile
const getMe = async (req, res) => {
    try {
        const userId = req.userId || req.user?._id;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required" });
        }
        const user = await User_1.User.findById(userId).select("-passwordHash");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json({ user });
    }
    catch (error) {
        console.error("Get profile error:", error);
        res.status(500).json({ message: "Failed to fetch profile" });
    }
};
exports.getMe = getMe;
// Delete user account
const deleteAccount = async (req, res) => {
    try {
        const userId = req.userId || req.user?._id;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required" });
        }
        const user = await User_1.User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        await User_1.User.findByIdAndDelete(userId);
        res.json({ message: "Account deleted successfully" });
    }
    catch (error) {
        console.error("Delete account error:", error);
        res.status(500).json({ message: "Failed to delete account" });
    }
};
exports.deleteAccount = deleteAccount;
