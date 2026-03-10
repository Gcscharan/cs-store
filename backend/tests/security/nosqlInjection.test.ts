import request from "supertest";
import app from "../../src/app";

describe("security: NoSQL injection payloads", () => {
  const payloads: any[] = [
    { $gt: "" },
    { $ne: null },
    { $where: "1==1" },
    { $regex: ".*" },
    { $exists: true },
    { $nin: [] },
    "'; DROP TABLE users; --",
    "<script>alert(1)</script>",
    "../../../etc/passwd",
    "null",
    "undefined",
    { $or: [{}, {}] },
    { $and: [{}, {}] },
  ];

  const attempts = Array.from({ length: 50 }, (_, i) => payloads[i % payloads.length]);

  it("login rejects injection attempts (never 500)", async () => {
    for (const p of attempts) {
      const res = await request(app)
        .post("/api/auth/login")
        .set("Content-Type", "application/json")
        .send({ email: p, password: p });

      expect([400, 401, 403, 404]).toContain(res.status);
      expect(res.status).not.toBe(500);
    }
  });
});
