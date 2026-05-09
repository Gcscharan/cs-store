import mongoose from "mongoose";
import { assignOrderToAdmin } from "../adminAssignmentService";
import { Order } from "../../../../models/Order";

describe("Admin Assignment Service", () => {
  let testOrderId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    // Create a test order
    const order = await Order.create({
      userId: new mongoose.Types.ObjectId(),
      idempotencyKey: `test-${Date.now()}-${Math.random()}`,
      cartHash: `hash-${Date.now()}`,
      items: [
        {
          productId: new mongoose.Types.ObjectId(),
          name: "Test Product",
          qty: 1,
          priceAtOrderTime: 100,
          gstRate: 0,
        },
      ],
      itemsTotal: 100,
      deliveryFee: 0,
      grandTotal: 100,
      paymentMethod: "RAZORPAY",
      paymentStatus: "PENDING",
      status: "PENDING",
      address: {
        line1: "Test Address",
        city: "Test City",
        state: "Test State",
        pincode: "123456",
        lat: 0,
        lng: 0,
      },
    });

    testOrderId = order._id as mongoose.Types.ObjectId;
  });

  afterEach(async () => {
    // Clean up test order
    await Order.deleteOne({ _id: testOrderId });
  });

  describe("assignOrderToAdmin", () => {
    it("should successfully assign order on first call", async () => {
      const result = await assignOrderToAdmin({
        orderId: testOrderId.toString(),
        adminId: "test-admin",
      });

      expect(result.assigned).toBe(true);

      // Verify order was updated
      const order = await Order.findById(testOrderId);
      expect(order?.adminAssigned).toBe(true);
      expect(order?.adminAssignedBy).toBe("test-admin");
      expect(order?.adminAssignedAt).toBeDefined();
    });

    it("should return false on second call (idempotent)", async () => {
      // First call
      const result1 = await assignOrderToAdmin({
        orderId: testOrderId.toString(),
        adminId: "test-admin-1",
      });
      expect(result1.assigned).toBe(true);

      // Second call
      const result2 = await assignOrderToAdmin({
        orderId: testOrderId.toString(),
        adminId: "test-admin-2",
      });
      expect(result2.assigned).toBe(false);

      // Verify order still has first admin assignment
      const order = await Order.findById(testOrderId);
      expect(order?.adminAssigned).toBe(true);
      expect(order?.adminAssignedBy).toBe("test-admin-1"); // First admin wins
    });

    it("should handle concurrent assignments (only one succeeds)", async () => {
      // Simulate concurrent calls
      const results = await Promise.all([
        assignOrderToAdmin({
          orderId: testOrderId.toString(),
          adminId: "admin-1",
        }),
        assignOrderToAdmin({
          orderId: testOrderId.toString(),
          adminId: "admin-2",
        }),
        assignOrderToAdmin({
          orderId: testOrderId.toString(),
          adminId: "admin-3",
        }),
      ]);

      // Exactly one should succeed
      const successCount = results.filter((r) => r.assigned).length;
      expect(successCount).toBe(1);

      // Verify order was assigned exactly once
      const order = await Order.findById(testOrderId);
      expect(order?.adminAssigned).toBe(true);
      expect(order?.adminAssignedAt).toBeDefined();
    });

    it("should use 'system' as default adminId", async () => {
      const result = await assignOrderToAdmin({
        orderId: testOrderId.toString(),
      });

      expect(result.assigned).toBe(true);

      const order = await Order.findById(testOrderId);
      expect(order?.adminAssignedBy).toBe("system");
    });

    it("should return false for invalid orderId", async () => {
      const result = await assignOrderToAdmin({
        orderId: "invalid-id",
      });

      expect(result.assigned).toBe(false);
    });

    it("should return false for non-existent order", async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const result = await assignOrderToAdmin({
        orderId: nonExistentId,
      });

      expect(result.assigned).toBe(false);
    });
  });
});
