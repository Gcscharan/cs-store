/**
 * Reachability regression test: the product reviews router must be mounted in
 * the real app. It was previously mounted only inside reviewsAPI.test.ts, so the
 * entire reviews API (build + service + model) was unreachable in production —
 * an orphan subsystem behind mock/fake-success UI.
 *
 * This proves GET /api/products/:productId/reviews resolves through createApp
 * (200 with reviews + stats), i.e. the route is no longer orphaned.
 */

import request from "supertest";
import mongoose from "mongoose";
import { createApp } from "../../createApp";
import type { Application } from "express";

describe("Reviews API reachability (mounted in createApp)", () => {
  let app: Application;

  beforeAll(() => {
    app = createApp({ enableQueues: false, enableRedis: false } as any);
  });

  it("GET /api/products/:productId/reviews resolves (not 404 orphan)", async () => {
    const productId = new mongoose.Types.ObjectId().toString();
    const res = await request(app).get(`/api/products/${productId}/reviews`);

    // Must NOT be a 404 "route not found" — the router is mounted.
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data).toHaveProperty("reviews");
    expect(res.body?.data).toHaveProperty("stats");
    expect(Array.isArray(res.body.data.reviews)).toBe(true);
  });

  it("POST /api/products/:productId/reviews requires authentication (not orphaned)", async () => {
    const productId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .send({ rating: 5, comment: "Great" });

    // 401 (auth required) proves the route is mounted + guarded — not a 404 orphan.
    expect(res.status).toBe(401);
  });
});
