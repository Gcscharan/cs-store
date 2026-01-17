"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.failDelivery = exports.completeDelivery = exports.verifyDeliveryOtp = exports.deliverAttempt = exports.createCodCollection = exports.getCodCollection = exports.markArrived = exports.startDelivery = exports.pickupOrder = exports.getEarnings = exports.toggleStatus = exports.updateLocation = exports.rejectOrder = exports.acceptOrder = exports.getDeliveryOrders = exports.getDeliveryBoyInfo = exports.getAdminCodCollection = exports.getAdminOrderAttempt = exports.recordDeliveryAttempt = exports.getCurrentRoute = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Order_1 = require("../../../models/Order");
const DeliveryBoy_1 = require("../../../models/DeliveryBoy");
const Notification_1 = __importDefault(require("../../../models/Notification"));
const sms_1 = require("../../../utils/sms");
const sendDeliveryOtpEmail_1 = require("../../../utils/sendDeliveryOtpEmail");
const orderStateService_1 = require("../../orders/services/orderStateService");
const OrderStatus_1 = require("../../orders/enums/OrderStatus");
const Route_1 = require("../../../models/Route");
const DeliveryAttempt_1 = require("../../../models/DeliveryAttempt");
const CodCollection_1 = require("../../../models/CodCollection");
const routeLifecycleService_1 = require("../../routes/routeLifecycleService");
const liveLocationStore_1 = require("../../../services/liveLocationStore");
const getApprovedDeliveryBoy = async (user) => {
    if (!user || user.role !== "delivery")
        return null;
    if (String(user.status || "") !== "active")
        return null;
    let deliveryBoy = await DeliveryBoy_1.DeliveryBoy.findOne({ userId: user._id });
    if (!deliveryBoy && user.phone) {
        const byPhone = await DeliveryBoy_1.DeliveryBoy.findOne({ phone: user.phone });
        if (byPhone) {
            if (!byPhone.userId) {
                byPhone.userId = user._id;
                await byPhone.save();
            }
            deliveryBoy = byPhone;
        }
    }
    if (!deliveryBoy || !deliveryBoy.isActive)
        return null;
    return deliveryBoy;
};
const toRadians = (deg) => (deg * Math.PI) / 180;
const haversineMeters = (a, b) => {
    const R = 6371000;
    const dLat = toRadians(b.lat - a.lat);
    const dLng = toRadians(b.lng - a.lng);
    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);
    const x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    return R * c;
};
/**
 * Get current assigned route for delivery boy
 * GET /api/delivery/routes/current
 */
