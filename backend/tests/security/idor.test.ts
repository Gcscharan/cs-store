import request from "supertest";
import app from "../../src/app";
import { generateValidAdminToken, generateValidCustomerToken, generateValidDeliveryToken } from "../helpers/tokenHelper";

describe("security: IDOR checks", () => {
  const customerToken = generateValidCustomerToken();
  const adminToken = generateValidAdminToken();
  const deliveryToken = generateValidDeliveryToken();

  const fakeOrderIdA = "507f1f77bcf86cd799439011";
  const fakeOrderIdB = "507f191e810c19729de860ea";

  it("customer token cannot access /api/admin/*", async () => {
    const res = await request(app)
      .get("/api/admin/orders")
      .set("Authorization", `Bearer ${customerToken}`);

    expect([403, 404]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });

  it("delivery token cannot access /api/admin/*", async () => {
    const res = await request(app)
      .get("/api/admin/orders")
      .set("Authorization", `Bearer ${deliveryToken}`);

    expect([403, 404]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });

  it("customer cannot read another user's order (403/404)", async () => {
    const res = await request(app)
      .get(`/api/orders/${fakeOrderIdB}`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect([403, 404, 400]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });

  it("admin can attempt to read any order without 500", async () => {
    const res = await request(app)
      .get(`/api/orders/${fakeOrderIdA}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect([200, 400, 401, 403, 404]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });

  it("30 IDOR smoke checks", async () => {
    for (let i = 0; i < 30; i++) {
      const res = await request(app)
        .get(`/api/orders/${i % 2 ? fakeOrderIdA : fakeOrderIdB}`)
        .set("Authorization", `Bearer ${customerToken}`);

      expect([403, 404, 400]).toContain(res.status);
      expect(res.status).not.toBe(500);
    }
  });
});
