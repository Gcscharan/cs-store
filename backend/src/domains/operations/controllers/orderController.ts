import { Request, Response } from "express";
import mongoose from "mongoose";
import { Order } from "../../../models/Order";
import { DeliveryBoy } from "../../../models/DeliveryBoy";
import { Product } from "../../../models/Product";
import { Cart } from "../../../models/Cart";
import { dispatchNotification } from "../../communication/services/notificationService";
import { createOrderFromCart } from "../services/orderBuilder";

export const getOrders = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const userId = (req as any).user._id;

    const query: any = { userId };
    if (status) query.orderStatus = status;

    const skip = (Number(page) - 1) * Number(limit);

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate("deliveryBoyId", "name phone vehicleType")
      .populate("items.productId", "name images");

    const total = await Order.countDocuments(query);

    // Map orderStatus to status for test compatibility
    const ordersWithStatus = orders.map(order => ({
      ...order.toObject(),
      status: order.orderStatus
    }));

    res.json({
      orders: ordersWithStatus,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch orders" });
  }
};

export const getOrderById = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user._id;
    const userRole = (req as any).user.role;

    const query: any = { _id: id };

    // If not admin, only show user's own orders
    if (userRole !== "admin") {
      query.userId = userId;
    }

    const order = await Order.findOne(query)
      .populate("deliveryBoyId", "name phone vehicleType currentLocation")
      .populate("items.productId", "name images");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json({ 
      order: {
        ...order.toObject(),
        status: order.orderStatus, // Map orderStatus to status for test compatibility
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch order" });
  }
};

export const cancelOrder = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user._id;

    const order = await Order.findOne({ _id: id, userId });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check if order can be cancelled
    if (order.orderStatus === "delivered") {
      return res.status(400).json({ message: "Cannot cancel delivered order" });
    }

    if (order.orderStatus === "cancelled") {
      return res.status(400).json({ message: "Order already cancelled" });
    }

    if (order.orderStatus === "confirmed") {
      return res.status(400).json({ message: "Cannot cancel confirmed order" });
    }

    // Update order status
    order.orderStatus = "cancelled";
    await order.save();

    // Restore product stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.qty },
      });
    }

    // Send cancellation notification
    try {
      await dispatchNotification(userId.toString(), 'ORDER_CANCELLED', {
        orderId: order._id.toString(),
        orderNumber: order._id.toString(),
        amount: order.totalAmount
      });
    } catch (notificationError) {
      console.error("Failed to send order cancellation notification:", notificationError);
    }

    res.json({
      message: "Order cancelled successfully",
      order: {
        ...order.toObject(),
        status: order.orderStatus, // Map orderStatus to status for test compatibility
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to cancel order" });
  }
};

export const createOrder = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id;
    const paymentMethodRaw = String(req.body?.paymentMethod || "").toLowerCase();
    const paymentMethod = paymentMethodRaw === "upi" ? "upi" : paymentMethodRaw === "cod" ? "cod" : null;

    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    if (!paymentMethod) {
      return res.status(400).json({ message: "Invalid payment method" });
    }

    const idempotencyKeyHeader = String(req.header("Idempotency-Key") || "").trim();
    const idempotencyKeyBody = String(req.body?.idempotencyKey || "").trim();
    const idempotencyKey = idempotencyKeyHeader || idempotencyKeyBody || undefined;

    const result = await createOrderFromCart({
      userId,
      paymentMethod,
      idempotencyKey,
    });

    if (paymentMethod === "cod") {
      return res.status(201).json({
        message: "Order placed with Cash on Delivery",
        order: result.order,
        created: result.created,
      });
    }

    return res.status(201).json({
      message: "Order created. Awaiting UPI payment",
      order: result.order,
      created: result.created,
    });
  } catch (error: any) {
    const statusCode = Number(error?.statusCode) || 500;
    if (statusCode >= 400 && statusCode < 500) {
      return res.status(statusCode).json({ message: error.message || "Bad request" });
    }
    console.error("Create order error:", error);
    return res.status(500).json({ message: "Failed to create order" });
  }
};

export const placeOrderCOD = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const idempotencyKeyHeader = String(req.header("Idempotency-Key") || "").trim();
    const idempotencyKeyBody = String(req.body?.idempotencyKey || "").trim();
    const idempotencyKey = idempotencyKeyHeader || idempotencyKeyBody || undefined;

    const result = await createOrderFromCart({
      userId,
      paymentMethod: "cod",
      idempotencyKey,
    });

    return res.status(200).json({
      message: "Order placed with Cash on Delivery",
      order: result.order,
      created: result.created,
    });
  } catch (error: any) {
    const statusCode = Number(error?.statusCode) || 500;
    if (statusCode >= 400 && statusCode < 500) {
      return res.status(statusCode).json({ message: error.message || "Bad request" });
    }
    console.error("COD order placement error:", error);
    return res.status(500).json({ message: "Failed to place order (COD)" });
  }
};

