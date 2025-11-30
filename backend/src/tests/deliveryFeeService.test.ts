/**
 * Delivery Fee Service - Test Examples
 * Demonstrates how the enhanced delivery fee calculation works
 */

import { calculateDeliveryFeeForAddress } from "../services/deliveryFeeService";
import { IAddress } from "../models/User";

/**
 * Example 1: Local delivery (< 5km) with low order value
 */
export async function testLocalDelivery() {
  console.log("\n=== TEST 1: Local Delivery (< 5km) ===");

  const address: IAddress = {
    _id: "test1" as any,
    label: "Home",
    name: "Test User",
    phone: "919876543210",
    addressLine: "Gachibowli, Hyderabad",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500081",
    lat: 17.4065,
    lng: 78.4772,
    isDefault: true,
  };

  const orderAmount = 500; // ₹500
  const orderWeight = 2; // 2kg

  try {
    const result = await calculateDeliveryFeeForAddress(address, orderAmount, orderWeight, false);

    console.log("Input:");
    console.log(`  Order Amount: ₹${orderAmount}`);
    console.log(`  Order Weight: ${orderWeight}kg`);
    console.log(`  Address: ${address.city}, ${address.state}`);

    console.log("\nResult:");
    console.log(`  Warehouse: ${result.warehouse.name} (${result.warehouse.city})`);
    console.log(`  Distance: ${result.distance.value} km (via ${result.distance.method})`);
    console.log(`  Base Fee: ₹${result.fees.baseFee}`);
    console.log(`  Distance Fee: ₹${result.fees.distanceFee}`);
    console.log(`  Surcharges: ₹${result.fees.surcharges.reduce((sum, s) => sum + s.amount, 0)}`);
    result.fees.surcharges.forEach((s) => console.log(`    - ${s.name}: ₹${s.amount}`));
    console.log(`  Subtotal: ₹${result.fees.subtotal}`);
    console.log(`  Discount: -₹${result.fees.discount}`);
    console.log(`  TOTAL: ₹${result.fees.total}`);
    console.log(`  Free Delivery: ${result.delivery.isFreeDelivery ? "YES" : "NO"}`);
    console.log(`  Estimated Time: ${result.delivery.estimatedTime}`);
    console.log(`  Breakdown: ${result.breakdown}`);
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

/**
 * Example 2: Free delivery (order above threshold)
 */
export async function testFreeDelivery() {
  console.log("\n=== TEST 2: Free Delivery (Order ≥ ₹2000) ===");

  const address: IAddress = {
    _id: "test2" as any,
    label: "Office",
    name: "Test User",
    phone: "919876543210",
    addressLine: "Hitech City, Hyderabad",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500081",
    lat: 17.4485,
    lng: 78.3908,
    isDefault: false,
  };

  const orderAmount = 2500; // ₹2,500 - Above threshold
  const orderWeight = 5; // 5kg

  try {
    const result = await calculateDeliveryFeeForAddress(address, orderAmount, orderWeight, false);

    console.log("Input:");
    console.log(`  Order Amount: ₹${orderAmount} (≥ ₹2000 = FREE DELIVERY)`);
    console.log(`  Order Weight: ${orderWeight}kg`);

    console.log("\nResult:");
    console.log(`  Distance: ${result.distance.value} km`);
    console.log(`  Original Fee: ₹${result.fees.subtotal}`);
    console.log(`  Discount: -₹${result.fees.discount}`);
    console.log(`  TOTAL: ₹${result.fees.total} ✅ FREE`);
    console.log(`  Free Delivery: ${result.delivery.isFreeDelivery ? "YES" : "NO"}`);
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

/**
 * Example 3: Long distance delivery with heavy item
 */
export async function testLongDistanceHeavy() {
  console.log("\n=== TEST 3: Long Distance + Heavy Item ===");

  const address: IAddress = {
    _id: "test5" as any,
    label: "Home",
    name: "Test User",
    phone: "919876543210",
    addressLine: "Gachibowli, Hyderabad",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500081",
    lat: 17.4065,
    lng: 78.4772,
    isDefault: true,
  };

  const orderAmount = 1500; // ₹1,500
  const orderWeight = 12; // 12kg - Heavy item (> 10kg)

  try {
    const result = await calculateDeliveryFeeForAddress(address, orderAmount, orderWeight, false);

    console.log("Input:");
    console.log(`  Order Amount: ₹${orderAmount}`);
    console.log(`  Order Weight: ${orderWeight}kg (Heavy - > 10kg)`);
    console.log(`  Address: ${address.city}, ${address.state}`);

    console.log("\nResult:");
    console.log(`  Distance: ${result.distance.value} km`);
    console.log(`  Base Fee: ₹${result.fees.baseFee}`);
    console.log(`  Distance Fee: ₹${result.fees.distanceFee}`);
    console.log(`  Surcharges:`);
    result.fees.surcharges.forEach((s) => console.log(`    - ${s.name}: ₹${s.amount}`));
    console.log(`  TOTAL: ₹${result.fees.total}`);
    console.log(`  Estimated Time: ${result.delivery.estimatedTime}`);
    console.log(`  Estimated Days: ${result.delivery.estimatedDays} day(s)`);
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

/**
 * Example 4: Express delivery with surcharge
 */
export async function testExpressDelivery() {
  console.log("\n=== TEST 4: Express Delivery ===");

  const address: IAddress = {
    _id: "test4" as any,
    label: "Home",
    name: "Test User",
    phone: "919876543210",
    addressLine: "Gachibowli, Hyderabad",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500081",
    lat: 17.4065,
    lng: 78.4772,
    isDefault: true,
  };

  const orderAmount = 800;
  const orderWeight = 3;
  const isExpressDelivery = true; // Express delivery requested

  try {
    const result = await calculateDeliveryFeeForAddress(address, orderAmount, orderWeight, isExpressDelivery);

    console.log("Input:");
    console.log(`  Order Amount: ₹${orderAmount}`);
    console.log(`  Express Delivery: YES`);

    console.log("\nResult:");
    console.log(`  Base Fee: ₹${result.fees.baseFee}`);
    console.log(`  Surcharges:`);
    result.fees.surcharges.forEach((s) => console.log(`    - ${s.name}: ₹${s.amount}`));
    console.log(`  TOTAL: ₹${result.fees.total}`);
    console.log(`  Estimated Days: ${result.delivery.estimatedDays} day(s) (EXPRESS)`);
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

/**
 * Example 5: Un-deliverable location (too far)
 */
export async function testUndeliverableLocation() {
  console.log("\n=== TEST 5: Un-deliverable Location ===");

  const address: IAddress = {
    _id: "test5" as any,
    label: "Home",
    name: "Test User",
    phone: "919876543210",
    addressLine: "Delhi",
    city: "Delhi",
    state: "Delhi",
    pincode: "110001",
    lat: 28.6139,
    lng: 77.209,
    isDefault: true,
  };

  const orderAmount = 1000;
  const orderWeight = 5;

  try {
    const result = await calculateDeliveryFeeForAddress(address, orderAmount, orderWeight, false);

    console.log("Input:");
    console.log(`  Address: ${address.city}, ${address.state}`);

    console.log("\nResult:");
    console.log(`  Distance: ${result.distance.value} km`);
    console.log(`  Deliverable: ${result.delivery.isDeliverable ? "YES" : "NO"}`);
    console.log(`  Message: ${result.breakdown}`);
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

/**
 * Run all tests
 */
export async function runAllTests() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║      ENHANCED DELIVERY FEE CALCULATION - TEST SUITE         ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  await testLocalDelivery();
  await testFreeDelivery();
  await testLongDistanceHeavy();
  await testExpressDelivery();
  await testUndeliverableLocation();

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                      ALL TESTS COMPLETED                     ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
}

// Export for manual testing
if (require.main === module) {
  runAllTests().catch(console.error);
}
