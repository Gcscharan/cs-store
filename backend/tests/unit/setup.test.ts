import { jest } from "@jest/globals";

describe("Test Setup", () => {
  test("should have environment variables set", () => {
    expect(process.env.NODE_ENV).toBe("test");
    expect(process.env.MOCK_OTP).toBe("true");
  });

  test("should have Redis mock available", () => {
    const redis = require("redis");
    expect(redis.createClient).toBeDefined();
    expect(typeof redis.createClient).toBe("function");
  });

  test("should have Razorpay mock available", () => {
    const razorpay = require("razorpay");
    expect(razorpay.default).toBeDefined();
    expect(typeof razorpay.default).toBe("function");
  });

  test("should have Cloudinary mock available", () => {
    const cloudinary = require("cloudinary");
    expect(cloudinary.v2).toBeDefined();
    expect(cloudinary.v2.uploader).toBeDefined();
  });

  test("should have Twilio mock available", () => {
    const twilio = require("twilio");
    expect(twilio.default).toBeDefined();
    expect(typeof twilio.default).toBe("function");
  });

  test("should have Nodemailer mock available", () => {
    const nodemailer = require("nodemailer");
    expect(nodemailer.createTransport).toBeDefined();
    expect(typeof nodemailer.createTransport).toBe("function");
  });

  test("global test helpers should be available", () => {
    expect((global as any).createTestUser).toBeDefined();
    expect(typeof (global as any).createTestUser).toBe("function");
    expect((global as any).createTestOTP).toBeDefined();
    expect(typeof (global as any).createTestOTP).toBe("function");
  });
});