/**
 * Get payment status for an order
 * GET /api/orders/:orderId/payment-status
 */
export const getPaymentStatus = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const userId = (req as any).user?._id;

    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    // Find the order
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Verify the user has access to this order (delivery boy or order owner)
    const deliveryBoy = await DeliveryBoy.findOne({ userId, isActive: true });
    const isDeliveryBoy = deliveryBoy && order.deliveryBoyId?.toString() === userId.toString();
    const isOrderOwner = order.userId.toString() === userId.toString();

    if (!isDeliveryBoy && !isOrderOwner) {
      return res.status(403).json({ message: "You are not authorized to view this order" });
    }

    // Return the payment status
    return res.json({
      orderId: order._id,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      orderStatus: order.orderStatus,
      deliveryStatus: order.deliveryStatus
    });

  } catch (error) {
    console.error("Get payment status error:", error);
    return res.status(500).json({ message: "Failed to get payment status" });
  }
};

/**
 * Update payment status for COD orders
 * PUT /api/orders/:orderId/payment-status
 */
export const updatePaymentStatus = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const userId = (req as any).user?._id;

    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    // Find the order
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Verify the order belongs to the authenticated delivery boy or user
    const deliveryBoy = await DeliveryBoy.findOne({ userId, isActive: true });
    const isDeliveryBoy = deliveryBoy && order.deliveryBoyId?.toString() === deliveryBoy._id.toString();
    const isOrderOwner = order.userId.toString() === userId.toString();

    if (!isDeliveryBoy && !isOrderOwner) {
      return res.status(403).json({ message: "You are not authorized to update this order" });
    }

    if (order.paymentMethod === "upi") {
      // UPI: confirm payment and clear cart atomically
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const fresh = await Order.findById(orderId).session(session);
          if (!fresh) {
            const err: any = new Error("Order not found");
            err.statusCode = 404;
            throw err;
          }

          if (fresh.paymentStatus === "PAID" || fresh.paymentStatus === "paid") {
            return;
          }

          if (fresh.orderStatus !== "PENDING_PAYMENT") {
            const err: any = new Error("Order is not awaiting payment");
            err.statusCode = 400;
            throw err;
          }

          // Re-check and decrement stock atomically at payment confirmation time
          for (const item of (fresh.items || []) as any[]) {
            const qty = Number(item.qty ?? item.quantity ?? 0);
            if (!item.productId || qty <= 0) {
              const err: any = new Error("Invalid order item");
              err.statusCode = 400;
              throw err;
            }

            const updated = await Product.findByIdAndUpdate(
              item.productId,
              { $inc: { stock: -qty } },
              { new: true, session }
            );

            if (!updated) {
              const err: any = new Error("Product not found");
              err.statusCode = 409;
              throw err;
            }

            if (updated.stock < 0) {
              const err: any = new Error(`Insufficient stock for ${updated.name}`);
              err.statusCode = 409;
              throw err;
            }
          }

          fresh.paymentStatus = "PAID" as any;
          fresh.paymentReceivedAt = new Date();
          fresh.orderStatus = "CONFIRMED" as any;

          await fresh.save({ session });

          await Cart.findOneAndUpdate(
            { userId: fresh.userId },
            { items: [], total: 0, itemCount: 0 },
            { new: true, session }
          );
        });
      } finally {
        session.endSession();
      }
    } else if (order.paymentMethod === "cod") {
      // COD: allow marking paid (e.g. at delivery). Cart was already cleared at order creation.
      order.paymentStatus = "PAID" as any;
      order.paymentReceivedAt = new Date();
      await order.save();
    } else {
      return res.status(400).json({ message: "Unsupported payment method" });
    }

    console.log(`💰 Payment status updated for order ${orderId}: ${order.paymentStatus}`);

    // Send payment success notification
    try {
      await dispatchNotification(order.userId.toString(), 'PAYMENT_SUCCESS', {
        orderId: order._id.toString(),
        orderNumber: order._id.toString(),
        amount: order.totalAmount,
        paymentId: orderId
      });
    } catch (notificationError) {
      console.error("Failed to send payment success notification:", notificationError);
    }

    const updatedOrder = await Order.findById(orderId);

    return res.status(200).json({
      success: true,
      message: "Payment status updated successfully",
      order: updatedOrder || order,
    });
  } catch (error: any) {
    console.error("Payment status update error:", error);
    return res.status(500).json({ 
      error: "Failed to update payment status",
      message: error.message || "Unknown error occurred"
    });
  }
};
