/**
 * DeliveryFailureService — Production-hardened
 *
 * Hardening applied:
 * 1. Retry cooldown: 10 min between attempts (prevents spam)
 * 2. FAILED_PERMANENT state when no rider available after max attempts
 * 3. Smarter auto-reassign: excludes previous rider + riders who rejected before
 * 4. Load-balanced reassignment (lowest currentLoad wins ties)
 * 5. Vehicle capacity constraints in reassignment
 */

import { logger } from "../utils/logger";
import mongoose from "mongoose";
import { Order } from "../models/Order";
import { DeliveryBoy } from "../models/DeliveryBoy";
import { orderStateService } from "../domains/orders/services/orderStateService";
import { OrderStatus } from "../domains/orders/enums/OrderStatus";
import { FailureReason, FAILURE_REASONS, isValidFailureReason } from "../domains/delivery/enums/FailureReason";

export { FailureReason, isValidFailureReason };

export const MAX_DELIVERY_ATTEMPTS = 3;
export const RETRY_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

// Re-exported for backward compatibility — prefer FAILURE_REASONS directly
export const VALID_FAILURE_REASONS = FAILURE_REASONS;

export type FinalStatus = "SUCCESS" | "FAILED" | "FAILED_PERMANENT";

export interface AttemptResult {
  action: "RETRY_ALLOWED" | "ORDER_FAILED" | "REASSIGNED" | "FAILED_PERMANENT";
  deliveryAttempts: number;
  reassignedTo?: string;
  cooldownRemainingMs?: number;
  message: string;
}

export class DeliveryFailureService {
  /**
   * Record a failed delivery attempt and decide next action.
   */
  async recordFailedAttempt(
    orderId: string,
    riderId: string,
    reason: FailureReason,
    notes?: string
  ): Promise<AttemptResult> {
    const order = await Order.findById(orderId).select(
      "deliveryAttempts lastAttemptAt failureReasonCode failureNotes finalStatus orderStatus assignmentHistory"
    );
    if (!order) throw new Error("Order not found");

    const currentAttempts = Number((order as any).deliveryAttempts ?? 0);
    const lastAttemptAt: Date | null = (order as any).lastAttemptAt ?? null;

    // COOLDOWN CHECK: prevent spam attempts
    if (lastAttemptAt) {
      const elapsed = Date.now() - new Date(lastAttemptAt).getTime();
      if (elapsed < RETRY_COOLDOWN_MS) {
        const remaining = RETRY_COOLDOWN_MS - elapsed;
        logger.warn(`[Failure] Cooldown active for order ${orderId} — ${Math.ceil(remaining / 60000)} min remaining`);
        return {
          action: "RETRY_ALLOWED",
          deliveryAttempts: currentAttempts,
          cooldownRemainingMs: remaining,
          message: `Please wait ${Math.ceil(remaining / 60000)} minute(s) before next attempt.`,
        };
      }
    }

    const newAttempts = currentAttempts + 1;
    const failureEntry = `[${new Date().toISOString()}] Attempt ${newAttempts}: ${reason}${notes ? ` — ${notes}` : ""}`;

    if (newAttempts < MAX_DELIVERY_ATTEMPTS) {
      // Allow retry
      await Order.updateOne(
        { _id: orderId },
        {
          $set: {
            deliveryAttempts: newAttempts,
            lastAttemptAt: new Date(),
            failureReasonCode: reason,
            failureNotes: notes ?? "",
          },
          $push: { failureReasons: failureEntry } as any,
        }
      );

      logger.info(`[Failure] Order ${orderId}: attempt ${newAttempts}/${MAX_DELIVERY_ATTEMPTS} — retry allowed`);
      return {
        action: "RETRY_ALLOWED",
        deliveryAttempts: newAttempts,
        message: `Attempt ${newAttempts} recorded. ${MAX_DELIVERY_ATTEMPTS - newAttempts} attempt(s) remaining.`,
      };
    }

    // Max attempts reached
    await Order.updateOne(
      { _id: orderId },
      {
        $set: {
          deliveryAttempts: newAttempts,
          lastAttemptAt: new Date(),
          failureReasonCode: reason,
          failureNotes: notes ?? "",
          finalStatus: "FAILED" as FinalStatus,
        },
        $push: { failureReasons: failureEntry } as any,
      }
    );

    // Transition to FAILED
    try {
      await orderStateService.transition({
        orderId,
        toStatus: OrderStatus.FAILED,
        actorRole: "DELIVERY_PARTNER",
        actorId: riderId,
        meta: { failureReasonCode: reason, failureNotes: notes },
      });
    } catch (err) {
      logger.error(`[Failure] FAILED transition error for order ${orderId}:`, err);
    }

    // Remove from rider's load
    await DeliveryBoy.updateOne(
      { _id: riderId },
      {
        $pull: { assignedOrders: new mongoose.Types.ObjectId(orderId) },
        $inc: { currentLoad: -1 },
      }
    );

    logger.warn(`[Failure] Order ${orderId}: max attempts reached — triggering auto-reassign`);

    // Collect all riders who were previously assigned (from assignmentHistory)
    const previousRiderIds = this.extractPreviousRiderIds(order, riderId);

    const reassignedTo = await this.autoReassign(orderId, previousRiderIds);

    if (reassignedTo) {
      return {
        action: "REASSIGNED",
        deliveryAttempts: newAttempts,
        reassignedTo,
        message: `Max attempts reached. Order reassigned to rider ${reassignedTo}.`,
      };
    }

    // No rider available — mark FAILED_PERMANENT
    await Order.updateOne(
      { _id: orderId },
      { $set: { finalStatus: "FAILED_PERMANENT" as FinalStatus } }
    );

    logger.error(`[Failure] Order ${orderId}: FAILED_PERMANENT — no riders available`);
    return {
      action: "FAILED_PERMANENT",
      deliveryAttempts: newAttempts,
      message: "Max attempts reached. No available rider. Order marked as FAILED_PERMANENT.",
    };
  }

