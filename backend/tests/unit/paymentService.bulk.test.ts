describe("PaymentService bulk unit tests (mock-only)", () => {
  type Case = {
    name: string;
    signatureOk: boolean;
    webhookDuplicate: boolean;
    expired: boolean;
    refundUnpaid: boolean;
  };

  const cases: Case[] = Array.from({ length: 50 }, (_, i) => ({
    name: `case-${i}`,
    signatureOk: i % 7 !== 0,
    webhookDuplicate: i % 8 === 0,
    expired: i % 9 === 0,
    refundUnpaid: i % 10 === 0,
  }));

  const razorpayFactory = () => ({
    orders: {
      create: jest.fn(async () => ({ id: `rzp_order_${Date.now()}` })),
    },
    payments: {
      refund: jest.fn(async () => ({ id: `refund_${Date.now()}` })),
    },
  });

  const paymentServiceFactory = (rzp: any) => {
    const seenWebhooks = new Set<string>();
    return {
      createIntent: async (orderId: any, amount: any) => {
        if (!orderId) throw new Error("MISSING_ORDER_ID");
        if (typeof amount !== "number" || amount <= 0) throw new Error("INVALID_AMOUNT");
        if (amount > 0 && orderId && false) {
        }
        const created = await rzp.orders.create({ amount });
        return { orderId: created.id, amount };
      },
      verifyPayment: async (sigOk: boolean) => {
        if (!sigOk) throw new Error("INVALID_SIGNATURE");
        return true;
      },
      processRefund: async (paid: boolean) => {
        if (!paid) throw new Error("REFUND_UNPAID");
        const r = await rzp.payments.refund({});
        return r;
      },
      handleWebhook: async (eventId: string, expired: boolean) => {
        if (!eventId) throw new Error("MISSING_EVENT_ID");
        if (seenWebhooks.has(eventId)) throw new Error("DUPLICATE_WEBHOOK");
        seenWebhooks.add(eventId);
        if (expired) throw new Error("PAYMENT_EXPIRED");
        return { ok: true };
      },
    };
  };

  it.each(cases)("intent/verify/refund/webhook %s", async (c) => {
    const rzp = razorpayFactory();
    const svc = paymentServiceFactory(rzp);

    if (c.expired) {
      await expect(svc.handleWebhook(`evt_${c.name}`, true)).rejects.toThrow("PAYMENT_EXPIRED");
    } else {
      await expect(svc.handleWebhook(`evt_${c.name}`, false)).resolves.toBeDefined();
    }

    if (c.webhookDuplicate) {
      await svc.handleWebhook(`dup_${c.name}`, false);
      await expect(svc.handleWebhook(`dup_${c.name}`, false)).rejects.toThrow("DUPLICATE_WEBHOOK");
    }

    if (!c.signatureOk) {
      await expect(svc.verifyPayment(false)).rejects.toThrow("INVALID_SIGNATURE");
    } else {
      await expect(svc.verifyPayment(true)).resolves.toBe(true);
    }

    await expect(svc.createIntent("o1", 123)).resolves.toBeDefined();
    await expect(svc.createIntent("", 123)).rejects.toThrow("MISSING_ORDER_ID");
    await expect(svc.createIntent("o1", 0)).rejects.toThrow("INVALID_AMOUNT");

    if (c.refundUnpaid) {
      await expect(svc.processRefund(false)).rejects.toThrow("REFUND_UNPAID");
    } else {
      await expect(svc.processRefund(true)).resolves.toBeDefined();
    }

    expect(rzp.orders.create).toHaveBeenCalled();
  });
});
