"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const User_1 = require("../models/User");
dotenv_1.default.config();
// Environment variable validation
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
console.log("Google OAuth credentials:", {
    clientId: GOOGLE_CLIENT_ID ? "Present" : "Missing",
    clientSecret: GOOGLE_CLIENT_SECRET ? "Present" : "Missing",
});
// Google OAuth Strategy (only if credentials are provided)
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    passport_1.default.use(new passport_google_oauth20_1.Strategy({
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: "http://localhost:5001/api/auth/google/callback",
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const googleId = profile.id;
            const email = profile.emails?.[0]?.value;
            if (!email) {
                return done(new Error("Google account does not have an email address"), undefined);
            }
            // Strict lookup: only allow login if a user with this exact email already exists
            const user = await User_1.User.findOne({ email });
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
    console.warn("⚠️  Google OAuth credentials not found. Google login will be disabled.");
}
exports.default = passport_1.default;
