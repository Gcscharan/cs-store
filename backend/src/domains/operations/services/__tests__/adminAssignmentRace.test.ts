/**
 * CP-5: Admin Assignment Race Test
 *
 * Proves: assignOrderToAdmin is idempotent under concurrency.
 * 10 workers race to assign the same order — exactly 1 must win.
 */

import mongoose from "mongoose";
import { Order } from "../../../../models/Order";
import { assignOrderToAdmin } from "../adminAssignmentService";

describe("CP-5: Admin Assignment Race — exactly one assignment under concurrency", () => {
  let testOrder: any;

  beforeEach(async () => {
    testOrder = await Order.create({
      userId: new mongoose.Types.ObjectId(),
      idempotencyKey: `test-admin-${Date.now()}-${Math.random()}`,
      cartHash: `hash-admin-${Date.now()}`,
      items: [
        {
          productId: new mongoose.Types.ObjectId(),
          name: "Test Product",
          price: 100,
          qty: 1,
          priceAtOrderTime: 100,
          gstRate: 0,
        },
      ],
      itemsTotal: 100,
      deliveryFee: 0,
      grandTotal: 100,
      totalAmount: 100,
      paymentMethod: "razorpay",
      paymentStatus: "PENDING",
      orderStatus: "PENDING_PAYMENT",
      adminAssigned: false,
      assignmentHistory: [],
      history: [],
      address: {
        label: "Home",
        addressLine: "Test Address",
        city: "Test City",
        state: "Test State",
        pincode: "123456",
        lat: 0,
        lng: 0,
      },
    });
  });

  afterEach(async () => {
    await Order.deleteOne({ _id: testOrder._id });
  });

  it("assigns admin exactly once under 10 concurrent workers (CP-5)", async () => {
    const orderId = testOrder._id.toString();

    const workers = Array.from({ length: 10 }, (_, i) =>
      assignOrderToAdmin({ orderId, adminId: `admin_${i}` })
    );

    const results = await Promise.all(workers);

    // Exactly ONE worker must win
    const successCount = results.filter(r => r.assigned).length;
    expect(successCount).toBe(1);

    // All others must return false
    const failCount = results.filter(r => !r.assigned).length;
    expect(failCount).toBe(9);

    // Verify DB state: adminAssigned=true, exactly one adminAssignedBy
    const order = await Order.findById(testOrder._id);
    expect(order?.adminAssigned).toBe(true);
    expect(order?.adminAssignedAt).toBeDefined();
    expect(order?.adminAssignedBy).toMatch(/^admin_\d$/);
  });

  it("second call always returns false (idempotent)", async () => {
    const orderId = testOrder._id.toString();

    const first = await assignOrderToAdmin({ orderId, adminId: "admin_first" });
    expect(first.assigned).toBe(true);

    const second = await assignOrderToAdmin({ orderId, adminId: "admin_second" });
    expect(second.assigned).toBe(false);

    // DB must still show first assignment
    const order = await Order.findById(testOrder._id);
    expect(order?.adminAssignedBy).toBe("admin_first");
  });

  it("handles 20 concurrent workers — exactly 1 wins (CP-5 stress)", async () => {
    const orderId = testOrder._id.toString();

    const workers = Array.from({ length: 20 }, (_, i) =>
      assignOrderToAdmin({ orderId, adminId: `admin_${i}` })
    );

    const results = await Promise.all(workers);

    const successCount = results.filter(r => r.assigned).length;
    expect(successCount).toBe(1);

    // DB integrity check
    const order = await Order.findById(testOrder._id);
    expect(order?.adminAssigned).toBe(true);
    expect(order?.adminAssignedAt).toBeDefined();
  });
});
