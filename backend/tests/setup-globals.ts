// Load test environment variables and override any existing ones
import dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.MOCK_OTP = "true";
  process.env.JWT_SECRET = "test-jwt-secret-key";
  process.env.JWT_REFRESH_SECRET = "test-jwt-refresh-secret-key";
  process.env.RAZORPAY_KEY_ID = "test-razorpay-key";
  process.env.RAZORPAY_KEY_SECRET = "test-razorpay-secret";
  process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  process.env.CLOUDINARY_API_KEY = "test-key";
  process.env.CLOUDINARY_API_SECRET = "test-secret";
  
  if (mongoose.connection.readyState === 0) {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
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
    orderStatus: finalOverrides.status || "pending",
  };
  // Remove the status field to avoid conflicts
  delete mappedOverrides.status;
  
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
    paymentStatus: "pending",
    orderStatus: "pending",
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
