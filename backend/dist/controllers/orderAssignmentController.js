"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOptimalDeliveryBoy = exports.unassignDeliveryBoyFromOrder = exports.assignDeliveryBoyToOrder = void 0;
exports.assignPackedOrderToDeliveryBoy = assignPackedOrderToDeliveryBoy;
const mongoose_1 = __importDefault(require("mongoose"));
const Order_1 = require("../models/Order");
const DeliveryBoy_1 = require("../models/DeliveryBoy");
const User_1 = require("../models/User");
const orderStateService_1 = require("../domains/orders/services/orderStateService");
const OrderStatus_1 = require("../domains/orders/enums/OrderStatus");
const smartAssignmentService_1 = require("../services/smartAssignmentService");
const opsMetrics_1 = require("../ops/opsMetrics");
let transactionsSupported = null;
async function assignPackedOrderToDeliveryBoy(params) {
    const { orderId, deliveryBoyId, actorId, allowReassign } = params;
    const isTxnUnsupportedError = (err) => {
        const msg = String(err?.message || "");
        return (msg.includes("Transaction numbers are only allowed") ||
            msg.includes("not supported") ||
            msg.includes("replica set"));
    };
    const assignedDeliveryBoy = await DeliveryBoy_1.DeliveryBoy.findById(deliveryBoyId);
    if (!assignedDeliveryBoy) {
        const err = new Error("Delivery boy not found");
        err.statusCode = 404;
        throw err;
    }
    if (!assignedDeliveryBoy.userId) {
        const err = new Error("Delivery partner is not linked to an approved user");
        err.statusCode = 400;
        throw err;
    }
    const deliveryUser = await User_1.User.findById(assignedDeliveryBoy.userId).select("role status");
    if (!deliveryUser || deliveryUser.role !== "delivery" || deliveryUser.status !== "active") {
        const err = new Error("Delivery partner is not approved");
        err.statusCode = 400;
        throw err;
    }
    if (!assignedDeliveryBoy.isActive) {
        const err = new Error("Delivery boy is not active");
        err.statusCode = 400;
        throw err;
    }
    const session = params.session || (await mongoose_1.default.startSession());
    const ownsSession = !params.session;
    let transitionedOrder = null;
    try {
        const run = async () => {
            const existing = await Order_1.Order.findById(orderId)
                .select("orderStatus deliveryBoyId deliveryPartnerId")
                .session(session);
            if (!existing) {
                const err = new Error("Order not found");
                err.statusCode = 404;
                throw err;
            }
            const existingStatusUpper = String(existing.orderStatus || "").toUpperCase();
            const existingAssignee = existing.deliveryBoyId
                ? String(existing.deliveryBoyId)
                : "";
            // Idempotent retry: if already assigned to same delivery boy, return without mutating load.
            if (existingAssignee && existingAssignee === String(deliveryBoyId)) {
                transitionedOrder = existing;
                return;
            }
            if (existingAssignee && existingAssignee !== String(deliveryBoyId)) {
                if (!allowReassign) {
                    const err = new Error("Order already assigned");
                    err.statusCode = 409;
                    (0, opsMetrics_1.incCounter)("assignment_conflicts_total", 1);
                    throw err;
                }
                if (!['ASSIGNED', 'PACKED'].includes(existingStatusUpper)) {
                    const err = new Error(`Cannot reassign when status is ${existingStatusUpper}`);
                    err.statusCode = 409;
                    throw err;
                }
                const prevDeliveryBoyId = String(existing.deliveryBoyId);
                // Clear assignment fields (idempotent conditional)
                await Order_1.Order.updateOne({ _id: orderId, deliveryBoyId: existing.deliveryBoyId }, { $set: { deliveryBoyId: null, deliveryPartnerId: null, deliveryStatus: "unassigned" } }, { session });
                await DeliveryBoy_1.DeliveryBoy.updateOne({ _id: new mongoose_1.default.Types.ObjectId(prevDeliveryBoyId) }, {
                    $pull: { assignedOrders: new mongoose_1.default.Types.ObjectId(orderId) },
                    $inc: { currentLoad: -1 },
                }, { session });
                const updatedBoy = await DeliveryBoy_1.DeliveryBoy.findById(prevDeliveryBoyId)
                    .select("assignedOrders")
                    .session(session);
                if (updatedBoy &&
                    Array.isArray(updatedBoy.assignedOrders) &&
                    updatedBoy.assignedOrders.length === 0) {
                    await DeliveryBoy_1.DeliveryBoy.updateOne({ _id: new mongoose_1.default.Types.ObjectId(prevDeliveryBoyId) }, { $set: { availability: "available" }, $unset: { activeRoute: 1 } }, { session });
                }
            }
            const skipStatusTransition = Boolean(allowReassign && existingStatusUpper === "ASSIGNED");
            const claimed = await Order_1.Order.findOneAndUpdate({
                _id: orderId,
                orderStatus: skipStatusTransition
                    ? { $in: ["ASSIGNED", "assigned"] }
                    : { $in: ["PACKED", "packed"] },
                $or: [{ deliveryBoyId: { $exists: false } }, { deliveryBoyId: null }],
            }, {
                $set: {
                    deliveryBoyId: assignedDeliveryBoy._id,
                    deliveryPartnerId: assignedDeliveryBoy.userId,
                    deliveryStatus: "assigned",
                },
            }, { new: true, session });
            if (!claimed) {
                const existing = await Order_1.Order.findById(orderId)
                    .select("orderStatus deliveryBoyId")
                    .session(session);
                if (!existing) {
                    const err = new Error("Order not found");
                    err.statusCode = 404;
                    throw err;
                }
                const hasAssignee = !!existing.deliveryBoyId;
                const statusUpper = String(existing.orderStatus || "").toUpperCase();
                const err = new Error(hasAssignee
                    ? "Order already assigned"
                    : `Order must be PACKED before assignment (current: ${statusUpper})`);
                err.statusCode = 409;
                (0, opsMetrics_1.incCounter)("assignment_conflicts_total", 1);
                throw err;
            }
            if (skipStatusTransition) {
                transitionedOrder = claimed;
            }
            else {
                transitionedOrder = await orderStateService_1.orderStateService.transition({
                    orderId: String(orderId),
                    toStatus: OrderStatus_1.OrderStatus.ASSIGNED,
                    actorRole: "ADMIN",
                    actorId,
                    meta: {
                        deliveryPartnerName: String(assignedDeliveryBoy.name || "") || undefined,
                    },
                    session,
                });
            }
            await DeliveryBoy_1.DeliveryBoy.findByIdAndUpdate(assignedDeliveryBoy._id, {
                $addToSet: { assignedOrders: transitionedOrder._id },
                $inc: { currentLoad: 1 },
                $set: { availability: "busy", lastAssignedAt: new Date() },
            }, { session });
        };
        if (ownsSession) {
            if (transactionsSupported === false) {
                await run();
            }
            else {
                try {
                    await session.withTransaction(async () => run());
                    transactionsSupported = true;
                }
                catch (e) {
                    if (isTxnUnsupportedError(e)) {
                        transactionsSupported = false;
                        await run();
                    }
                    else {
                        throw e;
                    }
                }
            }
        }
        else {
            await run();
        }
    }
    finally {
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
const assignDeliveryBoyToOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { deliveryBoyId } = req.body; // Optional: manual assignment
        const actorId = String(req.user?._id || "");
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
        const io = req.app.get("io");
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
    }
    catch (error) {
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
exports.assignDeliveryBoyToOrder = assignDeliveryBoyToOrder;
/**
 * Unassign delivery boy from an order
 * DELETE /api/orders/:orderId/assign
 */
const unassignDeliveryBoyFromOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const actorId = String(req.user?._id || "");
        if (!actorId) {
            res.status(401).json({ error: "User not authenticated" });
            return;
        }
        const session = await mongoose_1.default.startSession();
        try {
            await session.withTransaction(async () => {
                const order = await Order_1.Order.findById(orderId)
                    .select("orderStatus deliveryBoyId")
                    .session(session);
                if (!order) {
                    const err = new Error("Order not found");
                    err.statusCode = 404;
                    throw err;
                }
                if (!order.deliveryBoyId) {
                    return;
                }
                const statusUpper = String(order.orderStatus || "").toUpperCase();
                if (!['ASSIGNED', 'PACKED'].includes(statusUpper)) {
                    const err = new Error(`Cannot unassign when status is ${statusUpper}`);
                    err.statusCode = 409;
                    throw err;
                }
                const deliveryBoyId = String(order.deliveryBoyId);
                // Clear assignment fields first (idempotent conditional)
                await Order_1.Order.updateOne({ _id: orderId, deliveryBoyId: order.deliveryBoyId }, {
                    $set: { deliveryBoyId: null, deliveryPartnerId: null, deliveryStatus: "unassigned" },
                }, { session });
                // Roll the order back to PACKED so it can be re-assigned safely.
                if (statusUpper === 'ASSIGNED') {
                    await orderStateService_1.orderStateService.transition({
                        orderId: String(orderId),
                        toStatus: OrderStatus_1.OrderStatus.PACKED,
                        actorRole: "ADMIN",
                        actorId,
                        session,
                    });
                }
                await DeliveryBoy_1.DeliveryBoy.updateOne({ _id: new mongoose_1.default.Types.ObjectId(deliveryBoyId) }, { $pull: { assignedOrders: new mongoose_1.default.Types.ObjectId(orderId) }, $inc: { currentLoad: -1 } }, { session });
                const updatedBoy = await DeliveryBoy_1.DeliveryBoy.findById(deliveryBoyId)
                    .select("assignedOrders")
                    .session(session);
                if (updatedBoy && Array.isArray(updatedBoy.assignedOrders) && updatedBoy.assignedOrders.length === 0) {
                    await DeliveryBoy_1.DeliveryBoy.updateOne({ _id: new mongoose_1.default.Types.ObjectId(deliveryBoyId) }, { $set: { availability: "available" }, $unset: { activeRoute: 1 } }, { session });
                }
            });
        }
        finally {
            session.endSession();
        }
        res.json({
            success: true,
            message: "Delivery boy unassigned successfully",
        });
    }
    catch (error) {
        console.error("Error unassigning delivery boy from order:", error);
        const statusCode = Number(error?.statusCode) || 500;
        res.status(statusCode).json({
            error: error?.message || "Failed to unassign delivery boy. Please try again later.",
        });
    }
};
exports.unassignDeliveryBoyFromOrder = unassignDeliveryBoyFromOrder;
/**
 * Get optimal delivery boy for an order (preview without assigning)
 * GET /api/orders/:orderId/optimal-delivery-boy
 */
const getOptimalDeliveryBoy = async (req, res) => {
    try {
        const { orderId } = req.params;
        // Find the order
        const order = await Order_1.Order.findById(orderId);
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
        const assignmentResult = await smartAssignmentService_1.smartAssignmentService.assignDeliveryBoy(orderCoordinates);
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
    }
    catch (error) {
        console.error("Error getting optimal delivery boy:", error);
        res.status(500).json({
            error: "Failed to get optimal delivery boy. Please try again later.",
        });
    }
};
exports.getOptimalDeliveryBoy = getOptimalDeliveryBoy;
