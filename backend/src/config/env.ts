import path from "path";
import dotenv from "dotenv";

const ENV_PATH = path.resolve(__dirname, "..", "..", ".env");
dotenv.config({ path: ENV_PATH });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`❌ Missing required environment variable: ${name}`);
  }
  return value;
}

export const ENV = {
  NODE_ENV: process.env.NODE_ENV ?? "development",

  // 🔐 Payment (Razorpay)
  RAZORPAY_KEY_ID: requireEnv("RAZORPAY_KEY_ID"),
  RAZORPAY_KEY_SECRET: requireEnv("RAZORPAY_KEY_SECRET"),
  RAZORPAY_WEBHOOK_SECRET: requireEnv("RAZORPAY_WEBHOOK_SECRET"),

  // 🔐 Auth
  JWT_SECRET: requireEnv("JWT_SECRET"),
  JWT_REFRESH_SECRET: requireEnv("JWT_REFRESH_SECRET"),
};
