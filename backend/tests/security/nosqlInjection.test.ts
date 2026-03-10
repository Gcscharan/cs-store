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
    { $expr: { $gt: ["$role", ""] } },
    { $not: { $eq: "" } },
    { $in: [""] },
    { $all: [""] },
    { $size: 0 },
    { $type: "string" },
    { $gt: 0 },
    { $lte: 0 },
    { $comment: "injection" },
    { $where: "return true" },
    { "__proto__": { polluted: true } },
    { constructor: { prototype: { polluted: true } } },
  ];

  const attempts = Array.from({ length: 60 }, (_, i) => payloads[i % payloads.length]);

  it.each(attempts)("login rejects injection payload %p (never 500)", async (p) => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send({ email: p, password: p });

    expect([400, 401]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });
});
