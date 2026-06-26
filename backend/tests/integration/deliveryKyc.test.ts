import request from "supertest";

import app from "../../src/app";
import { DeliveryBoy } from "../../src/models/DeliveryBoy";

// Mock Cloudinary so KYC uploads don't hit the network.
jest.mock("cloudinary", () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: (_opts: any, cb: any) => ({
        end: () =>
          cb(null, {
            secure_url: "https://res.cloudinary.com/test/kyc.jpg",
            public_id: "delivery/kyc/test/aadhaar_front",
          }),
      }),
    },
  },
}));

/**
 * Delivery Partner KYC — full end-to-end flow:
 *  status (NOT_STARTED) → upload all 4 docs → submit (PENDING) → admin review (VERIFIED)
 */
describe("Delivery Partner KYC", () => {
  const DOC_TYPES = ["aadhaar_front", "aadhaar_back", "pan_card", "selfie"];

  async function makeDriver(email: string) {
    const user = await (global as any).createTestUser({ email, role: "delivery", status: "active" });
    const token = await (global as any).getAuthToken(user);
    return { user, token };
  }

  it("returns NOT_STARTED for a fresh delivery partner", async () => {
    const { token } = await makeDriver("kyc-fresh@example.com");
    const res = await request(app)
      .get("/api/delivery/kyc/status")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("NOT_STARTED");
    expect(res.body.uploadedDocs).toEqual([]);
  });

  it("rejects submit until all required documents are uploaded", async () => {
    const { token } = await makeDriver("kyc-incomplete@example.com");

    // Upload only one doc.
    await request(app)
      .post("/api/delivery/kyc/upload")
      .set("Authorization", `Bearer ${token}`)
      .field("documentType", "aadhaar_front")
      .attach("document", Buffer.from("fake-image"), "aadhaar_front.jpg");

    const res = await request(app)
      .post("/api/delivery/kyc/submit")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.missing).toEqual(
      expect.arrayContaining(["aadhaar_back", "pan_card", "selfie"])
    );
  });

  it("completes the full flow: upload → submit → admin verify", async () => {
    const { user, token } = await makeDriver("kyc-full@example.com");

    for (const docType of DOC_TYPES) {
      const up = await request(app)
        .post("/api/delivery/kyc/upload")
        .set("Authorization", `Bearer ${token}`)
        .field("documentType", docType)
        .attach("document", Buffer.from("fake-image"), `${docType}.jpg`);
      expect(up.status).toBe(200);
      expect(up.body.success).toBe(true);
    }

    const submit = await request(app)
      .post("/api/delivery/kyc/submit")
      .set("Authorization", `Bearer ${token}`);
    expect(submit.status).toBe(200);
    expect(submit.body.status).toBe("PENDING");

    const driver = await DeliveryBoy.findOne({ userId: user._id }).lean();
    expect((driver as any)?.kyc?.status).toBe("PENDING");
    expect((driver as any)?.kyc?.documents?.length).toBe(4);

    // Admin verifies.
    const admin = await (global as any).createTestUser({ email: "kyc-admin@example.com", role: "admin" });
    const adminToken = await (global as any).getAuthToken(admin);

    // Admin can DISCOVER the pending KYC via the delivery-boys list.
    const listRes = await request(app)
      .get("/api/admin/delivery-boys-list")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    const entry = (listRes.body.deliveryBoys || []).find(
      (b: any) => String(b.deliveryBoy?._id) === String((driver as any)._id)
    );
    expect(entry).toBeTruthy();
    expect(entry.deliveryBoy.kyc.status).toBe("PENDING");
    expect(entry.deliveryBoy.kyc.documents.length).toBe(4);

    const review = await request(app)
      .post(`/api/admin/delivery-boys/${(driver as any)._id}/kyc/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ decision: "VERIFIED" });
    expect(review.status).toBe(200);
    expect(review.body.status).toBe("VERIFIED");

    const status = await request(app)
      .get("/api/delivery/kyc/status")
      .set("Authorization", `Bearer ${token}`);
    expect(status.body.status).toBe("VERIFIED");
  });

  it("admin can reject with a reason, and re-upload resets to NOT_STARTED", async () => {
    const { user, token } = await makeDriver("kyc-reject@example.com");

    for (const docType of DOC_TYPES) {
      await request(app)
        .post("/api/delivery/kyc/upload")
        .set("Authorization", `Bearer ${token}`)
        .field("documentType", docType)
        .attach("document", Buffer.from("fake-image"), `${docType}.jpg`);
    }
    await request(app).post("/api/delivery/kyc/submit").set("Authorization", `Bearer ${token}`);

    const driver = await DeliveryBoy.findOne({ userId: user._id }).lean();
    const admin = await (global as any).createTestUser({ email: "kyc-admin2@example.com", role: "admin" });
    const adminToken = await (global as any).getAuthToken(admin);

    // Reject requires a reason.
    const noReason = await request(app)
      .post(`/api/admin/delivery-boys/${(driver as any)._id}/kyc/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ decision: "REJECTED" });
    expect(noReason.status).toBe(400);

    const rejected = await request(app)
      .post(`/api/admin/delivery-boys/${(driver as any)._id}/kyc/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ decision: "REJECTED", rejectionReason: "Aadhaar blurry" });
    expect(rejected.status).toBe(200);

    const status = await request(app)
      .get("/api/delivery/kyc/status")
      .set("Authorization", `Bearer ${token}`);
    expect(status.body.status).toBe("REJECTED");
    expect(status.body.rejectionReason).toBe("Aadhaar blurry");

    // Re-upload resets to NOT_STARTED so the partner can resubmit.
    const reupload = await request(app)
      .post("/api/delivery/kyc/upload")
      .set("Authorization", `Bearer ${token}`)
      .field("documentType", "aadhaar_front")
      .attach("document", Buffer.from("fake-image-2"), "aadhaar_front.jpg");
    expect(reupload.status).toBe(200);

    const status2 = await request(app)
      .get("/api/delivery/kyc/status")
      .set("Authorization", `Bearer ${token}`);
    expect(status2.body.status).toBe("NOT_STARTED");
  });
});
