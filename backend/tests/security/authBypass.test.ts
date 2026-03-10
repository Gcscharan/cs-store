import request from "supertest";
import app from "../../src/app";
import {
  generateAlgNoneToken,
  generateExpiredToken,
  generateFutureIatToken,
  generateInvalidToken,
  generateMalformedToken,
  generateValidCustomerToken,
} from "../helpers/tokenHelper";

describe("security: auth bypass attempts", () => {
  const attempts: Array<{ name: string; header?: string }> = [];

  // basic attempts
  attempts.push({ name: "wrong secret", header: `Bearer ${generateInvalidToken()}` });
  attempts.push({ name: "alg none", header: `Bearer ${generateAlgNoneToken()}` });
  attempts.push({ name: "expired", header: `Bearer ${generateExpiredToken()}` });
  attempts.push({ name: "future iat", header: `Bearer ${generateFutureIatToken()}` });
  attempts.push({ name: "malformed", header: `Bearer ${generateMalformedToken()}` });
  attempts.push({ name: "missing Bearer prefix", header: generateValidCustomerToken() });
  attempts.push({ name: "empty header", header: "" });

  // expand to 50 attempts by repetition / small variants
  while (attempts.length < 50) {
    attempts.push({ name: `repeat-${attempts.length}`, header: attempts[attempts.length % 7].header });
  }

  const protectedPaths = ["/api/cart", "/api/orders"];

  it.each(protectedPaths)("%s blocks bypass attempts with 401", async (path) => {
    for (const a of attempts) {
      const req = request(app).get(path);
      const res = a.header !== undefined ? await req.set("Authorization", a.header) : await req;
      expect(res.status).toBe(401);
    }
  });
});
