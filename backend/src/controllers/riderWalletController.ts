import { logger } from "../utils/logger";
import { Response } from "express";
import mongoose from "mongoose";
import { RiderWallet } from "../models/RiderWallet";
import { WalletTransaction } from "../models/WalletTransaction";
import { SettlementHistory } from "../models/SettlementHistory";
import { DeliveryBoy } from "../models/DeliveryBoy";
import { riderWalletService } from "../services/riderWalletService";
import { AuthRequest } from "../middleware/auth";

// ─── Helper: resolve riderId from authenticated user ─────────────────────────
async function getRiderId(req: AuthRequest): Promise<mongoose.Types.ObjectId | null> {
  const user = req.user;
  if (!user) return null;
  const rider = await DeliveryBoy.findOne({ userId: (user as any)._id }).select("_id").lean();
  return rider ? (rider._id as mongoose.Types.ObjectId) : null;
}

/** GET /delivery/wallet */
export const getWallet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const riderId = await getRiderId(req);
    if (!riderId) { res.status(req.user ? 404 : 401).json({ error: req.user ? "Delivery profile not found" : "Unauthenticated" }); return; }

    const wallet = await riderWalletService.getOrCreateWallet(riderId);
    res.json({ success: true, wallet });
  } catch (err) {
    logger.error("[Wallet] getWallet:", err);
    res.status(500).json({ error: "Failed to fetch wallet" });
  }
};

/** GET /delivery/wallet/transactions */
export const getWalletTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const riderId = await getRiderId(req);
    if (!riderId) { res.status(req.user ? 404 : 401).json({ error: req.user ? "Delivery profile not found" : "Unauthenticated" }); return; }

    const limit = Math.min(100, Number(req.query.limit) || 50);
    const txns = await WalletTransaction.find({ riderId }).sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ success: true, transactions: txns });
  } catch (err) {
    logger.error("[Wallet] getWalletTransactions:", err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
};

/** POST /delivery/wallet/settle */
export const settleWallet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const riderId = await getRiderId(req);
    if (!riderId) { res.status(req.user ? 404 : 401).json({ error: req.user ? "Delivery profile not found" : "Unauthenticated" }); return; }

    const result = await riderWalletService.settleWallet(riderId);
    if (result.settled === 0) {
      res.json({ success: true, message: "No pending balance to settle", settled: 0 });
      return;
    }
    res.json({ success: true, message: `₹${result.settled} settled successfully`, settled: result.settled });
  } catch (err) {
    logger.error("[Wallet] settleWallet:", err);
    res.status(500).json({ error: "Failed to settle wallet" });
  }
};

/** GET /delivery/wallet/settlement-history */
export const getSettlementHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const riderId = await getRiderId(req);
    if (!riderId) { res.status(req.user ? 404 : 401).json({ error: req.user ? "Delivery profile not found" : "Unauthenticated" }); return; }

    const history = await riderWalletService.getSettlementHistory(riderId);
    res.json({ success: true, history });
  } catch (err) {
    logger.error("[Wallet] getSettlementHistory:", err);
    res.status(500).json({ error: "Failed to fetch settlement history" });
  }
};

/** GET /delivery/wallet/reconcile */
export const reconcileWallet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const riderId = await getRiderId(req);
    if (!riderId) { res.status(req.user ? 404 : 401).json({ error: req.user ? "Delivery profile not found" : "Unauthenticated" }); return; }

    const result = await riderWalletService.reconcileCod(riderId);
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error("[Wallet] reconcileWallet:", err);
    res.status(500).json({ error: "Failed to reconcile wallet" });
  }
};

/** POST /delivery/orders/:orderId/fail-attempt */
export const recordFailedAttempt = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const riderId = await getRiderId(req);
    if (!riderId) { res.status(req.user ? 404 : 401).json({ error: req.user ? "Delivery profile not found" : "Unauthenticated" }); return; }

    const { orderId } = req.params;
    const { reason, notes } = req.body;

    const { VALID_FAILURE_REASONS, deliveryFailureService } = await import("../services/deliveryFailureService");

    if (!reason || !VALID_FAILURE_REASONS.includes(reason)) {
      res.status(400).json({ error: `reason must be one of: ${VALID_FAILURE_REASONS.join(", ")}` });
      return;
    }

    const result = await deliveryFailureService.recordFailedAttempt(
      orderId,
      String(riderId),
      reason,
      notes
    );

    res.json({ success: true, ...result });
  } catch (err: any) {
    logger.error("[Failure] recordFailedAttempt:", err);
    res.status(500).json({ error: err.message || "Failed to record attempt" });
  }
};

/** GET /delivery/orders/active-route */
export const getActiveOrdersRoute = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const riderId = await getRiderId(req);
    if (!riderId) { res.status(req.user ? 404 : 401).json({ error: req.user ? "Delivery profile not found" : "Unauthenticated" }); return; }

    const { batchAssignmentService } = await import("../services/batchAssignmentService");
    const orders = await batchAssignmentService.getActiveOrdersSortedByNearest(String(riderId));
    res.json({ success: true, orders });
  } catch (err) {
    logger.error("[Batch] getActiveOrdersRoute:", err);
    res.status(500).json({ error: "Failed to fetch active orders" });
  }
};
