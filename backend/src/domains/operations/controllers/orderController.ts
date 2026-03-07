import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Order } from "../../../models/Order";
import { DeliveryBoy } from "../../../models/DeliveryBoy";
import { Product } from "../../../models/Product";
import { Cart } from "../../../models/Cart";
import { dispatchNotification } from "../../communication/services/notificationService";
import { createOrderFromCart } from "../services/orderBuilder";
import { orderStateService } from "../../orders/services/orderStateService";
import { OrderStatus } from "../../orders/enums/OrderStatus";
import { publish } from "../../events/eventBus";
import { stableEventId } from "../../events/eventId";
import { createPaymentSuccessEvent } from "../../events/payment.events";
import { inventoryReservationService } from "../../orders/services/inventoryReservationService";
import { buildOrderTimeline } from "../../orders/services/orderTimeline";
import { RefundRequest } from "../../payments/models/RefundRequest";
import { LedgerEntry } from "../../payments/models/LedgerEntry";
import { safeDoc } from "../../../utils/safeDoc";

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
      ...safeDoc(order),
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

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

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

    const orderObj: any = {
      ...safeDoc(order),
      status: (order as any).orderStatus, // Map orderStatus to status for test compatibility
    };

    const refundDocs: any[] = await RefundRequest.find({ orderId: (order as any)._id })
      .select("_id amount currency status createdAt")
      .sort({ createdAt: 1, _id: 1 })
      .lean();

    const refundIds = refundDocs.map((d) => String(d?._id || "")).filter(Boolean);
    const refundLedgerDocs: any[] = refundIds.length
      ? await LedgerEntry.find({ eventType: "REFUND", refundId: { $in: refundIds } })
          .select("refundId occurredAt recordedAt")
          .sort({ recordedAt: 1, _id: 1 })
          .lean()
      : [];

    const completedAtByRefundId = new Map<string, string>();
    for (const d of refundLedgerDocs) {
      const refundId = String((d as any)?.refundId || "");
      if (!refundId || completedAtByRefundId.has(refundId)) continue;
      const t =
        (d as any)?.occurredAt instanceof Date
          ? (d as any).occurredAt
          : (d as any)?.recordedAt instanceof Date
            ? (d as any).recordedAt
            : null;
      if (t) completedAtByRefundId.set(refundId, t.toISOString());
    }

    orderObj.refunds = refundDocs.map((r) => {
      const refundId = String((r as any)._id);
      const status = String((r as any).status || "");
      return {
        refundId,
        amount: Number((r as any).amount || 0),
        currency: String((r as any).currency || "INR"),
        status,
        createdAt: ((r as any).createdAt instanceof Date ? (r as any).createdAt : new Date(0)).toISOString(),
        completedAt: completedAtByRefundId.get(refundId),
        failureReason: undefined,
      };
    });

    orderObj.timeline = buildOrderTimeline(orderObj);

    const currentTimelineStep = Array.isArray(orderObj.timeline)
      ? orderObj.timeline.find((s: any) => String(s?.state || "") === "current")
      : null;
    const isCustomerOutForDelivery = String(currentTimelineStep?.key || "") === "ORDER_IN_TRANSIT";

    // Customer-safe delivery partner exposure: only during Out for delivery stage, hidden after delivered.
    if (userRole !== "admin") {
      if (isCustomerOutForDelivery && (order as any).deliveryBoyId) {
        const d: any = (order as any).deliveryBoyId;
        orderObj.deliveryPartner = {
          name: d?.name,
          phone: d?.phone,
          vehicleType: d?.vehicleType,
        };
      } else {
        orderObj.deliveryPartner = null;
        orderObj.estimatedDeliveryWindow = null;
      }

      // Never expose internal delivery partner identifiers/records to customers.
      orderObj.deliveryBoyId = null;
      orderObj.deliveryPartnerId = null;
    }

    res.json({
      order: orderObj,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch order" });
  }
};

export const cancelOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const actorId = String((req as any).user?._id || "");
    if (!actorId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const role = String((req as any).user?.role || "").toLowerCase();
    const actorRole = role === "admin" ? "ADMIN" : "CUSTOMER";

    const order = await orderStateService.transition({
      orderId: id,
      toStatus: OrderStatus.CANCELLED,
      actorRole,
      actorId,
    });

    return res.json({
      message: "Order cancelled",
      order,
    });
  } catch (error) {
    return next(error as any);
  }
};

export const createOrder = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id;
    const paymentMethod = String(req.body?.paymentMethod || "").toLowerCase();

    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    if (paymentMethod !== "cod" && paymentMethod !== "upi" && paymentMethod !== "razorpay") {
      return res.status(400).json({ message: "Unsupported payment method" });
    }

    const upiVpa = paymentMethod === "upi" ? String(req.body?.upiVpa || "").trim() : undefined;
    if (paymentMethod === "upi" && !upiVpa) {
      return res.status(400).json({ message: "UPI ID required" });
    }

    const idempotencyKeyHeader = String(req.header("Idempotency-Key") || "").trim();
    const idempotencyKeyBody = String(req.body?.idempotencyKey || "").trim();
    const idempotencyKey = idempotencyKeyHeader || idempotencyKeyBody || undefined;

    const result = await createOrderFromCart({
      userId,
      paymentMethod: paymentMethod as any,
      upiVpa,
      idempotencyKey,
    });

    if (paymentMethod === "cod") {
      return res.status(201).json({
        message: "Order placed with Cash on Delivery",
        order: result.order,
        created: result.created,
      });
    }

    if (paymentMethod === "razorpay") {
      return res.status(201).json({
        message: "Order created. Awaiting payment",
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
    console.error("Create order error:", {
      message: error.message,
      statusCode: error.statusCode,
      stack: error.stack,
    });
    const statusCode = Number(error?.statusCode) || 500;
    if (statusCode >= 400 && statusCode < 500) {
      return res.status(statusCode).json({ message: error.message || "Bad request" });
    }
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

    console.log("[DEBUG] placeOrderCOD: userId:", userId, "idempotencyKey:", idempotencyKey);

    const result = await createOrderFromCart({
      userId,
      paymentMethod: "cod",
      idempotencyKey,
    });

    console.log("[DEBUG] placeOrderCOD: Order created:", result.order?._id, "created:", result.created);

    return res.status(200).json({
      message: "Order placed with Cash on Delivery",
      order: result.order,
      created: result.created,
    });
  } catch (error: any) {
    console.error("[DEBUG] placeOrderCOD error:", {
      message: error.message,
      statusCode: error.statusCode,
      stack: error.stack,
    });
    const statusCode = Number(error?.statusCode) || 500;
    if (statusCode >= 400 && statusCode < 500) {
      return res.status(statusCode).json({ message: error.message || "Bad request", error: error.message });
    }
    console.error("COD order placement error:", error);
    return res.status(500).json({ message: "Failed to place order (COD)", error: error.message });
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
    // SAFETY: Disabled to enforce single payment source-of-truth
    return res.status(410).json({
      error: "LEGACY_PAYMENT_PATH_DISABLED",
      message: "This payment path has been permanently disabled. Use PaymentIntent flow.",
    });
  } catch (error: any) {
    console.error("Payment status update error:", error);
    return res.status(500).json({ 
      error: "Failed to update payment status",
      message: error.message || "Unknown error occurred"
    });
  }
};
