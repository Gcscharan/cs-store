import request from "supertest";
import app from "../../src/app";
import { createTestUser, createTestAdmin, getAuthHeaders, getAuthHeadersForAdmin } from "../helpers/auth";

describe("Authentication Endpoints", () => {
  describe("POST /api/auth/signup", () => {
    it("should signup a new user successfully", async () => {
      const userData = {
        name: "John Doe",
        email: "john@example.com",
        phone: "9876543210",
        password: "password123",
      };

      const response = await request(app)
        .post("/api/auth/signup")
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty("message", "User created successfully");
      expect(response.body).toHaveProperty("user");
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user).not.toHaveProperty("password");
    });

    it("should not signup user with duplicate email", async () => {
      await createTestUser({ email: "john@example.com" });

      const userData = {
        name: "John Doe",
        email: "john@example.com",
        phone: "9876543211",
        password: "password123",
      };

      const response = await request(app)
        .post("/api/auth/signup")
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty("message", "Email already exists");
    });

    it("should not signup user with duplicate phone", async () => {
      await createTestUser({ phone: "9876543210" });

      const userData = {
        name: "John Doe",
        email: "john2@example.com",
        phone: "9876543210",
        password: "password123",
      };

      const response = await request(app)
        .post("/api/auth/signup")
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty("message", "Phone number already exists");
    });

    it("should validate required fields", async () => {
      const response = await request(app)
        .post("/api/auth/signup")
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty("message");
    });
  });

  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      // Clean up any existing users with this email first
      const { User } = await import("../../src/models/User");
      await User.deleteMany({ email: "test@example.com" });
      
      await createTestUser({
        email: "test@example.com",
      });
    });

    it("should login with valid credentials", async () => {
      const loginData = {
        email: "test@example.com",
        password: "password123",
      };

      const response = await request(app)
        .post("/api/auth/login")
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty("message", "Login successful");
      expect(response.body).toHaveProperty("user");
      expect(response.body).toHaveProperty("token");
      expect(response.body).toHaveProperty("refreshToken");
      expect(response.body.user.email).toBe(loginData.email);
      expect(response.body.user).not.toHaveProperty("password");
    });

    it("should not login with invalid email", async () => {
      const loginData = {
        email: "invalid@example.com",
        password: "password123",
      };

      const response = await request(app)
        .post("/api/auth/login")
        .send(loginData)
        .expect(400);

      expect(response.body).toHaveProperty("message", "Invalid email or password");
    });

    it("should not login with invalid password", async () => {
      const loginData = {
        email: "test@example.com",
        password: "wrongpassword",
      };

      const response = await request(app)
        .post("/api/auth/login")
        .send(loginData)
        .expect(400);

      expect(response.body).toHaveProperty("message", "Invalid email or password");
    });
  });

  describe("POST /api/auth/refresh", () => {
    let user: any;
    let refreshToken: string;

    beforeEach(async () => {
      user = await createTestUser();
      refreshToken = require("jsonwebtoken").sign(
        { id: user._id, type: "refresh" },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: "7d" }
      );
    });

    it("should refresh tokens with valid refresh token", async () => {
      const response = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty("token");
      expect(response.body).toHaveProperty("refreshToken");
      expect(response.body).toHaveProperty("message", "Token refreshed successfully");
    });

    it("should not refresh with invalid refresh token", async () => {
      const response = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: "invalid-token" })
        .expect(401);

      expect(response.body).toHaveProperty("message", "Invalid refresh token");
    });

    it("should not refresh without refresh token", async () => {
      const response = await request(app)
        .post("/api/auth/refresh")
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty("message", "Refresh token is required");
    });
  });

  describe("POST /api/auth/logout", () => {
    let user: any;
    let authHeaders: any;

    beforeEach(async () => {
      user = await createTestUser();
      authHeaders = getAuthHeaders(user);
    });

    it("should logout authenticated user", async () => {
      const response = await request(app)
        .post("/api/auth/logout")
        .set(authHeaders)
        .expect(200);

      expect(response.body).toHaveProperty("message", "Logout successful");
    });

    it("should not logout unauthenticated user", async () => {
      const response = await request(app)
        .post("/api/auth/logout")
        .expect(401);

      expect(response.body).toHaveProperty("message", "Authentication required");
    });
  });

  describe("POST /api/auth/complete-profile", () => {
    let user: any;
    let authHeaders: any;

    beforeEach(async () => {
      user = await createTestUser({
        name: "",
        phone: "",
      });
      authHeaders = getAuthHeaders(user);
    });

    it("should complete user profile", async () => {
      const profileData = {
        name: "John Doe",
        phone: "9876543210",
      };

      const response = await request(app)
        .post("/api/auth/complete-profile")
        .set(authHeaders)
        .send(profileData)
        .expect(200);

      expect(response.body).toHaveProperty("message", "Profile completed successfully");
      expect(response.body.user.name).toBe(profileData.name);
      expect(response.body.user.phone).toBe(profileData.phone);
    });

    it("should not complete profile without authentication", async () => {
      const profileData = {
        name: "John Doe",
        phone: "919876543210",
      };

      const response = await request(app)
        .post("/api/auth/complete-profile")
        .send(profileData)
        .expect(401);

      expect(response.body).toHaveProperty("message", "Authentication required");
    });

    it("should validate phone number format", async () => {
      const profileData = {
        name: "John Doe",
        phone: "invalid-phone",
      };

      const response = await request(app)
        .post("/api/auth/complete-profile")
        .set(authHeaders)
        .send(profileData)
        .expect(400);

      expect(response.body).toHaveProperty("message");
    });
  });

  describe("POST /api/auth/change-password", () => {
    let user: any;
    let authHeaders: any;

    beforeEach(async () => {
      user = await createTestUser();
      authHeaders = getAuthHeaders(user);
    });

    it("should change password with correct current password", async () => {
      const passwordData = {
        currentPassword: "password123",
        newPassword: "newpassword123",
      };

      const response = await request(app)
        .post("/api/auth/change-password")
        .set(authHeaders)
        .send(passwordData)
        .expect(200);

      expect(response.body).toHaveProperty("message", "Password changed successfully");
    });

    it("should not change password with incorrect current password", async () => {
      const passwordData = {
        currentPassword: "wrongpassword",
        newPassword: "newpassword123",
      };

      const response = await request(app)
        .post("/api/auth/change-password")
        .set(authHeaders)
        .send(passwordData)
        .expect(400);

      expect(response.body).toHaveProperty("message", "Current password is incorrect");
    });

    it("should not change password without authentication", async () => {
      const passwordData = {
        currentPassword: "password123",
        newPassword: "newpassword123",
      };

      const response = await request(app)
        .post("/api/auth/change-password")
        .send(passwordData)
        .expect(401);

      expect(response.body).toHaveProperty("message", "Authentication required");
    });
  });

  describe("GET /api/auth/me", () => {
    let user: any;
    let authHeaders: any;

    beforeEach(async () => {
      user = await createTestUser();
      authHeaders = getAuthHeaders(user);
    });

    it("should get current user profile", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set(authHeaders)
        .expect(200);

      expect(response.body).toHaveProperty("user");
      expect(response.body.user.email).toBe(user.email);
      expect(response.body.user).not.toHaveProperty("password");
    });

    it("should not get profile without authentication", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .expect(401);

      expect(response.body).toHaveProperty("message", "Authentication required");
    });
  });

  describe("DELETE /api/auth/delete-account", () => {
    let user: any;
    let authHeaders: any;

    beforeEach(async () => {
      user = await createTestUser();
      authHeaders = getAuthHeaders(user);
    });

    it("should delete user account", async () => {
      const response = await request(app)
        .delete("/api/auth/delete-account")
        .set(authHeaders)
        .expect(200);

      expect(response.body).toHaveProperty("message", "Account deleted successfully");
    });

    it("should not delete account without authentication", async () => {
      const response = await request(app)
        .delete("/api/auth/delete-account")
        .expect(401);

      expect(response.body).toHaveProperty("message", "Authentication required");
    });
  });
});
