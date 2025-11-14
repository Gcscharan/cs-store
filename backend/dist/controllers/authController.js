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
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePassword = exports.googleCallback = exports.logout = exports.refresh = exports.oauth = exports.login = exports.signup = void 0;
const jwt = __importStar(require("jsonwebtoken"));
const bcrypt = __importStar(require("bcryptjs"));
const User_1 = require("../models/User");
const Pincode_1 = require("../models/Pincode");
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-refresh-secret";
const signup = async (req, res) => {
    try {
        const { name, email, phone, password, addresses } = req.body;
        if (!name || !email || !phone || !password) {
            res.status(400).json({
                error: "Name, email, phone, and password are required for registration",
            });
            return;
        }
        if (!/^[6-9]\d{9}$/.test(phone)) {
            res.status(400).json({
                error: "Invalid phone number format. Please enter a valid 10-digit mobile number starting with 6-9.",
            });
            return;
        }
        if (addresses && addresses.length > 0) {
            const defaultAddress = addresses.find((addr) => addr.isDefault);
            if (defaultAddress) {
                const pincodeExists = await Pincode_1.Pincode.findOne({
                    pincode: defaultAddress.pincode,
                });
                if (!pincodeExists) {
                    res.status(400).json({
                        error: "Unable to deliver to this location.",
                    });
                    return;
                }
            }
        }
        const existingUserByEmail = await User_1.User.findOne({ email });
        if (existingUserByEmail) {
            res
                .status(400)
                .json({ error: "An account with this email already exists" });
            return;
        }
        const existingUserByPhone = await User_1.User.findOne({ phone });
        if (existingUserByPhone) {
            res
                .status(400)
                .json({ error: "An account with this phone number already exists" });
            return;
        }
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        const user = new User_1.User({
            name,
            email,
            phone,
            passwordHash,
            addresses: addresses || [],
        });
        await user.save();
        const accessToken = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: "15m" });
        const refreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, {
            expiresIn: "7d",
        });
        res.status(201).json({
            message: "User registered successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                isAdmin: user.role === "admin",
                addresses: user.addresses,
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
const login = async (req, res) => {
    try {
        const { email, phone, password } = req.body;
        const user = await User_1.User.findOne({
            $or: [{ email }, { phone }],
        });
        if (!user || !user.passwordHash) {
            res.status(401).json({ error: "Invalid credentials" });
            return;
        }
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            res.status(401).json({ error: "Invalid credentials" });
            return;
        }
        const accessToken = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: "15m" });
        const refreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, {
            expiresIn: "7d",
        });
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
            },
            accessToken,
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
        let user = await User_1.User.findOne({
            "oauthProviders.provider": provider,
            "oauthProviders.providerId": providerId,
        });
        if (!user) {
            user = await User_1.User.findOne({ email });
            if (user) {
                user.oauthProviders = user.oauthProviders || [];
                user.oauthProviders.push({ provider, providerId });
                await user.save();
            }
            else {
                user = new User_1.User({
                    name,
                    email,
                    phone,
                    oauthProviders: [{ provider, providerId }],
                });
                await user.save();
            }
        }
        const accessToken = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: "15m" });
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
            res.status(401).json({ error: "Refresh token required" });
            return;
        }
        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
        const user = await User_1.User.findById(decoded.userId);
        if (!user) {
            res.status(401).json({ error: "Invalid refresh token" });
            return;
        }
        const accessToken = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: "15m" });
        res.json({ accessToken });
    }
    catch (error) {
        res.status(401).json({ error: "Invalid refresh token" });
        return;
    }
};
exports.refresh = refresh;
const logout = async (req, res) => {
    res.json({ message: "Logout successful" });
};
exports.logout = logout;
const googleCallback = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
            res.redirect(`${frontendUrl}/auth/callback?error=authentication_failed`);
            return;
        }
        const accessToken = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: "15m" });
        const refreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, {
            expiresIn: "7d",
        });
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
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                error: "Current password and new password are required",
            });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({
                error: "New password must be at least 6 characters long",
            });
        }
        const user = await User_1.User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({ error: "Current password is incorrect" });
        }
        const saltRounds = 12;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
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
//# sourceMappingURL=authController.js.map