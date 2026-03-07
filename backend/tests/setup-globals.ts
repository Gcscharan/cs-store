// Load test environment variables and override any existing ones
import dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

process.env.NODE_ENV = "test";
process.env.MONGOMS_STARTUP_TIMEOUT = process.env.MONGOMS_STARTUP_TIMEOUT || "60000";
process.env.MOCK_OTP = process.env.MOCK_OTP || "true";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "test-jwt-refresh-secret-key";
process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "test-razorpay-key";
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "test-razorpay-secret";
process.env.RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "test-webhook-secret";
process.env.CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "test-cloud";
process.env.CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "test-key";
process.env.CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || "test-secret";

process.env.SELLER_LEGAL_NAME = process.env.SELLER_LEGAL_NAME || "Test Seller Pvt Ltd";
process.env.SELLER_GSTIN = process.env.SELLER_GSTIN || "29AABCU9603R1ZM";
process.env.SELLER_ADDRESS_LINE1 = process.env.SELLER_ADDRESS_LINE1 || "123 Test Address";
process.env.SELLER_CITY = process.env.SELLER_CITY || "Bengaluru";
process.env.SELLER_STATE = process.env.SELLER_STATE || "Karnataka";
process.env.SELLER_STATE_CODE = process.env.SELLER_STATE_CODE || "29";
process.env.SELLER_PINCODE = process.env.SELLER_PINCODE || "560001";

import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";

type GlobalWithMongo = typeof globalThis & {
  __mongoMemoryReplSet?: MongoMemoryReplSet;
  __mongoSuiteRefCount?: number;
  __jestOriginalSetInterval?: typeof globalThis.setInterval;
  __jestIntervalIds?: any[];
};

beforeAll(async () => {
  const g = globalThis as GlobalWithMongo;

  g.__mongoSuiteRefCount = Number(g.__mongoSuiteRefCount || 0) + 1;

  if (!g.__jestOriginalSetInterval) {
    g.__jestOriginalSetInterval = globalThis.setInterval;
    g.__jestIntervalIds = [];
    (globalThis as any).setInterval = (...args: any[]) => {
      const id = (g.__jestOriginalSetInterval as any)(...args);
      (g.__jestIntervalIds as any[]).push(id);
      return id;
    };
  }

  if (!g.__mongoMemoryReplSet) {
    g.__mongoMemoryReplSet = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      instanceOpts: [{ instance: { launchTimeout: 60000 } }],
    });
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(g.__mongoMemoryReplSet.getUri());
  }
});

afterAll(async () => {
  const g = globalThis as GlobalWithMongo;

  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase().catch(() => undefined);
  }

  g.__mongoSuiteRefCount = Math.max(0, Number(g.__mongoSuiteRefCount || 0) - 1);
  if (g.__mongoSuiteRefCount === 0) {
    if (g.__jestIntervalIds?.length) {
      for (const id of g.__jestIntervalIds) {
        try {
          clearInterval(id);
        } catch {
          // ignore
        }
      }
    }
    if (g.__jestOriginalSetInterval) {
      (globalThis as any).setInterval = g.__jestOriginalSetInterval;
    }

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => undefined);
    }

    if (g.__mongoMemoryReplSet) {
      await g.__mongoMemoryReplSet.stop().catch(() => undefined);
      delete g.__mongoMemoryReplSet;
    }

    delete g.__jestOriginalSetInterval;
    delete g.__jestIntervalIds;
  }
});

