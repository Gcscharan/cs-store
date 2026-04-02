import { logger } from '../../../utils/logger';
import { Request, Response } from "express";
import * as jwt from "jsonwebtoken";
import * as bcrypt from "bcryptjs";
import * as passport from "passport";
import { User, IOAuthProvider } from "../../../models/User";
import { Pincode } from "../../../models/Pincode";
import { createError } from "../../../middleware/errorHandler";
import Otp from "../../../models/Otp";
import { generateOTP, sendSMS, validatePhoneNumber } from "../../../utils/sms";
import { sendEmailOTP } from "../../../utils/sendEmailOTP";
import { publish } from "../../events/eventBus";
import { createAccountNewLoginEvent, createAccountPasswordChangedEvent } from "../../events/account.events";
import mongoose from "mongoose";
import { safeDoc } from "../../../utils/safeDoc";
import { sanitizeUser, toSafeUserResponse } from "../../../utils/sanitizeUser";
import { OAuth2Client } from "google-auth-library";

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string;

// Token expiry configuration
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || "24h";
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || "7d";

export const signup = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    // FIX: accept both name and fullName from the frontend safely
    const { fullName, name: rawName, email, phone, addresses } = req.body;
    const name = rawName || fullName;

    // Validate required fields (password no longer required - OTP/Google OAuth only)
    if (!name || !email || !phone) {
      res.status(400).json({
        message: "Name, email, and phone are required for registration",
      });
      return;
    }

    // Validate phone number format for Indian mobile numbers
    if (!/^[6-9]\d{9}$/.test(phone)) {
      res.status(400).json({
        message:
          "Invalid phone number format. Please enter a valid 10-digit mobile number starting with 6-9.",
      });
      return;
    }

    // Validate pincode in default address (only if addresses are provided)
    if (addresses && addresses.length > 0) {
      const defaultAddress = addresses.find((addr: any) => addr.isDefault);
      if (defaultAddress) {
        const pincodeExists = await Pincode.findOne({
          pincode: defaultAddress.pincode,
        });
        if (!pincodeExists) {
          res.status(400).json({ message: "Unable to deliver to this location." });
          return;
        }
      }
    }

    // Check if user already exists with this email
    const existingUserByEmail = await User.findOne({ email });
    if (existingUserByEmail) {
      res.status(400).json({ message: "Email already exists" });
      return;
    }

    // Check if user already exists with this phone number
    const existingUserByPhone = await User.findOne({ phone });
    if (existingUserByPhone) {
      res.status(400).json({ message: "Phone number already exists" });
      return;
    }

    // Create user directly (no password - OTP/Google OAuth only)
    logger.info("[DB][Signup][BeforeCreate] Host:", mongoose.connection.host);
    logger.info("[DB][Signup][BeforeCreate] Database Name:", mongoose.connection.name);
    logger.info("[DB][Signup][BeforeCreate] User.collection.name:", (User as any).collection?.name);
    const user = await User.create({
      name,
      email,
      phone,
      addresses: addresses || [],
      role: "customer",
      mobileVerified: true, // Phone verified via OTP before signup
    });
    logger.info("[DB][Signup][AfterCreate] Host:", mongoose.connection.host);
    logger.info("[DB][Signup][AfterCreate] Database Name:", mongoose.connection.name);
    logger.info("[DB][Signup][AfterCreate] User.collection.name:", (User as any).collection?.name);
    logger.info("[DB][Signup][AfterCreate] Created user:", { id: user?._id?.toString?.(), email: user?.email });

    // Generate JWT tokens (same as login flow)
    const accessToken = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY } as jwt.SignOptions
    );

    const refreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRY,
    } as jwt.SignOptions);

    return res.status(201).json({
      message: "User created successfully",
      user: toSafeUserResponse(user),
      accessToken,
      refreshToken,
      token: accessToken,
    });
  } catch (error) {
    logger.error("Signup error:", error);
    res.status(500).json({ error: "Registration failed" });
    return;
  }
};

export const verifyOnboardingOtp = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ error: "Phone and OTP are required" });
    }

    const cleanedPhone = String(phone).replace(/\D/g, "");

    const otpRecord = await Otp.findOne({
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
  } catch (error) {
    logger.error("verifyOnboardingOtp error:", error);
    return res.status(500).json({ error: "Failed to verify OTP" });
  }
};

