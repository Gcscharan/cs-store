"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePaymentStatus = exports.getPaymentStatus = exports.placeOrderCOD = exports.createOrder = exports.cancelOrder = exports.getOrderById = exports.getOrders = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Order_1 = require("../../../models/Order");
const DeliveryBoy_1 = require("../../../models/DeliveryBoy");
const Cart_1 = require("../../../models/Cart");
const notificationService_1 = require("../../communication/services/notificationService");
const orderBuilder_1 = require("../services/orderBuilder");
const orderStateService_1 = require("../../orders/services/orderStateService");
const OrderStatus_1 = require("../../orders/enums/OrderStatus");
const eventBus_1 = require("../../events/eventBus");
const eventId_1 = require("../../events/eventId");
const payment_events_1 = require("../../events/payment.events");
const inventoryReservationService_1 = require("../../orders/services/inventoryReservationService");
const orderTimeline_1 = require("../../orders/services/orderTimeline");
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
            ...order.toObject(),
            status: order.orderStatus, // Map orderStatus to status for test compatibility
        };
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
        if (paymentMethod !== "cod" && paymentMethod !== "upi") {
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
            paymentMethod,
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
        return res.status(201).json({
            message: "Order created. Awaiting UPI payment",
            order: result.order,
            created: result.created,
        });
    }
    catch (error) {
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
        const result = await (0, orderBuilder_1.createOrderFromCart)({
            userId,
            paymentMethod: "cod",
            idempotencyKey,
        });
        return res.status(200).json({
            message: "Order placed with Cash on Delivery",
            order: result.order,
            created: result.created,
        });
    }
    catch (error) {
        const statusCode = Number(error?.statusCode) || 500;
        if (statusCode >= 400 && statusCode < 500) {
            return res.status(statusCode).json({ message: error.message || "Bad request" });
        }
        console.error("COD order placement error:", error);
        return res.status(500).json({ message: "Failed to place order (COD)" });
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
        console.error("Get payment status error:", error);
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
        const { orderId } = req.params;
        const userId = req.user?._id;
        const userRole = req.user?.role;
        if (!userId) {
            return res.status(401).json({ message: "User not authenticated" });
        }
        // Find the order
        const order = await Order_1.Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        // Verify the order belongs to the authenticated delivery boy or user (admin allowed)
        const deliveryBoy = await DeliveryBoy_1.DeliveryBoy.findOne({ userId, isActive: true });
        const isDeliveryBoy = deliveryBoy && order.deliveryBoyId?.toString() === deliveryBoy._id.toString();
        const isOrderOwner = order.userId.toString() === userId.toString();
        const isAdmin = userRole === "admin";
        if (!isDeliveryBoy && !isOrderOwner && !isAdmin) {
            return res.status(403).json({ message: "You are not authorized to update this order" });
        }
        if (order.paymentMethod === "upi") {
            // UPI: confirm payment and clear cart atomically
            const session = await mongoose_1.default.startSession();
            try {
                await session.withTransaction(async () => {
                    const fresh = await Order_1.Order.findById(orderId).session(session);
                    if (!fresh) {
                        const err = new Error("Order not found");
                        err.statusCode = 404;
                        throw err;
                    }
                    if (fresh.paymentStatus === "PAID" || fresh.paymentStatus === "paid") {
                        return;
                    }
                    if (fresh.paymentStatus !== "AWAITING_UPI_APPROVAL") {
                        const err = new Error("Order is not awaiting payment");
                        err.statusCode = 400;
                        throw err;
                    }
                    const orderStatusUpper = String(fresh.orderStatus || "").toUpperCase();
                    if (!["PENDING_PAYMENT", "CREATED", "PENDING"].includes(orderStatusUpper)) {
                        const err = new Error("Order is not awaiting payment");
                        err.statusCode = 400;
                        throw err;
                    }
                    fresh.paymentStatus = "PAID";
                    fresh.paymentReceivedAt = new Date();
                    await fresh.save({ session });
                    await inventoryReservationService_1.inventoryReservationService.commitReservationsForOrder({
                        session,
                        orderId: fresh._id,
                    });
                    await Cart_1.Cart.findOneAndUpdate({ userId: fresh.userId }, { items: [], total: 0, itemCount: 0 }, { new: true, session });
                });
            }
            finally {
                session.endSession();
            }
        }
        else if (order.paymentMethod === "cod") {
            // COD: allow marking paid (e.g. at delivery). Commit inventory reservation now.
            const session = await mongoose_1.default.startSession();
            try {
                await session.withTransaction(async () => {
                    const fresh = await Order_1.Order.findById(orderId).session(session);
                    if (!fresh) {
                        const err = new Error("Order not found");
                        err.statusCode = 404;
                        throw err;
                    }
                    const ps = String(fresh.paymentStatus || "").toUpperCase();
                    if (ps === "PAID") {
                        return;
                    }
                    fresh.paymentStatus = "PAID";
                    fresh.paymentReceivedAt = new Date();
                    await fresh.save({ session });
                    await inventoryReservationService_1.inventoryReservationService.commitReservationsForOrder({
                        session,
                        orderId: fresh._id,
                    });
                });
            }
            finally {
                session.endSession();
            }
        }
        else {
            return res.status(400).json({ message: "Unsupported payment method" });
        }
        console.log(`💰 Payment status updated for order ${orderId}: ${order.paymentStatus}`);
        try {
            const finalOrder = await Order_1.Order.findById(orderId).select("userId _id totalAmount paymentStatus");
            if (finalOrder && String(finalOrder.paymentStatus || "").toUpperCase() === "PAID") {
                const actorType = userRole === "admin" ? "admin" : "user";
                await (0, eventBus_1.publish)((0, payment_events_1.createPaymentSuccessEvent)({
                    source: "operations",
                    actor: {
                        type: actorType,
                        id: String(userId),
                    },
                    eventId: (0, eventId_1.stableEventId)(`payment:order:${String(finalOrder._id)}:paid`),
                    occurredAt: new Date().toISOString(),
                    userId: String(finalOrder.userId),
                    orderId: String(finalOrder._id),
                    amount: Number(finalOrder.totalAmount),
                }));
            }
        }
        catch (e) {
            console.error("[orderController] failed to publish PAYMENT_SUCCESS", e);
        }
        // Send payment success notification
        try {
            await (0, notificationService_1.dispatchNotification)(order.userId.toString(), 'PAYMENT_SUCCESS', {
                orderId: order._id.toString(),
                orderNumber: order._id.toString(),
                amount: order.totalAmount,
                paymentId: orderId
            });
        }
        catch (notificationError) {
            console.error("Failed to send payment success notification:", notificationError);
        }
        const updatedOrder = await Order_1.Order.findById(orderId);
        return res.status(200).json({
            success: true,
            message: "Payment status updated successfully",
            order: updatedOrder || order,
        });
    }
    catch (error) {
        console.error("Payment status update error:", error);
        return res.status(500).json({
            error: "Failed to update payment status",
            message: error.message || "Unknown error occurred"
        });
    }
};
exports.updatePaymentStatus = updatePaymentStatus;