beforeEach(async () => {
  try {
    const g = globalThis as any;
    if (typeof g.__resetRedisMockStore === "function") {
      g.__resetRedisMockStore();
    }
  } catch {
    // ignore
  }

  // Clear all collections
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// Global test helpers
(global as any).createTestUser = async (overrides: any = {}) => {
  const { User } = await import("../src/models/User");
  const hashedPassword = await require("bcryptjs").hash("password123", 10);
  const userData = {
    name: "Test User",
    email: "test@example.com",
    phone: "9876543210",
    passwordHash: hashedPassword,
    role: "customer",
    ...overrides,
  };
  console.log("Creating user with data:", { ...userData, passwordHash: "[HASHED]" });
  const user = await User.create(userData);
  console.log("Created user:", { 
    id: user._id, 
    email: user.email, 
    hasPasswordHash: !!user.passwordHash 
  });
  return user;
};

(global as any).createTestProduct = async (overrides: any = {}) => {
  const { Product } = await import("../src/models/Product");
  return await Product.create({
    name: "Test Product",
    description: "Test product description",
    price: 1000,
    category: "electronics",
    stock: 10,
    images: [
      {
        publicId: "test-image",
        url: "https://example.com/test-image.jpg",
        variants: {
          original: "https://example.com/test-image.jpg",
        },
      },
    ],
    ...overrides,
  });
};

(global as any).createTestOrder = async (user: any, productOrOverrides?: any, overrides: any = {}) => {
  const { Order } = await import("../src/models/Order");
  const VALID_ORDER_STATUSES = [
    "PENDING_PAYMENT",
    "CONFIRMED",
    "PACKED",
    "ASSIGNED",
    "PICKED_UP",
    "IN_TRANSIT",
    "OUT_FOR_DELIVERY",
    "ARRIVED",
    "DELIVERED",
    "FAILED",
    "RETURNED",
    "CANCELLED",
    "CREATED",
  ];
  const ORDER_STATUS_MAP: Record<string, string> = {
    pending: "PENDING_PAYMENT",
    confirmed: "CONFIRMED",
    packed: "PACKED",
    assigned: "ASSIGNED",
    picked_up: "PICKED_UP",
    in_transit: "IN_TRANSIT",
    out_for_delivery: "OUT_FOR_DELIVERY",
    arrived: "ARRIVED",
    delivered: "DELIVERED",
    failed: "FAILED",
    returned: "RETURNED",
    cancelled: "CANCELLED",
    created: "CREATED",
  };
  const normalizeOrderStatus = (raw: any): string => {
    const s = String(raw || "").trim();
    if (!s) return "PENDING_PAYMENT";
    const upper = s.toUpperCase();
    if (VALID_ORDER_STATUSES.includes(upper)) return upper;
    const lower = s.toLowerCase();
    const mapped = ORDER_STATUS_MAP[lower];
    if (mapped) return mapped;
    return "PENDING_PAYMENT";
  };
  
  // Check if the second parameter is a product or overrides
  let product: any;
  let finalOverrides: any;
  
  if (productOrOverrides && (productOrOverrides._id || productOrOverrides.name || productOrOverrides.price)) {
    // Second parameter is a product
    product = productOrOverrides;
    finalOverrides = overrides;
  } else {
    // Second parameter is overrides, no product provided
    product = null;
    finalOverrides = productOrOverrides || {};
  }
  
  // Create a default product if none provided
  const defaultProduct = product || {
    _id: new mongoose.Types.ObjectId().toString(),
    name: "Test Product",
    price: 100
  };
  
  // Handle field name mapping for test compatibility
  const mappedOverrides = {
    ...finalOverrides,
    orderStatus: normalizeOrderStatus(finalOverrides.orderStatus ?? finalOverrides.status ?? "PENDING_PAYMENT"),
  };
  // Remove the status field to avoid conflicts
  delete mappedOverrides.status;

  const rawPaymentStatus = (mappedOverrides as any).paymentStatus;
  if (typeof rawPaymentStatus === "string") {
    const trimmed = rawPaymentStatus.trim();
    const upper = trimmed.toUpperCase();
    if (upper === "FAILED" || trimmed.toLowerCase() === "failed") {
      (mappedOverrides as any).paymentStatus = "FAILED";
    } else {
      (mappedOverrides as any).paymentStatus = "PENDING";
    }
  }
  
  return await Order.create({
    userId: typeof user === 'string' ? user : user._id,
    items: [
      {
        productId: defaultProduct._id,
        name: defaultProduct.name,
        price: defaultProduct.price,
        qty: 1,
      },
    ],
    totalAmount: defaultProduct.price,
    paymentStatus: "PENDING",
    orderStatus: "PENDING_PAYMENT",
    deliveryStatus: "unassigned",
    address: {
      name: "Test User",
      phone: "9876543210",
      label: "Home",
      addressLine: "123 Test St",
      city: "Test City",
      state: "TS",
      pincode: "500001",
      lat: 17.3850,
      lng: 78.4867,
    },
    assignmentHistory: [],
    history: [],
    ...mappedOverrides,
  });
};

(global as any).createTestPaidOrder = async (user: any, productOverrides: any = {}, orderOverrides: any = {}) => {
  const { Order } = await import("../src/models/Order");
  const { finalizeOrderOnCapturedPayment } = await import(
    "../src/domains/payments/services/orderPaymentFinalizer"
  );

  const product = await (global as any).createTestProduct({
    price: 100,
    stock: 10,
    reservedStock: 0,
    ...productOverrides,
  });

  const order = await (global as any).createTestOrder(user, product, {
    ...orderOverrides,
    paymentStatus: "PENDING",
    totalAmount: typeof orderOverrides?.totalAmount === "number" ? orderOverrides.totalAmount : product.price,
  });

  await finalizeOrderOnCapturedPayment({
    orderId: String(order._id),
    razorpayOrderId: orderOverrides?.razorpayOrderId,
    razorpayPaymentId: orderOverrides?.razorpayPaymentId,
    capturedAt: new Date(),
  } as any);

  return await Order.findById(order._id);
};

(global as any).createTestOTP = async (phone: any, type: string = "verification", overrides: any = {}) => {
  const Otp = await import("../src/models/Otp");
  return await Otp.default.create({
    phone,
    type,
    otp: "123456",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    ...overrides,
  });
};

(global as any).getAuthToken = async (user: any) => {
  const jwt = require("jsonwebtoken");
  return jwt.sign(
    { userId: user._id, email: user.email, role: user.role || "customer" },
    process.env.JWT_SECRET!,
    { expiresIn: "1h" }
  );
};

(global as any).getRefreshToken = async (user: any) => {
  const jwt = require("jsonwebtoken");
  return jwt.sign(
    { userId: user._id, type: "refresh" },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: "7d" }
  );
};
