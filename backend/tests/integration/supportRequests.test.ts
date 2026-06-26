import request from "supertest";

import app from "../../src/app";
import { SupportRequest } from "../../src/models/SupportRequest";

/**
 * Support request feature: a delivery partner (or customer) raises a help
 * request; it persists and appears in the admin inbox; admin can resolve it.
 */
describe("Support requests", () => {
  it("delivery partner raises a request → persists → admin lists → admin resolves", async () => {
    const driver = await (global as any).createTestUser({ email: "support-driver@example.com", role: "delivery", status: "active" });
    const driverToken = await (global as any).getAuthToken(driver);

    const createRes = await request(app)
      .post("/api/support/requests")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ category: "order-earning", subject: "Order Earning Issue", message: "My earning for order #123 is missing." });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.status).toBe("OPEN");
    const requestId = String(createRes.body.requestId);

    // Persisted with the requester's role + category.
    const persisted = await SupportRequest.findById(requestId).lean();
    expect(persisted).toBeTruthy();
    expect((persisted as any).role).toBe("delivery");
    expect((persisted as any).category).toBe("order-earning");
    expect((persisted as any).status).toBe("OPEN");

    // Admin sees it in the inbox.
    const admin = await (global as any).createTestUser({ email: "support-admin@example.com", role: "admin" });
    const adminToken = await (global as any).getAuthToken(admin);

    const listRes = await request(app)
      .get("/api/admin/support-requests?status=OPEN")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    const found = (listRes.body.requests || []).find((r: any) => String(r._id) === requestId);
    expect(found).toBeTruthy();
    expect(found.message).toContain("earning");

    // Admin resolves it.
    const resolveRes = await request(app)
      .post(`/api/admin/support-requests/${requestId}/resolve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "RESOLVED", adminNote: "Earning credited manually." });
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.status).toBe("RESOLVED");

    const after = await SupportRequest.findById(requestId).lean();
    expect((after as any).status).toBe("RESOLVED");
    expect((after as any).resolvedAt).toBeTruthy();
    expect((after as any).adminNote).toBe("Earning credited manually.");
  });

  it("rejects an empty request and requires authentication", async () => {
    const user = await (global as any).createTestUser({ email: "support-empty@example.com", role: "delivery", status: "active" });
    const token = await (global as any).getAuthToken(user);

    const noCategory = await request(app)
      .post("/api/support/requests")
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "hi" });
    expect(noCategory.status).toBe(400);

    const unauth = await request(app)
      .post("/api/support/requests")
      .send({ category: "x", message: "hello there" });
    expect([401, 403]).toContain(unauth.status);
  });

  it("non-admin cannot read the support inbox", async () => {
    const driver = await (global as any).createTestUser({ email: "support-noadmin@example.com", role: "delivery", status: "active" });
    const token = await (global as any).getAuthToken(driver);

    const res = await request(app)
      .get("/api/admin/support-requests")
      .set("Authorization", `Bearer ${token}`);
    expect([401, 403]).toContain(res.status);
  });
});