const getCurrentRoute = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        const deliveryBoy = await getApprovedDeliveryBoy(user);
        if (!deliveryBoy) {
            res.status(403).json({ error: "Account not approved or delivery profile not active" });
            return;
        }
        const route = await Route_1.Route.findOne({
            deliveryBoyId: deliveryBoy._id,
            status: { $in: ["ASSIGNED", "IN_PROGRESS"] },
        }).lean();
        if (!route) {
            res.json({ success: true, route: null });
            return;
        }
        const orderedOrderIds = (Array.isArray(route.routePath) ? route.routePath : [])
            .filter((x) => String(x || "").toUpperCase() !== "WAREHOUSE")
            .map((x) => String(x));
        const orders = await Order_1.Order.find({ _id: { $in: route.orderIds } })
            .select("_id orderStatus address.lat address.lng")
            .lean();
        const statusById = {};
        const coordsById = {};
        for (const o of orders) {
            const id = String(o._id);
            statusById[id] = String(o.orderStatus || "").toUpperCase();
            const lat = Number(o?.address?.lat);
            const lng = Number(o?.address?.lng);
            coordsById[id] = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
        }
        const isDone = (st) => st === "DELIVERED" || st === "FAILED" || st === "CANCELLED";
        const nextStop = orderedOrderIds.find((id) => !isDone(statusById[id] || "")) || null;
        const destination = nextStop ? coordsById[nextStop] : null;
        const navigationUrl = nextStop && destination
            ? `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=driving`
            : null;
        const totalOrders = orderedOrderIds.length;
        const deliveredCount = Number(route.deliveredCount || 0);
        const failedCount = Number(route.failedCount || 0);
        const completedCount = deliveredCount + failedCount;
        const progressPct = totalOrders > 0 ? Math.round((completedCount / totalOrders) * 100) : 0;
        res.json({
            success: true,
            route: {
                routeId: String(route.routeId),
                totalOrders,
                deliveredCount,
                estimatedTimeMin: Number(route.estimatedTimeMin || 0),
                routePath: orderedOrderIds,
                nextStop,
                navigationUrl,
                progressPct,
            },
        });
    }
    catch (error) {
        console.error("Get current route error:", error);
        res.status(500).json({ error: "Failed to fetch current route" });
    }
};
exports.getCurrentRoute = getCurrentRoute;
const recordDeliveryAttempt = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const body = req.body || {};
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        const deliveryBoy = await getApprovedDeliveryBoy(user);
        if (!deliveryBoy) {
            res.status(403).json({ error: "Account not approved or delivery profile not active" });
            return;
        }
        const order = await Order_1.Order.findById(orderId).select("_id orderStatus deliveryStatus deliveryBoyId deliveryPartnerId");
        if (!order) {
            res.status(404).json({ error: "Order not found" });
            return;
        }
        const assignedBoyId = order.deliveryBoyId;
        const assignedPartnerId = order.deliveryPartnerId;
        const actorBoyId = String(deliveryBoy._id);
        const actorUserId = String(user._id);
        const matchesBoy = assignedBoyId && String(assignedBoyId) === actorBoyId;
        const matchesPartner = assignedPartnerId && String(assignedPartnerId) === actorUserId;
        if (!matchesBoy && !matchesPartner) {
            res.status(403).json({ error: "You are not assigned to this order" });
            return;
        }
        const orderStatusUpper = String(order.orderStatus || "").trim().toUpperCase();
        const deliveryStatusLower = String(order.deliveryStatus || "").trim().toLowerCase();
        if (orderStatusUpper === "DELIVERED" || deliveryStatusLower === "delivered") {
            res.status(409).json({ error: "Order is already delivered" });
            return;
        }
        if (orderStatusUpper === "CANCELLED" || deliveryStatusLower === "cancelled") {
            res.status(409).json({ error: "Order is cancelled" });
            return;
        }
        const okToRecordAttempt = orderStatusUpper === "IN_TRANSIT" || orderStatusUpper === "OUT_FOR_DELIVERY";
        if (!okToRecordAttempt) {
            res
                .status(409)
                .json({ error: `Order must be IN_TRANSIT or OUT_FOR_DELIVERY to record attempt (orderStatus=${orderStatusUpper})` });
            return;
        }
        const status = String(body?.status || "").trim().toUpperCase();
        if (status !== "SUCCESS" && status !== "FAILED") {
            res.status(400).json({ error: "status must be SUCCESS or FAILED" });
            return;
        }
        const failureReason = typeof body?.failureReason === "string" ? String(body.failureReason).trim().toUpperCase() : "";
        const failureNotes = typeof body?.failureNotes === "string" ? String(body.failureNotes).trim() : "";
        const allowedReasons = ["CUSTOMER_NOT_AVAILABLE", "CUSTOMER_REJECTED", "ADDRESS_ISSUE"];
        if (status === "FAILED") {
            if (!failureReason || !allowedReasons.includes(failureReason)) {
                res.status(400).json({ error: "failureReason is required for FAILED attempts" });
                return;
            }
        }
        if (status === "SUCCESS") {
            if (failureReason || failureNotes) {
                res.status(400).json({ error: "failureReason/failureNotes must be empty for SUCCESS attempts" });
                return;
            }
        }
        const orderObjectId = new mongoose_1.default.Types.ObjectId(String(orderId));
        const existingAttempt = await DeliveryAttempt_1.DeliveryAttempt.findOne({ orderId: orderObjectId })
            .select("_id status")
            .lean();
        if (existingAttempt) {
            res.status(409).json({ error: "Delivery attempt already recorded" });
            return;
        }
        const route = await Route_1.Route.findOne({
            deliveryBoyId: deliveryBoy._id,
            status: { $in: ["ASSIGNED", "IN_PROGRESS"] },
            orderIds: new mongoose_1.default.Types.ObjectId(String(orderId)),
        })
            .select("_id")
            .lean();
        if (!route?._id) {
            res.status(409).json({ error: "Order is not part of an active route" });
            return;
        }
        let location = undefined;
        if (body?.location && typeof body.location === "object") {
            const lat = Number(body.location.lat);
            const lng = Number(body.location.lng);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
                location = { lat, lng };
            }
        }
        const now = new Date();
        let created = null;
        try {
            created = await DeliveryAttempt_1.DeliveryAttempt.create({
                orderId: orderObjectId,
                routeId: new mongoose_1.default.Types.ObjectId(String(route._id)),
                deliveryBoyId: new mongoose_1.default.Types.ObjectId(String(deliveryBoy._id)),
                status,
                failureReason: status === "FAILED" ? failureReason : null,
                failureNotes: status === "FAILED" && failureNotes ? failureNotes : null,
                attemptedAt: now,
                ...(location ? { location } : {}),
            });
        }
        catch (e) {
            const msg = String(e?.message || "");
            const isDup = e?.code === 11000 || msg.includes("E11000");
            if (isDup) {
                res.status(409).json({ error: "Delivery attempt already recorded" });
                return;
            }
            throw e;
        }
        if (!created) {
            res.status(500).json({ error: "Failed to record delivery attempt" });
            return;
        }
        if (status === "FAILED") {
            const cancelAt = new Date();
            await Order_1.Order.updateOne({ _id: orderObjectId }, {
                $set: {
                    orderStatus: "CANCELLED",
                    deliveryStatus: "cancelled",
                    cancelledAt: cancelAt,
                    cancelledBy: "system",
                    cancelReason: failureReason,
                    failureReasonCode: failureReason,
                    failureNotes: failureNotes || undefined,
                },
                $push: {
                    history: {
                        from: order.orderStatus,
                        to: "CANCELLED",
                        actorRole: "DELIVERY_PARTNER",
                        actorId: String(deliveryBoy._id),
                        at: cancelAt,
                        meta: {
                            failureReason,
                            failureNotes: failureNotes || null,
                        },
                    },
                },
            });
            try {
                await (0, routeLifecycleService_1.updateRouteAfterOrderStatusChange)({
                    orderId: String(orderId),
                    newStatus: OrderStatus_1.OrderStatus.CANCELLED,
                    occurredAt: cancelAt,
                });
            }
            catch (e) {
                console.error("Route lifecycle update failed (CANCELLED):", e);
            }
        }
        const io = req.app.get("io");
        if (io) {
            const payload = {
                orderId: String(orderId),
                deliveryBoyId: String(deliveryBoy._id),
                status,
                ...(status === "FAILED" ? { failureReason } : {}),
            };
            io.to("admin_room").emit(status === "FAILED" ? "delivery_attempt_failed" : "delivery_attempt_success", payload);
        }
        res.status(201).json({
            success: true,
            attempt: {
                _id: created._id,
                orderId: String(created.orderId),
                routeId: String(created.routeId),
                deliveryBoyId: String(created.deliveryBoyId),
                status: String(created.status),
                failureReason: created.failureReason ?? null,
                failureNotes: created.failureNotes ?? null,
                attemptedAt: created.attemptedAt,
                location: created.location,
                createdAt: created.createdAt,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.recordDeliveryAttempt = recordDeliveryAttempt;
const getAdminOrderAttempt = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const attempt = await DeliveryAttempt_1.DeliveryAttempt.findOne({
            orderId: new mongoose_1.default.Types.ObjectId(String(orderId)),
        }).lean();
        res.json({
            success: true,
            attempt: attempt
                ? {
                    _id: attempt._id,
                    orderId: String(attempt.orderId),
                    routeId: String(attempt.routeId),
                    deliveryBoyId: String(attempt.deliveryBoyId),
                    status: String(attempt.status),
                    failureReason: attempt.failureReason ?? null,
                    failureNotes: attempt.failureNotes ?? null,
                    attemptedAt: attempt.attemptedAt,
                    location: attempt.location,
                    createdAt: attempt.createdAt,
                }
                : null,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAdminOrderAttempt = getAdminOrderAttempt;
const getAdminCodCollection = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const collection = await CodCollection_1.CodCollection.findOne({
            orderId: new mongoose_1.default.Types.ObjectId(String(orderId)),
        })
            .populate("collectedByActorId", "name phone email")
            .lean();
        res.json({
            success: true,
            codCollection: collection
                ? {
                    _id: String(collection._id),
                    orderId: String(collection.orderId),
                    mode: String(collection.mode),
                    amount: Number(collection.amount),
                    currency: String(collection.currency),
                    collectedAt: collection.collectedAt,
                    idempotencyKey: String(collection.idempotencyKey),
                    upiRef: collection.upiRef ?? null,
                    notes: collection.notes ?? null,
                    collectedBy: collection.collectedByActorId
                        ? {
                            _id: String(collection.collectedByActorId?._id),
                            name: String(collection.collectedByActorId?.name || ""),
                            phone: String(collection.collectedByActorId?.phone || ""),
                            email: collection.collectedByActorId?.email
                                ? String(collection.collectedByActorId?.email)
                                : null,
                        }
                        : null,
                    createdAt: collection.createdAt,
                }
                : null,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAdminCodCollection = getAdminCodCollection;
/**
 * Get delivery boy info
 * GET /api/delivery/info
 */
const getDeliveryBoyInfo = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        const deliveryBoy = await getApprovedDeliveryBoy(user);
        if (!deliveryBoy) {
            res.status(403).json({ error: "Account not approved or delivery profile not active" });
            return;
        }
        console.log(`[GET_INFO] Fetching info for delivery boy: ${deliveryBoy._id} (${deliveryBoy.name})`);
        res.json({
            success: true,
            deliveryBoy: {
                id: deliveryBoy._id,
                name: deliveryBoy.name,
                phone: deliveryBoy.phone,
                email: deliveryBoy.email,
                vehicleType: deliveryBoy.vehicleType,
                availability: deliveryBoy.availability,
                currentLoad: deliveryBoy.currentLoad,
                earnings: deliveryBoy.earnings,
                completedOrdersCount: deliveryBoy.completedOrdersCount,
                isActive: deliveryBoy.isActive,
                currentLocation: deliveryBoy.currentLocation,
            },
        });
    }
    catch (error) {
        console.error("Get delivery boy info error:", error);
        res.status(500).json({
            error: "Failed to fetch delivery info. Please try again later.",
        });
    }
};
exports.getDeliveryBoyInfo = getDeliveryBoyInfo;
/**
 * Get delivery boy's assigned orders
 * GET /api/delivery/orders
 */
const getDeliveryOrders = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        const deliveryBoy = await getApprovedDeliveryBoy(user);
        if (!deliveryBoy) {
            res.status(403).json({ error: "Account not approved or delivery profile not active" });
            return;
        }
        console.log(`[GET_ORDERS] Fetching orders for delivery boy: ${deliveryBoy._id} (${deliveryBoy.name}) with userId: ${user._id}`);
        // Only return active delivery workflow orders (include legacy casing for compatibility)
        // Also support legacy data where deliveryBoyId accidentally stored the delivery user's _id.
        const orders = await Order_1.Order.find({
            $or: [
                { deliveryBoyId: deliveryBoy._id },
                { deliveryBoyId: user._id },
            ],
            orderStatus: {
                $in: [
                    // canonical
                    "CONFIRMED",
                    "PACKED",
                    "ASSIGNED",
                    "PICKED_UP",
                    "IN_TRANSIT",
                    // legacy
                    "OUT_FOR_DELIVERY",
                    "confirmed",
                    "packed",
                    "assigned",
                    "picked_up",
                    "in_transit",
                    "out_for_delivery",
                ],
            },
        })
            .populate("userId", "name phone")
            .sort({ createdAt: -1 });
        console.log(`[GET_ORDERS] Found ${orders.length} orders for userId ${user._id} (deliveryBoy ${deliveryBoy._id})`);
        orders.forEach(order => {
            console.log(`  - Order ${order._id}: status=${order.orderStatus}, deliveryStatus=${order.deliveryStatus}`);
        });
        const normalizedOrders = orders.map((o) => {
            const raw = String(o.orderStatus || "").toUpperCase();
            if (raw === "OUT_FOR_DELIVERY") {
                return { ...o.toObject(), orderStatus: "IN_TRANSIT" };
            }
            return o;
        });
        const computedCompletedOrdersCount = await Order_1.Order.countDocuments({
            $and: [
                {
                    $or: [
                        { deliveryBoyId: deliveryBoy._id },
                        { deliveryBoyId: user._id },
                        { deliveryPartnerId: user._id },
                    ],
                },
                {
                    $or: [
                        { orderStatus: { $in: ["DELIVERED", "delivered"] } },
                        { deliveryStatus: { $in: ["delivered"] } },
                    ],
                },
            ],
        });
        res.json({
            success: true,
            deliveryBoy: {
                id: deliveryBoy._id,
                name: deliveryBoy.name,
                availability: deliveryBoy.availability,
                earnings: deliveryBoy.earnings,
                completedOrdersCount: computedCompletedOrdersCount,
            },
            orders: normalizedOrders,
        });
    }
    catch (error) {
        console.error("Get delivery orders error:", error);
        res.status(500).json({
            error: "Failed to fetch orders. Please try again later.",
        });
    }
};
exports.getDeliveryOrders = getDeliveryOrders;
/**
 * Accept an order assignment
 * POST /api/delivery/orders/:orderId/accept
 */
const acceptOrder = async (req, res) => {
    throw new Error("Order status mutation is frozen. Use orderStateService.transition()");
};
exports.acceptOrder = acceptOrder;
/**
 * Reject an order assignment
 * POST /api/delivery/orders/:orderId/reject
 */
const rejectOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason } = req.body;
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        const deliveryBoy = await getApprovedDeliveryBoy(user);
        if (!deliveryBoy) {
            res.status(403).json({ error: "Account not approved or delivery profile not active" });
            return;
        }
        // Find the order
        const order = await Order_1.Order.findById(orderId);
        if (!order) {
            res.status(404).json({ error: "Order not found" });
            return;
        }
        // Add to assignment history
        order.assignmentHistory.push({
            riderId: deliveryBoy._id,
            offeredAt: new Date(),
            rejectedAt: new Date(),
            status: "rejected",
        });
        await order.save();
        // Emit socket event to reassign
        const io = req.app.get("io");
        if (io) {
            io.to("admin_room").emit("order:rejected", {
                orderId: order._id,
                deliveryBoyId: deliveryBoy._id,
                reason,
            });
        }
        res.json({
            success: true,
            message: "Order rejected",
        });
    }
    catch (error) {
        console.error("Reject order error:", error);
        res.status(500).json({
            error: "Failed to reject order. Please try again later.",
        });
    }
};
exports.rejectOrder = rejectOrder;
/**
 * Update delivery boy location
 * PUT /api/delivery/location
 */
