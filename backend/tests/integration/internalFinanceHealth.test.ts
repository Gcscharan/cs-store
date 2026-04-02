import request from "supertest";

import app from "../../src/app";

describe("Internal finance health (read-only)", () => {
  it("returns deterministic health output (snapshot)", async () => {
    const admin = await (global as any).createTestUser({ role: "admin", email: "finance-health-admin@example.com" });
    const token = await (global as any).getAuthToken(admin);

    const res = await request(app)
      .get("/api/internal/finance/health")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual({
      status: "OK",
      checks: [
        {
          name: "Refund exists without CAPTURE ledger",
          status: "OK",
          details: { pairs: 0, sample: [] },
        },
        {
          name: "Refund amount > captured amount",
          status: "OK",
          details: { pairs: 0, sample: [] },
        },
        {
          name: "Duplicate ledger entries (dedupeKey)",
          status: "OK",
          details: { duplicateGroups: 0, sample: [] },
        },
        {
          name: "Orphan ledger entries (no order/paymentIntent)",
          status: "OK",
          details: { entries: 0, sample: [] },
        },
        {
          name: "Refund marked COMPLETED but no ledger entry",
          status: "OK",
          details: { refunds: 0, sample: [] },
        },
        {
          name: "Ledger total ≠ Order.paymentStatus",
          status: "OK",
          details: { errors: 0, warnings: 0, sample: [] },
        },
      ],
    });
  });

  it("rejects non-admin users", async () => {
    const user = await (global as any).createTestUser({ role: "customer", email: "finance-health-user@example.com" });
    const token = await (global as any).getAuthToken(user);

    const res = await request(app)
      .get("/api/internal/finance/health")
      .set("Authorization", `Bearer ${token}`);

    expect([401, 403]).toContain(res.status);
  });
});
