/**
 * Integration tests for the admin KYC review flow.
 *
 * Covers the release-critical web-admin path:
 *  - GET admin delivery-boys list returns each partner's kyc block with documents
 *  - POST kyc/review transitions VERIFIED / REJECTED with validation
 *
 * Controllers are mounted directly behind a stub admin-auth middleware so the
 * tests exercise the real handler logic (the same logic the web admin UI calls).
 */

import express, { Application, Request, Response, NextFunction } from "express";
import request from "supertest";
import mongoose from "mongoose";

import { connect, clear, close } from "../../tests/setup";
import { DeliveryBoy } from "../../models/DeliveryBoy";
import { User } from "../../models/User";
import { reviewKyc } from "../../controllers/deliveryKycController";
import { getAdminDeliveryBoys } from "../../controllers/adminController";

const ADMIN_ID = new mongoose.Types.ObjectId();

const createTestApp = (): Application => {
  const app = express();
  app.use(express.json());

  // Stub admin authentication: the real routes use authenticateToken +
  // requireRole(["admin"]); here we inject the admin user the handlers read.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = { _id: ADMIN_ID, role: "admin" };
    (req as any).userId = ADMIN_ID;
    next();
  });

  app.get("/admin/delivery-boys-list", (req, res) => getAdminDeliveryBoys(req, res));
  app.post("/admin/delivery-boys/:deliveryBoyId/kyc/review", (req, res) =>
    reviewKyc(req, res)
  );

  return app;
};

const createPartnerWithPendingKyc = async () => {
  const user = await User.create({
    name: "Test Rider",
    email: `rider_${Date.now()}@example.com`,
    phone: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
    role: "delivery",
    status: "active",
  } as any);

  const deliveryBoy = await DeliveryBoy.create({
    name: user.name,
    phone: user.phone,
    email: user.email,
    userId: user._id,
    vehicleType: "bike",
    isActive: true,
    availability: "offline",
    currentLocation: { lat: 0, lng: 0, lastUpdatedAt: new Date() },
    earnings: 0,
    completedOrdersCount: 0,
    assignedOrders: [],
    kyc: {
      status: "PENDING",
      submittedAt: new Date(),
      documents: [
        {
          docType: "aadhaar_front",
          url: "https://res.cloudinary.com/demo/image/authenticated/aadhaar_front.jpg",
          publicId: `delivery/kyc/${user._id}/aadhaar_front`,
          uploadedAt: new Date(),
        },
        {
          docType: "pan_card",
          url: "https://res.cloudinary.com/demo/image/authenticated/pan_card.jpg",
          publicId: `delivery/kyc/${user._id}/pan_card`,
          uploadedAt: new Date(),
        },
      ],
    },
  } as any);

  return { user, deliveryBoy };
};

describe("Admin KYC review integration", () => {
  let app: Application;

  beforeAll(async () => {
    await connect();
    app = createTestApp();
  });

  beforeEach(async () => {
    await clear();
  });

  afterAll(async () => {
    await close();
  });

  it("returns the partner's KYC block with documents in the admin list", async () => {
    const { deliveryBoy } = await createPartnerWithPendingKyc();

    const res = await request(app).get("/admin/delivery-boys-list");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.deliveryBoys)).toBe(true);

    const entry = res.body.deliveryBoys.find(
      (b: any) => b.deliveryBoy._id === String(deliveryBoy._id)
    );
    expect(entry).toBeTruthy();
    expect(entry.deliveryBoy.kyc.status).toBe("PENDING");
    expect(entry.deliveryBoy.kyc.documents).toHaveLength(2);
    // A viewable URL must be returned for each document (signed or fallback).
    for (const doc of entry.deliveryBoy.kyc.documents) {
      expect(typeof doc.url).toBe("string");
      expect(doc.url.length).toBeGreaterThan(0);
      expect(doc.docType).toBeTruthy();
    }
  });

  it("verifies KYC when decision is VERIFIED", async () => {
    const { deliveryBoy } = await createPartnerWithPendingKyc();

    const res = await request(app)
      .post(`/admin/delivery-boys/${deliveryBoy._id}/kyc/review`)
      .send({ decision: "VERIFIED" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("VERIFIED");

    const updated = await DeliveryBoy.findById(deliveryBoy._id).lean();
    expect(updated?.kyc?.status).toBe("VERIFIED");
    expect(updated?.kyc?.reviewedAt).toBeTruthy();
  });

  it("rejects KYC with a reason and persists it", async () => {
    const { deliveryBoy } = await createPartnerWithPendingKyc();

    const res = await request(app)
      .post(`/admin/delivery-boys/${deliveryBoy._id}/kyc/review`)
      .send({ decision: "REJECTED", rejectionReason: "Aadhaar image is blurry" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("REJECTED");

    const updated = await DeliveryBoy.findById(deliveryBoy._id).lean();
    expect(updated?.kyc?.status).toBe("REJECTED");
    expect(updated?.kyc?.rejectionReason).toBe("Aadhaar image is blurry");
  });

  it("returns 400 when rejecting without a reason", async () => {
    const { deliveryBoy } = await createPartnerWithPendingKyc();

    const res = await request(app)
      .post(`/admin/delivery-boys/${deliveryBoy._id}/kyc/review`)
      .send({ decision: "REJECTED" });

    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid decision", async () => {
    const { deliveryBoy } = await createPartnerWithPendingKyc();

    const res = await request(app)
      .post(`/admin/delivery-boys/${deliveryBoy._id}/kyc/review`)
      .send({ decision: "MAYBE" });

    expect(res.status).toBe(400);
  });

  it("returns 404 when reviewing a non-existent partner", async () => {
    const res = await request(app)
      .post(`/admin/delivery-boys/${new mongoose.Types.ObjectId()}/kyc/review`)
      .send({ decision: "VERIFIED" });

    expect(res.status).toBe(404);
  });
});