const updateLocation = async (req, res) => {
    try {
        const { lat, lng, accuracy, speed, heading, timestamp, routeId, } = req.body;
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        const latNum = Number(lat);
        const lngNum = Number(lng);
        const accuracyNum = Number(accuracy);
        const tsNum = Number(timestamp);
        const routeIdStr = String(routeId || "").trim();
        if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
            res.status(422).json({ error: "Invalid lat/lng" });
            return;
        }
        if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
            res.status(422).json({ error: "Invalid lat/lng" });
            return;
        }
        if (!routeIdStr) {
            res.status(422).json({ error: "routeId is required" });
            return;
        }
        if (!Number.isFinite(accuracyNum)) {
            res.status(422).json({ error: "accuracy is required" });
            return;
        }
        if (accuracyNum > 50) {
            res.status(422).json({ error: "GPS accuracy too low" });
            return;
        }
        if (!Number.isFinite(tsNum)) {
            res.status(422).json({ error: "timestamp is required" });
            return;
        }
        const now = Date.now();
        if (now - tsNum > 30000) {
            res.status(422).json({ error: "stale timestamp" });
            return;
        }
        const deliveryBoy = await getApprovedDeliveryBoy(user);
        if (!deliveryBoy) {
            res.status(403).json({ error: "Account not approved or delivery profile not active" });
            return;
        }
        if (String(deliveryBoy.availability || "").toLowerCase() === "offline") {
            res.status(403).json({ error: "OFF_DUTY" });
            return;
        }
        // Lightweight abuse protection: max 1 update/sec, burst 5. If exceeded, drop silently.
        if (!liveLocationStore_1.liveLocationStore.allowIngest(String(deliveryBoy._id))) {
            res.status(204).send();
            return;
        }
        // Route ownership validation: must match the delivery boy's current active route.
        const activeRoute = await Route_1.Route.findOne({
            deliveryBoyId: deliveryBoy._id,
            status: { $in: ["ASSIGNED", "IN_PROGRESS"] },
        })
            .select("routeId orderIds status")
            .lean();
        if (!activeRoute) {
            res.status(403).json({ error: "NO_ACTIVE_ROUTE" });
            return;
        }
        if (String(activeRoute.routeId) !== routeIdStr) {
            res.status(403).json({ error: "ROUTE_MISMATCH" });
            return;
        }
        // Anti-spoof: reject impossible jumps using server receive time (do not trust client time).
        const driverIdStr = String(deliveryBoy._id);
        const prev = liveLocationStore_1.liveLocationStore.get(driverIdStr);
        if (prev) {
            const dtSec = Math.max(0.001, (now - prev.receivedAt) / 1000);
            const distM = haversineMeters({ lat: prev.lat, lng: prev.lng }, { lat: latNum, lng: lngNum });
            const speedKmh = (distM / dtSec) * 3.6;
            if (speedKmh > 120) {
                res.status(422).json({ error: "impossible jump" });
                return;
            }
        }
        const speedNum = speed == null ? null : Number(speed);
        const headingNum = heading == null ? null : Number(heading);
        const orderIds = Array.isArray(activeRoute.orderIds)
            ? activeRoute.orderIds.map((x) => String(x))
            : [];
        liveLocationStore_1.liveLocationStore.update(driverIdStr, {
            routeId: routeIdStr,
            orderIds,
            lat: latNum,
            lng: lngNum,
            accuracy: accuracyNum,
            speed: Number.isFinite(speedNum) ? speedNum : null,
            heading: Number.isFinite(headingNum) ? headingNum : null,
            timestamp: tsNum,
        });
        res.status(204).send();
        return;
    }
    catch (error) {
        console.error("Update location error:", error);
        res.status(500).json({
            error: "Failed to update location. Please try again later.",
        });
    }
};
exports.updateLocation = updateLocation;
/**
 * Toggle delivery boy online/offline status
 * PUT /api/delivery/status
 */
