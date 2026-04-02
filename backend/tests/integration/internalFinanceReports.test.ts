import request from "supertest";

import app from "../../src/app";

describe("Internal finance reports (read-only)", () => {
  it("rejects non-admin users", async () => {
    const user = await (global as any).createTestUser({ role: "customer" });
    const token = await (global as any).getAuthToken(user);

    const res = await request(app)
      .get("/api/internal/finance/net-revenue")
      .query({
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-01-02T00:00:00.000Z",
        currency: "INR",
      })
      .set("Authorization", `Bearer ${token}`);

    expect([401, 403]).toContain(res.status);
  });

  it("requires from/to range", async () => {
    const admin = await (global as any).createTestUser({ role: "admin", email: "finance-admin@example.com" });
    const token = await (global as any).getAuthToken(admin);

    const res = await request(app)
      .get("/api/internal/finance/net-revenue")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it("returns stable CSV headers", async () => {
    const admin = await (global as any).createTestUser({ role: "admin", email: "finance-admin2@example.com" });
    const token = await (global as any).getAuthToken(admin);

    const res = await request(app)
      .get("/api/internal/finance/net-revenue.csv")
      .query({
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-01-02T00:00:00.000Z",
        currency: "INR",
      })
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(String(res.headers["content-type"] || "")).toContain("text/csv");

    const text = String(res.text || "");
    const firstLine = text.split("\n")[0];

    expect(firstLine).toBe(
      [
        "schema_version",
        "currency",
        "gross_revenue",
        "captured_revenue",
        "refunded_amount",
        "net_revenue",
        "refund_rate",
      ].join(",")
    );
  });
});