export const completeOnboarding = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const googleClaims = (req as any).googleAuthOnly as
      | { email: string; name?: string; avatar?: string; providerId?: string }
      | undefined;

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

    const existingUserByEmail = await User.findOne({ email });
    if (existingUserByEmail) {
      const accessToken = jwt.sign(
        { userId: existingUserByEmail._id, email: existingUserByEmail.email, role: existingUserByEmail.role },
        JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY } as jwt.SignOptions
      );
      const refreshToken = jwt.sign({ userId: existingUserByEmail._id }, JWT_REFRESH_SECRET, {
        expiresIn: REFRESH_TOKEN_EXPIRY,
      } as jwt.SignOptions);

      const resolvedName = String((existingUserByEmail as any).name || (existingUserByEmail as any).fullName || "").trim();
      const resolvedPhoneRaw = String((existingUserByEmail as any).phone || "");
      const resolvedPhoneDigits = resolvedPhoneRaw.replace(/\D/g, "");
      const resolvedPhone10 =
        resolvedPhoneDigits.length >= 10
          ? resolvedPhoneDigits.slice(-10)
          : resolvedPhoneDigits;
      const profileCompleted =
        resolvedName.length > 0 && /^[6-9]\d{9}$/.test(resolvedPhone10);

      return res.json({
        authState: "ACTIVE",
        profileCompleted,
        user: {
          ...toSafeUserResponse(existingUserByEmail),
          profileCompleted,
          isProfileComplete: profileCompleted,
        },
        accessToken,
        refreshToken,
        token: accessToken,
      });
    }

    const existingUserByPhone = await User.findOne({ phone: nextPhone });
    if (existingUserByPhone) {
      return res
        .status(409)
        .json({ message: "Phone number already exists" });
    }

    const otpRecord = await Otp.findOne({
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

    logger.info("[AUTH] Creating user after OTP verification:", { email, phone: nextPhone });
    const newUser = new User({
      name: nextName,
      email,
      phone: nextPhone,
      avatar: googleClaims.avatar || undefined,
      oauthProviders: googleClaims.providerId
        ? [{ provider: "google", providerId: String(googleClaims.providerId) }]
        : [],
      isProfileComplete: true,
      mobileVerified: true,
    });

    await newUser.save();

    const accessToken = jwt.sign(
      { userId: newUser._id, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY } as jwt.SignOptions
    );
    const refreshToken = jwt.sign({ userId: newUser._id }, JWT_REFRESH_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRY,
    } as jwt.SignOptions);

    const resolvedName = String((newUser as any).name || (newUser as any).fullName || "").trim();
    const resolvedPhoneRaw = String((newUser as any).phone || "");
    const resolvedPhoneDigits = resolvedPhoneRaw.replace(/\D/g, "");
    const resolvedPhone10 =
      resolvedPhoneDigits.length >= 10
        ? resolvedPhoneDigits.slice(-10)
        : resolvedPhoneDigits;
    const profileCompleted =
      resolvedName.length > 0 && /^[6-9]\d{9}$/.test(resolvedPhone10);

    return res.json({
      authState: "ACTIVE",
      profileCompleted,
      user: {
        ...toSafeUserResponse(newUser),
        profileCompleted,
        isProfileComplete: profileCompleted,
      },
      accessToken,
      refreshToken,
      token: accessToken,
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Account already exists" });
    }

    logger.error("completeOnboarding error:", error);
    return res.status(500).json({ message: "Failed to complete onboarding" });
  }
};

export const login = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  // Password login disabled - use OTP or Google OAuth
  return res.status(401).json({
    error: "PASSWORD_LOGIN_DISABLED",
    message: "Password login has been removed. Please use OTP or Google OAuth to sign in.",
  });
};