const toggleStatus = async (req, res) => {
    try {
        const { isOnline } = req.body;
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        const deliveryBoy = await getApprovedDeliveryBoy(user);
        if (!deliveryBoy) {
            res.status(403).json({ error: "Account not approved or delivery profile not active" });
            return;
        }
        // Update availability
        deliveryBoy.availability = isOnline ? "available" : "offline";
        await deliveryBoy.save();
        // Emit socket event
        const io = req.app.get("io");
        if (io) {
            io.to("admin_room").emit("driver:status:update", {
                driverId: deliveryBoy._id,
                availability: deliveryBoy.availability,
            });
        }
        res.json({
            success: true,
            message: `Status updated to ${deliveryBoy.availability}`,
            availability: deliveryBoy.availability,
        });
    }
    catch (error) {
        console.error("Toggle status error:", error);
        res.status(500).json({
            error: "Failed to update status. Please try again later.",
        });
    }
};
exports.toggleStatus = toggleStatus;
/**
 * Get delivery boy earnings
 * GET /api/delivery/earnings
 */
const getEarnings = async (req, res) => {
    try {
        const { from, to } = req.query;
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        const deliveryBoy = await getApprovedDeliveryBoy(user);
        if (!deliveryBoy) {
            res.status(403).json({ error: "Account not approved or delivery profile not active" });
            return;
        }
        const range = {};
        if (from)
            range.$gte = new Date(from);
        if (to)
            range.$lte = new Date(to);
        const query = {
            $and: [
                {
                    $or: [
                        { deliveryBoyId: deliveryBoy._id },
                        { deliveryBoyId: user._id },
                        { deliveryPartnerId: user._id },
                    ],
                },
                {
                    $or: [
                        { orderStatus: { $in: ["DELIVERED", "delivered"] } },
                        { deliveryStatus: { $in: ["delivered"] } },
                    ],
                },
            ],
        };
        if (from || to) {
            query.$and.push({
                $or: [
                    { deliveredAt: range },
                    { $and: [{ deliveredAt: { $exists: false } }, { createdAt: range }] },
                ],
            });
        }
        // Get completed orders
        const orders = await Order_1.Order.find(query).sort({ deliveredAt: -1, createdAt: -1 });
        // Calculate earnings
        const totalEarnings = orders.reduce((sum, order) => sum + (order.earnings?.deliveryFee || 0), 0);
        const totalTips = orders.reduce((sum, order) => sum + (order.earnings?.tip || 0), 0);
        res.json({
            success: true,
            earnings: {
                total: deliveryBoy.earnings,
                deliveryFees: totalEarnings,
                tips: totalTips,
                completedOrders: orders.length,
            },
            orders: orders.map((order) => ({
                _id: order._id,
                amount: order.totalAmount,
                deliveryFee: order.earnings?.deliveryFee || 0,
                tip: order.earnings?.tip || 0,
                createdAt: order.createdAt,
                address: order.address,
            })),
        });
    }
    catch (error) {
        console.error("Get earnings error:", error);
        res.status(500).json({
            error: "Failed to fetch earnings. Please try again later.",
        });
    }
};
exports.getEarnings = getEarnings;
/**
 * Mark order as picked up
 * POST /api/delivery/orders/:orderId/pickup
 */
const pickupOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        const deliveryBoy = await getApprovedDeliveryBoy(user);
        if (!deliveryBoy) {
            res.status(403).json({ error: "Account not approved or delivery profile not active" });
            return;
        }
        const order = await orderStateService_1.orderStateService.transition({
            orderId,
            toStatus: OrderStatus_1.OrderStatus.PICKED_UP,
            actorRole: "DELIVERY_PARTNER",
            actorId: String(deliveryBoy._id),
        });
        try {
            await (0, routeLifecycleService_1.updateRouteAfterOrderStatusChange)({
                orderId: String(orderId),
                newStatus: OrderStatus_1.OrderStatus.PICKED_UP,
                occurredAt: new Date(),
            });
        }
        catch (e) {
            console.error("Route lifecycle update failed (PICKED_UP):", e);
        }
        const io = req.app.get("io");
        if (io) {
            io.to("admin_room").emit("order_picked_up", {
                orderId: String(orderId),
                deliveryBoyId: String(deliveryBoy._id),
            });
            io.to(`delivery_${String(deliveryBoy._id)}`).emit("order_picked_up", {
                orderId: String(orderId),
                deliveryBoyId: String(deliveryBoy._id),
            });
            io.to(`driver_${String(deliveryBoy._id)}`).emit("order_picked_up", {
                orderId: String(orderId),
                deliveryBoyId: String(deliveryBoy._id),
            });
        }
        res.json({ success: true, order });
    }
    catch (error) {
        const statusCode = Number(error?.statusCode) || 500;
        res.status(statusCode).json({ error: error?.message || "Failed to pickup order" });
    }
};
exports.pickupOrder = pickupOrder;
/**
 * Start delivery (in transit)
 * POST /api/delivery/orders/:orderId/start-delivery
 */
