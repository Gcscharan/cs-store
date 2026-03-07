import mongoose from "mongoose";
import * as bcrypt from "bcryptjs";
import { Product } from "../../src/models/Product";
import { User } from "../../src/models/User";
import { Order } from "../../src/models/Order";
import { InventoryReservation } from "../../src/models/InventoryReservation";
import { inventoryReservationService } from "../../src/domains/orders/services/inventoryReservationService";
import { Cart } from "../../src/models/Cart";

/**
 * Concurrency Stress Test for Inventory
 * 
 * GOAL: Ensure two users cannot buy the last item simultaneously.
 * 
 * Simulates:
 * - 10 parallel purchase requests
 * - Same product with stock = 1
 * 
 * Expects:
 * - Only 1 order succeeds
 * - Others fail gracefully
 * - Stock never goes negative
 */

async function createTestUser(index: number): Promise<any> {
  const hashedPassword = await bcrypt.hash("password123", 10);
  return User.create({
    name: `Test User ${index}`,
    email: `user${index}@test.com`,
    phone: `91987654321${index}`,
    password: hashedPassword,
    role: "user",
    addresses: [
      {
        name: `Test User ${index}`,
        phone: `91987654321${index}`,
        label: "Home",
        addressLine: "123 Test Street",
        city: "Hyderabad",
        state: "Telangana",
        pincode: "500001",
        lat: 17.385,
        lng: 78.4867,
        isDefault: true,
        isGeocoded: true,
        coordsSource: "saved",
      },
    ],
  });
}

async function createTestProduct(): Promise<any> {
  return Product.create({
    name: "Limited Stock Item",
    description: "Only 1 in stock",
    price: 100,
    stock: 1,
    reservedStock: 0,
    category: "test",
    isSellable: true,
  });
}

async function attemptReservation(
  userId: mongoose.Types.ObjectId,
  productId: mongoose.Types.ObjectId,
  orderId: mongoose.Types.ObjectId
): Promise<{ success: boolean; error?: string }> {
  const session = await mongoose.startSession();
  
  try {
    let result: { success: boolean; error?: string } = { success: false };
    
    await session.withTransaction(async () => {
      try {
        await inventoryReservationService.reserveForOrder({
          session,
          orderId,
          items: [{ productId, qty: 1 }],
          ttlMs: 15 * 60_000,
        });
        result = { success: true };
      } catch (err: any) {
        result = { success: false, error: err.message };
        throw err; // Abort transaction
      }
    });
    
    return result;
  } catch (err: any) {
    return { success: false, error: err.message };
  } finally {
    session.endSession();
  }
}

