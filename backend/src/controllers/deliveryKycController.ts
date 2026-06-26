import { logger } from "../utils/logger";
import { Request, Response } from "express";
import { v2 as cloudinary } from "cloudinary";
import { DeliveryBoy, KycDocType } from "../models/DeliveryBoy";
import { User } from "../models/User";

const VALID_DOC_TYPES: KycDocType[] = [
  "aadhaar_front",
  "aadhaar_back",
  "pan_card",
  "selfie",
];

const REQUIRED_DOCS: KycDocType[] = [
  "aadhaar_front",
  "aadhaar_back",
  "pan_card",
  "selfie",
];

/**
 * Resolve (and lazily create) the DeliveryBoy record for the authenticated user.
 * Mirrors the auto-create behaviour in getDeliveryProfile so KYC works for any
 * delivery user even before their first profile fetch.
 */
async function resolveDeliveryBoy(userId: string) {
  let deliveryBoy = await DeliveryBoy.findOne({ userId });
  if (!deliveryBoy) {
    const userDetails = await User.findById(userId);
    if (!userDetails) return null;
    deliveryBoy = new DeliveryBoy({
      name: userDetails.name,
      phone: userDetails.phone,
      email: userDetails.email,
      userId,
      vehicleType: (userDetails as any).deliveryProfile?.vehicleType || "bike",
      isActive: userDetails.status === "active",
      availability: "offline",
      currentLocation: { lat: 0, lng: 0, lastUpdatedAt: new Date() },
      earnings: 0,
      completedOrdersCount: 0,
      assignedOrders: [],
    });
    await deliveryBoy.save();
  }
  return deliveryBoy;
}

/**
 * GET /api/delivery/kyc/status
 * Returns the current KYC status, uploaded document types, and rejection reason.
 */
export const getKycStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const deliveryBoy = await resolveDeliveryBoy(String(user._id));
    if (!deliveryBoy) {
      res.status(404).json({ error: "Delivery profile not found" });
      return;
    }

    const kyc = deliveryBoy.kyc || { status: "NOT_STARTED", documents: [] };
    res.json({
      status: kyc.status || "NOT_STARTED",
      rejectionReason: kyc.rejectionReason || "",
      submittedAt: kyc.submittedAt || null,
      reviewedAt: kyc.reviewedAt || null,
      uploadedDocs: (kyc.documents || []).map((d) => d.docType),
    });
  } catch (error) {
    logger.error("Get KYC status error:", error);
    res.status(500).json({ error: "Failed to fetch KYC status" });
  }
};

/**
 * POST /api/delivery/kyc/upload  (multipart/form-data)
 * Fields: document (file), documentType (aadhaar_front|aadhaar_back|pan_card|selfie)
 * Uploads the document to Cloudinary and records it on the delivery profile.
 */
export const uploadKycDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const docType = String((req.body as any)?.documentType || "").trim() as KycDocType;
    if (!VALID_DOC_TYPES.includes(docType)) {
      res.status(400).json({ error: "Invalid documentType" });
      return;
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file || !file.buffer) {
      res.status(400).json({ error: "No document file provided" });
      return;
    }

    const deliveryBoy = await resolveDeliveryBoy(String(user._id));
    if (!deliveryBoy) {
      res.status(404).json({ error: "Delivery profile not found" });
      return;
    }

    // KYC docs contain PII — store privately, not in a public product folder.
    const result = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `delivery/kyc/${deliveryBoy._id}`,
          resource_type: "image",
          type: "authenticated",
          overwrite: true,
          public_id: docType,
        },
        (err, uploaded) => {
          if (err || !uploaded) return reject(err || new Error("Upload failed"));
          resolve(uploaded);
        }
      );
      stream.end(file.buffer);
    });

    if (!deliveryBoy.kyc) {
      deliveryBoy.kyc = { status: "NOT_STARTED", documents: [] } as any;
    }

    // Replace any existing doc of the same type (re-upload after rejection).
    const docs = (deliveryBoy.kyc!.documents || []).filter((d) => d.docType !== docType);
    docs.push({
      docType,
      url: result.secure_url,
      publicId: result.public_id,
      uploadedAt: new Date(),
    });
    deliveryBoy.kyc!.documents = docs;

    // Re-uploading after a rejection resets the flow back to NOT_STARTED until resubmit.
    if (deliveryBoy.kyc!.status === "REJECTED") {
      deliveryBoy.kyc!.status = "NOT_STARTED";
      deliveryBoy.kyc!.rejectionReason = "";
    }

    deliveryBoy.markModified("kyc");
    await deliveryBoy.save();

    logger.info(`📄 KYC document uploaded: ${docType} for delivery ${deliveryBoy._id}`);
    res.json({
      success: true,
      docType,
      uploadedDocs: deliveryBoy.kyc!.documents.map((d) => d.docType),
    });
  } catch (error) {
    logger.error("Upload KYC document error:", error);
    res.status(500).json({ error: "Failed to upload document" });
  }
};

