import request from "supertest";
import app from "../../src/app";
import { generateValidCustomerToken } from "../helpers/tokenHelper";

describe("security: IDOR checks", () => {
  const customerToken = generateValidCustomerToken();

  const idorChecks = Array.from({ length: 30 }, (_, i) => ({
    name: `customer-admin-check-${i}`,
    path: i % 2 === 0 ? "/api/admin/orders" : "/api/admin/users",
  }));

  it.each(idorChecks)("%s customer cannot access admin resources", async ({ path }) => {
    const res = await request(app).get(path).set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });
});