// Original password login implementation (deprecated)
export const _loginDeprecated = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { identifier, email, phone, password } = req.body;
    const loginValue = identifier || email || phone;

    logger.info("[LOGIN] Request body:", req.body);
    logger.info("[LOGIN] loginValue:", loginValue);

    if (!loginValue) {
      res.status(400).json({ message: "Email or phone is required" });
      return;
    }

    const isEmail = String(loginValue).includes("@");

    const normalizedEmail = isEmail
      ? String(loginValue).toLowerCase().trim()
      : undefined;
    const cleanedPhone = !isEmail
      ? String(loginValue).replace(/\D/g, "")
      : undefined;

    // DEBUG: Log what we're searching for
    logger.info("\n" + "=".repeat(60));
    logger.info("[PASSWORD LOGIN] Login attempt:");
    logger.info("  identifier:", identifier || "(not provided)");
    logger.info("  email:", normalizedEmail || "(not provided)");
    logger.info("  phone:", cleanedPhone || "(not provided)");

    // Look up strictly by the normalized identifier
    let user;
    if (normalizedEmail) {
      logger.info("[PASSWORD LOGIN] Looking up by email:", normalizedEmail);
      user = await User.findOne({ email: normalizedEmail }).select("+passwordHash");
    } else if (cleanedPhone) {
      logger.info("[PASSWORD LOGIN] Looking up by phone:", cleanedPhone);
      user = await User.findOne({ phone: cleanedPhone }).select("+passwordHash");
    }

    // DEBUG: Log what we found
    logger.info("[PASSWORD LOGIN] User found:", !!user);
    if (user) {
      logger.info("[PASSWORD LOGIN] User details:", {
        _id: user._id?.toString(),
        email: user.email,
        phone: user.phone,
        hasPasswordHash: !!user.passwordHash,
        oauthProviders: (user as any).oauthProviders?.length || 0,
        isDeleted: (user as any).isDeleted,
      });
    } else if (email) {
      // Try case-insensitive search to see if email exists with different case
      const altUser = await User.findOne({ 
        email: { $regex: new RegExp(`^${String(email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } 
      });
      if (altUser) {
        logger.info("[PASSWORD LOGIN] Found user with case-insensitive match:", {
          _id: altUser._id?.toString(),
          storedEmail: altUser.email,
          searchedEmail: String(email).toLowerCase(),
        });
      }
    }
    logger.info("=".repeat(60) + "\n");

    if (user && ((user as any).isDeleted || (user as any).deletedAt)) {
      res.status(403).json({ message: "Account is deleted" });
      return;
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
    const accessToken = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY } as jwt.SignOptions
    );

    const refreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRY,
    } as jwt.SignOptions);

    const resolvedName = String((user as any).name || (user as any).fullName || "").trim();
    const resolvedPhoneRaw = String((user as any).phone || "");
    const resolvedPhoneDigits = resolvedPhoneRaw.replace(/\D/g, "");
    const resolvedPhone10 = resolvedPhoneDigits.length >= 10 ? resolvedPhoneDigits.slice(-10) : resolvedPhoneDigits;

    const hasName = resolvedName.length > 0;
    const hasPhone = /^[6-9]\d{9}$/.test(resolvedPhone10);
    const isPhoneVerified = !!(user as any).mobileVerified || !!(user as any).isProfileComplete;
    const profileCompleted = hasName && hasPhone;

    logger.info("[LOGIN] user found:", !!user);

    res.json({
      message: "Login successful",
      user: toSafeUserResponse(user),
      accessToken,
      refreshToken,
      token: accessToken,
    });

    try {
      await publish(
        createAccountNewLoginEvent({
          source: "identity",
          actor: { type: user.role === "admin" ? "admin" : "user", id: String(user._id) },
          userId: String(user._id),
        })
      );
    } catch (e) {
      logger.error("[authController] failed to publish ACCOUNT_NEW_LOGIN", e);
    }
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
    return;
  }
};

export const oauth = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { provider, providerId, email, name, phone } = req.body;
    const providerStr = String(provider || "").trim();
    const providerIdStr = String(providerId || "").trim();
    const emailStr = String(email || "").trim().toLowerCase();
    const nameStr = String(name || "").trim();

    // Check if user exists with this OAuth provider
    let user = await User.findOne({
      "oauthProviders.provider": providerStr,
      "oauthProviders.providerId": providerIdStr,
    });

    if (!user) {
      // Check if user exists with this email
      user = await User.findOne({ email: emailStr });
      if (user && !user.isDeleted) {
        // Link OAuth provider to existing user
        user.oauthProviders = user.oauthProviders || [];
        user.oauthProviders.push({ provider: providerStr as IOAuthProvider["provider"], providerId: providerIdStr });
        await user.save();
      } else {
        // IMPORTANT: Do NOT create a user record here for ANY provider.
        // All new users must complete onboarding with OTP verification.
        // Return onboarding token for the frontend to complete registration.
        const onboardingToken = jwt.sign(
          {
            authState: "GOOGLE_AUTH_ONLY",
            email: emailStr,
            name: nameStr,
            provider: providerStr,
            providerId: providerIdStr,
          },
          JWT_SECRET,
          { expiresIn: "30m" }
        );

        return res.status(200).json({
          authState: "GOOGLE_AUTH_ONLY",
          signupRequired: true,
          email: emailStr,
          name: nameStr,
          provider: providerStr,
          providerId: providerIdStr,
          token: onboardingToken,
        });
      }
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY } as jwt.SignOptions
    );

    const refreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRY,
    } as jwt.SignOptions);

    const resolvedName = String((user as any).name || (user as any).fullName || "").trim();
    const resolvedPhoneRaw = String((user as any).phone || "");
    const resolvedPhoneDigits = resolvedPhoneRaw.replace(/\D/g, "");
    const resolvedPhone10 =
      resolvedPhoneDigits.length >= 10
        ? resolvedPhoneDigits.slice(-10)
        : resolvedPhoneDigits;

    const hasName = resolvedName.length > 0;
    const hasPhone = /^[6-9]\d{9}$/.test(resolvedPhone10);
    const profileCompleted = hasName && hasPhone;

    res.json({
      message: "OAuth login successful",
      user: toSafeUserResponse(user),
      accessToken,
      refreshToken,
      token: accessToken,
    });
  } catch (error) {
    res.status(500).json({ error: "OAuth login failed" });
    return;
  }
};

export const refresh = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
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
    } catch (redisError) {
      // Redis not available, proceed with token verification
    }

    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
    const userId = decoded.userId || decoded.id;
    const user = await User.findById(userId);

    if (!user) {
      res.status(401).json({ message: "Invalid refresh token" });
      return;
    }

    const accessToken = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY } as jwt.SignOptions
    );

    // Generate new refresh token
    const newRefreshToken = jwt.sign(
      { userId: user._id },
      JWT_REFRESH_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY } as jwt.SignOptions
    );

    res.json({ 
      message: "Token refreshed",
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    res.status(401).json({ message: "Invalid refresh token" });
    return;
  }
};

export const logout = async (
  req: any,
  res: Response
): Promise<Response | void> => {
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
      } catch (error) {
        // Failed to blacklist access token
      }
    }
    
    // Blacklist refresh token (7d expiry)
    if (refreshToken) {
      try {
        await redisClient.set(`blacklist:refresh:${refreshToken}`, 'revoked', 7 * 24 * 60 * 60); // 7d TTL
        tokensRevoked++;
      } catch (error) {
        // Failed to blacklist refresh token
      }
    }
    
    // Additional security: Invalidate all user sessions (optional)
    if (userId) {
      try {
        await redisClient.set(`user_session_revoked:${userId}`, Date.now().toString(), 7 * 24 * 60 * 60);
      } catch (error) {
        // Failed to invalidate user session
      }
    }
    
    res.json({ 
      success: true,
      message: "Logout successful",
      tokensRevoked
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: "Logout failed - unable to revoke session" 
    });
  }
};

// OAuth callback handlers
export const googleCallback = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const user = req.user as any;

    logger.info("=== GOOGLE CALLBACK START ===");
    logger.info("req.user:", req.user);
    logger.info("signupRequired:", (req.user as any)?._signupRequired);
    logger.info("email:", (req.user as any)?.email);
    logger.info("FRONTEND_URL:", process.env.FRONTEND_URL);
    logger.info("================================");

    logger.info("[OAuth][googleCallback] Signup required:", user?._signupRequired);

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
      const avatar = String(user.avatar || "");
      const providerId = String(user.oauthProviders?.[0]?.providerId || "");

      const onboardingToken = jwt.sign(
        {
          authState: "GOOGLE_AUTH_ONLY",
          email,
          name,
          avatar,
          provider: "google",
          providerId,
        },
        JWT_SECRET,
        { expiresIn: "30m" }
      );

      redirectUrl.searchParams.set("token", onboardingToken);
      redirectUrl.searchParams.set("authState", "GOOGLE_AUTH_ONLY");
      redirectUrl.searchParams.set("email", email);
      redirectUrl.searchParams.set("name", name);
      redirectUrl.searchParams.set("avatar", avatar);

      res.redirect(redirectUrl.toString());
      return;
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY } as jwt.SignOptions
    );

    const refreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRY,
    } as jwt.SignOptions);

    // Redirect to frontend with tokens and user data
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const redirectUrl = new URL(`${frontendUrl}/auth/callback`);

    redirectUrl.searchParams.set("token", accessToken);
    redirectUrl.searchParams.set("refreshToken", refreshToken);
    redirectUrl.searchParams.set("userId", user._id.toString());
    redirectUrl.searchParams.set("name", user.name || "");
    redirectUrl.searchParams.set("email", user.email || "");
    redirectUrl.searchParams.set("phone", user.phone || "");
    redirectUrl.searchParams.set("avatar", user.avatar || "");
    redirectUrl.searchParams.set("role", user.role || "customer");
    redirectUrl.searchParams.set("isAdmin", (user.role === "admin").toString());
    redirectUrl.searchParams.set("isProfileComplete", (user.isProfileComplete || false).toString());

    res.redirect(redirectUrl.toString());
  } catch (error) {
    logger.error("Google OAuth callback error:", error);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(`${frontendUrl}/auth/callback?error=callback_failed`);
    return;
  }
};

/**
 * Google Mobile Auth - Token-based authentication for React Native
 * Accepts Google ID token from mobile client, verifies it, and returns app tokens
 */
export const googleMobileAuth = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: "ID token is required" });
    }

    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    if (!GOOGLE_CLIENT_ID) {
      logger.error("GOOGLE_CLIENT_ID not configured");
      return res.status(503).json({ error: "Google OAuth not configured" });
    }

    // Verify Google ID token
    const client = new OAuth2Client(GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(401).json({ error: "Invalid ID token" });
    }

    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name || "";
    const avatar = payload.picture;

    if (!email) {
      return res.status(400).json({ error: "Google account has no email" });
    }

    logger.info("[GoogleMobileAuth] Verified token for email:", email);

    // Find or create user (same logic as Google OAuth callback)
    let user = await User.findOne({ email });

    if (!user) {
      // New user - need phone number for signup
      // Return onboarding required response
      const onboardingToken = jwt.sign(
        {
          authState: "GOOGLE_AUTH_ONLY",
          email,
          name,
          avatar,
          provider: "google",
          providerId: googleId,
        },
        JWT_SECRET,
        { expiresIn: "30m" }
      );

      return res.status(200).json({
        onboardingRequired: true,
        onboardingToken,
        user: {
          email,
          name,
          avatar,
        },
      });
    }

    // Existing user - link Google provider if not already linked
    if (!user.oauthProviders) {
      user.oauthProviders = [];
    }

    const alreadyLinked = user.oauthProviders.some(
      (p: IOAuthProvider) => p.provider === "google" && p.providerId === googleId
    );

    // Populate name from Google if missing
    const currentName = String(user.name || "").trim();
    if (!currentName && name) {
      user.name = name;
    }

    // Populate avatar from Google if missing
    if (avatar && !user.avatar) {
      user.avatar = avatar;
    }

    if (!alreadyLinked) {
      user.oauthProviders.push({
        provider: "google",
        providerId: googleId,
      });
    }

    // Save if changes were made
    if ((!currentName && name) || (avatar && !user.avatar) || !alreadyLinked) {
      await user.save();
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY } as jwt.SignOptions
    );

    const refreshToken = jwt.sign(
      { userId: user._id },
      JWT_REFRESH_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY } as jwt.SignOptions
    );

    logger.info("[GoogleMobileAuth] Login successful for user:", user._id);

    return res.json({
      message: "Login successful",
      accessToken,
      refreshToken,
      user: toSafeUserResponse(user),
    });
  } catch (error: any) {
    logger.error("Google mobile auth error:", error);
    return res.status(500).json({ error: "Google authentication failed" });
  }
};

export const changePassword = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  // Password change disabled - use OTP or Google OAuth
  return res.status(401).json({
    error: "PASSWORD_FEATURE_DISABLED",
    message: "Password login has been removed. You sign in with Google or OTP - no password needed.",
  });
};

// Original changePassword implementation (deprecated)
export const _changePasswordDeprecated = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = (req as any).userId || (req as any).user?._id;

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
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if ((user as any).isDeleted || (user as any).deletedAt) {
      return res.status(403).json({ message: "Account is deleted" });
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
      await publish(
        createAccountPasswordChangedEvent({
          source: "identity",
          actor: { type: user.role === "admin" ? "admin" : "user", id: String(user._id) },
          userId: String(user._id),
        })
      );
    } catch (e) {
      logger.error("[authController] failed to publish ACCOUNT_PASSWORD_CHANGED", e);
    }

    res.json({
      message: "Password changed successfully",
    });
  } catch (error) {
    logger.error("Change password error:", error);
    res.status(500).json({ error: "Failed to change password" });
    return;
  }
};

// Send OTP for authentication (login/signup)
export const sendAuthOTP = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    console.log("🔥 OTP API HIT");
    console.log("📱 Request body:", req.body);
    console.log("⚙️ MOCK_OTP (raw):", process.env.MOCK_OTP);
    console.log("⚙️ MOCK_OTP === 'true':", process.env.MOCK_OTP === "true");
    console.log("🔍 Mode:", req.query.mode);

    const { phone, email } = req.body;

    // Get the user input (either phone or email)
    const userInput = phone || email;

    if (!userInput) {
      return res.status(400).json({ message: "Phone or email is required" });
    }

    // Detect input type: email or phone
    // IMPORTANT: Check email FIRST because numeric prefixes (e.g., 203031240398@domain.com)
    // can be mistaken for phone numbers by digit extraction
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userInput);
    const isPhone = !isEmail && validatePhoneNumber(userInput);

    if (!isPhone && !isEmail) {
      return res.status(400).json({
        message: "Invalid phone or email format",
      });
    }

    logger.info("[OTP LOGIN] Input type detected:", { isEmail, isPhone, userInput });

    // ============================================================
    // USER LOOKUP (Case-insensitive for email)
    // ============================================================
    let user: any = null;

    // Always look up user - no signup mode
    if (isPhone) {
      const cleanedPhone = String(userInput).replace(/\D/g, "");
      logger.info("[OTP LOGIN] Looking up by phone:", cleanedPhone);
      user = await User.findOne({ phone: cleanedPhone });
    } else if (isEmail) {
      // Use case-insensitive email search from the start
      const normalizedEmail = String(userInput).toLowerCase().trim();
      logger.info("[OTP LOGIN] Looking up by email (case-insensitive):", normalizedEmail);
      
      // First try exact match (faster with index)
      user = await User.findOne({ email: normalizedEmail });
      
      // If not found, try case-insensitive regex
      if (!user) {
        logger.info("[OTP LOGIN] Exact match failed, trying case-insensitive...");
        user = await User.findOne({ 
          email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } 
        });
      }
    }

    // DEBUG: Log what we found
    logger.info("[OTP LOGIN] User found:", !!user);
    if (user) {
      logger.info("[OTP LOGIN] User details:", {
        _id: user._id?.toString(),
        email: user.email,
        phone: user.phone,
        hasPasswordHash: !!user.passwordHash,
        oauthProviders: user.oauthProviders?.length || 0,
        isDeleted: user.isDeleted,
        status: user.status,
      });
    }

    // ============================================================
    // NEW USER FLOW - Send OTP for onboarding
    // ============================================================
    if (!user) {
      logger.info("[OTP LOGIN] New user - will redirect to onboarding after OTP verification");
      // Continue to send OTP - verification will handle onboarding redirect
    } else {
      // User EXISTS - validate status

      // Soft-deleted user → 400
      if (user.isDeleted || user.deletedAt) {
        logger.info("[OTP LOGIN] Account is deleted:", user._id);
        return res.status(400).json({
          message: "This account has been deactivated. Please contact support.",
        });
      }

      // Suspended/inactive user → 400
      if (user.status === "suspended") {
        logger.info("[OTP LOGIN] Account is suspended:", user._id);
        return res.status(400).json({
          message: "This account has been suspended. Please contact support.",
        });
      }

      if (user.status === "pending") {
        logger.info("[OTP LOGIN] Account is pending:", user._id);
        return res.status(400).json({
          message: "This account is pending verification. Please complete registration first.",
        });
      }

      logger.info("[OTP LOGIN] ✓ User validated, proceeding with OTP");
    }

    // Determine where to send OTP:
    // - new user: use the raw input
    // - existing user: use the user's stored contact (prefer DB value)
    let targetPhone: string | undefined;
    let targetEmail: string | undefined;

    if (isPhone) {
      targetPhone = user ? (user?.phone || userInput) : userInput;
    } else if (isEmail) {
      targetEmail = user ? (user?.email || userInput) : userInput;
    }

    const normalizedTargetEmail = targetEmail
      ? String(targetEmail).toLowerCase().trim()
      : undefined;

    // Generate 6-digit OTP
    const otp = generateOTP();
    console.log("🔐 GENERATED OTP:", otp);

    // Create OTP record. The model requires phone, but email OTP flows may not have a phone.
    // Use a stable placeholder phone for email-based OTPs so verify can query reliably.
    const otpPayload: any = {
      phone: targetPhone ? String(targetPhone).replace(/\D/g, "") : "EMAIL",
      otp,
      type: user ? "login" : "signup", // New users get signup type for onboarding
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      isUsed: false,
      attempts: 0,
    };
    // Include normalized email field if it's an email-based OTP
    if (normalizedTargetEmail) otpPayload.email = normalizedTargetEmail;

    const otpRecord = new Otp(otpPayload);
    await otpRecord.save();
    console.log("💾 OTP saved to DB:", { phone: otpPayload.phone, type: otpPayload.type });

    // MOCK MODE: Skip SMS sending in development
    if (process.env.MOCK_OTP === "true") {
      console.log("🧪 MOCK MODE ACTIVE - NOT SENDING SMS");
      console.log("🔑 USE THIS OTP:", otp);
      console.log("⚠️  OTP is logged in console for development only");
      
      return res.json({
        message: "OTP sent successfully (mock mode)",
        expiresIn: 600,
        sentTo: targetPhone ? "phone" : "email",
        isNewUser: !user, // Indicate if this is a new user
        // DO NOT expose OTP in response - security risk
        // Check server console logs for OTP in development
      });
    }

    // Send OTP based on input type
    if (targetPhone) {
      // Send OTP via SMS
      const message = `<#> Your VyaparSetu OTP is ${otp}\nFA+9qCX9VSu`;
      await sendSMS(targetPhone, message);
    } else if (normalizedTargetEmail) {
      // Send OTP via Email using Gmail SMTP or fallback
      await sendEmailOTP(normalizedTargetEmail, otp);
    }

    res.json({
      message: "OTP sent successfully",
      expiresIn: 600, // 10 minutes in seconds
      sentTo: targetPhone ? "phone" : "email",
      isNewUser: !user, // Indicate if this is a new user for frontend routing
    });
  } catch (error: any) {
    console.error("❌ OTP ERROR:", error);
    logger.error("sendAuthOTP error:", error);
    res.status(500).json({ 
      message: "Failed to send OTP",
      details: process.env.NODE_ENV === "development" ? error.message : undefined
    });
    return;
  }
};

// Verify OTP for authentication
export const verifyAuthOTP = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { phone, email, otp } = req.body;

    // CRITICAL: OTP is ALWAYS required - no bypass
    if (!otp || String(otp).trim().length === 0) {
      logger.warn("[OTP VERIFY] Attempt to verify without OTP");
      return res.status(400).json({ error: "OTP is required" });
    }

    // Validate OTP format (must be 6 digits)
    if (!/^\d{6}$/.test(String(otp))) {
      logger.warn("[OTP VERIFY] Invalid OTP format:", otp);
      return res.status(400).json({ error: "OTP must be 6 digits" });
    }

    if (!phone && !email) {
      return res.status(400).json({ error: "Phone or email is required" });
    }

    const normalizedPhone = phone ? String(phone).replace(/\D/g, "") : undefined;
    const normalizedEmail = email ? String(email).toLowerCase().trim() : undefined;

    // Check if user exists
    let user: any | null = null;

    if (normalizedPhone) {
      user = await User.findOne({ phone: normalizedPhone });
    } else if (normalizedEmail) {
      user = await User.findOne({ email: normalizedEmail });
    }

    // Determine OTP type based on user existence
    const otpType = user ? "login" : "signup";

    // Find OTP record by phone or email
    const otpRecord = await Otp.findOne({
      ...(normalizedPhone ? { phone: normalizedPhone } : {}),
      ...(normalizedEmail ? { email: normalizedEmail } : {}),
      type: otpType,
      isUsed: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      logger.warn("[OTP VERIFY] No valid OTP found for:", { phone: normalizedPhone, email: normalizedEmail, type: otpType });
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    // Check attempts BEFORE verification
    if (otpRecord.attempts >= 3) {
      logger.warn("[OTP VERIFY] Max attempts exceeded for:", normalizedPhone || normalizedEmail);
      return res.status(400).json({
        error: "Maximum OTP attempts exceeded. Please request a new OTP.",
      });
    }

    // CRITICAL: Verify OTP matches exactly
    const otpMatches = String(otpRecord.otp).trim() === String(otp).trim();
    
    if (!otpMatches) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      
      logger.warn("[OTP VERIFY] Invalid OTP attempt:", {
        phone: normalizedPhone,
        email: normalizedEmail,
        attempts: otpRecord.attempts,
        providedOtp: otp,
        expectedOtp: otpRecord.otp
      });
      
      return res.status(400).json({
        error: `Invalid OTP. ${3 - otpRecord.attempts} attempts remaining.`,
      });
    }

    // OTP is valid - mark as used
    logger.info("[OTP VERIFY] OTP verified successfully for:", normalizedPhone || normalizedEmail);
    otpRecord.isUsed = true;
    await otpRecord.save();

    // ============================================================
    // NEW USER FLOW - Redirect to onboarding
    // ============================================================
    if (!user) {
      logger.info("[OTP VERIFY] New user - redirecting to onboarding");
      
      return res.json({
        message: "OTP verified successfully",
        requiresOnboarding: true,
        phone: normalizedPhone,
        email: normalizedEmail,
      });
    }

    // ============================================================
    // EXISTING USER FLOW - Login
    // ============================================================

    // ============================================================
    // EXISTING USER FLOW - Login
    // ============================================================
    logger.info("[OTP VERIFY] Existing user - logging in:", user._id);

    // Check for deleted/suspended accounts
    if (user.isDeleted || user.deletedAt) {
      return res.status(400).json({
        error: "This account has been deactivated. Please contact support.",
      });
    }

    if (user.status === "suspended") {
      return res.status(400).json({
        error: "This account has been suspended. Please contact support.",
      });
    }

    // Successful OTP login means the phone is verified for this account
    // Use updateOne to avoid triggering validation on other fields (e.g., old addresses missing required fields)
    if (!(user as any).mobileVerified) {
      await User.updateOne(
        { _id: user._id },
        { $set: { mobileVerified: true } }
      );
      (user as any).mobileVerified = true;
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY } as jwt.SignOptions
    );

    const refreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRY,
    } as jwt.SignOptions);

    const resolvedName = String((user as any).name || (user as any).fullName || "").trim();
    const resolvedPhoneRaw = String((user as any).phone || "");
    const resolvedPhoneDigits = resolvedPhoneRaw.replace(/\D/g, "");
    const resolvedPhone10 = resolvedPhoneDigits.length >= 10 ? resolvedPhoneDigits.slice(-10) : resolvedPhoneDigits;

    const hasName = resolvedName.length > 0;
    const hasPhone = /^[6-9]\d{9}$/.test(resolvedPhone10);
    const isPhoneVerified =
      !!(user as any).mobileVerified || !!(user as any).isProfileComplete;
    const profileCompleted = hasName && hasPhone;

    // DEBUG: Log profile completion status
    logger.info("[OTP VERIFY] Profile completion check:", {
      name: resolvedName,
      phone: resolvedPhone10,
      hasName,
      hasPhone,
      profileCompleted,
    });

    res.json({
      message: "Login successful",
      user: toSafeUserResponse(user),
      accessToken,
      refreshToken,
      token: accessToken,
    });
  } catch (error) {
    logger.error("Verify auth OTP error:", error);
    res.status(500).json({ error: "Failed to verify OTP" });
    return;
  }
};

