import mongoose from "mongoose";
import * as dotenv from "dotenv";
import * as bcrypt from "bcryptjs";
import { User } from "../models/User";
import { DeliveryBoy } from "../models/DeliveryBoy";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ CRITICAL: MONGODB_URI environment variable is not set!");
  process.exit(1);
}

type SeedDeliveryBoy = {
  name: string;
  email: string;
  phone: string;
};

const TEST_PASSWORD = "delivery123";

const seedAccounts: SeedDeliveryBoy[] = [
  {
    name: "Test Auto Delivery 1",
    email: "auto-delivery1@test.com",
    phone: "9876500001",
  },
  {
    name: "Test Auto Delivery 2",
    email: "auto-delivery2@test.com",
    phone: "9876500002",
  },
  {
    name: "Test Auto Delivery 3",
    email: "auto-delivery3@test.com",
    phone: "9876500003",
  },
];

async function ensureAccount(acc: SeedDeliveryBoy) {
  const existingUser = await User.findOne({
    $or: [{ email: acc.email }, { phone: acc.phone }],
  });

  let user = existingUser;

  if (!user) {
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

    user = new User({
      name: acc.name,
      email: acc.email,
      phone: acc.phone,
      passwordHash,
      role: "delivery",
      status: "active",
      deliveryProfile: {
        phone: acc.phone,
        vehicleType: "scooter",
        assignedAreas: ["500001", "500002", "500003"],
        documents: [],
      },
    });

    await user.save();
  } else {
    user.role = "delivery";
    user.status = "active";
    user.deliveryProfile = {
      phone: acc.phone,
      vehicleType: "scooter" as any,
      assignedAreas: (user.deliveryProfile as any)?.assignedAreas || ["500001"],
      documents: (user.deliveryProfile as any)?.documents || [],
      aadharOrId: (user.deliveryProfile as any)?.aadharOrId,
      approvedAt: (user.deliveryProfile as any)?.approvedAt,
      approvedBy: (user.deliveryProfile as any)?.approvedBy,
    };
    await user.save();
  }

  const existingDeliveryBoy =
    (await DeliveryBoy.findOne({ userId: user._id })) ||
    (await DeliveryBoy.findOne({ phone: acc.phone }));

  if (!existingDeliveryBoy) {
    const deliveryBoy = new DeliveryBoy({
      name: user.name,
      phone: user.phone,
      email: user.email,
      userId: user._id,
      vehicleType: "AUTO",
      isActive: true,
      availability: "available",
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
  } else {
    existingDeliveryBoy.userId = existingDeliveryBoy.userId || user._id;
    existingDeliveryBoy.vehicleType = "AUTO";
    existingDeliveryBoy.isActive = true;
    existingDeliveryBoy.availability = "available";
    if (!existingDeliveryBoy.currentLocation) {
      existingDeliveryBoy.currentLocation = {
        lat: 17.385044,
        lng: 78.486671,
        lastUpdatedAt: new Date(),
      } as any;
    }
    await existingDeliveryBoy.save();
  }

  return { userId: user._id };
}

async function main() {
  await mongoose.connect(MONGODB_URI as string);

  console.log("✅ Connected to MongoDB\n");
  console.log(`🔧 Ensuring ${seedAccounts.length} AUTO delivery boys...\n`);

  for (const acc of seedAccounts) {
    const r = await ensureAccount(acc);
    console.log(`✅ ${acc.name} created/updated (userId=${String(r.userId)})`);
    console.log(`   📧 ${acc.email}`);
    console.log(`   📞 ${acc.phone}`);
    console.log(`   🔑 password: ${TEST_PASSWORD}`);
    console.log("   🚗 vehicleType: AUTO\n");
  }

  console.log("🎉 Done.");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
    console.log("\n🔌 Disconnected from MongoDB");
  });
