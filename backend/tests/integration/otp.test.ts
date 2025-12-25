import request from "supertest";
import app from "../../src/app";
import { createTestUser, getAuthHeaders } from "../helpers/auth";
import "../types/global.d.ts";

describe("OTP Endpoints", () => {
  describe("POST /api/otp/verification/generate", () => {
    beforeEach(async () => {
      // Ensure MOCK_OTP is enabled for tests
      process.env.MOCK_OTP = "true";
    });

    it("should generate verification OTP for authenticated user", async () => {
      const user = await createTestUser();
      const authHeaders = getAuthHeaders(user);

      const response = await request(app)
        .post("/api/otp/verification/generate")
        .set(authHeaders)
        .expect(200);

      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("expiresIn", 600);
      
      if (process.env.MOCK_OTP === "true") {
        expect(response.body).toHaveProperty("mockOtp");
      }
    });

    it("should generate verification OTP with phone in body", async () => {
      const response = await request(app)
        .post("/api/otp/verification/generate")
        .send({ phone: "919876543210" })
        .expect(200);

      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("expiresIn", 600);
      
      if (process.env.MOCK_OTP === "true") {
        expect(response.body).toHaveProperty("mockOtp");
      }
    });

    it("should not generate OTP without phone for unauthenticated user", async () => {
      const response = await request(app)
        .post("/api/otp/verification/generate")
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty("message", "Phone number is required");
    });

    it("should validate phone number format", async () => {
      const response = await request(app)
        .post("/api/otp/verification/generate")
        .send({ phone: "invalid-phone" })
        .expect(400);

      expect(response.body).toHaveProperty("message", "Invalid phone number format");
    });
  });

  describe("POST /api/otp/payment/generate", () => {
    let user: any;
    let authHeaders: any;
    let product: any;
    let order: any;

    beforeEach(async () => {
      user = await createTestUser();
      authHeaders = getAuthHeaders(user);
      product = await global.createTestProduct();
      
      const { Order } = await import("../../src/models/Order");
      order = await Order.create({
        userId: user._id,
        items: [
          {
            productId: product._id,
            name: product.name,
            price: product.price,
            qty: 1,
          },
        ],
        totalAmount: product.price,
        orderStatus: "pending",
        address: {
          name: "Test User",
          phone: "919876543210",
          label: "Home",
          addressLine: "123 Test St",
          city: "Test City",
          state: "TS",
          pincode: "500001",
          lat: 17.3850,
          lng: 78.4867,
        },
      });

      process.env.MOCK_OTP = "true";
    });

    it("should generate payment OTP for valid order", async () => {
      const paymentData = {
        orderId: order._id,
        cardNumber: "4111111111111111",
        cardHolderName: "John Doe",
        expiryDate: "12/25",
        cvv: "123",
      };

      const response = await request(app)
        .post("/api/otp/payment/generate")
        .set(authHeaders)
        .send(paymentData)
        .expect(200);

      expect(response.body).toHaveProperty("paymentId");
      expect(response.body).toHaveProperty("expiresIn", 600);
      expect(response.body).toHaveProperty("realTimeDelivered", false);
      
      if (process.env.MOCK_OTP === "true") {
        expect(response.body).toHaveProperty("mock", true);
        expect(response.body).toHaveProperty("otp");
        expect(response.body.message).toContain("(mock)");
      }
    });

    it("should not generate payment OTP for unauthorized order", async () => {
      const otherUser = await createTestUser({ email: "other@example.com" });
      const otherOrder = await global.createTestOrder(otherUser._id);

      const paymentData = {
        orderId: otherOrder._id,
        cardNumber: "4111111111111111",
        cardHolderName: "John Doe",
        expiryDate: "12/25",
        cvv: "123",
      };

      const response = await request(app)
        .post("/api/otp/payment/generate")
        .set(authHeaders)
        .send(paymentData)
        .expect(403);

      expect(response.body).toHaveProperty("message", "Unauthorized access to order");
    });

    it("should validate required fields", async () => {
      const response = await request(app)
        .post("/api/otp/payment/generate")
        .set(authHeaders)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toContain("Order ID, card number, card holder name, expiry date, and CVV are required");
    });

    it("should validate card details", async () => {
      const paymentData = {
        orderId: order._id,
        cardNumber: "invalid-card",
        cardHolderName: "John Doe",
        expiryDate: "12/25",
        cvv: "123",
      };

      const response = await request(app)
        .post("/api/otp/payment/generate")
        .set(authHeaders)
        .send(paymentData)
        .expect(400);

      expect(response.body).toHaveProperty("message", "Invalid card details");
      expect(response.body).toHaveProperty("errors");
    });
  });

  describe("POST /api/otp/payment/verify", () => {
    let user: any;
    let authHeaders: any;
    let paymentId: string;
    let otp: string;

    beforeEach(async () => {
      user = await createTestUser();
      authHeaders = getAuthHeaders(user);
      paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      otp = "123456";

      // Create test OTP record
      await global.createTestOTP(user.phone, "payment", {
        paymentId,
        otp,
      });
    });

    it("should verify payment OTP with correct OTP", async () => {
      const response = await request(app)
        .post("/api/otp/payment/verify")
        .set(authHeaders)
        .send({ paymentId, otp })
        .expect(200);

      expect(response.body).toHaveProperty("message", "OTP verified successfully");
      expect(response.body).toHaveProperty("paymentId", paymentId);
    });

    it("should not verify payment OTP with incorrect OTP", async () => {
      const response = await request(app)
        .post("/api/otp/payment/verify")
        .set(authHeaders)
        .send({ paymentId, otp: "654321" })
        .expect(400);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toContain("Invalid or expired OTP");
    });

    it("should not verify payment OTP without authentication", async () => {
      const response = await request(app)
        .post("/api/otp/payment/verify")
        .send({ paymentId, otp })
        .expect(401);

      expect(response.body).toHaveProperty("message", "Authentication required");
    });

    it("should validate required fields", async () => {
      const response = await request(app)
        .post("/api/otp/payment/verify")
        .set(authHeaders)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toContain("Payment ID and OTP are required");
    });
  });

  describe("POST /api/otp/payment/resend", () => {
    let user: any;
    let authHeaders: any;
    let paymentId: string;

    beforeEach(async () => {
      user = await createTestUser();
      authHeaders = getAuthHeaders(user);
      paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create test OTP record
      await global.createTestOTP(user.phone, "payment", {
        paymentId,
      });

      process.env.MOCK_OTP = "true";
    });

    it("should resend payment OTP", async () => {
      const response = await request(app)
        .post("/api/otp/payment/resend")
        .set(authHeaders)
        .send({ paymentId })
        .expect(200);

      expect(response.body).toHaveProperty("message", "OTP resent successfully");
      expect(response.body).toHaveProperty("expiresIn", 600);
      
      if (process.env.MOCK_OTP === "true") {
        expect(response.body).toHaveProperty("mock", true);
        expect(response.body).toHaveProperty("otp");
        expect(response.body.message).toBe("OTP resent successfully");
      }
    });

    it("should not resend OTP without payment ID", async () => {
      const response = await request(app)
        .post("/api/otp/payment/resend")
        .set(authHeaders)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty("message", "Payment ID is required");
    });

    it("should not resend OTP for non-existent payment", async () => {
      const response = await request(app)
        .post("/api/otp/payment/resend")
        .set(authHeaders)
        .send({ paymentId: "non-existent-payment-id" })
        .expect(404);

      expect(response.body).toHaveProperty("message", "No OTP found for this payment");
    });

    it("should not resend OTP without authentication", async () => {
      const response = await request(app)
        .post("/api/otp/payment/resend")
        .send({ paymentId })
        .expect(401);

      expect(response.body).toHaveProperty("message", "Authentication required");
    });
  });
});
