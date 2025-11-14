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
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ||
    "181811534733-pc8tub5e2farke4tuveh352gtngs02uv.apps.googleusercontent.com";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "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";
console.log("Google OAuth credentials:", {
    clientId: GOOGLE_CLIENT_ID ? "Present" : "Missing",
    clientSecret: GOOGLE_CLIENT_SECRET ? "Present" : "Missing",
});
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    passport_1.default.use(new passport_google_oauth20_1.Strategy({
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: "http://localhost:5001/api/auth/google/callback",
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            let user = await User_1.User.findOne({
                "oauthProviders.providerId": profile.id,
                "oauthProviders.provider": "google",
            });
            if (user) {
                return done(null, user);
            }
            user = await User_1.User.findOne({ email: profile.emails?.[0]?.value });
            if (user) {
                user.oauthProviders = user.oauthProviders || [];
                user.oauthProviders.push({
                    provider: "google",
                    providerId: profile.id,
                });
                await user.save();
                return done(null, user);
            }
            const existingUser = await User_1.User.findOne({
                email: profile.emails?.[0]?.value,
            });
            if (existingUser) {
                return done(new Error("An account with this email already exists"), undefined);
            }
            const newUser = new User_1.User({
                name: profile.displayName,
                email: profile.emails?.[0]?.value,
                oauthProviders: [
                    {
                        provider: "google",
                        providerId: profile.id,
                    },
                ],
                addresses: [],
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
//# sourceMappingURL=oauth.js.map