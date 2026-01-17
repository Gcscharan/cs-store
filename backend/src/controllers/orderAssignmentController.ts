import { Request, Response } from "express";
import mongoose from "mongoose";
import { Order } from "../models/Order";
import { DeliveryBoy } from "../models/DeliveryBoy";
import { User } from "../models/User";
import { orderStateService } from "../domains/orders/services/orderStateService";
import { OrderStatus } from "../domains/orders/enums/OrderStatus";
import { smartAssignmentService } from "../services/smartAssignmentService";
import { incCounter } from "../ops/opsMetrics";

let transactionsSupported: boolean | null = null;

export async function assignPackedOrderToDeliveryBoy(params: {
  orderId: string;
  deliveryBoyId: string;
  actorId: string;
  allowReassign?: boolean;
  session?: mongoose.ClientSession;
}): Promise<any> {
  const { orderId, deliveryBoyId, actorId, allowReassign } = params;

  const isTxnUnsupportedError = (err: any): boolean => {
    const msg = String(err?.message || "");
    return (
      msg.includes("Transaction numbers are only allowed") ||
      msg.includes("not supported") ||
      msg.includes("replica set")
    );
  };

  const assignedDeliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
  if (!assignedDeliveryBoy) {
    const err: any = new Error("Delivery boy not found");
    err.statusCode = 404;
    throw err;
  }

  if (!assignedDeliveryBoy.userId) {
    const err: any = new Error("Delivery partner is not linked to an approved user");
    err.statusCode = 400;
    throw err;
  }

  const deliveryUser = await User.findById(assignedDeliveryBoy.userId).select("role status");
  if (!deliveryUser || deliveryUser.role !== "delivery" || deliveryUser.status !== "active") {
    const err: any = new Error("Delivery partner is not approved");
    err.statusCode = 400;
    throw err;
  }

  if (!assignedDeliveryBoy.isActive) {
    const err: any = new Error("Delivery boy is not active");
    err.statusCode = 400;
    throw err;
  }

  const session = params.session || (await mongoose.startSession());
  const ownsSession = !params.session;
  let transitionedOrder: any = null;
  try {
    const run = async () => {
      const existing = await Order.findById(orderId)
        .select("orderStatus deliveryBoyId deliveryPartnerId")
        .session(session);
      if (!existing) {
        const err: any = new Error("Order not found");
        err.statusCode = 404;
        throw err;
      }

      const existingStatusUpper = String((existing as any).orderStatus || "").toUpperCase();
      const existingAssignee = (existing as any).deliveryBoyId
        ? String((existing as any).deliveryBoyId)
        : "";

      // Idempotent retry: if already assigned to same delivery boy, return without mutating load.
      if (existingAssignee && existingAssignee === String(deliveryBoyId)) {
        transitionedOrder = existing;
        return;
      }

      if (existingAssignee && existingAssignee !== String(deliveryBoyId)) {
        if (!allowReassign) {
          const err: any = new Error("Order already assigned");
          err.statusCode = 409;
          incCounter("assignment_conflicts_total", 1);
          throw err;
        }

        if (!['ASSIGNED', 'PACKED'].includes(existingStatusUpper)) {
          const err: any = new Error(`Cannot reassign when status is ${existingStatusUpper}`);
          err.statusCode = 409;
          throw err;
        }

        const prevDeliveryBoyId = String((existing as any).deliveryBoyId);

        // Clear assignment fields (idempotent conditional)
        await Order.updateOne(
          { _id: orderId, deliveryBoyId: (existing as any).deliveryBoyId },
          { $set: { deliveryBoyId: null, deliveryPartnerId: null, deliveryStatus: "unassigned" } },
          { session }
        );

        await DeliveryBoy.updateOne(
          { _id: new mongoose.Types.ObjectId(prevDeliveryBoyId) },
          {
            $pull: { assignedOrders: new mongoose.Types.ObjectId(orderId) },
            $inc: { currentLoad: -1 },
          },
          { session }
        );

        const updatedBoy = await DeliveryBoy.findById(prevDeliveryBoyId)
          .select("assignedOrders")
          .session(session);
        if (
          updatedBoy &&
          Array.isArray((updatedBoy as any).assignedOrders) &&
          (updatedBoy as any).assignedOrders.length === 0
        ) {
          await DeliveryBoy.updateOne(
            { _id: new mongoose.Types.ObjectId(prevDeliveryBoyId) },
            { $set: { availability: "available" }, $unset: { activeRoute: 1 } },
            { session }
          );
        }
      }

      const skipStatusTransition = Boolean(allowReassign && existingStatusUpper === "ASSIGNED");

      const claimed = await Order.findOneAndUpdate(
        {
          _id: orderId,
          orderStatus: skipStatusTransition
            ? { $in: ["ASSIGNED", "assigned"] }
            : { $in: ["PACKED", "packed"] },
          $or: [{ deliveryBoyId: { $exists: false } }, { deliveryBoyId: null }],
        },
        {
          $set: {
            deliveryBoyId: (assignedDeliveryBoy as any)._id,
            deliveryPartnerId: (assignedDeliveryBoy as any).userId,
            deliveryStatus: "assigned",
          },
        },
        { new: true, session }
      );

      if (!claimed) {
        const existing = await Order.findById(orderId)
          .select("orderStatus deliveryBoyId")
          .session(session);
        if (!existing) {
          const err: any = new Error("Order not found");
          err.statusCode = 404;
          throw err;
        }

        const hasAssignee = !!(existing as any).deliveryBoyId;
        const statusUpper = String((existing as any).orderStatus || "").toUpperCase();
        const err: any = new Error(
          hasAssignee
            ? "Order already assigned"
            : `Order must be PACKED before assignment (current: ${statusUpper})`
        );
        err.statusCode = 409;

        incCounter("assignment_conflicts_total", 1);
        throw err;
      }

      if (skipStatusTransition) {
        transitionedOrder = claimed;
      } else {
        transitionedOrder = await orderStateService.transition({
          orderId: String(orderId),
          toStatus: OrderStatus.ASSIGNED,
          actorRole: "ADMIN",
          actorId,
          meta: {
            deliveryPartnerName: String((assignedDeliveryBoy as any).name || "") || undefined,
          },
          session,
        });
      }

      await DeliveryBoy.findByIdAndUpdate(
        (assignedDeliveryBoy as any)._id,
        {
          $addToSet: { assignedOrders: (transitionedOrder as any)._id },
          $inc: { currentLoad: 1 },
          $set: { availability: "busy", lastAssignedAt: new Date() },
        },
        { session }
      );
    };

    if (ownsSession) {
      if (transactionsSupported === false) {
        await run();
      } else {
        try {
          await session.withTransaction(async () => run());
          transactionsSupported = true;
        } catch (e: any) {
          if (isTxnUnsupportedError(e)) {
            transactionsSupported = false;
            await run();
          } else {
            throw e;
          }
        }
      }
    } else {
      await run();
    }
  } finally {
    if (ownsSession) {
      session.endSession();
    }
  }

  return transitionedOrder;
}