const startDelivery = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        const deliveryBoy = await getApprovedDeliveryBoy(user);
        if (!deliveryBoy) {
            res.status(403).json({ error: "Account not approved or delivery profile not active" });
            return;
        }
        const order = await orderStateService_1.orderStateService.transition({
            orderId,
            toStatus: OrderStatus_1.OrderStatus.IN_TRANSIT,
            actorRole: "DELIVERY_PARTNER",
            actorId: String(deliveryBoy._id),
        });
        try {
            await (0, routeLifecycleService_1.updateRouteAfterOrderStatusChange)({
                orderId: String(orderId),
                newStatus: OrderStatus_1.OrderStatus.IN_TRANSIT,
                occurredAt: new Date(),
            });
        }
        catch (e) {
            console.error("Route lifecycle update failed (IN_TRANSIT):", e);
        }
        res.json({
            success: true,
            order,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.startDelivery = startDelivery;
/**
 * Mark as arrived at delivery location
 * POST /api/delivery/orders/:orderId/arrived
 */
const markArrived = async (req, res) => {
    try {
        const { orderId } = req.params;
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        const deliveryBoy = await getApprovedDeliveryBoy(user);
        if (!deliveryBoy) {
            res.status(403).json({ error: "Account not approved or delivery profile not active" });
            return;
        }
        const order = await Order_1.Order.findById(orderId);
        if (!order) {
            res.status(404).json({ error: "Order not found" });
            return;
        }
        const assignedPartnerId = order.deliveryPartnerId;
        const assignedBoyId = order.deliveryBoyId;
        const actorBoyId = String(deliveryBoy._id);
        const actorUserId = String(user._id);
        const matchesPartner = assignedPartnerId && String(assignedPartnerId) === actorUserId;
        const matchesBoy = assignedBoyId && String(assignedBoyId) === actorBoyId;
        if (!matchesPartner && !matchesBoy) {
            res.status(403).json({ error: "Access denied for this order" });
            return;
        }
        if (order.arrivedAt) {
            res.status(200).json({
                success: true,
                message: "Arrival already recorded",
                order,
            });
            return;
        }
        const status = String(order.orderStatus || "").toUpperCase();
        const okToArrive = status === "IN_TRANSIT" || status === "OUT_FOR_DELIVERY";
        if (!okToArrive) {
            res.status(409).json({
                error: "Invalid order status for arrived",
                message: `Cannot mark arrived when orderStatus=${status}`,
            });
            return;
        }
        order.arrivedAt = new Date();
        await order.save();
        try {
            await Notification_1.default.create({
                userId: new mongoose_1.default.Types.ObjectId(String(order.userId?._id || order.userId)),
                title: "Delivery Arrived",
                message: "Your delivery partner has arrived at the delivery location.",
                body: "Your delivery partner has arrived at the delivery location.",
                type: "delivery_arrived",
                category: "delivery",
                isRead: false,
                orderId: new mongoose_1.default.Types.ObjectId(String(orderId)),
                deepLink: "/notifications",
            });
        }
        catch (e) {
            console.error("Failed to create arrived in-app notification:", e);
        }
        const io = req.app.get("io");
        if (io) {
            const customerRoom = `user_${String(order.userId?._id || order.userId || "")}`;
            if (String(order.userId?._id || order.userId || "")) {
                io.to(customerRoom).emit("notification:refresh");
            }
            io.to("admin_room").emit("order_arrived", {
                orderId: String(orderId),
                deliveryBoyId: String(deliveryBoy._id),
            });
        }
        res.json({ success: true, order });
    }
    catch (error) {
        console.error("Mark arrived error:", error);
        const statusCode = Number(error?.statusCode) || 500;
        res.status(statusCode).json({ error: error?.message || "Failed to mark arrived" });
    }
};
exports.markArrived = markArrived;
const getCodCollection = async (req, res) => {
    try {
        const { orderId } = req.params;
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        const deliveryBoy = await getApprovedDeliveryBoy(user);
        if (!deliveryBoy) {
            res.status(403).json({ error: "Account not approved or delivery profile not active" });
            return;
        }
        const order = await Order_1.Order.findById(orderId).select("_id deliveryBoyId deliveryPartnerId orderStatus deliveryStatus paymentMethod arrivedAt totalAmount");
        if (!order) {
            res.status(404).json({ error: "Order not found" });
            return;
        }
        const assignedPartnerId = order.deliveryPartnerId;
        const assignedBoyId = order.deliveryBoyId;
        const actorBoyId = String(deliveryBoy._id);
        const actorUserId = String(user._id);
        const matchesPartner = assignedPartnerId && String(assignedPartnerId) === actorUserId;
        const matchesBoy = assignedBoyId && String(assignedBoyId) === actorBoyId;
        if (!matchesPartner && !matchesBoy) {
            res.status(403).json({ error: "Access denied for this order" });
            return;
        }
        const collection = await CodCollection_1.CodCollection.findOne({
            orderId: new mongoose_1.default.Types.ObjectId(String(orderId)),
        })
            .select("_id orderId mode amount currency collectedByActorId collectedAt idempotencyKey upiRef notes deviceContext createdAt")
            .lean();
        if (!collection) {
            res.status(404).json({ error: "COD_COLLECTION_NOT_FOUND" });
            return;
        }
        res.json({
            success: true,
            codCollection: {
                _id: String(collection._id),
                orderId: String(collection.orderId),
                mode: String(collection.mode),
                amount: Number(collection.amount),
                currency: String(collection.currency),
                collectedByActorId: String(collection.collectedByActorId),
                collectedAt: collection.collectedAt,
                idempotencyKey: String(collection.idempotencyKey),
                upiRef: collection.upiRef ?? null,
                notes: collection.notes ?? null,
                deviceContext: collection.deviceContext ?? null,
                createdAt: collection.createdAt,
            },
        });
    }
    catch (error) {
        console.error("Get COD collection error:", error);
        const statusCode = Number(error?.statusCode) || 500;
        res.status(statusCode).json({ error: error?.message || "Failed to fetch COD collection" });
    }
};
exports.getCodCollection = getCodCollection;
const createCodCollection = async (req, res) => {
    try {
        const { orderId } = req.params;
        const body = req.body || {};
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        const deliveryBoy = await getApprovedDeliveryBoy(user);
        if (!deliveryBoy) {
            res.status(403).json({ error: "Account not approved or delivery profile not active" });
            return;
        }
        const order = await Order_1.Order.findById(orderId).select("_id deliveryBoyId deliveryPartnerId orderStatus deliveryStatus paymentMethod arrivedAt totalAmount");
        if (!order) {
            res.status(404).json({ error: "Order not found" });
            return;
        }
        const assignedPartnerId = order.deliveryPartnerId;
        const assignedBoyId = order.deliveryBoyId;
        const actorBoyId = String(deliveryBoy._id);
        const actorUserId = String(user._id);
        const matchesPartner = assignedPartnerId && String(assignedPartnerId) === actorUserId;
        const matchesBoy = assignedBoyId && String(assignedBoyId) === actorBoyId;
        if (!matchesPartner && !matchesBoy) {
            res.status(403).json({ error: "Access denied for this order" });
            return;
        }
        const orderStatusUpper = String(order.orderStatus || "").toUpperCase();
        const deliveryStatusLower = String(order.deliveryStatus || "").toLowerCase();
        if (orderStatusUpper === "DELIVERED" || deliveryStatusLower === "delivered") {
            res.status(409).json({ error: "Order is already delivered" });
            return;
        }
        if (orderStatusUpper === "CANCELLED" || deliveryStatusLower === "cancelled") {
            res.status(409).json({ error: "Order is cancelled" });
            return;
        }
        const paymentMethodLower = String(order.paymentMethod || "").toLowerCase();
        if (paymentMethodLower !== "cod") {
            res.status(422).json({ error: "NOT_COD_ORDER" });
            return;
        }
        if (!order.arrivedAt) {
            res.status(409).json({ error: "ARRIVAL_REQUIRED_BEFORE_COD_COLLECTION" });
            return;
        }
        const okToCollect = orderStatusUpper === "IN_TRANSIT" || orderStatusUpper === "OUT_FOR_DELIVERY";
        if (!okToCollect) {
            res.status(409).json({ error: `Invalid order status for COD collection (orderStatus=${orderStatusUpper})` });
            return;
        }
        const mode = String(body?.mode || "").trim().toUpperCase();
        if (mode !== "CASH" && mode !== "UPI") {
            res.status(400).json({ error: "mode must be CASH or UPI" });
            return;
        }
        const idempotencyKey = String(body?.idempotencyKey || "").trim();
        if (!idempotencyKey) {
            res.status(400).json({ error: "idempotencyKey is required" });
            return;
        }
        const amountNum = Number(order.totalAmount);
        if (!Number.isFinite(amountNum) || amountNum < 0) {
            res.status(500).json({ error: "Invalid order amount" });
            return;
        }
        const orderObjectId = new mongoose_1.default.Types.ObjectId(String(orderId));
        const now = new Date();
        let created = null;
        try {
            created = await CodCollection_1.CodCollection.create({
                orderId: orderObjectId,
                mode,
                amount: amountNum,
                currency: "INR",
                collectedByActorId: new mongoose_1.default.Types.ObjectId(String(deliveryBoy._id)),
                collectedAt: now,
                idempotencyKey,
                upiRef: body?.upiRef ? String(body.upiRef).trim() : null,
                notes: body?.notes ? String(body.notes).trim() : null,
                deviceContext: body?.deviceContext && typeof body.deviceContext === "object" ? body.deviceContext : null,
            });
        }
        catch (e) {
            const msg = String(e?.message || "");
            const isDup = e?.code === 11000 || msg.includes("E11000");
            if (isDup) {
                const existing = await CodCollection_1.CodCollection.findOne({ orderId: orderObjectId }).lean();
                if (existing && String(existing.idempotencyKey) === idempotencyKey) {
                    res.status(200).json({
                        success: true,
                        codCollection: {
                            _id: String(existing._id),
                            orderId: String(existing.orderId),
                            mode: String(existing.mode),
                            amount: Number(existing.amount),
                            currency: String(existing.currency),
                            collectedByActorId: String(existing.collectedByActorId),
                            collectedAt: existing.collectedAt,
                            idempotencyKey: String(existing.idempotencyKey),
                            upiRef: existing.upiRef ?? null,
                            notes: existing.notes ?? null,
                            deviceContext: existing.deviceContext ?? null,
                            createdAt: existing.createdAt,
                        },
                    });
                    return;
                }
                res.status(409).json({ error: "COD_COLLECTION_ALREADY_RECORDED" });
                return;
            }
            throw e;
        }
        res.status(201).json({
            success: true,
            codCollection: {
                _id: String(created._id),
                orderId: String(created.orderId),
                mode: String(created.mode),
                amount: Number(created.amount),
                currency: String(created.currency),
                collectedByActorId: String(created.collectedByActorId),
                collectedAt: created.collectedAt,
                idempotencyKey: String(created.idempotencyKey),
                upiRef: created.upiRef ?? null,
                notes: created.notes ?? null,
                deviceContext: created.deviceContext ?? null,
                createdAt: created.createdAt,
            },
        });
    }
    catch (error) {
        console.error("Create COD collection error:", error);
        const statusCode = Number(error?.statusCode) || 500;
        res.status(statusCode).json({ error: error?.message || "Failed to record COD collection" });
    }
};
exports.createCodCollection = createCodCollection;
const deliverAttempt = async (req, res) => {
    try {
        const { orderId } = req.params;
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        const deliveryBoy = await getApprovedDeliveryBoy(user);
        if (!deliveryBoy) {
            res.status(403).json({ error: "Account not approved or delivery profile not active" });
            return;
        }
        const order = await Order_1.Order.findById(orderId).populate("userId", "name phone email");
        if (!order) {
            res.status(404).json({ error: "Order not found" });
            return;
        }
        const assignedPartnerId = order.deliveryPartnerId;
        const assignedBoyId = order.deliveryBoyId;
        const actorId = String(deliveryBoy._id);
        const matchesPartner = assignedPartnerId && String(assignedPartnerId) === actorId;
        const matchesBoy = assignedBoyId && String(assignedBoyId) === actorId;
        if (!matchesPartner && !matchesBoy) {
            res.status(403).json({ error: "Access denied for this order" });
            return;
        }
        const status = String(order.orderStatus || "").toUpperCase();
        const deliveryStatusLower = String(order.deliveryStatus || "").toLowerCase();
        if (status === "CANCELLED" || deliveryStatusLower === "cancelled") {
            res.status(409).json({ error: `Cannot attempt delivery for cancelled order (orderStatus=${status})` });
            return;
        }
        if (!order.arrivedAt) {
            res.status(409).json({ error: "ARRIVAL_REQUIRED_BEFORE_OTP" });
            return;
        }
        const paymentMethodLower = String(order.paymentMethod || "").toLowerCase();
        if (paymentMethodLower === "cod") {
            const existingCollection = await CodCollection_1.CodCollection.findOne({
                orderId: new mongoose_1.default.Types.ObjectId(String(orderId)),
            })
                .select("_id")
                .lean();
            if (!existingCollection?._id) {
                res.status(409).json({ error: "COD_COLLECTION_REQUIRED_BEFORE_OTP" });
                return;
            }
        }
        const okToAttempt = status === "IN_TRANSIT" || status === "OUT_FOR_DELIVERY";
        if (!okToAttempt) {
            res.status(409).json({
                error: "Invalid order status for delivery attempt",
                message: `Cannot attempt delivery when orderStatus=${status}`,
            });
            return;
        }
        const now = new Date();
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        order.deliveryOtp = otp;
        order.deliveryOtpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
        order.deliveryOtpGeneratedAt = now;
        order.deliveryOtpIssuedTo = deliveryBoy._id;
        await order.save();
        const customer = order.userId;
        const otpToSend = String(order.deliveryOtp || "").trim();
        let smsSent = false;
        let emailSent = false;
        if (customer?.phone) {
            const smsMessage = `Your CS Store delivery OTP is ${otpToSend}. Valid for 5 minutes.`;
            try {
                await (0, sms_1.sendSMS)(String(customer.phone), smsMessage);
                smsSent = true;
            }
            catch (e) {
                console.error("Failed to send delivery OTP via SMS:", e);
            }
        }
        if (customer?.email) {
            try {
                await (0, sendDeliveryOtpEmail_1.sendDeliveryOtpEmail)(String(customer.email), otpToSend, String(orderId));
                emailSent = true;
            }
            catch (e) {
                console.error("Failed to send delivery OTP via email:", e);
            }
        }
        try {
            const orderLabel = String(orderId).slice(-6).toUpperCase();
            await Notification_1.default.create({
                userId: new mongoose_1.default.Types.ObjectId(String(order.userId?._id || order.userId)),
                title: "Delivery OTP",
                message: `Your delivery OTP for Order #${orderLabel} is ${otpToSend}`,
                body: `Your delivery OTP for Order #${orderLabel} is ${otpToSend}`,
                type: "delivery_otp",
                category: "delivery",
                priority: "high",
                isRead: false,
                orderId: new mongoose_1.default.Types.ObjectId(String(orderId)),
                deepLink: "/notifications",
            });
        }
        catch (e) {
            console.error("Failed to create OTP in-app notification:", e);
        }
        const io = req.app.get("io");
        if (io) {
            const customerRoom = `user_${String(order.userId?._id || order.userId || "")}`;
            if (String(order.userId?._id || order.userId || "")) {
                io.to(customerRoom).emit("notification:refresh", {
                    kind: "delivery_otp",
                    orderId: String(orderId),
                });
            }
        }
        res.json({
            success: true,
            otpExpiresAt: order.deliveryOtpExpiresAt,
            otpSentTo: {
                sms: smsSent,
                email: emailSent,
            },
        });
    }
    catch (error) {
        console.error("Delivery attempt error:", error);
        const statusCode = Number(error?.statusCode) || 500;
        res.status(statusCode).json({ error: error?.message || "Failed to start delivery attempt" });
    }
};
exports.deliverAttempt = deliverAttempt;
const verifyDeliveryOtp = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { otp, photoUrl, signature, geo, deviceId } = req.body || {};
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        const deliveryBoy = await getApprovedDeliveryBoy(user);
        if (!deliveryBoy) {
            res.status(403).json({ error: "Account not approved or delivery profile not active" });
            return;
        }
        const orderDoc = await Order_1.Order.findById(orderId).select("_id userId orderStatus deliveryStatus deliveryOtpExpiresAt deliveryOtpIssuedTo");
        if (!orderDoc) {
            res.status(404).json({ error: "Order not found" });
            return;
        }
        const status = String(orderDoc.orderStatus || "").toUpperCase();
        const deliveryStatusLower = String(orderDoc.deliveryStatus || "").toLowerCase();
        if (status === "CANCELLED" || deliveryStatusLower === "cancelled") {
            res.status(409).json({ error: `Cannot verify OTP for cancelled order (orderStatus=${status})` });
            return;
        }
        const okToVerify = status === "IN_TRANSIT" || status === "OUT_FOR_DELIVERY";
        if (!okToVerify) {
            res.status(409).json({ error: `Cannot verify OTP for orderStatus=${status}` });
            return;
        }
        if (!otp || String(otp).trim().length !== 4) {
            res.status(400).json({ error: "OTP is required" });
            return;
        }
        const issuedTo = orderDoc.deliveryOtpIssuedTo;
        if (!issuedTo || String(issuedTo) !== String(deliveryBoy._id)) {
            res.status(403).json({ error: "OTP is not issued for this delivery partner" });
            return;
        }
        const order = await orderStateService_1.orderStateService.transition({
            orderId,
            toStatus: OrderStatus_1.OrderStatus.DELIVERED,
            actorRole: "DELIVERY_PARTNER",
            actorId: String(deliveryBoy._id),
            meta: {
                otp,
                photoUrl,
                signature,
                geo,
                deviceId,
            },
        });
        try {
            await Order_1.Order.findByIdAndUpdate(orderId, {
                $unset: { deliveryOtp: 1, deliveryOtpExpiresAt: 1 },
            });
        }
        catch (e) {
            console.error("Failed to invalidate delivery OTP after verification:", e);
        }
        try {
            await (0, routeLifecycleService_1.updateRouteAfterOrderStatusChange)({
                orderId: String(orderId),
                newStatus: OrderStatus_1.OrderStatus.DELIVERED,
                occurredAt: new Date(),
            });
        }
        catch (e) {
            console.error("Route lifecycle update failed (DELIVERED):", e);
        }
        const io = req.app.get("io");
        if (io) {
            io.to("admin_room").emit("order_delivered", {
                orderId: String(orderId),
                deliveryBoyId: String(deliveryBoy._id),
            });
            const customerRoom = `user_${String(order?.userId || "")}`;
            if (String(order?.userId || "")) {
                io.to(customerRoom).emit("order_delivered", {
                    orderId: String(orderId),
                });
            }
        }
        res.json({ success: true, order });
    }
    catch (error) {
        console.error("Verify OTP error:", error);
        const statusCode = Number(error?.statusCode) || 500;
        res.status(statusCode).json({ error: error?.message || "Failed to verify OTP" });
    }
};
exports.verifyDeliveryOtp = verifyDeliveryOtp;
/**
 * Complete delivery with OTP verification
 * POST /api/delivery/orders/:orderId/complete
 */
