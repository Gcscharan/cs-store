import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../../src/models/User";
import { Product } from "../../src/models/Product";
import { Order } from "../../src/models/Order";
import Otp from "../../src/models/Otp";
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

    // Seed users - credentials match Postman collection (TEST_EMAIL/TEST_PASSWORD)
    const hashedPassword = await bcrypt.hash("Test@1234", 10);
    
    const regularUser = await User.create({
      name: "Test User",
      email: "test.user@example.com",
      phone: "9876543210",
      password: hashedPassword,
      role: "customer",
    });

    const adminUser = await User.create({
      name: "Admin User",
      email: "admin@example.com",
      phone: "9999999999",
      password: hashedPassword,
      role: "admin",
      isAdmin: true,
    });

    const deliveryUser = await User.create({
      name: "Delivery Partner",
      email: "delivery@example.com",
      phone: "8888888888",
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
        images: [
          {
            publicId: "test/laptop",
            variants: {
              original: "https://example.com/laptop.jpg"
            }
          }
        ],
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
        images: [
          {
            publicId: "test/phone",
            variants: {
              original: "https://example.com/phone.jpg"
            }
          }
        ],
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
        category: "electronics",
        stock: 50,
        images: [
          {
            publicId: "test/headphones",
            variants: {
              original: "https://example.com/headphones.jpg"
            }
          }
        ],
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
            qty: 1,
          },
        ],
        totalAmount: 50000,
        status: "pending",
        address: {
          label: "Home",
          addressLine: "123 Test Street",
          city: "Test City",
          state: "TS",
          pincode: "500001",
          lat: 17.3850,
          lng: 78.4867,
        },
        paymentMethod: "cod",
        paymentStatus: "PENDING",
      },
      {
        userId: regularUser._id,
        items: [
          {
            productId: products[1]._id,
            name: "Smartphone",
            price: 25000,
            qty: 2,
          },
        ],
        totalAmount: 50000,
        status: "confirmed",
        address: {
          label: "Office",
          addressLine: "456 Test Avenue",
          city: "Another City",
          state: "TS",
          pincode: "500002",
          lat: 17.4399,
          lng: 78.4983,
        },
        paymentMethod: "upi",
        paymentStatus: "PENDING",
        paymentId: "pay_test123",
      },
    ]);

    // Seed pincodes
    await Pincode.create([
      {
        pincode: "500001",
        state: "Telangana",
        district: "Hyderabad",
      },
      {
        pincode: "500002",
        state: "Telangana",
        district: "Hyderabad",
      },
      {
        pincode: "500003",
        state: "Telangana",
        district: "Hyderabad",
      },
    ]);

    // Seed OTPs
    await Otp.create([
      {
        phone: "9876543210",
        otp: "123456",
        type: "verification",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
      {
        phone: "9876543210",
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
