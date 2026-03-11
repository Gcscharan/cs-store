"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePaymentStatus = exports.getPaymentStatus = exports.placeOrderCOD = exports.createOrder = exports.cancelOrder = exports.getOrderById = exports.getOrders = void 0;
const logger_1 = require("../../../utils/logger");
const mongoose_1 = __importDefault(require("mongoose"));
const Order_1 = require("../../../models/Order");
const DeliveryBoy_1 = require("../../../models/DeliveryBoy");
const orderBuilder_1 = require("../services/orderBuilder");
const orderStateService_1 = require("../../orders/services/orderStateService");
const OrderStatus_1 = require("../../orders/enums/OrderStatus");
const orderTimeline_1 = require("../../orders/services/orderTimeline");
const RefundRequest_1 = require("../../payments/models/RefundRequest");
const LedgerEntry_1 = require("../../payments/models/LedgerEntry");
const safeDoc_1 = require("../../../utils/safeDoc");
const getOrders = async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        const userId = req.user._id;
        const query = { userId };
        if (status)
            query.orderStatus = status;
        const skip = (Number(page) - 1) * Number(limit);
        const orders = await Order_1.Order.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .populate("deliveryBoyId", "name phone vehicleType")
            .populate("items.productId", "name images");
        const total = await Order_1.Order.countDocuments(query);
        // Map orderStatus to status for test compatibility
        const ordersWithStatus = orders.map(order => ({
            ...(0, safeDoc_1.safeDoc)(order),
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
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch orders" });
    }
};
exports.getOrders = getOrders;
const getOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const userRole = req.user.role;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid order ID" });
        }
        const query = { _id: id };
        // If not admin, only show user's own orders
        if (userRole !== "admin") {
            query.userId = userId;
        }
        const order = await Order_1.Order.findOne(query)
            .populate("deliveryBoyId", "name phone vehicleType currentLocation")
            .populate("items.productId", "name images");
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        const orderObj = {
            ...(0, safeDoc_1.safeDoc)(order),
            status: order.orderStatus, // Map orderStatus to status for test compatibility
        };
        const refundDocs = await RefundRequest_1.RefundRequest.find({ orderId: order._id })
            .select("_id amount currency status createdAt")
            .sort({ createdAt: 1, _id: 1 })
            .lean();
        const refundIds = refundDocs.map((d) => String(d?._id || "")).filter(Boolean);
        const refundLedgerDocs = refundIds.length
            ? await LedgerEntry_1.LedgerEntry.find({ eventType: "REFUND", refundId: { $in: refundIds } })
                .select("refundId occurredAt recordedAt")
                .sort({ recordedAt: 1, _id: 1 })
                .lean()
            : [];
        const completedAtByRefundId = new Map();
        for (const d of refundLedgerDocs) {
            const refundId = String(d?.refundId || "");
            if (!refundId || completedAtByRefundId.has(refundId))
                continue;
            const t = d?.occurredAt instanceof Date
                ? d.occurredAt
                : d?.recordedAt instanceof Date
                    ? d.recordedAt
                    : null;
            if (t)
                completedAtByRefundId.set(refundId, t.toISOString());
        }
        orderObj.refunds = refundDocs.map((r) => {
            const refundId = String(r._id);
            const status = String(r.status || "");
            return {
                refundId,
                amount: Number(r.amount || 0),
                currency: String(r.currency || "INR"),
                status,
                createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date(0)).toISOString(),
                completedAt: completedAtByRefundId.get(refundId),
                failureReason: undefined,
            };
        });
        orderObj.timeline = (0, orderTimeline_1.buildOrderTimeline)(orderObj);
        const currentTimelineStep = Array.isArray(orderObj.timeline)
            ? orderObj.timeline.find((s) => String(s?.state || "") === "current")
            : null;
        const isCustomerOutForDelivery = String(currentTimelineStep?.key || "") === "ORDER_IN_TRANSIT";
        // Customer-safe delivery partner exposure: only during Out for delivery stage, hidden after delivered.
        if (userRole !== "admin") {
            if (isCustomerOutForDelivery && order.deliveryBoyId) {
                const d = order.deliveryBoyId;
                orderObj.deliveryPartner = {
                    name: d?.name,
                    phone: d?.phone,
                    vehicleType: d?.vehicleType,
                };
            }
            else {
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
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch order" });
    }
};
exports.getOrderById = getOrderById;
const cancelOrder = async (req, res, next) => {
    try {
        const { id } = req.params;
        const actorId = String(req.user?._id || "");
        if (!actorId) {
            return res.status(401).json({ message: "User not authenticated" });
        }
        const role = String(req.user?.role || "").toLowerCase();
        const actorRole = role === "admin" ? "ADMIN" : "CUSTOMER";
        const order = await orderStateService_1.orderStateService.transition({
            orderId: id,
            toStatus: OrderStatus_1.OrderStatus.CANCELLED,
            actorRole,
            actorId,
        });
        return res.json({
            message: "Order cancelled",
            order,
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.cancelOrder = cancelOrder;
const createOrder = async (req, res) => {
    try {
        const userId = req.user?._id;
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
        const result = await (0, orderBuilder_1.createOrderFromCart)({
            userId,
            paymentMethod: paymentMethod,
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
    }
    catch (error) {
        logger_1.logger.error("Create order error:", {
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
exports.createOrder = createOrder;
const placeOrderCOD = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({ message: "User not authenticated" });
        }
        const idempotencyKeyHeader = String(req.header("Idempotency-Key") || "").trim();
        const idempotencyKeyBody = String(req.body?.idempotencyKey || "").trim();
        const idempotencyKey = idempotencyKeyHeader || idempotencyKeyBody || undefined;
        logger_1.logger.info("[DEBUG] placeOrderCOD:", { userId, idempotencyKey });
        const result = await (0, orderBuilder_1.createOrderFromCart)({
            userId,
            paymentMethod: "cod",
            idempotencyKey,
        });
        logger_1.logger.info("[DEBUG] placeOrderCOD: Order created:", { orderId: result.order?._id, created: result.created });
        return res.status(200).json({
            message: "Order placed with Cash on Delivery",
            order: result.order,
            created: result.created,
        });
    }
    catch (error) {
        logger_1.logger.error("[DEBUG] placeOrderCOD error:", {
            message: error.message,
            statusCode: error.statusCode,
            stack: error.stack,
        });
        const statusCode = Number(error?.statusCode) || 500;
        if (statusCode >= 400 && statusCode < 500) {
            return res.status(statusCode).json({ message: error.message || "Bad request", error: error.message });
        }
        logger_1.logger.error("COD order placement error:", error);
        return res.status(500).json({ message: "Failed to place order (COD)", error: error.message });
    }
};
exports.placeOrderCOD = placeOrderCOD;
/**
 * Get payment status for an order
 * GET /api/orders/:orderId/payment-status
 */
const getPaymentStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({ message: "User not authenticated" });
        }
        // Find the order
        const order = await Order_1.Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        // Verify the user has access to this order (delivery boy or order owner)
        const deliveryBoy = await DeliveryBoy_1.DeliveryBoy.findOne({ userId, isActive: true });
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
    }
    catch (error) {
        logger_1.logger.error("Get payment status error:", error);
        return res.status(500).json({ message: "Failed to get payment status" });
    }
};
exports.getPaymentStatus = getPaymentStatus;
/**
 * Update payment status for COD orders
 * PUT /api/orders/:orderId/payment-status
 */
const updatePaymentStatus = async (req, res) => {
    try {
        // SAFETY: Disabled to enforce single payment source-of-truth
        return res.status(410).json({
            error: "LEGACY_PAYMENT_PATH_DISABLED",
            message: "This payment path has been permanently disabled. Use PaymentIntent flow.",
        });
    }
    catch (error) {
        logger_1.logger.error("Payment status update error:", error);
        return res.status(500).json({
            error: "Failed to update payment status",
            message: error.message || "Unknown error occurred"
        });
    }
};
exports.updatePaymentStatus = updatePaymentStatus;
