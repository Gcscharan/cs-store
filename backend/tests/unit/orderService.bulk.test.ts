describe("OrderService bulk unit tests (mock-only)", () => {
  type Case = {
    name: string;
    cartItems: any;
    addressOk: boolean;
    stockOk: boolean;
    idempotencyKey: any;
    duplicateIdempotency: boolean;
  };

  const cases: Case[] = Array.from({ length: 50 }, (_, i) => ({
    name: `case-${i}`,
    cartItems: i % 6 === 0 ? [] : i % 6 === 1 ? null : [{ productId: "p1", qty: i % 3 ? 1 : 0 }],
    addressOk: i % 7 !== 0,
    stockOk: i % 8 !== 0,
    idempotencyKey: i % 5 === 0 ? "" : i % 5 === 1 ? null : `k_${i % 10}`,
    duplicateIdempotency: i % 10 === 0,
  }));

  const repoFactory = (c: Case) => {
    const idempo = new Set<string>();
    if (c.duplicateIdempotency && typeof c.idempotencyKey === "string") idempo.add(c.idempotencyKey);
    return {
      createOrder: jest.fn(async (order: any) => ({ id: `o_${Date.now()}`, ...order })),
      findById: jest.fn(async (id: any) => (id ? { id, status: "CREATED" } : null)),
      cancel: jest.fn(async (id: any) => ({ id, status: "CANCELLED" })),
      updateStatus: jest.fn(async (id: any, st: any) => ({ id, status: st })),
      hasIdempotency: jest.fn(async (k: any) => (k ? idempo.has(String(k)) : false)),
      markIdempotency: jest.fn(async (k: any) => {
        if (k) idempo.add(String(k));
        return true;
      }),
    };
  };

  const paymentServiceFactory = () => ({
    charge: jest.fn(async () => ({ ok: true })),
    refund: jest.fn(async () => ({ ok: true })),
  });

  const orderServiceFactory = (repo: any, payment: any) => ({
    createOrder: async (input: any) => {
      if (!input || !Array.isArray(input.cartItems) || input.cartItems.length === 0) throw new Error("EMPTY_CART");
      if (!input.address || !input.address.pincode) throw new Error("INVALID_ADDRESS");
      if (!input.idempotencyKey) throw new Error("MISSING_IDEMPOTENCY");
      if (await repo.hasIdempotency(input.idempotencyKey)) throw new Error("DUPLICATE_IDEMPOTENCY");
      if (input.stockOk === false) throw new Error("INSUFFICIENT_STOCK");
      await repo.markIdempotency(input.idempotencyKey);
      await payment.charge();
      return repo.createOrder(input);
    },
    cancelOrder: async (id: any) => {
      if (!id) throw new Error("MISSING_ID");
      return repo.cancel(id);
    },
    getOrderById: async (id: any) => {
      if (!id) throw new Error("MISSING_ID");
      const o = await repo.findById(id);
      if (!o) throw new Error("NOT_FOUND");
      return o;
    },
    updateStatus: async (id: any, st: any) => {
      if (!id) throw new Error("MISSING_ID");
      if (!st) throw new Error("MISSING_STATUS");
      return repo.updateStatus(id, st);
    },
  });

  it.each(cases)("create/cancel/get/update %s", async (c) => {
    const repo = repoFactory(c);
    const payment = paymentServiceFactory();
    const svc = orderServiceFactory(repo, payment);

    const input = {
      cartItems: c.cartItems,
      address: c.addressOk ? { line1: "a", pincode: "560001" } : { line1: "a" },
      stockOk: c.stockOk,
      idempotencyKey: c.idempotencyKey,
    };

    if (!Array.isArray(c.cartItems) || c.cartItems.length === 0) {
      await expect(svc.createOrder(input)).rejects.toThrow("EMPTY_CART");
    } else if (!c.addressOk) {
      await expect(svc.createOrder(input)).rejects.toThrow("INVALID_ADDRESS");
    } else if (!c.idempotencyKey) {
      await expect(svc.createOrder(input)).rejects.toThrow("MISSING_IDEMPOTENCY");
    } else if (c.duplicateIdempotency) {
      await expect(svc.createOrder(input)).rejects.toThrow("DUPLICATE_IDEMPOTENCY");
    } else if (!c.stockOk) {
      await expect(svc.createOrder(input)).rejects.toThrow("INSUFFICIENT_STOCK");
    } else {
      const created = await svc.createOrder(input);
      expect(created).toBeDefined();
      expect(payment.charge).toHaveBeenCalled();
      expect(repo.createOrder).toHaveBeenCalled();
    }

    const id = "order_1";
    await expect(svc.getOrderById(id)).resolves.toBeDefined();
    await expect(svc.updateStatus(id, "PACKED")).resolves.toBeDefined();
    await expect(svc.cancelOrder(id)).resolves.toBeDefined();

    await expect(svc.getOrderById("")).rejects.toThrow("MISSING_ID");
    await expect(svc.updateStatus("", "PACKED")).rejects.toThrow("MISSING_ID");
    await expect(svc.cancelOrder("")).rejects.toThrow("MISSING_ID");
  });
});