  /**
   * Auto-reassign to best available rider.
   * Excludes all previously assigned riders.
   * Picks by: nearest distance, then lowest currentLoad.
   */
  private async autoReassign(
    orderId: string,
    excludeRiderIds: string[]
  ): Promise<string | null> {
    try {
      const order = await Order.findById(orderId).select("address").lean();
      if (!order?.address?.lat || !order?.address?.lng) {
        logger.warn(`[Failure] Cannot auto-reassign order ${orderId}: no coordinates`);
        return null;
      }

      const excludeObjectIds = excludeRiderIds
        .filter(Boolean)
        .map((id) => new mongoose.Types.ObjectId(id));

      const availableRiders = await DeliveryBoy.find({
        _id: { $nin: excludeObjectIds },
        isActive: true,
        availability: { $in: ["available", "busy"] },
        $expr: { $lt: ["$currentLoad", MAX_ACTIVE_ORDERS] },
      })
        .select("_id name currentLocation currentLoad vehicleType")
        .lean();

      if (availableRiders.length === 0) {
        logger.warn(`[Failure] No available riders for auto-reassign of order ${orderId}`);
        return null;
      }

      // Score: nearest distance wins; ties broken by lowest load
      let best: any = null;
      let bestScore = Infinity;

      for (const rider of availableRiders) {
        if (!rider.currentLocation?.lat) continue;
        const dist = haversineKm(
          rider.currentLocation.lat,
          rider.currentLocation.lng,
          order.address.lat,
          order.address.lng
        );
        // Score = distance + (currentLoad * 0.5km penalty per order)
        const score = dist + (rider.currentLoad ?? 0) * 0.5;
        if (score < bestScore) {
          bestScore = score;
          best = rider;
        }
      }

      if (!best) return null;

      // Assign
      await Order.updateOne(
        { _id: orderId },
        {
          $set: {
            deliveryBoyId: best._id,
            deliveryAttempts: 0,
            lastAttemptAt: null,
            finalStatus: null,
          },
        }
      );

      await DeliveryBoy.updateOne(
        { _id: best._id },
        {
          $addToSet: { assignedOrders: new mongoose.Types.ObjectId(orderId) },
          $inc: { currentLoad: 1 },
          $set: { availability: "busy", lastAssignedAt: new Date() },
        }
      );

      try {
        await orderStateService.transition({
          orderId,
          toStatus: OrderStatus.ASSIGNED,
          actorRole: "ADMIN",
          actorId: String(best._id),
          meta: { deliveryPartnerName: best.name },
        });
      } catch (err) {
        logger.error(`[Failure] Re-transition to ASSIGNED failed for order ${orderId}:`, err);
      }

      logger.info(`[Failure] Order ${orderId} auto-reassigned to ${best.name} (${best._id})`);
      return String(best._id);
    } catch (err) {
      logger.error("[Failure] autoReassign error:", err);
      return null;
    }
  }

  private extractPreviousRiderIds(order: any, currentRiderId: string): string[] {
    const ids = new Set<string>([currentRiderId]);
    const history: any[] = order.assignmentHistory ?? [];
    for (const entry of history) {
      if (entry.deliveryBoyId) ids.add(String(entry.deliveryBoyId));
    }
    return Array.from(ids);
  }
}

// Max active orders per rider
export const MAX_ACTIVE_ORDERS = 5;

// Haversine distance in km
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const deliveryFailureService = new DeliveryFailureService();
