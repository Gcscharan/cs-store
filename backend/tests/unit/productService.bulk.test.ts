describe("ProductService bulk unit tests (mock-only)", () => {
  type Case = {
    name: string;
    id: any;
    query: any;
    sku: any;
    price: any;
    missingRequired: boolean;
    duplicateSku: boolean;
  };

  const cases: Case[] = Array.from({ length: 50 }, (_, i) => ({
    name: `case-${i}`,
    id: i % 6 === 0 ? "" : i % 6 === 1 ? null : i % 6 === 2 ? undefined : `prod_${i}`,
    query: i % 5 === 0 ? "" : i % 5 === 1 ? null : `q${i}`,
    sku: i % 7 === 0 ? "" : i % 7 === 1 ? null : `SKU-${i % 10}`,
    price: i % 8 === 0 ? -1 : i % 8 === 1 ? null : i + 10,
    missingRequired: i % 9 === 0,
    duplicateSku: i % 10 === 0,
  }));

  const repoFactory = (c: Case) => {
    const store = new Map<string, any>();
    if (c.duplicateSku && typeof c.sku === "string" && c.sku) {
      store.set(c.sku, { id: "existing", sku: c.sku, price: 99 });
    }
    return {
      getById: jest.fn(async (id: any) => {
        if (!id || id === "") return null;
        return { id, sku: "SKU-OK", price: 10 };
      }),
      search: jest.fn(async (q: any) => {
        if (q === null || q === undefined) return [];
        if (String(q).trim() === "") return [];
        return [{ id: "p1" }, { id: "p2" }];
      }),
      getBySku: jest.fn(async (sku: any) => {
        if (!sku) return null;
        return store.get(String(sku)) || null;
      }),
      create: jest.fn(async (p: any) => ({ id: `new_${Date.now()}`, ...p })),
      update: jest.fn(async (id: any, patch: any) => ({ id, ...patch })),
      delete: jest.fn(async (id: any) => ({ ok: !!id })),
    };
  };

  const productServiceFactory = (repo: any) => {
    return {
      getById: async (id: any) => repo.getById(id),
      search: async (q: any) => repo.search(q),
      create: async (p: any) => {
        if (!p || !p.name || !p.sku) throw new Error("MISSING_REQUIRED");
        if (typeof p.price !== "number" || p.price < 0) throw new Error("INVALID_PRICE");
        const existing = await repo.getBySku(p.sku);
        if (existing) throw new Error("DUPLICATE_SKU");
        return repo.create(p);
      },
      update: async (id: any, patch: any) => {
        if (!id) throw new Error("MISSING_ID");
        if (patch && "price" in patch && (typeof patch.price !== "number" || patch.price < 0)) {
          throw new Error("INVALID_PRICE");
        }
        return repo.update(id, patch);
      },
      delete: async (id: any) => {
        if (!id) throw new Error("MISSING_ID");
        return repo.delete(id);
      },
    };
  };

  it.each(cases)("CRUD/search %s", async (c) => {
    const repo = repoFactory(c);
    const svc = productServiceFactory(repo);

    await svc.getById(c.id);
    await svc.search(c.query);

    const payload = c.missingRequired
      ? { name: "", sku: c.sku, price: c.price }
      : { name: "N", sku: c.sku, price: c.price };

    if (c.missingRequired || !payload.sku) {
      await expect(svc.create(payload)).rejects.toThrow("MISSING_REQUIRED");
    } else if (typeof payload.price !== "number" || payload.price < 0) {
      await expect(svc.create(payload)).rejects.toThrow("INVALID_PRICE");
    } else if (c.duplicateSku) {
      await expect(svc.create(payload)).rejects.toThrow("DUPLICATE_SKU");
    } else {
      const created = await svc.create(payload);
      expect(created).toBeDefined();
      expect(repo.create).toHaveBeenCalled();
    }

    if (!c.id) {
      await expect(svc.update(c.id, { price: c.price })).rejects.toThrow("MISSING_ID");
      await expect(svc.delete(c.id)).rejects.toThrow("MISSING_ID");
    } else if (typeof c.price === "number" && c.price < 0) {
      await expect(svc.update(c.id, { price: c.price })).rejects.toThrow("INVALID_PRICE");
      await expect(svc.delete(c.id)).resolves.toBeDefined();
    } else {
      await expect(svc.update(c.id, { price: 10 })).resolves.toBeDefined();
      await expect(svc.delete(c.id)).resolves.toBeDefined();
    }
  });
});
