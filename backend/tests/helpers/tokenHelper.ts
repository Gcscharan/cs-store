import jwt from "jsonwebtoken";

function getJwtSecret(): string {
  return process.env.JWT_SECRET || "ci-test-secret-minimum-32-characters-long";
}

function getJwtRefreshSecret(): string {
  return process.env.JWT_REFRESH_SECRET || "ci-test-secret-minimum-32-characters-long";
}

function baseClaims(role: "customer" | "admin" | "delivery") {
  return {
    userId: "507f1f77bcf86cd799439011",
    email: `${role}@example.com`,
    role,
  };
}

export function generateValidCustomerToken(): string {
  return jwt.sign({ userId: "customertest", role: "customer" }, getJwtSecret(), { expiresIn: "1h" });
}

export function generateValidAdminToken(): string {
  return jwt.sign({ userId: "admintest", role: "admin" }, getJwtSecret(), { expiresIn: "1h" });
}

export function generateValidDeliveryToken(): string {
  return jwt.sign(baseClaims("delivery"), getJwtSecret(), { expiresIn: "15m" });
}

export function generateExpiredToken(): string {
  return jwt.sign(
    { userId: "test", role: "customer" },
    process.env.JWT_SECRET || "ci-test-secret-minimum-32-characters-long",
    { expiresIn: "-1s" }
  );
}

export function generateMalformedToken(): string {
  return "not.a.valid.jwt.token.at.all";
}

export function generateInvalidToken(): string {
  return jwt.sign({ userId: "test", role: "customer" }, "wrong-secret-xyz", { expiresIn: "1h" });
}

export function generateAlgNoneToken(): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ userId: "test", role: "admin" })).toString("base64url");
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
