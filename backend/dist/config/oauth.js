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
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ||
    "181811534733-pc8tub5e2farke4tuveh352gtngs02uv.apps.googleusercontent.com";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "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";
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
            // 1) If user already linked with this Google account, log them in
            let user = await User_1.User.findOne({
                "oauthProviders.providerId": googleId,
                "oauthProviders.provider": "google",
            });
            if (user) {
                return done(null, user);
            }
            // 2) Try to find existing user by email and link Google provider
            if (email) {
                user = await User_1.User.findOne({ email });
                if (user) {
                    user.oauthProviders = user.oauthProviders || [];
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
            }
            // 3) No existing user found, create a new one
            const newUser = new User_1.User({
                name: profile.displayName || "",
                email: email || "",
                phone: "", // Google OAuth typically doesn't provide phone
                oauthProviders: [
                    {
                        provider: "google",
                        providerId: googleId,
                    },
                ],
                addresses: [],
                isProfileComplete: false,
            });
            await newUser.save();
            return done(null, newUser);
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
