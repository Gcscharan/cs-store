import { logger } from '../utils/logger';
import mongoose from "mongoose";
import { User } from "../models/User";
import { DeliveryBoy } from "../models/DeliveryBoy";
import * as bcrypt from "bcryptjs";
import * as dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  logger.error("❌ MONGODB_URI environment variable is not set!");
  process.exit(1);
}

async function createDeliveryBoy() {
  try {
    await mongoose.connect(MONGODB_URI as string);
    logger.info("✅ Connected to MongoDB\n");

    const email = "deliveryboy@gmail.com";
    const password = "123456";

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.info("⚠️ User already exists with this email!");
      logger.info(`📧 Email: ${email}`);
      
      // Ensure DeliveryBoy record exists with unique phone
      let deliveryBoy = await DeliveryBoy.findOne({ userId: existingUser._id });
      if (!deliveryBoy) {
        // Use a unique phone for DeliveryBoy
        const uniquePhone = `99${Date.now().toString().slice(-8)}`;
        deliveryBoy = new DeliveryBoy({
          name: existingUser.name,
          phone: uniquePhone,
          email: existingUser.email,
          userId: existingUser._id,
          vehicleType: "bike",
          isActive: existingUser.status === "active",
          availability: "offline",
          currentLocation: { lat: 17.385044, lng: 78.486671, lastUpdatedAt: new Date() },
          earnings: 0,
          completedOrdersCount: 0,
          assignedOrders: [],
        });
        await deliveryBoy.save();
        logger.info("✅ DeliveryBoy document created!");
      } else {
        logger.info("✅ DeliveryBoy document already exists!");
      }
      
      // Update password
      existingUser.passwordHash = await bcrypt.hash(password, 10);
      existingUser.status = "active";
      await existingUser.save();
      logger.info("✅ Password updated to: 123456");
      
      logger.info("\n📝 Login Credentials:");
      logger.info(`   📧 Email: ${email}`);
      logger.info(`   🔑 Password: ${password}`);
      return;
    }

    logger.info("🔧 Creating delivery boy account...\n");

    // Create User
    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({
      name: "Delivery Boy",
      email,
      phone: "9998887776",
      passwordHash,
      role: "delivery",
      status: "active",
      deliveryProfile: {
        phone: "9998887776",
        vehicleType: "bike",
        assignedAreas: ["500001", "500002"],
        documents: [],
      },
    });

    await user.save();
    logger.info("✅ User created:");
    logger.info(`   Name: ${user.name}`);
    logger.info(`   Email: ${user.email}`);
    logger.info(`   Role: ${user.role}`);
    logger.info(`   Status: ${user.status}`);

    // Create DeliveryBoy
    const deliveryBoy = new DeliveryBoy({
      name: user.name,
      phone: user.phone,
      email: user.email,
      userId: user._id,
      vehicleType: "bike",
      isActive: true,
      availability: "offline",
      currentLocation: { lat: 17.385044, lng: 78.486671, lastUpdatedAt: new Date() },
      earnings: 0,
      completedOrdersCount: 0,
      assignedOrders: [],
    });

    await deliveryBoy.save();
    logger.info("\n✅ DeliveryBoy document created:");
    logger.info(`   ID: ${deliveryBoy._id}`);

    logger.info("\n" + "=".repeat(50));
    logger.info("🎉 DELIVERY BOY ACCOUNT CREATED!");
    logger.info("=".repeat(50));
    logger.info("\n📝 Login Credentials:");
    logger.info(`   📧 Email: ${email}`);
    logger.info(`   🔑 Password: ${password}`);
    logger.info("\n🔗 Login at: http://localhost:3000/delivery/login");
    logger.info("=".repeat(50));

  } catch (error) {
    logger.error("❌ Error:", error);
  } finally {
    await mongoose.connection.close();
    logger.info("\n🔌 Disconnected from MongoDB");
  }
}

createDeliveryBoy();
