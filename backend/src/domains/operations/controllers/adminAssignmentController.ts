import { Request, Response } from "express";
import { assignOrderToAdmin } from "../services/adminAssignmentService";
import { logger } from "../../../utils/logger";

/**
 * Admin assignment controller
 * Provides HTTP endpoint for manual admin assignment (if needed)
 * Primary use case is event-driven via ORDER_CREATED events
 */

/**
 * POST /api/admin/orders/:orderId/assign-admin
 * Manually assign an order to admin system
 * Idempotent - safe to call multiple times
 */
export async function assignOrderToAdminController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { orderId } = req.params;
    const adminId = (req as any).user?._id?.toString();

    if (!orderId) {
      res.status(400).json({
        error: "MISSING_ORDER_ID",
        message: "Order ID is required",
      });
      return;
    }

    const result = await assignOrderToAdmin({
      orderId,
      adminId,
    });

    if (result.assigned) {
      res.status(200).json({
        success: true,
        message: "Order assigned to admin",
        orderId,
      });
    } else {
      // Already assigned - idempotent response
      res.status(200).json({
        success: true,
        message: "Order already assigned to admin",
        orderId,
        alreadyAssigned: true,
      });
    }
  } catch (error: any) {
    logger.error("[ADMIN][ASSIGNMENT_CONTROLLER] Error assigning order to admin", {
      error: error?.message,
      orderId: req.params.orderId,
    });

    res.status(500).json({
      error: "ASSIGNMENT_FAILED",
      message: "Failed to assign order to admin",
    });
  }
}
