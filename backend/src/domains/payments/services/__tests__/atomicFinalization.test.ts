/**
 * Atomic Finalization Unit Tests - Task 7.2
 * 
 * Tests for atomic payment finalization to ensure exactly-once semantics
 * and proper race condition handling.
 */

import mongoose from "mongoose";
import { Order } from "../../../../models/Order";
import { finalizeOrderOnCapturedPayment } from "../orderPaymentFinalizer";

describe("Atomic Finalization", () => {
  let testOrderId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    // Create a test order in PENDING state
    const order = await Order.create({
      userId: new mongoose.Types.ObjectId(),
      idempotencyKey: `test-${Date.now()}-${Math.random()}`,
      cartHash: `hash-${Date.now()}`,
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

    testOrderId = order._id as mongoose.Types.ObjectId;
  });

  afterEach(async () => {
    // Clean up test order
    await Order.deleteOne({ _id: testOrderId });
  });

  describe("First finalization succeeds", () => {
    it("should successfully finalize order on first call", async () => {
      const result = await finalizeOrderOnCapturedPayment({
        orderId: testOrderId.toString(),
        razorpayOrderId: "order_test123",
        razorpayPaymentId: "pay_test123",
        capturedAt: new Date(),
        confirmedBy: "WEBHOOK",
      });

      expect(result.updated).toBe(true);

      // Verify order was updated
      const order = await Order.findById(testOrderId);
      expect(order?.paymentStatus).toBe("PAID");
      expect(order?.finalizedAt).toBeDefined();
      expect(order?.razorpayOrderId).toBe("order_test123");
      expect(order?.razorpayPaymentId).toBe("pay_test123");
      expect(order?.paymentConfirmedBy).toBe("WEBHOOK");
    });

    it("should set finalizedAt timestamp", async () => {
      const beforeFinalization = new Date();
      
      await finalizeOrderOnCapturedPayment({
        orderId: testOrderId.toString(),
        confirmedBy: "WEBHOOK",
      });

      const afterFinalization = new Date();
      const order = await Order.findById(testOrderId);
      
      expect(order?.finalizedAt).toBeDefined();
      expect(order?.finalizedAt!.getTime()).toBeGreaterThanOrEqual(beforeFinalization.getTime());
      expect(order?.finalizedAt!.getTime()).toBeLessThanOrEqual(afterFinalization.getTime());
    });

    it("should use default confirmedBy value", async () => {
      await finalizeOrderOnCapturedPayment({
        orderId: testOrderId.toString(),
      });

      const order = await Order.findById(testOrderId);
      expect(order?.paymentConfirmedBy).toBe("WEBHOOK");
    });

    it("should handle POLLING confirmation", async () => {
      await finalizeOrderOnCapturedPayment({
        orderId: testOrderId.toString(),
        confirmedBy: "POLLING",
      });

      const order = await Order.findById(testOrderId);
      expect(order?.paymentConfirmedBy).toBe("POLLING");
    });

    it("should handle RECONCILIATION confirmation", async () => {
      await finalizeOrderOnCapturedPayment({
        orderId: testOrderId.toString(),
        confirmedBy: "RECONCILIATION",
      });

      const order = await Order.findById(testOrderId);
      expect(order?.paymentConfirmedBy).toBe("RECONCILIATION");
    });
  });

  describe("Second finalization returns false", () => {
    it("should return false on second call (idempotent)", async () => {
      // First call
      const result1 = await finalizeOrderOnCapturedPayment({
        orderId: testOrderId.toString(),
        razorpayOrderId: "order_first",
        confirmedBy: "WEBHOOK",
      });
      expect(result1.updated).toBe(true);

      // Second call
      const result2 = await finalizeOrderOnCapturedPayment({
        orderId: testOrderId.toString(),
        razorpayOrderId: "order_second",
        confirmedBy: "POLLING",
      });
      expect(result2.updated).toBe(false);

      // Verify order still has first finalization data
      const order = await Order.findById(testOrderId);
      expect(order?.razorpayOrderId).toBe("order_first");
      expect(order?.paymentConfirmedBy).toBe("WEBHOOK");
    });

    it("should not modify order on second call", async () => {
      // First call
      await finalizeOrderOnCapturedPayment({
        orderId: testOrderId.toString(),
        razorpayOrderId: "order_123",
        razorpayPaymentId: "pay_123",
        confirmedBy: "WEBHOOK",
      });

      const orderAfterFirst = await Order.findById(testOrderId);
      const firstFinalizedAt = orderAfterFirst?.finalizedAt;

      // Wait a bit to ensure timestamp would be different
      await new Promise(resolve => setTimeout(resolve, 10));

      // Second call
      await finalizeOrderOnCapturedPayment({
        orderId: testOrderId.toString(),
        razorpayOrderId: "order_456",
        razorpayPaymentId: "pay_456",
        confirmedBy: "POLLING",
      });

      const orderAfterSecond = await Order.findById(testOrderId);
      
      // Verify nothing changed
      expect(orderAfterSecond?.razorpayOrderId).toBe("order_123");
      expect(orderAfterSecond?.razorpayPaymentId).toBe("pay_123");
      expect(orderAfterSecond?.paymentConfirmedBy).toBe("WEBHOOK");
      expect(orderAfterSecond?.finalizedAt?.getTime()).toBe(firstFinalizedAt?.getTime());
    });

    it("should handle multiple retry attempts", async () => {
      // First call succeeds
      const result1 = await finalizeOrderOnCapturedPayment({
        orderId: testOrderId.toString(),
        confirmedBy: "WEBHOOK",
      });
      expect(result1.updated).toBe(true);

      // Multiple retries all return false
      const results = await Promise.all([
        finalizeOrderOnCapturedPayment({
          orderId: testOrderId.toString(),
          confirmedBy: "POLLING",
        }),
        finalizeOrderOnCapturedPayment({
          orderId: testOrderId.toString(),
          confirmedBy: "RECONCILIATION",
        }),
        finalizeOrderOnCapturedPayment({
          orderId: testOrderId.toString(),
          confirmedBy: "WEBHOOK",
        }),
      ]);

      expect(results.every(r => r.updated === false)).toBe(true);
    });
  });

  describe("modifiedCount is checked correctly", () => {
    it("should detect when no documents were modified", async () => {
      // Finalize once
      await finalizeOrderOnCapturedPayment({
        orderId: testOrderId.toString(),
      });

      // Try to finalize again - should detect modifiedCount=0
      const result = await finalizeOrderOnCapturedPayment({
        orderId: testOrderId.toString(),
      });

      expect(result.updated).toBe(false);
    });

    it("should return true only when modifiedCount=1", async () => {
      const result = await finalizeOrderOnCapturedPayment({
        orderId: testOrderId.toString(),
      });

      expect(result.updated).toBe(true);
    });

    it("should handle invalid order ID gracefully", async () => {
      const result = await finalizeOrderOnCapturedPayment({
        orderId: new mongoose.Types.ObjectId().toString(),
      });

      expect(result.updated).toBe(false);
    });
  });

  describe("Concurrent finalizations (one succeeds)", () => {
    it("should handle concurrent finalization attempts", async () => {
      // Simulate concurrent calls from webhook and polling
      const results = await Promise.all([
        finalizeOrderOnCapturedPayment({
          orderId: testOrderId.toString(),
          razorpayOrderId: "order_webhook",
          confirmedBy: "WEBHOOK",
        }),
        finalizeOrderOnCapturedPayment({
          orderId: testOrderId.toString(),
          razorpayOrderId: "order_polling",
          confirmedBy: "POLLING",
        }),
        finalizeOrderOnCapturedPayment({
          orderId: testOrderId.toString(),
          razorpayOrderId: "order_reconciliation",
          confirmedBy: "RECONCILIATION",
        }),
      ]);

      // Exactly one should succeed
      const successCount = results.filter(r => r.updated).length;
      expect(successCount).toBe(1);

      // Verify order was finalized exactly once
      const order = await Order.findById(testOrderId);
      expect(order?.paymentStatus).toBe("PAID");
      expect(order?.finalizedAt).toBeDefined();
      
      // Winner's data should be saved
      const winner = results.find(r => r.updated);
      expect(winner).toBeDefined();
    });

    it("should handle high concurrency (10 workers)", async () => {
      const workers = Array.from({ length: 10 }, (_, i) =>
        finalizeOrderOnCapturedPayment({
          orderId: testOrderId.toString(),
          razorpayOrderId: `order_worker_${i}`,
          confirmedBy: "WEBHOOK",
        })
      );

      const results = await Promise.all(workers);

      // Exactly one should succeed
      const successCount = results.filter(r => r.updated).length;
      expect(successCount).toBe(1);

      // Verify order state
      const order = await Order.findById(testOrderId);
      expect(order?.paymentStatus).toBe("PAID");
      expect(order?.finalizedAt).toBeDefined();
    });

    it("should handle concurrent calls with different confirmation sources", async () => {
      const results = await Promise.all([
        finalizeOrderOnCapturedPayment({
          orderId: testOrderId.toString(),
          confirmedBy: "WEBHOOK",
        }),
        finalizeOrderOnCapturedPayment({
          orderId: testOrderId.toString(),
          confirmedBy: "WEBHOOK",
        }),
        finalizeOrderOnCapturedPayment({
          orderId: testOrderId.toString(),
          confirmedBy: "POLLING",
        }),
        finalizeOrderOnCapturedPayment({
          orderId: testOrderId.toString(),
          confirmedBy: "POLLING",
        }),
        finalizeOrderOnCapturedPayment({
          orderId: testOrderId.toString(),
          confirmedBy: "RECONCILIATION",
        }),
      ]);

      const successCount = results.filter(r => r.updated).length;
      expect(successCount).toBe(1);
    });

    it("should maintain data consistency under concurrent load", async () => {
      const razorpayOrderIds = Array.from({ length: 20 }, (_, i) => `order_${i}`);
      
      const results = await Promise.all(
        razorpayOrderIds.map(orderId =>
          finalizeOrderOnCapturedPayment({
            orderId: testOrderId.toString(),
            razorpayOrderId: orderId,
            confirmedBy: "WEBHOOK",
          })
        )
      );

      // Exactly one should succeed
      const successCount = results.filter(r => r.updated).length;
      expect(successCount).toBe(1);

      // Verify order has exactly one razorpayOrderId
      const order = await Order.findById(testOrderId);
      expect(order?.razorpayOrderId).toBeDefined();
      expect(razorpayOrderIds).toContain(order?.razorpayOrderId);
    });
  });

  describe("Transaction support", () => {
    it("should work with external session", async () => {
      const session = await mongoose.startSession();
      
      try {
        await session.withTransaction(async () => {
          const result = await finalizeOrderOnCapturedPayment({
            orderId: testOrderId.toString(),
            session,
          });
          
          expect(result.updated).toBe(true);
        });

        // Verify order was finalized
        const order = await Order.findById(testOrderId);
        expect(order?.paymentStatus).toBe("PAID");
        expect(order?.finalizedAt).toBeDefined();
      } finally {
        session.endSession();
      }
    });

    it("should rollback on transaction abort", async () => {
      const session = await mongoose.startSession();
      
      try {
        await session.withTransaction(async () => {
          await finalizeOrderOnCapturedPayment({
            orderId: testOrderId.toString(),
            session,
          });
          
          // Abort transaction
          throw new Error("Test abort");
        });
      } catch (error: any) {
        expect(error.message).toBe("Test abort");
      } finally {
        session.endSession();
      }

      // Verify order was NOT finalized
      const order = await Order.findById(testOrderId);
      expect(order?.paymentStatus).toBe("PENDING");
      expect(order?.finalizedAt).toBeUndefined();
    });
  });
});
