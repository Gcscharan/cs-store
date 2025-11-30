import jwt from "jsonwebtoken";
import { User } from "../../src/models/User";

export async function createTestUser(overrides: any = {}) {
  const hashedPassword = await require("bcryptjs").hash("password123", 10);
  return await User.create({
    name: "Test User",
    email: "test@example.com",
    phone: "9876543210",
    passwordHash: hashedPassword,
    role: "customer",
    ...overrides,
  });
}

export async function createTestAdmin(overrides: any = {}) {
  const hashedPassword = await require("bcryptjs").hash("admin123", 10);
  return await User.create({
    name: "Admin User",
    email: "admin@example.com",
    phone: "9876543211",
    passwordHash: hashedPassword,
    role: "admin",
    isAdmin: true,
    ...overrides,
  });
}

export function generateAuthToken(user: any) {
  return jwt.sign(
    { userId: user._id, email: user.email, role: user.role || "customer" },
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
