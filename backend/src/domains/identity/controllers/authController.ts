import { Request, Response } from "express";
import * as jwt from "jsonwebtoken";
import * as bcrypt from "bcryptjs";
import * as passport from "passport";
import { User } from "../../../models/User";
import { Pincode } from "../../../models/Pincode";
import { createError } from "../../../middleware/errorHandler";
import Otp from "../../../models/Otp";
import { generateOTP, sendSMS } from "../../../utils/sms";
import { sendOTPEmail } from "../../communication/services/mailService";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "your-refresh-secret";

export const signup = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { name, email, phone, password, addresses } = req.body;

    // Validate required fields for email/password registration
    if (!name || !email || !phone || !password) {
      res.status(400).json({
        error: "Name, email, phone, and password are required for registration",
      });
      return;
    }

    // Validate phone number format for Indian mobile numbers
    if (!/^[6-9]\d{9}$/.test(phone)) {
      res.status(400).json({
        error:
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
          res.status(400).json({ error: "Unable to deliver to this location." });
          return;
        }
      }
    }

    // Check if user already exists with this email
    const existingUserByEmail = await User.findOne({ email });
    if (existingUserByEmail) {
      res.status(400).json({ error: "An account with this email already exists" });
      return;
    }

    // Check if user already exists with this phone number
    const existingUserByPhone = await User.findOne({ phone });
    if (existingUserByPhone) {
      res.status(400).json({ error: "An account with this phone number already exists" });
      return;
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Store as pending user with TTL (24 hours)
    const { PendingUser } = require("../../../models/PendingUser");
    const pendingUser = await PendingUser.create({
      name,
      email,
      phone,
      passwordHash,
      addresses: addresses || [],
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    // Generate verification OTP and send via SMS
    const otp = generateOTP();
    const otpRecord = new Otp({
      phone,
      otp,
      type: "verification",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });
    await otpRecord.save();

    const message = `Your CS Store verification OTP is ${otp}. Valid for 10 minutes. Do not share this OTP with anyone.`;
    const smsOk = await sendSMS(phone, message);

    if (!smsOk) {
      console.error("❌ Signup: failed to send verification OTP", {
        phone,
        pendingUserId: pendingUser._id?.toString(),
      });
      // Optionally clean up pending user when SMS fails
      // await PendingUser.deleteOne({ _id: pendingUser._id });
      res.status(500).json({ error: "Failed to send verification OTP" });
      return;
    }

    // Return pending user ID to continue verification on client side
    res.status(202).json({
      message: "Signup initiated. Verification OTP sent.",
      pendingUserId: pendingUser._id,
      expiresIn: 600,
    });
    return;
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Registration failed" });
    return;
  }
};

export const login = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { email, phone, password } = req.body;

    // Find user by email or phone
    const user = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (!user || !user.passwordHash) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Check password with bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "24h" } // Extended from 15m to 24h to prevent frequent expiration
    );

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
        isProfileComplete: user.isProfileComplete,
      },
      accessToken,
      refreshToken,
    });
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
    const { provider, providerId, name, email, phone } = req.body;

    // Check if user exists with this OAuth provider
    let user = await User.findOne({
      "oauthProviders.provider": provider,
      "oauthProviders.providerId": providerId,
    });

    if (!user) {
      // Check if user exists with same email
      user = await User.findOne({ email });
      if (user) {
        // Link OAuth provider to existing user
        user.oauthProviders = user.oauthProviders || [];
        user.oauthProviders.push({ provider, providerId });
        await user.save();
      } else {
        // Create new user
        user = new User({
          name,
          email,
          phone,
          oauthProviders: [{ provider, providerId }],
        });
        await user.save();
      }
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "24h" } // Extended from 15m to 24h to prevent frequent expiration
    );

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
        isProfileComplete: user.isProfileComplete,
      },
      accessToken,
      refreshToken,
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
      res.status(401).json({ error: "Refresh token required" });
      return;
    }

    // Check if refresh token is blacklisted
    try {
      const redisClient = require('../../../config/redis').default;
      const isBlacklisted = await redisClient.get(`blacklist:refresh:${refreshToken}`);
      if (isBlacklisted) {
        console.log('❌ REFRESH: Refresh token is blacklisted (logged out)');
        res.status(401).json({ error: "Refresh token revoked - please login again", code: "REFRESH_TOKEN_REVOKED" });
        return;
      }
    } catch (redisError) {
      console.warn('⚠️ REFRESH: Redis blacklist check failed, proceeding with token verification');
    }

    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
    const user = await User.findById(decoded.userId);

    if (!user) {
      res.status(401).json({ error: "Invalid refresh token" });
      return;
    }

    const accessToken = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "24h" } // Extended from 15m to 24h to prevent frequent expiration
    );

    res.json({ accessToken });
  } catch (error) {
    res.status(401).json({ error: "Invalid refresh token" });
    return;
  }
};