/**
 * Assign delivery boy to an order using smart route-based assignment
 * POST /api/orders/:orderId/assign
 */
export const assignDeliveryBoyToOrder = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { deliveryBoyId } = req.body; // Optional: manual assignment

    const actorId = String((req as any).user?._id || "");
    if (!actorId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    if (!deliveryBoyId) {
      res.status(400).json({
        error: "deliveryBoyId is required for manual assignment",
      });
      return;
    }

    const transitionedOrder = await assignPackedOrderToDeliveryBoy({
      orderId,
      deliveryBoyId,
      actorId,
      allowReassign: true,
    });

    const io = (req as any).app.get("io");
    if (io) {
      io.to("admin_room").emit("order_assigned", {
        orderId: String(orderId),
        deliveryBoyId: String(deliveryBoyId || ""),
      });
      io.to(`delivery_${String(deliveryBoyId)}`).emit("order_assigned", {
        orderId: String(orderId),
        deliveryBoyId: String(deliveryBoyId),
      });
      io.to(`driver_${String(deliveryBoyId)}`).emit("order_assigned", {
        orderId: String(orderId),
        deliveryBoyId: String(deliveryBoyId),
      });

      io.to("admin_room").emit("order:assigned", {
        orderId: String(orderId),
        deliveryBoyId: String(deliveryBoyId),
      });
      io.to(`delivery_${String(deliveryBoyId)}`).emit("order:assigned", {
        orderId: String(orderId),
        deliveryBoyId: String(deliveryBoyId),
      });
      io.to(`driver_${String(deliveryBoyId)}`).emit("order:assigned", {
        orderId: String(orderId),
        deliveryBoyId: String(deliveryBoyId),
      });

      io.to("admin_room").emit("refresh_orders");
      io.to(`delivery_${String(deliveryBoyId)}`).emit("refresh_orders");
      io.to(`driver_${String(deliveryBoyId)}`).emit("refresh_orders");
    }

    res.json({
      success: true,
      message: "Delivery boy assigned successfully",
      order: transitionedOrder,
    });
  } catch (error: any) {
    console.error("Error assigning delivery boy to order:", error);

    const statusCode = Number(error?.statusCode) || 500;
    if (statusCode === 409) {
      res.status(409).json({
        error: error?.message || "Order assignment conflict",
      });
      return;
    }

    if (statusCode === 404) {
      res.status(404).json({
        error: error?.message || "Order not found",
      });
      return;
    }

    res.status(statusCode).json({
      error: error?.message || "Failed to assign delivery boy. Please try again later.",
    });
  }
};

