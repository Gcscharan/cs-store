import dotenv from "dotenv";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { User } from "../models/User";

dotenv.config();

// Environment variable validation
const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  "181811534733-pc8tub5e2farke4tuveh352gtngs02uv.apps.googleusercontent.com";
const GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET || "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";

console.log("Google OAuth credentials:", {
  clientId: GOOGLE_CLIENT_ID ? "Present" : "Missing",
  clientSecret: GOOGLE_CLIENT_SECRET ? "Present" : "Missing",
});

// Google OAuth Strategy (only if credentials are provided)
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: "http://localhost:5001/api/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user exists with this Google ID
          let user = await User.findOne({
            "oauthProviders.providerId": profile.id,
            "oauthProviders.provider": "google",
          });

          if (user) {
            return done(null, user);
          }

          // Check if user exists with same email
          user = await User.findOne({ email: profile.emails?.[0]?.value });

          if (user) {
            // Link Google account to existing user
            user.oauthProviders = user.oauthProviders || [];
            user.oauthProviders.push({
              provider: "google",
              providerId: profile.id,
            });
            await user.save();
            return done(null, user);
          }

          // Check if user already exists with this email
          const existingUser = await User.findOne({
            email: profile.emails?.[0]?.value,
          });
          if (existingUser) {
            return done(
              new Error("An account with this email already exists"),
              undefined
            );
          }

          // Create new user
          const newUser = new User({
            name: profile.displayName || "",
            email: profile.emails?.[0]?.value,
            phone: "", // Google OAuth typically doesn't provide phone
            oauthProviders: [
              {
                provider: "google",
                providerId: profile.id,
              },
            ],
            addresses: [],
            // Check if profile is complete (has name and phone)
            isProfileComplete: !!(profile.displayName && false), // Always false since Google doesn't provide phone
          });

          await newUser.save();
          return done(null, newUser);
        } catch (error) {
          return done(error, undefined);
        }
      }
    )
  );
} else {
  console.warn(
    "⚠️  Google OAuth credentials not found. Google login will be disabled."
  );
}

export default passport;
