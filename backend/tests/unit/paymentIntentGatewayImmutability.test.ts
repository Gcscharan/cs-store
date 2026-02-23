import { PaymentIntent } from "../../src/domains/payments/models/PaymentIntent";

describe("PaymentIntent gateway immutability", () => {
  it("does not allow gateway to be mutated after creation", async () => {
    const user = await (global as any).createTestUser({ email: "pi-gateway-immut@example.com" });
    const order = await (global as any).createTestOrder(user, { paymentStatus: "PENDING", totalAmount: 100 });

    const pi = await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "pi_gateway_immut_1",
      gateway: "RAZORPAY",
      amount: 100,
      currency: "INR",
      status: "CREATED",
      expiresAt: new Date(Date.now() + 60 * 60_000),
      isLocked: false,
    });

    await PaymentIntent.updateOne({ _id: pi._id }, { $set: { gateway: "RAZORPAY" } });

    const reloaded = await PaymentIntent.findById(pi._id).lean();
    expect((reloaded as any)?.gateway).toBe("RAZORPAY");

    // Attempt to mutate gateway. Since gateway is immutable at schema level, the update should not change the value.
    await PaymentIntent.updateOne({ _id: pi._id }, { $set: { gateway: "SOME_OTHER_GATEWAY" } });

    const after = await PaymentIntent.findById(pi._id).lean();
    expect((after as any)?.gateway).toBe("RAZORPAY");
  });
});
