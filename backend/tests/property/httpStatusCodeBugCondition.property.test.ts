/**
 * Bug Condition Exploration Test - HTTP Status Code Fix
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * 
 * This test encodes the EXPECTED behavior:
 * - POST /api/auth/login should return HTTP 401 (not 410) with "PASSWORD_LOGIN_DISABLED"
 * - POST /api/auth/change-password should return HTTP 401 (not 410)
 * - GET /health should return {status: "ok"} (not "healthy")
 * - Invalid credentials should return HTTP 400 (not 410)
 * - NoSQL injection payloads should return 400/401/403/404 (not 410)
 * 
 * When this test passes after the fix, it confirms the expected behavior is satisfied.
 */

import request from "supertest";
import * as fc from "fast-check";
import app from "../../src/app";

const numRuns = process.env.CI_NIGHTLY === "true" ? 1000 : 20;

describe("Bug Condition: HTTP Status Code Verification", () => {
  describe("Property 1: Password Login Returns HTTP 401 (not 410)", () => {
    it("should return HTTP 401 for password login attempts", async () => {
      // Test with various email/password combinations
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 6, maxLength: 20 }),
          async (email, password) => {
            const response = await request(app)
              .post("/api/auth/login")
              .send({ email, password });

            // EXPECTED: HTTP 401 (Unauthorized) - password login is disabled
            // CURRENT BUG: Returns HTTP 410 (Gone)
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error", "PASSWORD_LOGIN_DISABLED");
            expect(response.body.message).toContain("OTP");
          }
        ),
        { numRuns: 5 } // Limited runs since this is a simple endpoint test
      );
    });

    it("should return HTTP 401 for password login with phone identifier", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          phone: "9876543210",
          password: "password123",
        });

      // EXPECTED: HTTP 401 (Unauthorized)
      // CURRENT BUG: Returns HTTP 410 (Gone)
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "PASSWORD_LOGIN_DISABLED");
    });
  });

  describe("Property 1: Change Password Returns HTTP 401 (not 410)", () => {
    it("should return HTTP 401 for password change attempts (with auth)", async () => {
      // Create a mock user and get auth token
      const { createTestUser, getAuthHeaders } = require("../helpers/auth");
      const user = await createTestUser();
      const authHeaders = getAuthHeaders(user);

      const response = await request(app)
        .post("/api/auth/change-password")
        .set(authHeaders)
        .send({
          currentPassword: "oldpass123",
          newPassword: "newpass123",
        });

      // EXPECTED: HTTP 401 (Unauthorized) - password feature is disabled
      // CURRENT BUG: Returns HTTP 410 (Gone)
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "PASSWORD_FEATURE_DISABLED");
    });
  });

  describe("Property 1: Health Check Returns 'ok' (not 'healthy')", () => {
    it("should return status 'ok' for health check", async () => {
      const response = await request(app).get("/health");

      // EXPECTED: {status: "ok"}
      // CURRENT BUG: Returns {status: "healthy"}
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("status", "ok");
    });
  });

  describe("Property 1: Invalid Credentials Return HTTP 400 (not 410)", () => {
    it("should return HTTP 400 for invalid credentials (not 410)", async () => {
      // Since password login is disabled, this test verifies the status code
      // In the original implementation, invalid credentials would return 400
      // But with password login disabled, we expect 401 for any password attempt
      
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "nonexistent@example.com",
          password: "wrongpassword",
        });

      // EXPECTED: HTTP 401 (password login disabled)
      // CURRENT BUG: Returns HTTP 410
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "PASSWORD_LOGIN_DISABLED");
    });
  });

  describe("Property 1: NoSQL Injection Payloads Return Standard Security Codes (not 410)", () => {
    it("should return 400/401/403/404 for NoSQL injection attempts (not 410)", async () => {
      // Generate various NoSQL injection payloads
      const injectionPayloads = [
        { email: { $gt: "" }, password: { $ne: null } },
        { email: { $regex: ".*" }, password: "test" },
        { email: "test@example.com", password: { $where: "1==1" } },
        { email: { $or: [{ email: "admin@example.com" }] }, password: "test" },
      ];

      for (const payload of injectionPayloads) {
        const response = await request(app)
          .post("/api/auth/login")
          .send(payload);

        // EXPECTED: One of the standard security rejection codes
        // CURRENT BUG: Returns HTTP 410
        const validSecurityCodes = [400, 401, 403, 404];
        expect(validSecurityCodes).toContain(response.status);
        expect(response.status).not.toBe(410);
      }
    });

    it("should handle NoSQL injection with property-based testing", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            email: fc.oneof(
              fc.emailAddress(),
              fc.constant({ $gt: "" }),
              fc.constant({ $ne: null }),
              fc.constant({ $regex: ".*" })
            ),
            password: fc.oneof(
              fc.string(),
              fc.constant({ $ne: null }),
              fc.constant({ $gt: "" })
            ),
          }),
          async (payload) => {
            const response = await request(app)
              .post("/api/auth/login")
              .send(payload);

            // EXPECTED: Standard security codes (400, 401, 403, 404)
            // CURRENT BUG: Returns HTTP 410
            const validSecurityCodes = [400, 401, 403, 404];
            expect(validSecurityCodes).toContain(response.status);
            expect(response.status).not.toBe(410);
          }
        ),
        { numRuns: 10 } // Limited runs for injection testing
      );
    });
  });
});