async function runConcurrencyTest(): Promise<void> {
  console.log("\n========================================");
  console.log("🧪 INVENTORY CONCURRENCY STRESS TEST");
  console.log("========================================\n");

  // Connect to test database
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/cs_store_test";
  await mongoose.connect(mongoUri);
  
  console.log("📦 Setting up test data...\n");

  // Clean up previous test data
  await User.deleteMany({ email: /user\d+@test\.com/ });
  await Product.deleteMany({ name: "Limited Stock Item" });
  await Order.deleteMany({});
  await InventoryReservation.deleteMany({});
  await Cart.deleteMany({});

  // Create product with stock = 1
  const product = await createTestProduct();
  console.log(`✅ Created product: ${product._id}`);
  console.log(`   Initial stock: ${product.stock}`);
  console.log(`   Reserved stock: ${product.reservedStock || 0}\n`);

  // Create 10 test users
  const users = await Promise.all(
    Array.from({ length: 10 }, (_, i) => createTestUser(i))
  );
  console.log(`✅ Created ${users.length} test users\n`);

  // Generate 10 order IDs
  const orderIds = Array.from({ length: 10 }, () => new mongoose.Types.ObjectId());

  console.log("🚀 Launching 10 parallel purchase attempts...\n");
  console.log("   All users trying to buy the SAME item (stock = 1)");
  console.log("   Expected: 1 success, 9 failures\n");

  const startTime = Date.now();

  // Run all 10 attempts in parallel
  const results = await Promise.all(
    orderIds.map(async (orderId, index) => {
      const user = users[index];
      return attemptReservation(user._id, product._id, orderId);
    })
  );

  const duration = Date.now() - startTime;

  // Count results
  let successCount = 0;
  let failureCount = 0;
  const errors: string[] = [];

  results.forEach((result, index) => {
    if (result.success) {
      successCount++;
      console.log(`   [User ${index}] ✅ SUCCESS - Reserved`);
    } else {
      failureCount++;
      const errorMsg = result.error || "Unknown error";
      errors.push(errorMsg);
      console.log(`   [User ${index}] ❌ FAILED - ${errorMsg.substring(0, 50)}...`);
    }
  });

  // Check final stock state
  const finalProduct = await Product.findById(product._id).lean();
  const finalStock = finalProduct?.stock ?? -1;
  const finalReserved = finalProduct?.reservedStock ?? 0;
  const availableStock = finalStock - finalReserved;

  // Count successful reservations in DB
  const activeReservations = await InventoryReservation.countDocuments({
    productId: product._id,
    status: "ACTIVE",
  });

  console.log("\n========================================");
  console.log("📊 TEST RESULTS");
  console.log("========================================");
  console.log(`   Duration: ${duration}ms`);
  console.log(`   Success count: ${successCount}`);
  console.log(`   Failure count: ${failureCount}`);
  console.log(`   Final stock: ${finalStock}`);
  console.log(`   Final reserved: ${finalReserved}`);
  console.log(`   Available stock: ${availableStock}`);
  console.log(`   Active reservations in DB: ${activeReservations}`);
  console.log("========================================\n");

  // Validation
  const errors_list: string[] = [];

  if (successCount !== 1) {
    errors_list.push(`❌ FAIL: Expected exactly 1 success, got ${successCount}`);
  } else {
    console.log("✅ PASS: Exactly 1 reservation succeeded");
  }

  if (failureCount !== 9) {
    errors_list.push(`❌ FAIL: Expected 9 failures, got ${failureCount}`);
  } else {
    console.log("✅ PASS: 9 reservations failed gracefully");
  }

  if (finalStock < 0) {
    errors_list.push(`❌ FAIL: Stock went negative: ${finalStock}`);
  } else {
    console.log("✅ PASS: Stock never went negative");
  }

  if (availableStock < 0) {
    errors_list.push(`❌ FAIL: Available stock went negative: ${availableStock}`);
  } else {
    console.log("✅ PASS: Available stock is non-negative");
  }

  if (activeReservations !== 1) {
    errors_list.push(`❌ FAIL: Expected 1 active reservation, found ${activeReservations}`);
  } else {
    console.log("✅ PASS: Exactly 1 active reservation in database");
  }

  if (finalReserved !== 1) {
    errors_list.push(`❌ FAIL: Expected reservedStock = 1, got ${finalReserved}`);
  } else {
    console.log("✅ PASS: Reserved stock correctly incremented to 1");
  }

  console.log("\n========================================");
  if (errors_list.length === 0) {
    console.log("🎉 ALL VALIDATIONS PASSED!");
    console.log("   Inventory concurrency protection is working correctly.");
  } else {
    console.log("⚠️  VALIDATION FAILURES:");
    errors_list.forEach(e => console.log(`   ${e}`));
    process.exit(1);
  }
  console.log("========================================\n");

  // Cleanup
  await User.deleteMany({ email: /user\d+@test\.com/ });
  await Product.deleteMany({ name: "Limited Stock Item" });
  await Order.deleteMany({});
  await InventoryReservation.deleteMany({});
  await Cart.deleteMany({});

  await mongoose.disconnect();
  console.log("🧹 Test data cleaned up\n");
}

// Run the test
runConcurrencyTest()
  .then(() => {
    console.log("✅ Test completed successfully");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Test failed with error:", err);
    process.exit(1);
  });
