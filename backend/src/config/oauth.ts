import dotenv from "dotenv";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { User } from "../models/User";

dotenv.config();

// Environment variable validation
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;

// Google OAuth Strategy (only if credentials are provided)
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: "/api/auth/google/callback",
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

          // Create new user
          const newUser = new User({
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

// Facebook OAuth Strategy (only if credentials are provided)
if (FACEBOOK_APP_ID && FACEBOOK_APP_SECRET) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: FACEBOOK_APP_ID,
        clientSecret: FACEBOOK_APP_SECRET,
        callbackURL: "/api/auth/facebook/callback",
        profileFields: ["id", "emails", "name"],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user exists with this Facebook ID
          let user = await User.findOne({
            "oauthProviders.providerId": profile.id,
            "oauthProviders.provider": "facebook",
          });

          if (user) {
            return done(null, user);
          }

          // Check if user exists with same email
          user = await User.findOne({ email: profile.emails?.[0]?.value });

          if (user) {
            // Link Facebook account to existing user
            user.oauthProviders = user.oauthProviders || [];
            user.oauthProviders.push({
              provider: "facebook",
              providerId: profile.id,
            });
            await user.save();
            return done(null, user);
          }

          // Create new user
          const newUser = new User({
            name: `${profile.name?.givenName} ${profile.name?.familyName}`,
            email: profile.emails?.[0]?.value,
            oauthProviders: [
              {
                provider: "facebook",
                providerId: profile.id,
              },
            ],
            addresses: [],
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
    "⚠️  Facebook OAuth credentials not found. Facebook login will be disabled."
  );
}

export default passport;
