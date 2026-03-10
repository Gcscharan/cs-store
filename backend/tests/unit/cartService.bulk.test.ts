import { CartService } from "../../src/domains/cart/services/CartService";

describe("CartService bulk unit tests", () => {
  const cases = Array.from({ length: 50 }, (_, i) => ({
    name: `case-${i}`,
    userId: i % 7 === 0 ? "" : i % 7 === 1 ? "undefined" : i % 7 === 2 ? "null" : `user_${i}`,
    repoHasCart: i % 5 !== 0,
    repoThrows: i % 11 === 0,
  }));

  it.each(cases)("getCart %s", async ({ userId, repoHasCart, repoThrows }) => {
    const svc: any = new CartService();
    svc.cartRepository = {
      findByUserIdWithPopulate: jest.fn(async () => {
        if (repoThrows) throw new Error("DB_ERROR");
        if (!repoHasCart) return null;
        return { items: [], total: 0, itemCount: 0 };
      }),
      save: jest.fn(async () => undefined),
    };
    svc.productRepository = { findById: jest.fn() };

    if (!userId || userId === "undefined" || userId === "null") {
      await expect(svc.getCart(userId)).rejects.toThrow();
      return;
    }
    if (repoThrows) {
      await expect(svc.getCart(userId)).rejects.toThrow("DB_ERROR");
      return;
    }
    const res = await svc.getCart(userId);
    expect(res).toBeDefined();
    expect(res.cart).toBeDefined();
    expect(Array.isArray(res.cart.items)).toBe(true);
    expect(typeof res.cart.totalAmount).toBe("number");
  });
});