const completeDelivery = async (req, res, next) => {
    try {
        res.status(410).json({
            error: "This endpoint is disabled. Use /verify-otp to complete delivery.",
        });
    }
    catch (error) {
        next(error);
    }
};
exports.completeDelivery = completeDelivery;
/**
 * Fail delivery
 * POST /api/delivery/orders/:orderId/fail
 */
const failDelivery = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const { failureReasonCode, failureNotes } = req.body || {};
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        const deliveryBoy = await getApprovedDeliveryBoy(user);
        if (!deliveryBoy) {
            res.status(403).json({ error: "Account not approved or delivery profile not active" });
            return;
        }
        const order = await orderStateService_1.orderStateService.transition({
            orderId,
            toStatus: OrderStatus_1.OrderStatus.FAILED,
            actorRole: "DELIVERY_PARTNER",
            actorId: String(deliveryBoy._id),
            meta: {
                failureReasonCode,
                failureNotes,
            },
        });
        try {
            await (0, routeLifecycleService_1.updateRouteAfterOrderStatusChange)({
                orderId: String(orderId),
                newStatus: OrderStatus_1.OrderStatus.FAILED,
                occurredAt: new Date(),
            });
        }
        catch (e) {
            console.error("Route lifecycle update failed (FAILED):", e);
        }
        res.json({
            success: true,
            order,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.failDelivery = failDelivery;
/**
 * REMOVED: Resend OTP for delivery verification
 * This was part of the arrived status workflow which has been removed
 * POST /api/delivery/orders/:orderId/resend-otp
 */
/* COMMENTED OUT - ARRIVED STATUS REMOVED
export const resendDeliveryOTP = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { orderId } = req.params;
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const deliveryBoy = await DeliveryBoy.findOne({ userId: user._id, isActive: true });
    if (!deliveryBoy) {
      res.status(404).json({ error: "Delivery profile not found" });
      return;
    }

    const order = await Order.findById(orderId).populate('userId');
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    // Verify ownership
    if (order.deliveryBoyId?.toString() !== user._id.toString()) {
      res.status(403).json({ error: "You are not assigned to this order" });
      return;
    }

    // Only allow resend if order is in arrived status
    if (order.deliveryStatus !== "arrived") {
      res.status(400).json({
        error: `Can only resend OTP when status is arrived. Current status: ${order.deliveryStatus}`
      });
      return;
    }

    // Generate new 4-digit OTP
    const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
    order.deliveryOtp = newOtp;
    order.deliveryOtpExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    
    await order.save();

    // Send OTP to customer via SMS and Email
    const customer = order.userId as any;
    
    console.log('='.repeat(80));
    console.log(`🔔 RESENDING DELIVERY OTP - ORDER ${orderId}`);
    console.log('='.repeat(80));
    console.log(`📦 Order ID: ${orderId}`);
    console.log(`🔑 New OTP: ${order.deliveryOtp}`);
    console.log(`⏰ OTP Expires: ${order.deliveryOtpExpiresAt}`);
    console.log(`👤 Customer Details:`);
    console.log(`   - Name: ${customer?.name || 'N/A'}`);
    console.log(`   - Email: ${customer?.email || 'N/A'}`);
    console.log(`   - Phone: ${customer?.phone || 'N/A'}`);
    console.log('='.repeat(80));
    
    if (customer && customer.phone) {
      const smsMessage = `Your CS Store delivery OTP has been resent. Your OTP is ${order.deliveryOtp}. Valid for 30 minutes.`;
      try {
        await sendSMS(customer.phone, smsMessage);
        console.log(`✅ OTP resent via SMS to customer ${customer.phone}`);
      } catch (smsError) {
        console.error("❌ Failed to resend SMS OTP:", smsError);
      }
    } else {
      console.log(`⚠️ No phone number available for customer`);
    }

    if (customer && customer.email) {
      try {
        await sendEmailOTP(customer.email, order.deliveryOtp);
        console.log(`✅ OTP resent via email to customer ${customer.email}`);
      } catch (emailError) {
        console.error("❌ Failed to resend email OTP:", emailError);
      }
    } else {
      console.log(`⚠️ No email available for customer`);
    }
    
    console.log('='.repeat(80));
    
    // Determine what was actually sent
    const sentToPhone = customer && customer.phone;
    const sentToEmail = customer && customer.email;
    let notificationMessage = "New OTP:";
    let responseMessage = "OTP resent";
    
    if (sentToPhone && sentToEmail) {
      notificationMessage = "New OTP sent to your phone and email.";
      responseMessage += " to customer's phone and email";
    } else if (sentToEmail) {
      notificationMessage = "New OTP sent to your email.";
      responseMessage += " to customer's email";
    } else if (sentToPhone) {
      notificationMessage = "New OTP sent to your phone.";
      responseMessage += " to customer's phone";
    } else {
      notificationMessage = `Your OTP is: ${order.deliveryOtp}`;
      responseMessage += " (no contact info available)";
    }

    // Emit socket event
    const io = (req as any).app.get("io");
    if (io) {
      io.to(`user_${order.userId}`).emit("order:otpResent", {
        orderId: order._id,
        message: notificationMessage,
        otp: !sentToPhone && !sentToEmail ? order.deliveryOtp : undefined,
      });
    }

    res.json({
      success: true,
      message: responseMessage,
      otp: order.deliveryOtp, // Include OTP in response for testing
      otpSentTo: {
        email: sentToEmail ? customer.email : null,
        phone: sentToPhone ? customer.phone : null,
      },
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({ error: "Failed to resend OTP" });
  }
};
*/
