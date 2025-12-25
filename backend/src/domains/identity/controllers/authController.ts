import { Request, Response } from "express";
import * as jwt from "jsonwebtoken";
import * as bcrypt from "bcryptjs";
import * as passport from "passport";
import { User } from "../../../models/User";
import { Pincode } from "../../../models/Pincode";
import { createError } from "../../../middleware/errorHandler";
import Otp from "../../../models/Otp";
import { generateOTP, sendSMS, validatePhoneNumber } from "../../../utils/sms";
import { sendEmailOTP } from "../../../utils/sendEmailOTP";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "your-refresh-secret";

export const signup = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    // FIX: accept both name and fullName from the frontend safely
    const { fullName, name: rawName, email, phone, password, addresses } = req.body;
    const name = rawName || fullName;

    // Validate required fields for email/password registration
    if (!name || !email || !phone || !password) {
      res.status(400).json({
        message: "Name, email, phone, and password are required for registration",
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

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user directly
    const user = await User.create({
      name,
      email,
      phone,
      passwordHash,
      addresses: addresses || [],
      role: "customer",
    });

    // Generate JWT tokens (same as login flow)
    const accessToken = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    const refreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, {
      expiresIn: "7d",
    });

    return res.status(201).json({
      message: "User created successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      accessToken,
      refreshToken,
    });
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

    // Require an explicit identifier
    if (!email && !phone) {
      res.status(400).json({ message: "Email or phone is required" });
      return;
    }

    // Look up strictly by the identifier the client provided
    let user;
    if (email) {
      user = await User.findOne({ email: String(email).toLowerCase() });
    } else if (phone) {
      const cleanedPhone = String(phone).replace(/\D/g, "");
      user = await User.findOne({ phone: cleanedPhone });
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
      { expiresIn: "24h" } // Extended from 15m to 24h to prevent frequent expiration
    );

    const refreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, {
      expiresIn: "7d",
    });

    const isProfileComplete = !!(user.name && user.phone);

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
        isProfileComplete,
      },
      token: accessToken,
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
      { expiresIn: "24h" } // Extended from 15m to 24h to prevent frequent expiration
    );

    // Generate new refresh token
    const newRefreshToken = jwt.sign(
      { userId: user._id },
      JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ 
      message: "Token refreshed",
      accessToken,
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

    if (!user) {
      // Redirect to frontend with error
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(`${frontendUrl}/auth/callback?error=authentication_failed`);
      return;
    }

    // Check if this is a signup required case (user not found in OAuth strategy)
    if (user._signupRequired) {
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const redirectUrl = new URL(`${frontendUrl}/signup`);

      if (user.email) {
        redirectUrl.searchParams.set("identifier", user.email);
      }

      redirectUrl.searchParams.set("error", "google_signup_required");
      res.redirect(redirectUrl.toString());
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
      return res.status(400).json({ message: "Phone or email is required" });
    }

    // Detect input type: phone or email
    // Use validatePhoneNumber for proper international format support
    const isPhone = validatePhoneNumber(userInput);
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userInput);

    if (!isPhone && !isEmail) {
      return res.status(400).json({
        message: "Invalid phone or email format",
      });
    }

    // Check mode: signup or login (default login)
    const isSignup = String(req.query.mode || "") === "signup";

    // In signup mode, we don't need to find an existing user
    let user;
    if (!isSignup) {
      // In login mode, look up strictly by the identifier type
      if (isPhone) {
        const cleanedPhone = String(userInput).replace(/\D/g, "");
        user = await User.findOne({ phone: cleanedPhone });
      } else if (isEmail) {
        const normalizedEmail = String(userInput).toLowerCase();
        user = await User.findOne({ email: normalizedEmail });
      }

      // In login mode, user must exist
      if (!user) {
        return res.status(404).json({
          error: "Account not found. Please sign up first.",
          action: "signup_required",
          email: isEmail ? userInput : undefined,
        });
      }
    }

    // Determine where to send OTP:
    // - signup: use the raw input (new number/email)
    // - login: use the user's stored contact (prefer DB value)
    let targetPhone: string | undefined;
    let targetEmail: string | undefined;

    if (isPhone) {
      targetPhone = isSignup ? userInput : (user?.phone || userInput);
    } else if (isEmail) {
      targetEmail = isSignup ? userInput : (user?.email || userInput);
    }

    // Generate 6-digit OTP
    const otp = generateOTP();

    // Create OTP record. Always include phone field (required by model) and optionally email.
    const otpPayload: any = {
      phone: targetPhone || user?.phone || userInput, // Always provide phone
      otp,
      type: isSignup ? "signup" : "login",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      isUsed: false,
      attempts: 0,
    };
    // Include email field if it's an email-based OTP
    if (targetEmail) otpPayload.email = String(targetEmail);

    const otpRecord = new Otp(otpPayload);
    await otpRecord.save();

    // Send OTP based on input type
    if (targetPhone) {
      // Send OTP via SMS
      const message = `Your CS Store ${isSignup ? "signup" : "login"} OTP is ${otp}. Valid for 10 minutes. Do not share this OTP with anyone.`;
      await sendSMS(targetPhone, message);
    } else if (targetEmail) {
      // Send OTP via Email using Gmail SMTP or fallback
      await sendEmailOTP(targetEmail, otp);
    }

    res.json({
      message: "OTP sent successfully",
      expiresIn: 600, // 10 minutes in seconds
      sentTo: targetPhone ? "phone" : "email",
    });
  } catch (error: any) {
    console.error("sendAuthOTP error:", error);
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

    if (!otp) {
      return res.status(400).json({ error: "OTP is required" });
    }

    if (!phone && !email) {
      return res.status(400).json({ error: "Phone or email is required" });
    }

    // Determine mode
    const isSignup = String(req.query.mode || "") === "signup";

    // In signup mode we verify OTP against the contact (phone/email) regardless of existing user.
    if (isSignup) {
      // Find OTP record by phone or email
      const otpRecord = await Otp.findOne({
        ...(phone ? { phone } : {}),
        ...(email ? { email } : {}),
        type: "signup",
        isUsed: false,
        expiresAt: { $gt: new Date() },
      }).sort({ createdAt: -1 });

      if (!otpRecord) {
        return res.status(400).json({ error: "Invalid or expired OTP" });
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

      // For signup, we simply confirm verification (frontend will continue signup)
      return res.json({
        message: "OTP verified",
        verified: true,
      });
    }

    // LOGIN MODE: strict identifier-based lookup
    let user: any | null = null;

    if (phone && !email) {
      const cleanedPhone = String(phone).replace(/\D/g, "");
      user = await User.findOne({ phone: cleanedPhone });
    } else if (email && !phone) {
      const normalizedEmail = String(email).toLowerCase();
      user = await User.findOne({ email: normalizedEmail });
    } else {
      // Ambiguous input (both or neither) is not allowed in login mode
      return res
        .status(400)
        .json({ error: "Provide exactly one of phone or email" });
    }

    if (!user) {
      return res.status(404).json({
        error: "Account not found. Please sign up first.",
        action: "signup_required",
        email: email ? String(email) : undefined,
      });
    }

    // Find OTP record matching user's phone/email
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

    const isProfileComplete = !!(user.name && user.phone);

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
        isProfileComplete,
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
    console.error("Check phone exists error:", error);
    return res.status(500).json({ error: "Failed to check phone number" });
  }
};

// Complete user profile for OAuth users
export const completeProfile = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const userId = (req as any).user?._id; // from auth middleware

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { fullName, phone, email } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        fullName,
        phone,
        email,
        isProfileComplete: true,
      },
      { new: true }
    );

    return res.json({
      success: true,
      user: updatedUser,
    });
  } catch (err) {
    console.error("completeProfile error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get current user profile
export const getMe = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const userId = (req as any).userId || (req as any).user?._id;
    
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = await User.findById(userId).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user });
  } catch (error: any) {
    console.error("Get profile error:", error);
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
    console.error("Delete account error:", error);
    res.status(500).json({ message: "Failed to delete account" });
  }
};