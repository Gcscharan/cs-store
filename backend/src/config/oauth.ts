import dotenv from "dotenv";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { User } from "../models/User";

dotenv.config();

// Environment variable validation
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL ||
  (process.env.BACKEND_URL
    ? `${String(process.env.BACKEND_URL).replace(/\/+$/, "")}/api/auth/google/callback`
    : undefined);

console.log("Google OAuth credentials:", {
  clientId: GOOGLE_CLIENT_ID ? "Present" : "Missing",
  clientSecret: GOOGLE_CLIENT_SECRET ? "Present" : "Missing",
});

// Google OAuth Strategy (only if credentials are provided)
const callbackURL =
  GOOGLE_CALLBACK_URL ||
  undefined;

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && callbackURL) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value;

          if (!email) {
            return done(new Error("Google account does not have an email address"), undefined);
          }

          // Strict lookup: only allow login if a user with this exact email already exists
          const user = await User.findOne({ email });

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

          const alreadyLinked = user.oauthProviders.some(
            (p: any) => p.provider === "google" && p.providerId === googleId
          );

          if (!alreadyLinked) {
            user.oauthProviders.push({
              provider: "google",
              providerId: googleId,
            });
            await user.save();
          }

          return done(null, user);
        } catch (error) {
          return done(error, undefined);
        }
      }
    )
  );
}
 else {
  console.warn(
    "⚠️  Google OAuth credentials not found. Google login will be disabled."
  );
}

if (process.env.NODE_ENV === "production" && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && !callbackURL) {
  console.warn(
    "⚠️  GOOGLE_CALLBACK_URL (or BACKEND_URL) is not set. Google OAuth will be disabled in production."
  );
}

export default passport;
