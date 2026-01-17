import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { jest } from "@jest/globals";

process.env.NODE_ENV = "test";

const g = globalThis as any;
if (!g.__redisKv) g.__redisKv = new Map<string, string>();
if (!g.__redisExpiries) g.__redisExpiries = new Map<string, number>();

g.__resetRedisMockStore = () => {
  try {
    (g.__redisKv as Map<string, string>).clear();
    (g.__redisExpiries as Map<string, number>).clear();
  } catch {
    // ignore
  }
};

// Mock external services before any imports
jest.mock("redis", () => ({
  createClient: jest.fn(() => {
    const __redisKv: Map<string, string> = (globalThis as any).__redisKv;
    const __redisExpiries: Map<string, number> = (globalThis as any).__redisExpiries;

    const isExpired = (key: string): boolean => {
      const exp = __redisExpiries.get(key);
      if (!exp) return false;
      if (Date.now() <= exp) return false;
      __redisKv.delete(key);
      __redisExpiries.delete(key);
      return true;
    };

    const client: any = {
      connect: jest.fn(async () => true),
      disconnect: jest.fn(async () => true),
      get: jest.fn(async (key: string) => {
        const k = String(key);
        isExpired(k);
        return __redisKv.has(k) ? __redisKv.get(k) : null;
      }),
      set: jest.fn(async (key: string, value: string, opts?: any) => {
        const k = String(key);
        __redisKv.set(k, String(value));
        if (opts && typeof opts === "object" && Number.isFinite(Number((opts as any).EX))) {
          __redisExpiries.set(k, Date.now() + Number((opts as any).EX) * 1000);
        } else {
          __redisExpiries.delete(k);
        }
        return true;
      }),
      del: jest.fn(async (key: string) => {
        const k = String(key);
        const existed = __redisKv.delete(k);
        __redisExpiries.delete(k);
        return existed ? 1 : 0;
      }),
      exists: jest.fn(async (key: string) => {
        const k = String(key);
        isExpired(k);
        return __redisKv.has(k) ? 1 : 0;
      }),
      zAdd: jest.fn(async () => 1),
      zRange: jest.fn(async () => []),
      zRem: jest.fn(async () => 1),
      zCard: jest.fn(async () => 0),
      hGet: jest.fn(async () => null),
      hSet: jest.fn(async () => true),
      hGetAll: jest.fn(async () => ({})),
      hDel: jest.fn(async () => 1),
      incr: jest.fn(async (key: string) => {
        const k = String(key);
        isExpired(k);
        const cur = Number(__redisKv.get(k) || 0);
        const next = Number.isFinite(cur) ? cur + 1 : 1;
        __redisKv.set(k, String(next));
        return next;
      }),
      incrBy: jest.fn(async (key: string, by: number) => {
        const k = String(key);
        isExpired(k);
        const cur = Number(__redisKv.get(k) || 0);
        const inc = Number(by || 0);
        const next = (Number.isFinite(cur) ? cur : 0) + inc;
        __redisKv.set(k, String(next));
        return next;
      }),
      expire: jest.fn(async (key: string, seconds: number) => {
        const k = String(key);
        if (!__redisKv.has(k)) return false;
        const s = Math.max(1, Number(seconds || 1));
        __redisExpiries.set(k, Date.now() + s * 1000);
        return true;
      }),
      ttl: jest.fn(async (key: string) => {
        const k = String(key);
        isExpired(k);
        const exp = __redisExpiries.get(k);
        if (!__redisKv.has(k)) return -2;
        if (!exp) return -1;
        return Math.max(0, Math.floor((exp - Date.now()) / 1000));
      }),
      flushAll: jest.fn(async () => {
        __redisKv.clear();
        __redisExpiries.clear();
        return true;
      }),
      on: jest.fn(),
      once: jest.fn(),
      emit: jest.fn(),
      quit: jest.fn(async () => true),
      isOpen: true,
      isReady: true,
      __kv: __redisKv,
      __expiries: __redisExpiries,
    };
    return client;
  }),
}));

jest.mock("uuid", () => {
  let counter = 0;

  const v5: any = (name: string, namespace: string) => `uuidv5:${namespace}:${name}`;
  v5.URL = "uuid:namespace:url";

  return {
    __esModule: true,
    v4: () => {
      counter += 1;
      return `test-uuid-v4-${counter}`;
    },
    v5,
  };
});

jest.mock("razorpay", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    orders: {
      create: jest.fn(async () => ({
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
      })),
    },
    payments: {
      capture: jest.fn(async () => ({
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
      })),
    },
  })),
}));

jest.mock("twilio", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    messages: {
      create: jest.fn(async () => ({
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
      })),
    },
  })),
}));

jest.mock("cloudinary", () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload: jest.fn(async () => ({
        secure_url: "https://res.cloudinary.com/test/image.jpg",
        public_id: "test_public_id",
        format: "jpg",
        width: 800,
        height: 600,
      })),
      upload_stream: jest.fn().mockReturnValue({
        pipe: jest.fn(),
        on: jest.fn(),
        end: jest.fn(),
      }),
    },
    api: {
      delete_resources: jest.fn(async () => ({ deleted: ["test_public_id"] })),
    },
    search: {
      expression: jest.fn(),
      execute: jest.fn(async () => ({ resources: [] })),
    },
  },
}));

jest.mock("resend", () => ({
  __esModule: true,
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn(async () => ({
        id: "email_test123",
        from: "test@example.com",
        to: ["recipient@example.com"],
        subject: "Test Email",
        html: "<p>Test email content</p>",
        text: "Test email content",
        createdAt: "2023-01-01T00:00:00.000Z",
      })),
    },
  })),
}));

jest.mock("nodemailer", () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(() => ({
      sendMail: jest.fn(async () => ({
        messageId: "test123@example.com",
        envelope: {
          from: "test@example.com",
          to: ["recipient@example.com"],
        },
        accepted: ["recipient@example.com"],
        rejected: [],
        pending: [],
      })),
      verify: jest.fn(async () => true),
      close: jest.fn(),
    })),
  },
  createTransport: jest.fn(() => ({
    sendMail: jest.fn(async () => ({
      messageId: "test123@example.com",
      envelope: {
        from: "test@example.com",
        to: ["recipient@example.com"],
      },
      accepted: ["recipient@example.com"],
      rejected: [],
      pending: [],
    })),
    verify: jest.fn(async () => true),
    close: jest.fn(),
  })),
}));

// Mock services are defined above - they will be loaded before any tests run
// Global test setup and helpers are in setup-globals.ts
