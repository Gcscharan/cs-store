"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../utils/logger");
const dotenv_1 = __importDefault(require("dotenv"));
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const User_1 = require("../models/User");
dotenv_1.default.config();
// Environment variable validation
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const NODE_ENV = process.env.NODE_ENV || "development";
const PORT = String(process.env.PORT || "5001").trim() || "5001";
const backendBaseUrl = String(process.env.BACKEND_URL || "").trim().replace(/\/+$/, "");
const googleCallbackUrlFromEnv = String(process.env.GOOGLE_CALLBACK_URL || "").trim();
const GOOGLE_CALLBACK_URL = (googleCallbackUrlFromEnv ? googleCallbackUrlFromEnv : undefined) ||
    (backendBaseUrl ? `${backendBaseUrl}/api/auth/google/callback` : undefined) ||
    (NODE_ENV !== "production"
        ? "http://localhost:5001/api/auth/google/callback"
        : undefined);
logger_1.logger.info("Google OAuth credentials:", {
    clientId: GOOGLE_CLIENT_ID ? "Present" : "Missing",
    clientSecret: GOOGLE_CLIENT_SECRET ? "Present" : "Missing",
});
// Google OAuth Strategy (only if credentials are provided)
const callbackURL = GOOGLE_CALLBACK_URL ||
    undefined;
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && callbackURL) {
    passport_1.default.use(new passport_google_oauth20_1.Strategy({
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL,
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const googleId = profile.id;
            const email = profile.emails?.[0]?.value;
            if (!email) {
                return done(new Error("Google account does not have an email address"), undefined);
            }
            // Strict lookup: only allow login if a user with this exact email already exists
            const user = await User_1.User.findOne({ email });
            logger_1.logger.info("=== GOOGLE STRATEGY VERIFY ===");
            logger_1.logger.info("Email from Google:", email);
            logger_1.logger.info("User found:", !!user);
            logger_1.logger.info("Returning signupRequired:", !user);
            logger_1.logger.info("================================");
            if (!user) {
                // No user with this email exists -> create a temporary user object for redirect
                // We'll handle the signup_required logic in the callback
                const tempUser = {
                    email: email,
                    name: profile.displayName || "",
                    oauthProviders: [
                        {
                            provider: "google",
                            providerId: googleId,
                        },
                    ],
                    _signupRequired: true // Flag to indicate signup is needed
                };
                return done(null, tempUser);
            }
            // Link Google provider if not already linked
            if (!user.oauthProviders) {
                user.oauthProviders = [];
            }
            const alreadyLinked = user.oauthProviders.some((p) => p.provider === "google" && p.providerId === googleId);
            if (!alreadyLinked) {
                user.oauthProviders.push({
                    provider: "google",
                    providerId: googleId,
                });
                await user.save();
            }
            return done(null, user);
        }
        catch (error) {
            return done(error, undefined);
        }
    }));
}
else {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        logger_1.logger.warn("⚠️  Google OAuth credentials not found. Google login will be disabled.");
    }
    else if (!callbackURL) {
        logger_1.logger.warn("⚠️  Google OAuth callback URL is not configured (GOOGLE_CALLBACK_URL or BACKEND_URL). Google login will be disabled.");
    }
}
if (NODE_ENV === "production" && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && !callbackURL) {
    logger_1.logger.warn("⚠️  GOOGLE_CALLBACK_URL (or BACKEND_URL) is not set. Google OAuth will be disabled in production.");
}
exports.default = passport_1.default;
