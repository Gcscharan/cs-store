import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../../src/models/User";
import { Product } from "../../src/models/Product";
import { Order } from "../../src/models/Order";
import { Otp } from "../../src/models/Otp";
import { Pincode } from "../../src/models/Pincode";

async function seedDatabase() {
  console.log("🌱 Seeding test database...");

  try {
    // Clear existing data
    await User.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    await Otp.deleteMany({});
    await Pincode.deleteMany({});

    // Seed users
    const hashedPassword = await bcrypt.hash("password123", 10);
    
    const regularUser = await User.create({
      name: "Test User",
      email: "user@example.com",
      phone: "919876543210",
      password: hashedPassword,
      role: "user",
    });

    const adminUser = await User.create({
      name: "Admin User",
      email: "admin@example.com",
      phone: "919999999999",
      password: hashedPassword,
      role: "admin",
      isAdmin: true,
    });

    const deliveryUser = await User.create({
      name: "Delivery Partner",
      email: "delivery@example.com",
      phone: "918888888888",
      password: hashedPassword,
      role: "delivery",
    });

    // Seed products
    const products = await Product.create([
      {
        name: "Laptop",
        description: "High-performance laptop",
        price: 50000,
        category: "electronics",
        stock: 10,
        images: ["https://example.com/laptop.jpg"],
        specifications: {
          brand: "TestBrand",
          model: "TestModel",
          ram: "16GB",
          storage: "512GB SSD",
        },
      },
      {
        name: "Smartphone",
        description: "Latest smartphone",
        price: 25000,
        category: "electronics",
        stock: 20,
        images: ["https://example.com/phone.jpg"],
        specifications: {
          brand: "TestPhone",
          model: "TestPhoneX",
          ram: "8GB",
          storage: "128GB",
          display: "6.1 inch",
        },
      },
      {
        name: "Headphones",
        description: "Wireless headphones",
        price: 2000,
        category: "accessories",
        stock: 50,
        images: ["https://example.com/headphones.jpg"],
        specifications: {
          brand: "TestAudio",
          type: "Over-ear",
          connectivity: "Bluetooth 5.0",
          battery: "30 hours",
        },
      },
    ]);

    // Seed orders
    await Order.create([
      {
        userId: regularUser._id,
        items: [
          {
            productId: products[0]._id,
            name: "Laptop",
            price: 50000,
            quantity: 1,
          },
        ],
        totalAmount: 50000,
        status: "pending",
        deliveryAddress: {
          street: "123 Test Street",
          city: "Test City",
          state: "TS",
          pincode: "500001",
          phone: "919876543210",
        },
        paymentMethod: "cod",
        paymentStatus: "pending",
      },
      {
        userId: regularUser._id,
        items: [
          {
            productId: products[1]._id,
            name: "Smartphone",
            price: 25000,
            quantity: 2,
          },
        ],
        totalAmount: 50000,
        status: "confirmed",
        deliveryAddress: {
          street: "456 Test Avenue",
          city: "Another City",
          state: "TS",
          pincode: "500002",
          phone: "919876543210",
        },
        paymentMethod: "online",
        paymentStatus: "paid",
        paymentId: "pay_test123",
      },
    ]);

    // Seed pincodes
    await Pincode.create([
      {
        pincode: "500001",
        city: "Test City",
        state: "TS",
        deliveryAvailable: true,
        deliveryCharge: 40,
        estimatedDays: 2,
      },
      {
        pincode: "500002",
        city: "Another City",
        state: "TS",
        deliveryAvailable: true,
        deliveryCharge: 30,
        estimatedDays: 1,
      },
      {
        pincode: "500003",
        city: "No Delivery City",
        state: "TS",
        deliveryAvailable: false,
        deliveryCharge: 0,
        estimatedDays: 0,
      },
    ]);

    // Seed OTPs
    await Otp.create([
      {
        phone: "919876543210",
        otp: "123456",
        type: "verification",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
      {
        phone: "919876543210",
        otp: "654321",
        type: "payment",
        orderId: new mongoose.Types.ObjectId(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    ]);

    console.log("✅ Database seeded successfully!");
    console.log(`- Users: ${await User.countDocuments()}`);
    console.log(`- Products: ${await Product.countDocuments()}`);
    console.log(`- Orders: ${await Order.countDocuments()}`);
    console.log(`- Pincodes: ${await Pincode.countDocuments()}`);
    console.log(`- OTPs: ${await Otp.countDocuments()}`);

  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/test")
    .then(() => seedDatabase())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Seeding failed:", error);
      process.exit(1);
    });
}

export default seedDatabase;
