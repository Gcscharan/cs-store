import request from "supertest";

import app from "../../src/app";
import { LedgerEntry } from "../../src/domains/payments/models/LedgerEntry";

/**
 * This test documents the current (intentional) exception:
 * - Razorpay: PAID derived from webhook + ledger
 * - UPI: can be marked PAID via operations endpoint without creating a ledger CAPTURE row
 */

describe("UPI payment status update is not ledger-backed (documented exception)", () => {
  it("PUT /api/orders/:orderId/payment-status marks UPI order paid but does not create a CAPTURE ledger entry", async () => {
    const user = await (global as any).createTestUser({ email: "upi-truth@example.com" });
    const token = await (global as any).getAuthToken(user);

    const order = await (global as any).createTestOrder(user, {
      paymentMethod: "upi",
      paymentStatus: "PENDING",
      orderStatus: "PENDING_PAYMENT",
      totalAmount: 100,
    });

    const beforeCount = await LedgerEntry.countDocuments({ orderId: order._id, eventType: "CAPTURE" });

    const res = await request(app)
      .put(`/api/orders/${String(order._id)}/payment-status`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(410);
    expect(String(res.body?.error || "")).toBe("LEGACY_PAYMENT_PATH_DISABLED");

    const afterCount = await LedgerEntry.countDocuments({ orderId: order._id, eventType: "CAPTURE" });
    expect(beforeCount).toBe(0);
    expect(afterCount).toBe(0);
  });
});
