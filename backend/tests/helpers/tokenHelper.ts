import jwt from "jsonwebtoken";

function getJwtSecret(): string {
  return process.env.JWT_SECRET || "test-secret";
}

function getJwtRefreshSecret(): string {
  return process.env.JWT_REFRESH_SECRET || "test-refresh-secret";
}

function baseClaims(role: "customer" | "admin" | "delivery") {
  return {
    userId: "507f1f77bcf86cd799439011",
    email: `${role}@example.com`,
    role,
  };
}

export function generateValidCustomerToken(): string {
  return jwt.sign(baseClaims("customer"), getJwtSecret(), { expiresIn: "15m" });
}

export function generateValidAdminToken(): string {
  return jwt.sign(baseClaims("admin"), getJwtSecret(), { expiresIn: "15m" });
}

export function generateValidDeliveryToken(): string {
  return jwt.sign(baseClaims("delivery"), getJwtSecret(), { expiresIn: "15m" });
}

export function generateExpiredToken(): string {
  // already expired
  return jwt.sign(baseClaims("customer"), getJwtSecret(), { expiresIn: -10 });
}

export function generateMalformedToken(): string {
  // Not a JWT format
  return "not-a-jwt";
}

export function generateInvalidToken(): string {
  // Signed with wrong secret
  return jwt.sign(baseClaims("customer"), "wrong-secret", { expiresIn: "15m" });
}

export function generateAlgNoneToken(): string {
  // JWT with alg none (not actually signed)
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ ...baseClaims("customer"), exp: Math.floor(Date.now() / 1000) + 60 })).toString(
    "base64url"
  );
  return `${header}.${payload}.`;
}

export function generateFutureIatToken(): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign({ ...baseClaims("customer"), iat: now + 60 * 60, exp: now + 60 * 60 * 2 }, getJwtSecret());
}

export const generateTokens = {
  getJwtSecret,
  getJwtRefreshSecret,
  generateValidCustomerToken,
  generateValidAdminToken,
  generateValidDeliveryToken,
  generateExpiredToken,
  generateMalformedToken,
  generateInvalidToken,
  generateAlgNoneToken,
  generateFutureIatToken,
};
