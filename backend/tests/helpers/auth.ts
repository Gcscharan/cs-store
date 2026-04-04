import jwt from "jsonwebtoken";
import { User } from "../../src/models/User";

export async function createTestUser(overrides: any = {}) {
  const hashedPassword = await require("bcryptjs").hash("password123", 10);
  
  // Generate unique phone and referralCode if not provided
  const uniquePhone = overrides.phone || 
    `98765${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
  const uniqueReferralCode = overrides.referralCode !== undefined 
    ? overrides.referralCode 
    : `REF${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  
  return await User.create({
    name: "Test User",
    phone: uniquePhone,
    referralCode: uniqueReferralCode,
    passwordHash: hashedPassword,
    role: "customer",
    ...overrides,
  });
}

export async function createTestAdmin(overrides: any = {}) {
  const hashedPassword = await require("bcryptjs").hash("admin123", 10);
  
  // Generate unique phone and referralCode if not provided
  const uniquePhone = overrides.phone || 
    `98766${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
  const uniqueReferralCode = overrides.referralCode !== undefined 
    ? overrides.referralCode 
    : `REF${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  
  return await User.create({
    name: "Admin User",
    phone: uniquePhone,
    referralCode: uniqueReferralCode,
    passwordHash: hashedPassword,
    role: "admin",
    isAdmin: true,
    ...overrides,
  });
}

export function generateAuthToken(user: any) {
  return jwt.sign(
    { userId: user._id, phone: user.phone, role: user.role || "customer" },
    process.env.JWT_SECRET!,
    { expiresIn: "1h" }
  );
}

export function generateRefreshToken(user: any) {
  return jwt.sign(
    { userId: user._id, type: "refresh" },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: "7d" }
  );
}

export function getAuthHeaders(user: any) {
  const token = generateAuthToken(user);
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export function getAuthHeadersForAdmin(admin: any) {
  const token = generateAuthToken(admin);
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}
