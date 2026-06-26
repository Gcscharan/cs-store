import { Request, Response } from "express";
import mongoose from "mongoose";
import { logger } from "../utils/logger";
import { SupportRequest, SupportRequesterRole } from "../models/SupportRequest";

function normalizeRole(role: any): SupportRequesterRole {
  const r = String(role || "").toLowerCase();
  if (r === "delivery" || r === "admin") return r;
  return "customer";
}

/**
 * POST /api/support/requests
 * Any authenticated user (customer or delivery partner) can raise a support
 * request. Persisted for the admin inbox and surfaced to ops via opsAlert.
 */
export const createSupportRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user?._id) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const category = String((req.body as any)?.category || "").trim();
    const message = String((req.body as any)?.message || "").trim();
    const subject = String((req.body as any)?.subject || "").trim() || undefined;
    const contactPhone = String((req.body as any)?.contactPhone || "").trim() || undefined;
    const orderIdRaw = String((req.body as any)?.orderId || "").trim();

    if (!category) {
      res.status(400).json({ error: "category is required" });
      return;
    }
    if (!message || message.length < 3) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    const doc = await SupportRequest.create({
      userId: user._id,
      role: normalizeRole(user.role),
      category,
      subject,
      message,
      contactPhone,
      orderId: orderIdRaw && mongoose.Types.ObjectId.isValid(orderIdRaw) ? new mongoose.Types.ObjectId(orderIdRaw) : undefined,
      status: "OPEN",
    });

    // Surface to ops/admin (reuses the existing alerting channel).
    logger.opsAlert("[SUPPORT][NEW] Support request raised", {
      supportRequestId: String(doc._id),
      userId: String(user._id),
      role: doc.role,
      category,
    });

    res.status(201).json({
      success: true,
      requestId: String(doc._id),
      status: doc.status,
    });
  } catch (error) {
    logger.error("Create support request error:", error);
    res.status(500).json({ error: "Failed to submit support request" });
  }
};

/**
 * GET /api/admin/support-requests?status=OPEN&page=1&limit=50
 * Admin inbox of support requests.
 */
export const listSupportRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const statusFilter = String(req.query.status || "").toUpperCase();

    const query: any = {};
    if (["OPEN", "IN_PROGRESS", "RESOLVED"].includes(statusFilter)) {
      query.status = statusFilter;
    }

    const [requests, total] = await Promise.all([
      SupportRequest.find(query)
        .populate("userId", "name phone email role")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SupportRequest.countDocuments(query),
    ]);

    res.json({
      requests,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error("List support requests error:", error);
    res.status(500).json({ error: "Failed to fetch support requests" });
  }
};

/**
 * POST /api/admin/support-requests/:id/resolve
 * Body: { status?: "IN_PROGRESS" | "RESOLVED", adminNote?: string }
 */
export const updateSupportRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const admin = (req as any).user;
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid request id" });
      return;
    }

    const status = String((req.body as any)?.status || "RESOLVED").toUpperCase();
    if (!["IN_PROGRESS", "RESOLVED"].includes(status)) {
      res.status(400).json({ error: "status must be IN_PROGRESS or RESOLVED" });
      return;
    }
    const adminNote = String((req.body as any)?.adminNote || "").trim() || undefined;

    const update: any = { status };
    if (adminNote) update.adminNote = adminNote;
    if (status === "RESOLVED") {
      update.resolvedAt = new Date();
      update.resolvedBy = admin?._id;
    }

    const doc = await SupportRequest.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!doc) {
      res.status(404).json({ error: "Support request not found" });
      return;
    }

    res.json({ success: true, status: (doc as any).status });
  } catch (error) {
    logger.error("Update support request error:", error);
    res.status(500).json({ error: "Failed to update support request" });
  }
};
