import mongoose from "mongoose";
import { User } from "../src/models/User";
import { DeliveryBoy } from "../src/models/DeliveryBoy";
import * as bcrypt from "bcryptjs";
import * as dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/cps-store";

async function createDeliveryBoyTestAccount() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Delivery boy details
    const deliveryBoyEmail = "deliveryboy@test.com";
    const deliveryBoyPhone = "9876543210";
    const deliveryBoyPassword = "delivery123";

    // Check if delivery boy already exists
    const existingUser = await User.findOne({ email: deliveryBoyEmail });
    if (existingUser) {
      console.log("⚠️ Delivery boy account already exists");
      console.log(`   Email: ${deliveryBoyEmail}`);
      console.log(`   Password: ${deliveryBoyPassword}`);
      return;
    }

    // Create User account for delivery boy
    const passwordHash = await bcrypt.hash(deliveryBoyPassword, 10);
    const user = new User({
      name: "Test Delivery Boy",
      email: deliveryBoyEmail,
      phone: deliveryBoyPhone,
      passwordHash,
      role: "delivery",
      status: "active",
      deliveryProfile: {
        phone: deliveryBoyPhone,
        vehicleType: "bike",
        assignedAreas: [],
        documents: [],
      },
    });

    const savedUser = await user.save();
    console.log("✅ Created User account for delivery boy");

    // Create Delivery Boy profile
    const deliveryBoy = new DeliveryBoy({
      userId: savedUser._id,
      name: "Test Delivery Boy",
      email: deliveryBoyEmail,
      phone: deliveryBoyPhone,
      vehicleType: "bike",
      isActive: true,
      currentLocation: {
        lat: 17.385044,
        lng: 78.486671,
      },
    });

    await deliveryBoy.save();
    console.log("✅ Created Delivery Boy profile");

    console.log("\n🎉 DELIVERY BOY TEST ACCOUNT CREATED:");
    console.log("=".repeat(50));
    console.log(`📧 Email: ${deliveryBoyEmail}`);
    console.log(`🔑 Password: ${deliveryBoyPassword}`);
    console.log(`📱 Phone: ${deliveryBoyPhone}`);
    console.log(`🏍 Vehicle: Bike`);
    console.log(`✅ Status: Active`);
    console.log("=".repeat(50));

  } catch (error) {
    console.error("❌ Error creating delivery boy account:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

// Run the script
createDeliveryBoyTestAccount();