export const logout = async (
  req: any,
  res: Response
): Promise<Response | void> => {
  try {
    console.log('🚪 SECURE LOGOUT: Processing server-side session revocation...');
    
    // Get user from auth middleware
    const userId = req.user?._id || req.userId;
    
    // Extract tokens from request body and headers
    const { refreshToken } = req.body;
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    console.log('🚪 SECURE LOGOUT: Received tokens for blacklisting', {
      userId: userId?.toString(),
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken
    });

    // Import Redis client for token blacklisting
    const redisClient = require('../../../config/redis').default;
    
    let tokensRevoked = 0;
    
    // Blacklist access token (24h expiry)
    if (accessToken) {
      try {
        await redisClient.set(`blacklist:access:${accessToken}`, 'revoked', 24 * 60 * 60); // 24h TTL
        console.log('✅ Access token blacklisted successfully');
        tokensRevoked++;
      } catch (error) {
        console.error('❌ Failed to blacklist access token:', error);
      }
    }
    
    // Blacklist refresh token (7d expiry)
    if (refreshToken) {
      try {
        await redisClient.set(`blacklist:refresh:${refreshToken}`, 'revoked', 7 * 24 * 60 * 60); // 7d TTL
        console.log('✅ Refresh token blacklisted successfully');
        tokensRevoked++;
      } catch (error) {
        console.error('❌ Failed to blacklist refresh token:', error);
      }
    }
    
    // Additional security: Invalidate all user sessions (optional)
    if (userId) {
      try {
        await redisClient.set(`user_session_revoked:${userId}`, Date.now().toString(), 7 * 24 * 60 * 60);
        console.log('✅ User session invalidated');
      } catch (error) {
        console.error('❌ Failed to invalidate user session:', error);
      }
    }
    
    console.log(`✅ SECURE LOGOUT: ${tokensRevoked} tokens blacklisted successfully`);
    
    res.json({ 
      success: true,
      message: "Logout successful - session revoked and tokens blacklisted",
      tokensRevoked
    });
  } catch (error) {
    console.error('❌ SECURE LOGOUT ERROR:', error);
    res.status(500).json({ 
      success: false,
      error: "Logout failed - unable to revoke session" 
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

    if (!user) {
      // Redirect to frontend with error
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(`${frontendUrl}/auth/callback?error=authentication_failed`);
      return;
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "24h" } // Extended from 15m to 24h to prevent frequent expiration
    );

    const refreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, {
      expiresIn: "7d",
    });

    // Redirect to frontend with tokens and user data
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
    redirectUrl.searchParams.set("isProfileComplete", (user.isProfileComplete || false).toString());

    res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(`${frontendUrl}/auth/callback?error=callback_failed`);
    return;
  }
};

