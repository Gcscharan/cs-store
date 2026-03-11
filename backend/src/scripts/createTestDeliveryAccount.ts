import { logger } from '../utils/logger';
import mongoose from "mongoose";
import { User } from "../models/User";
import { DeliveryBoy } from "../models/DeliveryBoy";
import * as bcrypt from "bcryptjs";
import * as dotenv from "dotenv";

dotenv.config();

// CRITICAL: Only use MONGODB_URI from environment - no fallbacks
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  logger.error("❌ CRITICAL: MONGODB_URI environment variable is not set!");
  logger.error("❌ Please set MONGODB_URI in your .env file and restart.");
  process.exit(1);
}

async function createTestDeliveryAccount() {
  try {
    await mongoose.connect(MONGODB_URI as string);
    logger.info("✅ Connected to MongoDB Atlas\n");

    // Check if test delivery user already exists
    const existingUser = await User.findOne({ email: "delivery@test.com" });
    if (existingUser) {
      logger.info("⚠️ Test delivery account already exists!");
      logger.info(`📧 Email: delivery@test.com`);
      logger.info(`🔑 Password: delivery123`);
      
      // Check if linked DeliveryBoy exists
      const existingDeliveryBoy = await DeliveryBoy.findOne({ userId: existingUser._id });
      if (!existingDeliveryBoy) {
        logger.info("\n🔧 Creating missing DeliveryBoy document...");
        const deliveryBoy = new DeliveryBoy({
          name: existingUser.name,
          phone: existingUser.phone,
          email: existingUser.email,
          userId: existingUser._id,
          vehicleType: existingUser.deliveryProfile?.vehicleType || "bike",
          isActive: existingUser.status === "active",
          availability: "offline",
          currentLocation: {
            lat: 17.385044,
            lng: 78.486671,
            lastUpdatedAt: new Date(),
          },
          earnings: 0,
          completedOrdersCount: 0,
          assignedOrders: [],
          currentLoad: 0,
        });
        await deliveryBoy.save();
        logger.info("✅ DeliveryBoy document created and linked!");
      } else {
        logger.info("✅ DeliveryBoy document already exists and linked!");
      }
      
      return;
    }

    logger.info("🔧 Creating test delivery account...\n");

    // Create User with delivery role
    const passwordHash = await bcrypt.hash("delivery123", 10);
    
    const user = new User({
      name: "Test Delivery Boy",
      email: "delivery@test.com",
      phone: "9876543210",
      passwordHash,
      role: "delivery",
      status: "active", // Active by default for testing
      deliveryProfile: {
        phone: "9876543210",
        vehicleType: "bike",
        assignedAreas: ["500001", "500002", "500003"],
        documents: [],
      },
    });

    await user.save();
    logger.info("✅ User created:");
    logger.info(`   Name: ${user.name}`);
    logger.info(`   Email: ${user.email}`);
    logger.info(`   Phone: ${user.phone}`);
    logger.info(`   Role: ${user.role}`);
    logger.info(`   Status: ${user.status}`);

    // Create DeliveryBoy document
    const deliveryBoy = new DeliveryBoy({
      name: user.name,
      phone: user.phone,
      email: user.email,
      userId: user._id,
      vehicleType: "bike",
      isActive: true,
      availability: "offline",
      currentLocation: {
        lat: 17.385044, // Default: Hyderabad
        lng: 78.486671,
        lastUpdatedAt: new Date(),
      },
      earnings: 0,
      completedOrdersCount: 0,
      assignedOrders: [],
      currentLoad: 0,
    });

    await deliveryBoy.save();
    logger.info("\n✅ DeliveryBoy document created:");
    logger.info(`   ID: ${deliveryBoy._id}`);
    logger.info(`   Vehicle: ${deliveryBoy.vehicleType}`);
    logger.info(`   Availability: ${deliveryBoy.availability}`);
    logger.info(`   Linked to User: ${deliveryBoy.userId}`);

    logger.info("\n" + "=".repeat(60));
    logger.info("🎉 TEST DELIVERY ACCOUNT CREATED SUCCESSFULLY!");
    logger.info("=".repeat(60));
    logger.info("\n📝 Login Credentials:");
    logger.info("   📧 Email: delivery@test.com");
    logger.info("   🔑 Password: delivery123");
    logger.info("\n🔗 API Endpoint:");
    logger.info("   POST http://localhost:5001/api/delivery/auth/login");
    logger.info("\n📦 Request Body:");
    logger.info('   { "email": "delivery@test.com", "password": "delivery123" }');
    logger.info("=".repeat(60));

  } catch (error) {
    logger.error("❌ Error:", error);
  } finally {
    await mongoose.connection.close();
    logger.info("\n🔌 Disconnected from MongoDB");
  }
}

createTestDeliveryAccount();
