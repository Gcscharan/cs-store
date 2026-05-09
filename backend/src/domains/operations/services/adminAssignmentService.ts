import mongoose from "mongoose";
import { Order } from "../../../models/Order";
import { logger } from "../../../utils/logger";
import { paymentMetricsService } from "../../payments/services/paymentMetricsService";

/**
 * Idempotent admin assignment service
 * Uses atomic findOneAndUpdate to prevent duplicate assignments
 * when ORDER_CREATED events are processed multiple times
 */

export interface AssignOrderToAdminParams {
  orderId: string;
  adminId?: string;
}

export interface AssignOrderToAdminResult {
  assigned: boolean;
}

/**
 * Atomically assign an order to admin
 * Only succeeds if order has not been assigned yet (adminAssigned !== true)
 * 
 * @param params - Order ID and optional admin ID
 * @returns { assigned: true } if this call won the race, { assigned: false } if already assigned
 */
export async function assignOrderToAdmin(
  params: AssignOrderToAdminParams
): Promise<AssignOrderToAdminResult> {
  const { orderId, adminId } = params;

  // Validate orderId
  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
    logger.warn("[ADMIN][ASSIGNMENT] Invalid orderId", { orderId });
    return { assigned: false };
  }

  // Track admin assignment attempt (Task 8.2)
  paymentMetricsService.trackAdminAssignmentAttempt({
    orderId,
    adminId,
  });

  // ATOMIC OPERATION: Only assign if not already assigned
  // Uses findOneAndUpdate with adminAssigned: { $ne: true } filter
  const result = await Order.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(orderId),
      adminAssigned: { $ne: true }, // Atomic guard - only update if not already assigned
    },
    {
      $set: {
        adminAssigned: true,
        adminAssignedAt: new Date(),
        adminAssignedBy: adminId || "system",
      },
    },
    { new: false } // Return old document to check if we won the race
  );

  if (!result) {
    // Order already assigned by another worker OR order doesn't exist
    logger.info("[ADMIN][ASSIGNMENT_GUARD] Order already assigned or not found", {
      orderId,
    });
    
    // Track admin assignment conflict (Task 8.2)
    paymentMetricsService.trackAdminAssignmentConflict({
      orderId,
      adminId,
    });
    
    return { assigned: false };
  }

  // Success - we won the race
  logger.info("[ADMIN][ASSIGNED] Order assigned to admin", {
    orderId,
    adminId: adminId || "system",
    assignedAt: new Date().toISOString(),
  });

  return { assigned: true };
}
