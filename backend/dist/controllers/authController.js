"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.refresh = exports.oauth = exports.login = exports.signup = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const Pincode_1 = require("../models/Pincode");
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-refresh-secret";
const signup = async (req, res) => {
    try {
        const { name, email, phone, password, addresses } = req.body;
        if (addresses && addresses.length > 0) {
            const defaultAddress = addresses.find((addr) => addr.isDefault);
            if (defaultAddress) {
                const pincodeExists = await Pincode_1.Pincode.findOne({
                    pincode: defaultAddress.pincode,
                });
                if (!pincodeExists) {
                    return res.status(400).json({
                        error: "Unable to deliver to this location.",
                    });
                }
            }
        }
        const existingUser = await User_1.User.findOne({ email });
        if (existingUser) {
            return res
                .status(400)
                .json({ error: "User already exists with this email" });
        }
        const user = new User_1.User({
            name,
            email,
            phone,
            passwordHash: password,
            addresses: addresses || [],
        });
        await user.save();
        const accessToken = jsonwebtoken_1.default.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: "15m" });
        const refreshToken = jsonwebtoken_1.default.sign({ userId: user._id }, JWT_REFRESH_SECRET, {
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
                addresses: user.addresses,
            },
            accessToken,
            refreshToken,
        });
    }
    catch (error) {
        res.status(500).json({ error: "Registration failed" });
    }
};
exports.signup = signup;
const login = async (req, res) => {
    try {
        const { email, phone, password } = req.body;
        const user = await User_1.User.findOne({
            $or: [{ email }, { phone }],
        }).select("+passwordHash");
        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        const accessToken = jsonwebtoken_1.default.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: "15m" });
        const refreshToken = jsonwebtoken_1.default.sign({ userId: user._id }, JWT_REFRESH_SECRET, {
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
                addresses: user.addresses,
            },
            accessToken,
            refreshToken,
        });
    }
    catch (error) {
        res.status(500).json({ error: "Login failed" });
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
        const accessToken = jsonwebtoken_1.default.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: "15m" });
        const refreshToken = jsonwebtoken_1.default.sign({ userId: user._id }, JWT_REFRESH_SECRET, {
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
    }
};
exports.oauth = oauth;
const refresh = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(401).json({ error: "Refresh token required" });
        }
        const decoded = jsonwebtoken_1.default.verify(refreshToken, JWT_REFRESH_SECRET);
        const user = await User_1.User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ error: "Invalid refresh token" });
        }
        const accessToken = jsonwebtoken_1.default.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: "15m" });
        res.json({ accessToken });
    }
    catch (error) {
        res.status(401).json({ error: "Invalid refresh token" });
    }
};
exports.refresh = refresh;
const logout = async (req, res) => {
    res.json({ message: "Logout successful" });
};
exports.logout = logout;
//# sourceMappingURL=authController.js.map