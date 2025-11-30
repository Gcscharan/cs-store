import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

// Mock external services before any imports
jest.mock("redis", () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
    del: jest.fn().mockResolvedValue(true),
    exists: jest.fn().mockResolvedValue(false),
    zAdd: jest.fn().mockResolvedValue(1),
    zRange: jest.fn().mockResolvedValue([]),
    zRem: jest.fn().mockResolvedValue(1),
    zCard: jest.fn().mockResolvedValue(0),
    hGet: jest.fn().mockResolvedValue(null),
    hSet: jest.fn().mockResolvedValue(true),
    hGetAll: jest.fn().mockResolvedValue({}),
    hDel: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
    incrBy: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(true),
    ttl: jest.fn().mockResolvedValue(-1),
    flushAll: jest.fn().mockResolvedValue(true),
    on: jest.fn(),
    once: jest.fn(),
    emit: jest.fn(),
    quit: jest.fn().mockResolvedValue(true),
    isOpen: true,
    isReady: true,
  })),
}));

jest.mock("razorpay", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    orders: {
      create: jest.fn().mockResolvedValue({
        id: "order_test123",
        entity: "order",
        amount: 50000,
        amount_paid: 0,
        amount_due: 50000,
        currency: "INR",
        receipt: "receipt_test123",
        offer_id: null,
        status: "created",
        attempts: 0,
        notes: [],
        created_at: 1234567890,
      }),
    },
    payments: {
      capture: jest.fn().mockResolvedValue({
        id: "pay_test123",
        entity: "payment",
        amount: 50000,
        currency: "INR",
        status: "captured",
        order_id: "order_test123",
        invoice_id: null,
        international: false,
        method: "card",
        amount_refunded: 0,
        refund_status: null,
        captured: true,
        description: "Test payment",
        card_id: "card_test123",
        bank: null,
        wallet: null,
        vpa: null,
        email: "test@example.com",
        contact: "+919876543210",
        notes: {},
        fee: 0,
        tax: 0,
        created_at: 1234567890,
      }),
    },
  })),
}));

jest.mock("twilio", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        sid: "SMtest123",
        dateCreated: "2023-01-01T00:00:00.000Z",
        dateUpdated: "2023-01-01T00:00:00.000Z",
        dateSent: "2023-01-01T00:00:00.000Z",
        accountSid: "ACtest123",
        to: "+919876543210",
        from: "+1234567890",
        body: "Test message",
        status: "sent",
        direction: "outbound-api",
        price: null,
        priceUnit: null,
        apiVersion: "2010-04-01",
        subresourceUris: {},
      }),
    },
  })),
}));

jest.mock("cloudinary", () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload: jest.fn().mockResolvedValue({
        secure_url: "https://res.cloudinary.com/test/image.jpg",
        public_id: "test_public_id",
        format: "jpg",
        width: 800,
        height: 600,
      }),
      upload_stream: jest.fn().mockReturnValue({
        pipe: jest.fn(),
        on: jest.fn(),
        end: jest.fn(),
      }),
    },
    api: {
      delete_resources: jest.fn().mockResolvedValue({ deleted: ["test_public_id"] }),
    },
    search: {
      expression: jest.fn(),
      execute: jest.fn().mockResolvedValue({ resources: [] }),
    },
  },
}));

jest.mock("resend", () => ({
  __esModule: true,
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({
        id: "email_test123",
        from: "test@example.com",
        to: ["recipient@example.com"],
        subject: "Test Email",
        html: "<p>Test email content</p>",
        text: "Test email content",
        createdAt: "2023-01-01T00:00:00.000Z",
      }),
    },
  })),
}));

jest.mock("nodemailer", () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(() => ({
      sendMail: jest.fn().mockResolvedValue({
        messageId: "test123@example.com",
        envelope: {
          from: "test@example.com",
          to: ["recipient@example.com"],
        },
        accepted: ["recipient@example.com"],
        rejected: [],
        pending: [],
      }),
      verify: jest.fn().mockResolvedValue(true),
      close: jest.fn(),
    })),
  },
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({
      messageId: "test123@example.com",
      envelope: {
        from: "test@example.com",
        to: ["recipient@example.com"],
      },
      accepted: ["recipient@example.com"],
      rejected: [],
      pending: [],
    }),
    verify: jest.fn().mockResolvedValue(true),
    close: jest.fn(),
  })),
}));

// Mock services are defined above - they will be loaded before any tests run
// Global test setup and helpers are in setup-globals.ts
