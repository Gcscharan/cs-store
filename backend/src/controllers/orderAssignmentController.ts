import { Request, Response } from "express";
import { Order } from "../models/Order";
import { DeliveryBoy } from "../models/DeliveryBoy";
import { smartAssignmentService } from "../services/smartAssignmentService";

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

    // Find the order
    const order = await Order.findById(orderId);
    if (!order) {
      res.status(404).json({
        error: "Order not found",
      });
      return;
    }

    // Check if order already has a delivery boy
    if (order.deliveryBoyId) {
      res.status(400).json({
        error: "Order already has a delivery boy assigned",
      });
      return;
    }

    let assignedDeliveryBoy;

    // Manual assignment if deliveryBoyId is provided
    if (deliveryBoyId) {
      const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
      if (!deliveryBoy) {
        res.status(404).json({
          error: "Delivery boy not found",
        });
        return;
      }

      if (!deliveryBoy.isActive || deliveryBoy.availability === "offline") {
        res.status(400).json({
          error: "Delivery boy is not available",
        });
        return;
      }

      assignedDeliveryBoy = deliveryBoy;
    } else {
      // Smart automatic assignment
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

      assignedDeliveryBoy = assignmentResult.deliveryBoy;

      console.log(
        `✅ Smart assignment: ${assignedDeliveryBoy.name} (${assignmentResult.reason})`
      );
    }

    // Update order with delivery boy
    const assignedUserId = (assignedDeliveryBoy as any).userId;
    if (!assignedUserId) {
      res.status(400).json({
        error: "Delivery boy is missing linked userId",
      });
      return;
    }

    order.deliveryPartnerId = assignedUserId;
    await order.save();

    // Update delivery boy's assigned orders
    await DeliveryBoy.findByIdAndUpdate(assignedDeliveryBoy._id, {
      $push: { assignedOrders: order._id },
      $set: { availability: "busy" },
    });

    // Update delivery boy's route
    const orderCoordinates = {
      lat: order.address.lat,
      lng: order.address.lng,
    };

    await smartAssignmentService.updateDeliveryBoyRoute(
      assignedDeliveryBoy._id.toString(),
      orderCoordinates,
      order._id.toString()
    );

    res.json({
      success: true,
      message: "Delivery boy assigned successfully",
      order: {
        _id: order._id,
        deliveryBoyId: assignedDeliveryBoy._id,
        deliveryBoyName: assignedDeliveryBoy.name,
        orderStatus: order.orderStatus,
      },
    });
  } catch (error) {
    console.error("Error assigning delivery boy to order:", error);
    res.status(500).json({
      error: "Failed to assign delivery boy. Please try again later.",
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

    // Find the order
    const order = await Order.findById(orderId);
    if (!order) {
      res.status(404).json({
        error: "Order not found",
      });
      return;
    }

    if (!order.deliveryBoyId) {
      res.status(400).json({
        error: "Order does not have a delivery boy assigned",
      });
      return;
    }

    const deliveryBoyId = order.deliveryBoyId;

    // Remove order from delivery boy's assigned orders
    await DeliveryBoy.findByIdAndUpdate(deliveryBoyId, {
      $pull: { assignedOrders: order._id },
    });

    // Check if delivery boy has other orders
    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (deliveryBoy && deliveryBoy.assignedOrders.length === 0) {
      // Clear route if no more orders
      await smartAssignmentService.clearDeliveryBoyRoute(
        deliveryBoyId.toString()
      );
      // Set availability to available
      deliveryBoy.availability = "available";
      await deliveryBoy.save();
    }

    // Update order
    order.deliveryPartnerId = undefined;
    await order.save();

    res.json({
      success: true,
      message: "Delivery boy unassigned successfully",
    });
  } catch (error) {
    console.error("Error unassigning delivery boy from order:", error);
    res.status(500).json({
      error: "Failed to unassign delivery boy. Please try again later.",
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
