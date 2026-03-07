import mongoose from "mongoose";
import { User } from "../models/User";
import { DeliveryBoy } from "../models/DeliveryBoy";
import * as bcrypt from "bcryptjs";
import * as dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI environment variable is not set!");
  process.exit(1);
}

async function createDeliveryBoy() {
  try {
    await mongoose.connect(MONGODB_URI as string);
    console.log("✅ Connected to MongoDB\n");

    const email = "deliveryboy@gmail.com";
    const password = "123456";

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log("⚠️ User already exists with this email!");
      console.log(`📧 Email: ${email}`);
      
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
        console.log("✅ DeliveryBoy document created!");
      } else {
        console.log("✅ DeliveryBoy document already exists!");
      }
      
      // Update password
      existingUser.passwordHash = await bcrypt.hash(password, 10);
      existingUser.status = "active";
      await existingUser.save();
      console.log("✅ Password updated to: 123456");
      
      console.log("\n📝 Login Credentials:");
      console.log(`   📧 Email: ${email}`);
      console.log(`   🔑 Password: ${password}`);
      return;
    }

    console.log("🔧 Creating delivery boy account...\n");

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
    console.log("✅ User created:");
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Status: ${user.status}`);

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
    console.log("\n✅ DeliveryBoy document created:");
    console.log(`   ID: ${deliveryBoy._id}`);

    console.log("\n" + "=".repeat(50));
    console.log("🎉 DELIVERY BOY ACCOUNT CREATED!");
    console.log("=".repeat(50));
    console.log("\n📝 Login Credentials:");
    console.log(`   📧 Email: ${email}`);
    console.log(`   🔑 Password: ${password}`);
    console.log("\n🔗 Login at: http://localhost:3000/delivery/login");
    console.log("=".repeat(50));

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

createDeliveryBoy();