export const changePassword = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = (req as any).userId || (req as any).user?._id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Validate input
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

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    user.passwordHash = newPasswordHash;
    await user.save();

    res.json({
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
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
    const { phone, email } = req.body;

    // Get the user input (either phone or email)
    const userInput = phone || email;

    if (!userInput) {
      console.log("❌ Error: No phone or email provided");
      return res.status(400).json({ error: "Phone or email is required" });
    }

    // Detect input type: phone or email
    const isPhone = /^[0-9]{10,12}$/.test(userInput);
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userInput);

    console.log(`📋 Input type: ${isPhone ? "Phone" : isEmail ? "Email" : "Invalid"}`);

    if (!isPhone && !isEmail) {
      console.log("❌ Error: Invalid format");
      return res.status(400).json({
        error: "Invalid phone or email format",
      });
    }

    // Find user by phone or email
    console.log(`🔍 Searching for user with ${isPhone ? "phone" : "email"}: ${userInput}`);
    const user = await User.findOne({
      $or: [{ phone: userInput }, { email: userInput }],
    });

    if (!user) {
      return res.status(404).json({
        error: "Account not found. Please sign up first.",
        action: "signup_required",
        email: isEmail ? userInput : undefined,
      });
    }

    // Generate 6-digit OTP
    const otp = generateOTP();

    // Create OTP record
    const otpRecord = new Otp({
      phone: user.phone,
      otp,
      type: "login",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    await otpRecord.save();

    // Send OTP based on input type
    if (isPhone) {
      // Send OTP via SMS
      const message = `Your CS Store login OTP is ${otp}. Valid for 10 minutes. Do not share this OTP with anyone.`;
      await sendSMS(userInput, message);
    } else if (isEmail) {
      // Send OTP via Email
      await sendOTPEmail(userInput, otp);
    }

    console.log(`✅ OTP sent to ${isPhone ? 'phone' : 'email'}: ${userInput}`);

    res.json({
      message: "OTP sent successfully",
      expiresIn: 600, // 10 minutes in seconds
      sentTo: isPhone ? "phone" : "email",
    });
  } catch (error: any) {
    console.error("❌ Send auth OTP error:", error.message);
    res.status(500).json({ 
      error: "Failed to send OTP",
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

    if (!otp) {
      return res.status(400).json({ error: "OTP is required" });
    }

    if (!phone && !email) {
      return res.status(400).json({ error: "Phone or email is required" });
    }

    // Find user by phone or email
    const user = await User.findOne({
      $or: [{ phone }, { email }],
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Find OTP record
    const otpRecord = await Otp.findOne({
      phone: user.phone,
      type: "login",
      isUsed: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({
        error: "Invalid or expired OTP",
      });
    }

    // Check attempts
    if (otpRecord.attempts >= 3) {
      return res.status(400).json({
        error: "Maximum OTP attempts exceeded. Please request a new OTP.",
      });
    }

    // Verify OTP
    if (otpRecord.otp !== otp) {
      otpRecord.attempts += 1;
      await otpRecord.save();

      return res.status(400).json({
        error: `Invalid OTP. ${3 - otpRecord.attempts} attempts remaining.`,
      });
    }

    // Mark OTP as used
    otpRecord.isUsed = true;
    await otpRecord.save();

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "24h" } // Extended from 15m to 24h to prevent frequent expiration
    );

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
        isProfileComplete: user.isProfileComplete,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Verify auth OTP error:", error);
    res.status(500).json({ error: "Failed to verify OTP" });
    return;
  }
};

// Complete user profile for OAuth users
export const completeProfile = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { name, phone } = req.body;
    const userId = (req as any).userId || (req as any).user?._id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Validate required fields
    if (!name || !phone) {
      return res.status(400).json({
        error: "Name and phone number are required",
      });
    }

    // Validate phone number format for Indian mobile numbers
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({
        error: "Invalid phone number format. Please enter a valid 10-digit mobile number starting with 6-9.",
      });
    }

    // Get current user to check if they already have this phone number
    const currentUser = await User.findById(userId);
    
    console.log('📱 COMPLETE PROFILE: Phone validation', {
      requestedPhone: phone,
      currentUserPhone: currentUser?.phone,
      userId: userId,
      isSamePhone: currentUser?.phone === phone
    });
    
    // If user is trying to set the same phone number they already have, allow it
    if (currentUser?.phone === phone) {
      console.log('📱 COMPLETE PROFILE: User setting same phone number - allowing');
    } else {
      // Check if phone number is already in use by another user
      const existingUser = await User.findOne({ 
        phone, 
        _id: { $ne: userId } 
      });
      
      if (existingUser) {
        console.log('📱 COMPLETE PROFILE: Phone number already registered by another user', {
          existingUserId: existingUser._id,
          existingUserEmail: existingUser.email
        });
        return res.status(400).json({
          error: "This phone number is already registered with another account",
        });
      }
    }

    // Update user profile
    const user = await User.findByIdAndUpdate(
      userId,
      {
        name: name.trim(),
        phone: phone.trim(),
        isProfileComplete: true,
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      message: "Profile completed successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isAdmin: user.role === "admin",
        addresses: user.addresses,
        isProfileComplete: user.isProfileComplete,
      },
    });
  } catch (error) {
    console.error("Complete profile error:", error);
    res.status(500).json({ error: "Failed to complete profile" });
    return;
  }
};