// Check if phone number exists
export const checkPhoneExists = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
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
    const existingUser = await User.findOne({ phone });

    return res.status(200).json({
      exists: !!existingUser,
      message: existingUser 
        ? "This phone number is already registered" 
        : "Phone number is available",
    });
  } catch (error) {
    logger.error("Check phone exists error:", error);
    return res.status(500).json({ error: "Failed to check phone number" });
  }
};

// Complete user profile for OAuth users
export const completeProfile = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    // Log request for debugging
    logger.info("completeProfile called", {
      body: req.body,
      userId: (req as any).userId || (req as any).user?._id || (req as any).user?.id,
    });

    const userId = (req as any).userId || (req as any).user?._id || (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "Invalid user session" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Explicit allowlist with validation - prevents mass assignment and empty string overwrites

    // Name: only update if explicitly provided and non-empty
    if (req.body.name !== undefined) {
      if (typeof req.body.name !== "string" || req.body.name.trim().length === 0) {
        return res.status(400).json({ message: "Name cannot be empty" });
      }
      user.name = req.body.name.trim();
    } else if (req.body.fullName !== undefined) {
      // Support legacy fullName field
      if (typeof req.body.fullName !== "string" || req.body.fullName.trim().length === 0) {
        return res.status(400).json({ message: "Name cannot be empty" });
      }
      user.name = req.body.fullName.trim();
    }

    // Email: validate format and uniqueness before update
    if (req.body.email !== undefined) {
      const emailValue = String(req.body.email).trim().toLowerCase();
      // Check for empty string first
      if (emailValue === "") {
        return res.status(400).json({ message: "Email cannot be empty" });
      }
      // Then validate format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailValue)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      // Check for uniqueness if email is changing
      if (emailValue !== user.email) {
        const existingEmail = await User.findOne({ email: emailValue, _id: { $ne: userId } });
        if (existingEmail) {
          return res.status(400).json({ message: "Email already in use by another account" });
        }
        user.email = emailValue;
      }
    }

    // Phone: validate and uniqueness before update
    if (req.body.phone !== undefined) {
      const phoneValue = String(req.body.phone).trim();
      // Check for empty string
      if (phoneValue === "") {
        // Only allow empty phone if it's not already set or if it's not required
        // But the schema allows undefined, so we'll treat empty as an empty string
        // which is excluded from the unique index
        user.phone = "";
      } else {
        const digits = phoneValue.replace(/\D/g, "");
        const phone10 = digits.length >= 10 ? digits.slice(-10) : digits;
        if (!/^[6-9]\d{9}$/.test(phone10)) {
          return res.status(400).json({ message: "Invalid phone number format" });
        }

        // Check for uniqueness if phone is changing
        if (phone10 !== user.phone) {
          const existingPhone = await User.findOne({ phone: phone10, _id: { $ne: userId } });
          if (existingPhone) {
            return res.status(400).json({ message: "Phone number already in use by another account" });
          }
          user.phone = phone10;
        }
      }
    }

    // Avatar: only update if provided
    if (req.body.avatar !== undefined) {
      user.avatar = req.body.avatar;
    }

    // PreferredLanguage: only update if provided
    if (req.body.preferredLanguage !== undefined) {
      user.preferredLanguage = req.body.preferredLanguage;
    }

    // AppLanguage: only update if provided
    if (req.body.appLanguage !== undefined) {
      user.appLanguage = req.body.appLanguage;
    }

    // Recalculate profile completion safely
    const resolvedName = String(user.name || "").trim();
    const resolvedPhoneRaw = String(user.phone || "");
    const resolvedPhoneDigits = resolvedPhoneRaw.replace(/\D/g, "");
    const resolvedPhone10 = resolvedPhoneDigits.length >= 10 ? resolvedPhoneDigits.slice(-10) : resolvedPhoneDigits;

    // Use a more robust check for profile completion
    const hasName = resolvedName.length > 0;
    const hasEmail = !!user.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email);
    const hasPhone = /^[6-9]\d{9}$/.test(resolvedPhone10);
    
    const profileCompleted = hasName && hasEmail && hasPhone;

    // Persist completion status
    user.isProfileComplete = profileCompleted;
    if (hasPhone) user.mobileVerified = true;
    await user.save();

    // Construct safe user object
    const sanitizedUser = toSafeUserResponse(user);
    if (!sanitizedUser) {
      throw new Error("Failed to sanitize user object");
    }

    const safeUser = {
      ...sanitizedUser,
      isProfileComplete: profileCompleted,
      profileCompleted,
      authState: "ACTIVE",
    };

    return res.status(200).json({ success: true, user: safeUser });
  } catch (err: any) {
    logger.error("completeProfile error:", err);
    
    // Log the full error stack for debugging
    if (err.stack) {
      logger.error("Error stack:", err.stack);
    }
    
    // Handle validation errors specifically
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e: any) => e.message);
      return res.status(400).json({ message: messages.join(', ') });
    }

    // Handle MongoDB duplicate key errors (code 11000)
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'field';
      return res.status(400).json({ 
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already in use by another account` 
      });
    }

    // Return more details in non-production environments to help debug
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).json({ 
      message: isDev ? `Server error: ${err.message}` : "Server error" 
    });
  }
};

// Get current user profile
export const getMe = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const userId = (req as any).userId || (req as any).user?._id;
    
    logger.info("[getMe] Called with userId:", userId);
    
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = await User.findById(userId).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    logger.info("[getMe] Found user:", {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      oauthProviders: user.oauthProviders?.length || 0,
    });

    // Authoritative profile completion check (server-side)
    const resolvedName = String((user as any).name || (user as any).fullName || "").trim();
    const resolvedPhoneRaw = String((user as any).phone || "");
    const resolvedPhoneDigits = resolvedPhoneRaw.replace(/\D/g, "");
    const resolvedPhone10 = resolvedPhoneDigits.length >= 10 ? resolvedPhoneDigits.slice(-10) : resolvedPhoneDigits;

    const hasName = resolvedName.length > 0;
    const hasPhone = /^[6-9]\d{9}$/.test(resolvedPhone10);
    const isPhoneVerified = !!user.mobileVerified || !!(user as any).isProfileComplete; // Backward compatible
    const profileCompleted = hasName && hasPhone;

    // Construct safe user object with only allowed fields
    const safeUser = {
      ...toSafeUserResponse(user),
      isProfileComplete: profileCompleted,
      profileCompleted,
      authState: "ACTIVE",
    };

    logger.info("[getMe] Returning safeUser:", safeUser);

    res.status(200).json({ user: safeUser });
  } catch (error: any) {
    logger.error("Get profile error:", error);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};

// Delete user account
export const deleteAccount = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const userId = (req as any).userId || (req as any).user?._id;
    
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await User.findByIdAndDelete(userId);

    res.json({ message: "Account deleted successfully" });
  } catch (error: any) {
    logger.error("Delete account error:", error);
    res.status(500).json({ message: "Failed to delete account" });
  }
};