/**
 * Unassign delivery boy from an order
 * DELETE /api/orders/:orderId/assign
 */
export const unassignDeliveryBoyFromOrder = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { orderId } = req.params;

    const actorId = String((req as any).user?._id || "");
    if (!actorId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const order = await Order.findById(orderId)
          .select("orderStatus deliveryBoyId")
          .session(session);
        if (!order) {
          const err: any = new Error("Order not found");
          err.statusCode = 404;
          throw err;
        }

        if (!(order as any).deliveryBoyId) {
          return;
        }

        const statusUpper = String((order as any).orderStatus || "").toUpperCase();
        if (!['ASSIGNED', 'PACKED'].includes(statusUpper)) {
          const err: any = new Error(`Cannot unassign when status is ${statusUpper}`);
          err.statusCode = 409;
          throw err;
        }

        const deliveryBoyId = String((order as any).deliveryBoyId);

        // Clear assignment fields first (idempotent conditional)
        await Order.updateOne(
          { _id: orderId, deliveryBoyId: (order as any).deliveryBoyId },
          {
            $set: { deliveryBoyId: null, deliveryPartnerId: null, deliveryStatus: "unassigned" },
          },
          { session }
        );

        // Roll the order back to PACKED so it can be re-assigned safely.
        if (statusUpper === 'ASSIGNED') {
          await orderStateService.transition({
            orderId: String(orderId),
            toStatus: OrderStatus.PACKED,
            actorRole: "ADMIN",
            actorId,
            session,
          });
        }

        await DeliveryBoy.updateOne(
          { _id: new mongoose.Types.ObjectId(deliveryBoyId) },
          { $pull: { assignedOrders: new mongoose.Types.ObjectId(orderId) }, $inc: { currentLoad: -1 } },
          { session }
        );

        const updatedBoy = await DeliveryBoy.findById(deliveryBoyId)
          .select("assignedOrders")
          .session(session);
        if (updatedBoy && Array.isArray((updatedBoy as any).assignedOrders) && (updatedBoy as any).assignedOrders.length === 0) {
          await DeliveryBoy.updateOne(
            { _id: new mongoose.Types.ObjectId(deliveryBoyId) },
            { $set: { availability: "available" }, $unset: { activeRoute: 1 } },
            { session }
          );
        }
      });
    } finally {
      session.endSession();
    }

    res.json({
      success: true,
      message: "Delivery boy unassigned successfully",
    });
  } catch (error) {
    console.error("Error unassigning delivery boy from order:", error);
    const statusCode = Number((error as any)?.statusCode) || 500;
    res.status(statusCode).json({
      error: (error as any)?.message || "Failed to unassign delivery boy. Please try again later.",
    });
  }
};

/**
 * Get optimal delivery boy for an order (preview without assigning)
 * GET /api/orders/:orderId/optimal-delivery-boy
 */
export const getOptimalDeliveryBoy = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { orderId } = req.params;

    // Find the order
    const order = await Order.findById(orderId);
    if (!order) {
      res.status(404).json({
        error: "Order not found",
      });
      return;
    }

    // Get optimal delivery boy
    const orderCoordinates = {
      lat: order.address.lat,
      lng: order.address.lng,
    };

    const assignmentResult = await smartAssignmentService.assignDeliveryBoy(
      orderCoordinates
    );

    if (!assignmentResult) {
      res.status(404).json({
        error: "No available delivery boys found",
      });
      return;
    }

    res.json({
      success: true,
      deliveryBoy: {
        _id: assignmentResult.deliveryBoy._id,
        name: assignmentResult.deliveryBoy.name,
        phone: assignmentResult.deliveryBoy.phone,
        vehicleType: assignmentResult.deliveryBoy.vehicleType,
        currentLocation: assignmentResult.deliveryBoy.currentLocation,
        assignedOrdersCount: assignmentResult.deliveryBoy.assignedOrders.length,
      },
      assignmentReason: assignmentResult.reason,
      distance: assignmentResult.distance,
      estimatedDuration: assignmentResult.estimatedDuration,
    });
  } catch (error) {
    console.error("Error getting optimal delivery boy:", error);
    res.status(500).json({
      error: "Failed to get optimal delivery boy. Please try again later.",
    });
  }
};