/**
 * POST /api/delivery/kyc/submit
 * Transitions KYC to PENDING once all required documents are uploaded.
 */
export const submitKyc = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const deliveryBoy = await resolveDeliveryBoy(String(user._id));
    if (!deliveryBoy) {
      res.status(404).json({ error: "Delivery profile not found" });
      return;
    }

    if (!deliveryBoy.kyc) {
      deliveryBoy.kyc = { status: "NOT_STARTED", documents: [] } as any;
    }

    if (deliveryBoy.kyc!.status === "VERIFIED") {
      res.status(409).json({ error: "KYC already verified" });
      return;
    }

    const uploaded = new Set((deliveryBoy.kyc!.documents || []).map((d) => d.docType));
    const missing = REQUIRED_DOCS.filter((d) => !uploaded.has(d));
    if (missing.length > 0) {
      res.status(400).json({ error: "Missing required documents", missing });
      return;
    }

    deliveryBoy.kyc!.status = "PENDING";
    deliveryBoy.kyc!.submittedAt = new Date();
    deliveryBoy.kyc!.rejectionReason = "";
    deliveryBoy.markModified("kyc");
    await deliveryBoy.save();

    logger.info(`📝 KYC submitted for review: delivery ${deliveryBoy._id}`);
    res.json({ success: true, status: "PENDING" });
  } catch (error) {
    logger.error("Submit KYC error:", error);
    res.status(500).json({ error: "Failed to submit KYC" });
  }
};

/**
 * POST /api/admin/delivery/:deliveryBoyId/kyc/review   (admin)
 * Body: { decision: "VERIFIED" | "REJECTED", rejectionReason?: string }
 */
export const reviewKyc = async (req: Request, res: Response): Promise<void> => {
  try {
    const admin = (req as any).user;
    const { deliveryBoyId } = req.params;
    const decision = String((req.body as any)?.decision || "").toUpperCase();
    const rejectionReason = String((req.body as any)?.rejectionReason || "").trim();

    if (decision !== "VERIFIED" && decision !== "REJECTED") {
      res.status(400).json({ error: "decision must be VERIFIED or REJECTED" });
      return;
    }
    if (decision === "REJECTED" && !rejectionReason) {
      res.status(400).json({ error: "rejectionReason is required when rejecting" });
      return;
    }

    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!deliveryBoy) {
      res.status(404).json({ error: "Delivery profile not found" });
      return;
    }

    if (!deliveryBoy.kyc) {
      deliveryBoy.kyc = { status: "NOT_STARTED", documents: [] } as any;
    }

    deliveryBoy.kyc!.status = decision as any;
    deliveryBoy.kyc!.reviewedAt = new Date();
    deliveryBoy.kyc!.reviewedBy = admin?._id;
    deliveryBoy.kyc!.rejectionReason = decision === "REJECTED" ? rejectionReason : "";
    deliveryBoy.markModified("kyc");
    await deliveryBoy.save();

    logger.info(`✅ KYC ${decision} for delivery ${deliveryBoy._id} by admin ${admin?._id}`);
    res.json({ success: true, status: deliveryBoy.kyc!.status });
  } catch (error) {
    logger.error("Review KYC error:", error);
    res.status(500).json({ error: "Failed to review KYC" });
  }
};
