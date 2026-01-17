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
exports.deleteAccount = exports.getMe = exports.completeProfile = exports.checkPhoneExists = exports.verifyAuthOTP = exports.sendAuthOTP = exports.changePassword = exports.googleCallback = exports.logout = exports.refresh = exports.oauth = exports.login = exports.completeOnboarding = exports.verifyOnboardingOtp = exports.signup = void 0;
const jwt = __importStar(require("jsonwebtoken"));
const bcrypt = __importStar(require("bcryptjs"));
const User_1 = require("../../../models/User");
const Pincode_1 = require("../../../models/Pincode");
const Otp_1 = __importDefault(require("../../../models/Otp"));
const sms_1 = require("../../../utils/sms");
const sendEmailOTP_1 = require("../../../utils/sendEmailOTP");
const eventBus_1 = require("../../events/eventBus");
const account_events_1 = require("../../events/account.events");
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-refresh-secret";
const signup = async (req, res) => {
    try {
        // FIX: accept both name and fullName from the frontend safely
        const { fullName, name: rawName, email, phone, password, addresses } = req.body;
        const name = rawName || fullName;
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
        // Generate JWT tokens (same as login flow)
        const accessToken = jwt.sign({ userId: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "24h" });
        const refreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, {
            expiresIn: "7d",
        });
        return res.status(201).json({
            message: "User created successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
            },
            accessToken,
            refreshToken,
        });
    }
    catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({ error: "Registration failed" });
        return;
    }
};
exports.signup = signup;
const verifyOnboardingOtp = async (req, res) => {
    try {
        const { phone, otp } = req.body;
        if (!phone || !otp) {
            return res.status(400).json({ error: "Phone and OTP are required" });
        }
        const cleanedPhone = String(phone).replace(/\D/g, "");
        const otpRecord = await Otp_1.default.findOne({
            phone: cleanedPhone,
            type: "signup",
            isUsed: false,
            expiresAt: { $gt: new Date() },
        }).sort({ createdAt: -1 });
        if (!otpRecord) {
            return res.status(400).json({ error: "Invalid or expired OTP" });
        }
        if (otpRecord.attempts >= 3) {
            return res.status(400).json({
                error: "Maximum OTP attempts exceeded. Please request a new OTP.",
            });
        }
        if (otpRecord.otp !== String(otp).trim()) {
            otpRecord.attempts += 1;
            await otpRecord.save();
            return res.status(400).json({
                error: `Invalid OTP. ${3 - otpRecord.attempts} attempts remaining.`,
            });
        }
        return res.json({ verified: true });
    }
    catch (error) {
        console.error("verifyOnboardingOtp error:", error);
        return res.status(500).json({ error: "Failed to verify OTP" });
    }
};
exports.verifyOnboardingOtp = verifyOnboardingOtp;
const completeOnboarding = async (req, res) => {
    try {
        const googleClaims = req.googleAuthOnly;
        if (!googleClaims?.email) {
            return res.status(401).json({ message: "Invalid onboarding session" });
        }
        const { fullName, name, phone, otp } = req.body;
        const nextName = String(name || fullName || "").trim();
        const nextPhone = String(phone || "").replace(/\D/g, "");
        const nextOtp = String(otp || "").trim();
        const email = String(googleClaims.email).toLowerCase();
        if (!nextName || nextName.length < 2) {
            return res.status(400).json({ message: "Full name is required" });
        }
        if (!/^[6-9]\d{9}$/.test(nextPhone)) {
            return res.status(400).json({ message: "Invalid phone number format" });
        }
        if (!/^[0-9]{6}$/.test(nextOtp)) {
            return res.status(400).json({ message: "Invalid OTP format" });
        }
        const existingUserByEmail = await User_1.User.findOne({ email });
        if (existingUserByEmail) {
            const accessToken = jwt.sign({ userId: existingUserByEmail._id, email: existingUserByEmail.email, role: existingUserByEmail.role }, JWT_SECRET, { expiresIn: "24h" });
            const refreshToken = jwt.sign({ userId: existingUserByEmail._id }, JWT_REFRESH_SECRET, {
                expiresIn: "7d",
            });
            const resolvedName = String(existingUserByEmail.name || existingUserByEmail.fullName || "").trim();
            const resolvedPhoneRaw = String(existingUserByEmail.phone || "");
            const resolvedPhoneDigits = resolvedPhoneRaw.replace(/\D/g, "");
            const resolvedPhone10 = resolvedPhoneDigits.length >= 10
                ? resolvedPhoneDigits.slice(-10)
                : resolvedPhoneDigits;
            const profileCompleted = resolvedName.length > 0 && /^[6-9]\d{9}$/.test(resolvedPhone10);
            return res.json({
                authState: "ACTIVE",
                profileCompleted,
                user: {
                    ...existingUserByEmail?.toObject?.()
                        ? existingUserByEmail.toObject()
                        : existingUserByEmail,
                    profileCompleted,
                    isProfileComplete: profileCompleted,
                },
                accessToken,
                refreshToken,
            });
        }
        const existingUserByPhone = await User_1.User.findOne({ phone: nextPhone });
        if (existingUserByPhone) {
            return res
                .status(409)
                .json({ message: "Phone number already exists" });
        }
        const otpRecord = await Otp_1.default.findOne({
            phone: nextPhone,
            type: "signup",
            isUsed: false,
            expiresAt: { $gt: new Date() },
        }).sort({ createdAt: -1 });
        if (!otpRecord) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }
        if (otpRecord.attempts >= 3) {
            return res.status(400).json({
                message: "Maximum OTP attempts exceeded. Please request a new OTP.",
            });
        }
        if (otpRecord.otp !== nextOtp) {
            otpRecord.attempts += 1;
            await otpRecord.save();
            return res.status(400).json({
                message: `Invalid OTP. ${3 - otpRecord.attempts} attempts remaining.`,
            });
        }
        otpRecord.isUsed = true;
        await otpRecord.save();
        const newUser = new User_1.User({
            name: nextName,
            email,
            phone: nextPhone,
            oauthProviders: googleClaims.providerId
                ? [{ provider: "google", providerId: String(googleClaims.providerId) }]
                : [],
            isProfileComplete: true,
            mobileVerified: true,
        });
        await newUser.save();
        const accessToken = jwt.sign({ userId: newUser._id, email: newUser.email, role: newUser.role }, JWT_SECRET, { expiresIn: "24h" });
        const refreshToken = jwt.sign({ userId: newUser._id }, JWT_REFRESH_SECRET, {
            expiresIn: "7d",
        });
        const resolvedName = String(newUser.name || newUser.fullName || "").trim();
        const resolvedPhoneRaw = String(newUser.phone || "");
        const resolvedPhoneDigits = resolvedPhoneRaw.replace(/\D/g, "");
        const resolvedPhone10 = resolvedPhoneDigits.length >= 10
            ? resolvedPhoneDigits.slice(-10)
            : resolvedPhoneDigits;
        const profileCompleted = resolvedName.length > 0 && /^[6-9]\d{9}$/.test(resolvedPhone10);
        return res.json({
            authState: "ACTIVE",
            profileCompleted,
            user: {
                ...newUser?.toObject?.() ? newUser.toObject() : newUser,
                profileCompleted,
                isProfileComplete: profileCompleted,
            },
            accessToken,
            refreshToken,
        });
    }
    catch (error) {
        if (error?.code === 11000) {
            return res.status(409).json({ message: "Account already exists" });
        }
        console.error("completeOnboarding error:", error);
        return res.status(500).json({ message: "Failed to complete onboarding" });
    }
};
exports.completeOnboarding = completeOnboarding;
const login = async (req, res) => {
    try {
        const { email, phone, password } = req.body;
        // Require an explicit identifier
        if (!email && !phone) {
            res.status(400).json({ message: "Email or phone is required" });
            return;
        }
        // Look up strictly by the identifier the client provided
        let user;
        if (email) {
            user = await User_1.User.findOne({ email: String(email).toLowerCase() });
        }
        else if (phone) {
            const cleanedPhone = String(phone).replace(/\D/g, "");
            user = await User_1.User.findOne({ phone: cleanedPhone });
        }
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
        const resolvedName = String(user.name || user.fullName || "").trim();
        const resolvedPhoneRaw = String(user.phone || "");
        const resolvedPhoneDigits = resolvedPhoneRaw.replace(/\D/g, "");
        const resolvedPhone10 = resolvedPhoneDigits.length >= 10 ? resolvedPhoneDigits.slice(-10) : resolvedPhoneDigits;
        const hasName = resolvedName.length > 0;
        const hasPhone = /^[6-9]\d{9}$/.test(resolvedPhone10);
        const isPhoneVerified = !!user.mobileVerified || !!user.isProfileComplete;
        const profileCompleted = hasName && hasPhone;
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
                profileCompleted,
                // backward compatibility for older frontend code paths
                isProfileComplete: profileCompleted,
            },
            token: accessToken,
            refreshToken,
        });
        try {
            await (0, eventBus_1.publish)((0, account_events_1.createAccountNewLoginEvent)({
                source: "identity",
                actor: { type: user.role === "admin" ? "admin" : "user", id: String(user._id) },
                userId: String(user._id),
            }));
        }
        catch (e) {
            console.error("[authController] failed to publish ACCOUNT_NEW_LOGIN", e);
        }
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
        const resolvedName = String(user.name || user.fullName || "").trim();
        const resolvedPhoneRaw = String(user.phone || "");
        const resolvedPhoneDigits = resolvedPhoneRaw.replace(/\D/g, "");
        const resolvedPhone10 = resolvedPhoneDigits.length >= 10
            ? resolvedPhoneDigits.slice(-10)
            : resolvedPhoneDigits;
        const hasName = resolvedName.length > 0;
        const hasPhone = /^[6-9]\d{9}$/.test(resolvedPhone10);
        const profileCompleted = hasName && hasPhone;
        res.json({
            message: "OAuth login successful",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                addresses: user.addresses,
                profileCompleted,
                // backward compatibility for older frontend code paths
                isProfileComplete: profileCompleted,
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
        // Check if this is a signup required case (user not found in OAuth strategy)
        // IMPORTANT: do NOT create a partial user record. Issue a GOOGLE_AUTH_ONLY onboarding session.
        if (user._signupRequired) {
            const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
            const redirectUrl = new URL(`${frontendUrl}/auth/callback`);
            const email = String(user.email || "").toLowerCase();
            const name = String(user.name || "");
            const providerId = String(user.oauthProviders?.[0]?.providerId || "");
            const onboardingToken = jwt.sign({
                authState: "GOOGLE_AUTH_ONLY",
                email,
                name,
                provider: "google",
                providerId,
            }, JWT_SECRET, { expiresIn: "30m" });
            redirectUrl.searchParams.set("token", onboardingToken);
            redirectUrl.searchParams.set("authState", "GOOGLE_AUTH_ONLY");
            redirectUrl.searchParams.set("email", email);
            redirectUrl.searchParams.set("name", name);
            res.redirect(redirectUrl.toString());
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
        try {
            await (0, eventBus_1.publish)((0, account_events_1.createAccountPasswordChangedEvent)({
                source: "identity",
                actor: { type: user.role === "admin" ? "admin" : "user", id: String(user._id) },
                userId: String(user._id),
            }));
        }
        catch (e) {
            console.error("[authController] failed to publish ACCOUNT_PASSWORD_CHANGED", e);
        }
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
        // Check mode: signup or login (default login)
        const isSignup = String(req.query.mode || "") === "signup";
        // In signup mode, we don't need to find an existing user
        let user;
        if (!isSignup) {
            // In login mode, look up strictly by the identifier type
            if (isPhone) {
                const cleanedPhone = String(userInput).replace(/\D/g, "");
                user = await User_1.User.findOne({ phone: cleanedPhone });
            }
            else if (isEmail) {
                const normalizedEmail = String(userInput).toLowerCase();
                user = await User_1.User.findOne({ email: normalizedEmail });
            }
            // In login mode, user must exist
            if (!user) {
                return res.status(404).json({
                    error: "Account not found. Please sign up first.",
                    action: "signup_required",
                    email: isEmail ? userInput : undefined,
                });
            }
        }
        // Determine where to send OTP:
        // - signup: use the raw input (new number/email)
        // - login: use the user's stored contact (prefer DB value)
        let targetPhone;
        let targetEmail;
        if (isPhone) {
            targetPhone = isSignup ? userInput : (user?.phone || userInput);
        }
        else if (isEmail) {
            targetEmail = isSignup ? userInput : (user?.email || userInput);
        }
        // Generate 6-digit OTP
        const otp = (0, sms_1.generateOTP)();
        // Create OTP record. Always include phone field (required by model) and optionally email.
        const otpPayload = {
            phone: targetPhone || user?.phone || userInput, // Always provide phone
            otp,
            type: isSignup ? "signup" : "login",
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
            isUsed: false,
            attempts: 0,
        };
        // Include email field if it's an email-based OTP
        if (targetEmail)
            otpPayload.email = String(targetEmail);
        const otpRecord = new Otp_1.default(otpPayload);
        await otpRecord.save();
        // Send OTP based on input type
        if (targetPhone) {
            // Send OTP via SMS
            const message = `Your CS Store ${isSignup ? "signup" : "login"} OTP is ${otp}. Valid for 10 minutes. Do not share this OTP with anyone.`;
            await (0, sms_1.sendSMS)(targetPhone, message);
        }
        else if (targetEmail) {
            // Send OTP via Email using Gmail SMTP or fallback
            await (0, sendEmailOTP_1.sendEmailOTP)(targetEmail, otp);
        }
        res.json({
            message: "OTP sent successfully",
            expiresIn: 600, // 10 minutes in seconds
            sentTo: targetPhone ? "phone" : "email",
        });
    }
    catch (error) {
        console.error("sendAuthOTP error:", error);
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
        // Determine mode
        const isSignup = String(req.query.mode || "") === "signup";
        // In signup mode we verify OTP against the contact (phone/email) regardless of existing user.
        if (isSignup) {
            // Find OTP record by phone or email
            const otpRecord = await Otp_1.default.findOne({
                ...(phone ? { phone } : {}),
                ...(email ? { email } : {}),
                type: "signup",
                isUsed: false,
                expiresAt: { $gt: new Date() },
            }).sort({ createdAt: -1 });
            if (!otpRecord) {
                return res.status(400).json({ error: "Invalid or expired OTP" });
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
            // For signup, we simply confirm verification (frontend will continue signup)
            return res.json({
                message: "OTP verified",
                verified: true,
            });
        }
        // LOGIN MODE: strict identifier-based lookup
        let user = null;
        if (phone && !email) {
            const cleanedPhone = String(phone).replace(/\D/g, "");
            user = await User_1.User.findOne({ phone: cleanedPhone });
        }
        else if (email && !phone) {
            const normalizedEmail = String(email).toLowerCase();
            user = await User_1.User.findOne({ email: normalizedEmail });
        }
        else {
            // Ambiguous input (both or neither) is not allowed in login mode
            return res
                .status(400)
                .json({ error: "Provide exactly one of phone or email" });
        }
        if (!user) {
            return res.status(404).json({
                error: "Account not found. Please sign up first.",
                action: "signup_required",
                email: email ? String(email) : undefined,
            });
        }
        // Find OTP record matching user's phone/email
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
        // Successful OTP login means the phone is verified for this account
        if (!user.mobileVerified) {
            user.mobileVerified = true;
            await user.save();
        }
        // Generate tokens
        const accessToken = jwt.sign({ userId: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "24h" } // Extended from 15m to 24h to prevent frequent expiration
        );
        const refreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, {
            expiresIn: "7d",
        });
        const resolvedName = String(user.name || user.fullName || "").trim();
        const resolvedPhoneRaw = String(user.phone || "");
        const resolvedPhoneDigits = resolvedPhoneRaw.replace(/\D/g, "");
        const resolvedPhone10 = resolvedPhoneDigits.length >= 10 ? resolvedPhoneDigits.slice(-10) : resolvedPhoneDigits;
        const hasName = resolvedName.length > 0;
        const hasPhone = /^[6-9]\d{9}$/.test(resolvedPhone10);
        const isPhoneVerified = !!user.mobileVerified || !!user.isProfileComplete;
        const profileCompleted = hasName && hasPhone;
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
                profileCompleted,
                // backward compatibility for older frontend code paths
                isProfileComplete: profileCompleted,
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
        const { fullName, name, phone, email } = req.body;
        const nextName = String(name || fullName || "").trim();
        const nextPhone = String(phone || "").replace(/\D/g, "");
        const updatedUser = await User_1.User.findByIdAndUpdate(userId, {
            name: nextName,
            phone: nextPhone,
            email,
            isProfileComplete: true,
            mobileVerified: true,
        }, { new: true });
        const updatedName = String(updatedUser?.name || updatedUser?.fullName || "").trim();
        const updatedPhoneRaw = String(updatedUser?.phone || "");
        const updatedPhoneDigits = updatedPhoneRaw.replace(/\D/g, "");
        const updatedPhone10 = updatedPhoneDigits.length >= 10 ? updatedPhoneDigits.slice(-10) : updatedPhoneDigits;
        const hasName = updatedName.length > 0;
        const hasPhone = /^[6-9]\d{9}$/.test(updatedPhone10);
        const isPhoneVerified = !!updatedUser?.mobileVerified;
        const profileCompleted = hasName && hasPhone;
        return res.json({
            success: true,
            user: {
                ...updatedUser?.toObject?.() ? updatedUser.toObject() : updatedUser,
                profileCompleted,
                isProfileComplete: profileCompleted,
            },
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
        // Authoritative profile completion check (server-side)
        const resolvedName = String(user.name || user.fullName || "").trim();
        const resolvedPhoneRaw = String(user.phone || "");
        const resolvedPhoneDigits = resolvedPhoneRaw.replace(/\D/g, "");
        const resolvedPhone10 = resolvedPhoneDigits.length >= 10 ? resolvedPhoneDigits.slice(-10) : resolvedPhoneDigits;
        const hasName = resolvedName.length > 0;
        const hasPhone = /^[6-9]\d{9}$/.test(resolvedPhone10);
        const isPhoneVerified = !!user.mobileVerified || !!user.isProfileComplete; // Backward compatible
        const profileCompleted = hasName && hasPhone;
        res.json({ user: { ...user.toObject(), profileCompleted } });
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
