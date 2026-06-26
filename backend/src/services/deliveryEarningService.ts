/**
 * Idempotent delivery earning creation.
 * Called once after OTP verification / delivery completion.
 * Unique index on (orderId, deliveryBoyId) prevents duplicates.
 */

import mongoose from "mongoose";
import { DeliveryEarning } from "../models/DeliveryEarning";
import { DeliveryBoy } from "../models/DeliveryBoy";
import { logger } from "../utils/logger";

export interface CreateEarningParams {
  deliveryBoyId: string;
  orderId: string;
  deliveryFee: number;
  tip?: number;
}

export interface EarningResult {
  earning: any;
  totalEarnings: number;
  alreadyExisted: boolean;
}

/**
 * Idempotently create a delivery earning for a completed order.
 * If an earning already exists for this (orderId, deliveryBoyId), returns the existing one.
 */
export async function createDeliveryEarning(
  params: CreateEarningParams
): Promise<EarningResult> {
  const { deliveryBoyId, orderId, deliveryFee, tip = 0 } = params;
  const amount = deliveryFee + tip;

  // Guard: no earning for zero-amount
  if (amount <= 0) {
    logger.warn("[DeliveryEarning] Skipping zero-amount earning", {
      orderId,
      deliveryBoyId,
      deliveryFee,
      tip,
    });
    const boy = await DeliveryBoy.findById(deliveryBoyId).select("earnings").lean();
    return {
      earning: null,
      totalEarnings: (boy as any)?.earnings ?? 0,
      alreadyExisted: false,
    };
  }

  try {
    const earning = await DeliveryEarning.create({
      deliveryBoyId: new mongoose.Types.ObjectId(deliveryBoyId),
      orderId: new mongoose.Types.ObjectId(orderId),
      amount,
      type: "DELIVERY_COMMISSION",
      status: "credited",
      creditedAt: new Date(),
      meta: { deliveryFee, tip },
    });

    // Increment earnings on DeliveryBoy document
    const updatedBoy = await DeliveryBoy.findByIdAndUpdate(
      deliveryBoyId,
      { $inc: { earnings: amount } },
      { new: true, select: "earnings" }
    );

    const totalEarnings = (updatedBoy as any)?.earnings ?? amount;

    logger.info("[DeliveryEarning] Created earning", {
      orderId,
      deliveryBoyId,
      amount,
      totalEarnings,
    });

    return { earning, totalEarnings, alreadyExisted: false };
  } catch (err: any) {
    // E11000 = duplicate key (idempotency protection)
    if (err?.code === 11000) {
      logger.info("[DeliveryEarning] Earning already exists (idempotent)", {
        orderId,
        deliveryBoyId,
      });

      const existing = await DeliveryEarning.findOne({
        orderId: new mongoose.Types.ObjectId(orderId),
        deliveryBoyId: new mongoose.Types.ObjectId(deliveryBoyId),
      }).lean();

      const boy = await DeliveryBoy.findById(deliveryBoyId).select("earnings").lean();
      return {
        earning: existing,
        totalEarnings: (boy as any)?.earnings ?? 0,
        alreadyExisted: true,
      };
    }

    // Real error — log and rethrow
    logger.error("[DeliveryEarning] Failed to create earning", {
      orderId,
      deliveryBoyId,
      error: err?.message,
    });
    throw err;
  }
}
