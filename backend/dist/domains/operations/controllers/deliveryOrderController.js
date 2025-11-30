"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeDelivery = exports.markArrived = exports.startDelivery = exports.pickupOrder = exports.getEarnings = exports.toggleStatus = exports.updateLocation = exports.rejectOrder = exports.acceptOrder = exports.getDeliveryOrders = exports.getDeliveryBoyInfo = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Order_1 = require("../../../models/Order");
const DeliveryBoy_1 = require("../../../models/DeliveryBoy");
const Notification_1 = __importDefault(require("../../../models/Notification"));
const sms_1 = require("../../../utils/sms");
const sendDeliveryOtpEmail_1 = require("../../../utils/sendDeliveryOtpEmail");
const notificationService_1 = require("../../communication/services/notificationService");
const deliveryPartnerLoadService_1 = require("../services/deliveryPartnerLoadService");
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
        // Find delivery boy record - ONLY active ones
        const deliveryBoy = await DeliveryBoy_1.DeliveryBoy.findOne({
            userId: user._id,
            isActive: true
        });
        if (!deliveryBoy) {
            console.log(`[GET_INFO] Delivery profile not found for user: ${user._id}`);
            res.status(404).json({ error: "Delivery profile not found" });
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
        // Find delivery boy record - ONLY active ones
        const deliveryBoy = await DeliveryBoy_1.DeliveryBoy.findOne({
            userId: user._id,
            isActive: true
        });
        if (!deliveryBoy) {
            console.log(`[GET_ORDERS] Delivery profile not found for user: ${user._id}`);
            res.status(404).json({ error: "Delivery profile not found" });
            return;
        }
        console.log(`[GET_ORDERS] Fetching orders for delivery boy: ${deliveryBoy._id} (${deliveryBoy.name}) with userId: ${user._id}`);
        // Get all orders assigned to this delivery boy
        // Note: deliveryBoyId in orders stores the User ID (for population), not DeliveryBoy ID
        const orders = await Order_1.Order.find({
            deliveryBoyId: user._id,
            orderStatus: { $nin: ["cancelled", "delivered"] },
        })
            .populate("userId", "name phone")
            .sort({ createdAt: -1 });
        console.log(`[GET_ORDERS] Found ${orders.length} orders for userId ${user._id} (deliveryBoy ${deliveryBoy._id})`);
        orders.forEach(order => {
            console.log(`  - Order ${order._id}: status=${order.orderStatus}, deliveryStatus=${order.deliveryStatus}`);
        });
        res.json({
            success: true,
            deliveryBoy: {
                id: deliveryBoy._id,
                name: deliveryBoy.name,
                availability: deliveryBoy.availability,
                earnings: deliveryBoy.earnings,
            },
            orders,
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
    try {
        const { orderId } = req.params;
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        // Find delivery boy record
        const deliveryBoy = await DeliveryBoy_1.DeliveryBoy.findOne({ userId: user._id, isActive: true });
        if (!deliveryBoy) {
            res.status(404).json({ error: "Delivery profile not found" });
            return;
        }
        // Find the order
        const order = await Order_1.Order.findById(orderId);
        if (!order) {
            res.status(404).json({ error: "Order not found" });
            return;
        }
        // Check if order is already assigned to another delivery boy
        if (order.deliveryBoyId &&
            order.deliveryBoyId.toString() !== user._id.toString()) {
            res.status(400).json({
                error: "Order already assigned to another delivery partner",
            });
            return;
        }
        // Generate 4-digit OTP for delivery verification (only for prepaid orders, not COD)
        let deliveryOtp = null;
        if (order.paymentMethod !== "cod") {
            deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();
        }
        // Update order - store User ID for population consistency
        order.deliveryBoyId = user._id;
        order.orderStatus = "assigned";
        order.deliveryStatus = "assigned";
        if (deliveryOtp) {
            order.deliveryOtp = deliveryOtp;
        }
        // Add to assignment history
        order.assignmentHistory.push({
            riderId: deliveryBoy._id,
            offeredAt: new Date(),
            acceptedAt: new Date(),
            status: "accepted",
        });
        await order.save();
        // Update delivery boy's assigned orders
        if (!deliveryBoy.assignedOrders.includes(order._id)) {
            deliveryBoy.assignedOrders.push(order._id);
            deliveryBoy.currentLoad = (deliveryBoy.currentLoad || 0) + 1;
        }
        deliveryBoy.availability = "busy";
        await deliveryBoy.save();
        // Update load in Redis ZSET for O(1) performance
        await deliveryPartnerLoadService_1.deliveryPartnerLoadService.incrementLoad(user._id.toString(), 1);
        console.log(`📈 Updated Redis load for delivery partner ${user._id} (+1 order, order accepted)`);
        // Emit socket event for real-time update
        const io = req.app.get("io");
        if (io) {
            io.to(`order_${orderId}`).emit("order:accepted", {
                orderId: order._id,
                deliveryBoy: {
                    id: deliveryBoy._id,
                    name: deliveryBoy.name,
                    phone: deliveryBoy.phone,
                    vehicleType: deliveryBoy.vehicleType,
                },
            });
            io.to("admin_room").emit("order:accepted", {
                orderId: order._id,
                deliveryBoyId: deliveryBoy._id,
            });
        }
        res.json({
            success: true,
            message: "Order accepted successfully",
            order: {
                _id: order._id,
                orderStatus: order.orderStatus,
                deliveryOtp,
            },
        });
    }
    catch (error) {
        console.error("Accept order error:", error);
        res.status(500).json({
            error: "Failed to accept order. Please try again later.",
        });
    }
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
        // Find delivery boy record
        const deliveryBoy = await DeliveryBoy_1.DeliveryBoy.findOne({ userId: user._id, isActive: true });
        if (!deliveryBoy) {
            res.status(404).json({ error: "Delivery profile not found" });
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
        const { lat, lng } = req.body;
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        if (!lat || !lng) {
            res.status(400).json({
                error: "Latitude and longitude are required",
            });
            return;
        }
        // Find delivery boy record
        const deliveryBoy = await DeliveryBoy_1.DeliveryBoy.findOne({ userId: user._id, isActive: true });
        if (!deliveryBoy) {
            res.status(404).json({ error: "Delivery profile not found" });
            return;
        }
        // Update location
        deliveryBoy.currentLocation = {
            lat,
            lng,
            lastUpdatedAt: new Date(),
        };
        await deliveryBoy.save();
        // Emit socket event for real-time tracking
        const io = req.app.get("io");
        if (io) {
            io.emit("driver_location_update", {
                driverId: deliveryBoy._id,
                lat,
                lng,
            });
        }
        res.json({
            success: true,
            message: "Location updated",
        });
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
        // Find delivery boy record
        const deliveryBoy = await DeliveryBoy_1.DeliveryBoy.findOne({ userId: user._id, isActive: true });
        if (!deliveryBoy) {
            res.status(404).json({ error: "Delivery profile not found" });
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
        // Find delivery boy record
        const deliveryBoy = await DeliveryBoy_1.DeliveryBoy.findOne({ userId: user._id, isActive: true });
        if (!deliveryBoy) {
            res.status(404).json({ error: "Delivery profile not found" });
            return;
        }
        // Build query for orders
        const query = {
            deliveryBoyId: user._id,
            orderStatus: "delivered",
        };
        if (from || to) {
            query.createdAt = {};
            if (from)
                query.createdAt.$gte = new Date(from);
            if (to)
                query.createdAt.$lte = new Date(to);
        }
        // Get completed orders
        const orders = await Order_1.Order.find(query).sort({ createdAt: -1 });
        // Calculate earnings
        const totalEarnings = orders.reduce((sum, order) => sum + (order.earnings?.deliveryFee || 0), 0);
        const totalTips = orders.reduce((sum, order) => sum + (order.earnings?.tip || 0), 0);
        res.json({
            success: true,
            earnings: {
                total: deliveryBoy.earnings,
                deliveryFees: totalEarnings,
                tips: totalTips,
                completedOrders: deliveryBoy.completedOrdersCount,
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
        const { location } = req.body;
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        const deliveryBoy = await DeliveryBoy_1.DeliveryBoy.findOne({ userId: user._id, isActive: true });
        if (!deliveryBoy) {
            res.status(404).json({ error: "Delivery profile not found" });
            return;
        }
        const order = await Order_1.Order.findById(orderId);
        if (!order) {
            console.log(`[PICKUP] Order not found: ${orderId}`);
            res.status(404).json({ error: "Order not found" });
            return;
        }
        console.log(`[PICKUP] Attempt by delivery boy ${deliveryBoy._id} for order ${orderId}`);
        console.log(`[PICKUP] Order status: ${order.orderStatus}, Delivery status: ${order.deliveryStatus}`);
        console.log(`[PICKUP] Assigned to: ${order.deliveryBoyId}`);
        // Idempotency check - if already picked up by same delivery partner, return success
        if (order.deliveryStatus === "picked_up" && order.deliveryBoyId?.toString() === user._id.toString()) {
            console.log(`[PICKUP] Order already picked up (idempotent call) - returning success`);
            const populatedOrder = await Order_1.Order.findById(orderId)
                .populate("userId", "name phone")
                .populate("deliveryBoyId", "name phone");
            res.json({
                success: true,
                message: "Order already picked up",
                order: populatedOrder,
            });
            return;
        }
        // Validate order is assigned to a delivery partner
        if (!order.deliveryBoyId) {
            console.log(`[PICKUP] FAILED: Order not assigned to any delivery partner`);
            res.status(400).json({
                error: "Order must be assigned to a delivery partner before pickup",
                currentStatus: {
                    orderStatus: order.orderStatus,
                    deliveryStatus: order.deliveryStatus,
                }
            });
            return;
        }
        // Verify ownership - order must be assigned to this delivery partner
        if (order.deliveryBoyId?.toString() !== user._id.toString()) {
            console.log(`[PICKUP] FAILED: Order assigned to different delivery partner`);
            res.status(403).json({
                error: "Order assigned to another delivery partner",
                assignedTo: order.deliveryBoyId.toString(),
            });
            return;
        }
        // Validate order status is "assigned"
        if (order.orderStatus !== "assigned") {
            console.log(`[PICKUP] FAILED: Invalid order status: ${order.orderStatus}`);
            res.status(400).json({
                error: `Order must be assigned before pickup. Current order status: ${order.orderStatus}`,
                currentStatus: {
                    orderStatus: order.orderStatus,
                    deliveryStatus: order.deliveryStatus,
                }
            });
            return;
        }
        // Validate delivery status is "assigned"
        if (order.deliveryStatus !== "assigned") {
            console.log(`[PICKUP] FAILED: Invalid delivery status: ${order.deliveryStatus}`);
            res.status(400).json({
                error: `Cannot pick up order in delivery status: ${order.deliveryStatus}. Order must be in "assigned" status.`,
                currentStatus: {
                    orderStatus: order.orderStatus,
                    deliveryStatus: order.deliveryStatus,
                }
            });
            return;
        }
        // Update status
        order.deliveryStatus = "picked_up";
        order.orderStatus = "picked_up";
        order.pickedUpAt = new Date();
        if (location) {
            order.riderLocation = {
                lat: location.lat,
                lng: location.lng,
                updatedAt: new Date(),
            };
        }
        // Add to history
        order.history = order.history || [];
        order.history.push({
            status: "picked_up",
            deliveryStatus: "picked_up",
            updatedBy: deliveryBoy._id,
            updatedByRole: "delivery",
            timestamp: new Date(),
            meta: { location },
        });
        await order.save();
        console.log(`[PICKUP] SUCCESS: Order ${orderId} picked up by delivery boy ${deliveryBoy._id}`);
        // Send order picked up notification
        try {
            await (0, notificationService_1.dispatchNotification)(order.userId.toString(), 'ORDER_PICKED_UP', {
                orderId: order._id.toString(),
                orderNumber: order._id.toString(),
                amount: order.totalAmount
            });
        }
        catch (notificationError) {
            console.error("Failed to send order picked up notification:", notificationError);
        }
        // Emit socket event
        const io = req.app.get("io");
        if (io) {
            io.to(`user_${order.userId}`).emit("order:statusUpdate", {
                orderId: order._id,
                status: "picked_up",
                deliveryStatus: "picked_up",
                message: "Your order has been picked up",
            });
            io.to("admin_room").emit("order:statusUpdate", {
                orderId: order._id,
                status: "picked_up",
                deliveryStatus: "picked_up",
            });
        }
        res.json({
            success: true,
            message: "Order marked as picked up",
            order,
        });
    }
    catch (error) {
        console.error("Pickup order error:", error);
        res.status(500).json({ error: "Failed to mark order as picked up" });
    }
};
exports.pickupOrder = pickupOrder;
/**
 * Start delivery (in transit)
 * POST /api/delivery/orders/:orderId/start-delivery
 */
const startDelivery = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { location } = req.body;
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        const deliveryBoy = await DeliveryBoy_1.DeliveryBoy.findOne({ userId: user._id, isActive: true });
        if (!deliveryBoy) {
            res.status(404).json({ error: "Delivery profile not found" });
            return;
        }
        const order = await Order_1.Order.findById(orderId);
        if (!order) {
            res.status(404).json({ error: "Order not found" });
            return;
        }
        // Verify ownership
        if (order.deliveryBoyId?.toString() !== user._id.toString()) {
            res.status(403).json({ error: "You are not assigned to this order" });
            return;
        }
        // Idempotency check
        if (order.deliveryStatus === "in_transit") {
            res.json({
                success: true,
                message: "Delivery already in transit",
                order,
            });
            return;
        }
        // Validate current status
        if (order.deliveryStatus !== "picked_up") {
            res.status(400).json({
                error: `Cannot start delivery from status: ${order.deliveryStatus}`
            });
            return;
        }
        // Generate 4-digit OTP for delivery verification (only for prepaid orders, not COD)
        if (order.paymentMethod !== "cod") {
            const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();
            const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
            order.deliveryOtp = deliveryOtp;
            order.deliveryOtpExpiresAt = otpExpiresAt;
        }
        // Update status
        order.deliveryStatus = "in_transit";
        order.orderStatus = "in_transit";
        order.inTransitAt = new Date();
        if (location) {
            order.riderLocation = {
                lat: location.lat,
                lng: location.lng,
                updatedAt: new Date(),
            };
        }
        // Add to history
        order.history = order.history || [];
        order.history.push({
            status: "in_transit",
            deliveryStatus: "in_transit",
            updatedBy: deliveryBoy._id,
            updatedByRole: "delivery",
            timestamp: new Date(),
            meta: { location },
        });
        await order.save();
        // Send order in transit notification
        try {
            await (0, notificationService_1.dispatchNotification)(order.userId.toString(), 'ORDER_IN_TRANSIT', {
                orderId: order._id.toString(),
                orderNumber: order._id.toString(),
                amount: order.totalAmount
            });
        }
        catch (notificationError) {
            console.error("Failed to send order in transit notification:", notificationError);
        }
        // Get customer details for OTP sending
        const User = mongoose_1.default.model("User");
        const Notification = mongoose_1.default.model("Notification");
        const customer = await User.findById(order.userId);
        if (customer) {
            const customerEmail = customer.email;
            const customerPhone = customer.phone;
            const orderId = order._id.toString();
            console.log("=".repeat(80));
            console.log("🚚 DELIVERY STARTED - SENDING OTP");
            console.log("=".repeat(80));
            console.log(`📦 Order ID: ${orderId}`);
            console.log(`🔑 OTP: ${order.deliveryOtp}`);
            console.log(`⏰ Expires: ${order.deliveryOtpExpiresAt?.toLocaleString()}`);
            console.log(`📧 Email: ${customerEmail}`);
            console.log(`📱 Phone: ${customerPhone}`);
            console.log("=".repeat(80));
            // Send OTP to customer for delivery verification (only for prepaid orders)
            if (order.userId && order.paymentMethod !== "cod" && order.deliveryOtp) {
                // Send OTP via SMS if phone exists
                if (customerPhone) {
                    try {
                        await (0, sms_1.sendSMS)(customerPhone, `Your CS Store delivery OTP for order #${orderId} is: ${order.deliveryOtp}. Valid for 10 minutes. Share with delivery person only.`);
                        console.log(`✅ SMS sent to ${customerPhone}`);
                    }
                    catch (error) {
                        console.error("❌ Failed to send SMS:", error);
                    }
                }
                // Send OTP via Email
                if (customerEmail) {
                    try {
                        await (0, sendDeliveryOtpEmail_1.sendDeliveryOtpEmail)(customerEmail, order.deliveryOtp, orderId);
                        console.log(`✅ Email sent to ${customerEmail}`);
                    }
                    catch (error) {
                        console.error("❌ Failed to send email:", error);
                    }
                }
                // Create notification for customer
                try {
                    await Notification.create({
                        userId: order.userId,
                        title: "Delivery Verification OTP",
                        message: `Your OTP for order #${orderId} is ${order.deliveryOtp}. Valid for 10 minutes.`,
                        type: "delivery_otp",
                        orderId: order._id,
                    });
                    console.log("✅ Notification created");
                }
                catch (error) {
                    console.error("❌ Failed to create notification:", error);
                }
            }
        }
        // Emit socket event
        const io = req.app.get("io");
        if (io) {
            io.to(`user_${order.userId}`).emit("order:statusUpdate", {
                orderId: order._id,
                status: "in_transit",
                deliveryStatus: "in_transit",
                message: "Your order is on the way",
            });
            io.to("admin_room").emit("order:statusUpdate", {
                orderId: order._id,
                status: "in_transit",
                deliveryStatus: "in_transit",
            });
        }
        res.json({
            success: true,
            message: "Delivery started",
            order,
        });
    }
    catch (error) {
        console.error("Start delivery error:", error);
        res.status(500).json({ error: "Failed to start delivery" });
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
        const { location } = req.body;
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        const deliveryBoy = await DeliveryBoy_1.DeliveryBoy.findOne({ userId: user._id, isActive: true });
        if (!deliveryBoy) {
            res.status(404).json({ error: "Delivery profile not found" });
            return;
        }
        const order = await Order_1.Order.findById(orderId).populate('userId');
        if (!order) {
            res.status(404).json({ error: "Order not found" });
            return;
        }
        // Verify ownership
        if (order.deliveryBoyId?.toString() !== user._id.toString()) {
            res.status(403).json({ error: "You are not assigned to this order" });
            return;
        }
        // Validate current status
        if (order.deliveryStatus !== "in_transit") {
            res.status(400).json({
                error: `Cannot mark arrived from status: ${order.deliveryStatus}`
            });
            return;
        }
        // Generate new 4-digit OTP (only for prepaid orders, not COD)
        if (order.paymentMethod !== "cod") {
            const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();
            const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
            order.deliveryOtp = deliveryOtp;
            order.deliveryOtpExpiresAt = otpExpiresAt;
        }
        // Update status
        order.deliveryStatus = "arrived";
        order.orderStatus = "arrived";
        order.arrivedAt = new Date();
        if (location) {
            order.riderLocation = {
                lat: location.lat,
                lng: location.lng,
                updatedAt: new Date(),
            };
        }
        // Add to history
        order.history = order.history || [];
        order.history.push({
            status: "arrived",
            deliveryStatus: "arrived",
            updatedBy: deliveryBoy._id,
            updatedByRole: "delivery",
            timestamp: new Date(),
            meta: { location },
        });
        await order.save();
        // Send order arrived notification
        try {
            await (0, notificationService_1.dispatchNotification)(order.userId.toString(), 'ORDER_ARRIVED_AT_DESTINATION', {
                orderId: order._id.toString(),
                orderNumber: order._id.toString(),
                amount: order.totalAmount
            });
        }
        catch (notificationError) {
            console.error("Failed to send order arrived notification:", notificationError);
        }
        // Send OTP to customer via SMS, Email, and Notification
        const customer = order.userId;
        console.log('='.repeat(80));
        console.log(`🔔 DELIVERY ARRIVED - ORDER ${orderId}`);
        console.log('='.repeat(80));
        console.log(`📦 Order ID: ${orderId}`);
        console.log(`🔑 Generated OTP: ${order.deliveryOtp}`);
        console.log(`⏰ OTP Expires: ${order.deliveryOtpExpiresAt}`);
        console.log(`👤 Customer Details:`);
        console.log(`   - Name: ${customer?.name || 'N/A'}`);
        console.log(`   - Email: ${customer?.email || 'N/A'}`);
        console.log(`   - Phone: ${customer?.phone || 'N/A'}`);
        console.log('='.repeat(80));
        if (customer && customer.phone) {
            const smsMessage = `Your CS Store delivery has arrived! Your OTP for order verification is ${order.deliveryOtp}. Valid for 30 minutes.`;
            try {
                await (0, sms_1.sendSMS)(customer.phone, smsMessage);
                console.log(`✅ OTP sent via SMS to customer ${customer.phone}`);
            }
            catch (smsError) {
                console.error("❌ Failed to send SMS OTP:", smsError);
            }
        }
        else {
            console.log(`⚠️ No phone number available for customer`);
        }
        // Send OTP notifications only for prepaid orders
        if (order.paymentMethod !== "cod" && order.deliveryOtp) {
            if (customer && customer.email) {
                try {
                    await (0, sendDeliveryOtpEmail_1.sendDeliveryOtpEmail)(customer.email, order.deliveryOtp, orderId);
                    console.log(`✅ OTP sent via email to customer ${customer.email}`);
                }
                catch (emailError) {
                    console.error("❌ Failed to send email OTP:", emailError);
                }
            }
            else {
                console.log(`⚠️ No email available for customer`);
            }
            // Create in-app notification
            try {
                await Notification_1.default.create({
                    userId: order.userId,
                    title: "Delivery Verification OTP",
                    message: `Your OTP for order #${orderId} is ${order.deliveryOtp}. Valid for 10 minutes.`,
                    type: "delivery_otp",
                    orderId: order._id,
                });
                console.log("✅ Notification created");
            }
            catch (error) {
                console.error("❌ Failed to create notification:", error);
            }
        }
        console.log('='.repeat(80));
        // Emit socket event
        const io = req.app.get("io");
        if (io) {
            io.to(`user_${order.userId}`).emit("order:statusUpdate", {
                orderId: order._id,
                status: "arrived",
                deliveryStatus: "arrived",
                message: "Your delivery partner has arrived! Check your notifications for OTP.",
            });
            io.to("admin_room").emit("order:statusUpdate", {
                orderId: order._id,
                status: "arrived",
                deliveryStatus: "arrived",
            });
        }
        res.json({
            success: true,
            message: "Marked as arrived. OTP sent to customer!",
            order,
        });
    }
    catch (error) {
        console.error("Mark arrived error:", error);
        res.status(500).json({ error: "Failed to mark as arrived" });
    }
};
exports.markArrived = markArrived;
/**
 * Complete delivery with OTP verification
 * POST /api/delivery/orders/:orderId/complete
 */
const completeDelivery = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { otp, proofPhotoUrl, location } = req.body;
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        const deliveryBoy = await DeliveryBoy_1.DeliveryBoy.findOne({ userId: user._id, isActive: true });
        if (!deliveryBoy) {
            res.status(404).json({ error: "Delivery profile not found" });
            return;
        }
        const order = await Order_1.Order.findById(orderId);
        if (!order) {
            res.status(404).json({ error: "Order not found" });
            return;
        }
        // Verify ownership
        if (order.deliveryBoyId?.toString() !== user._id.toString()) {
            res.status(403).json({ error: "You are not assigned to this order" });
            return;
        }
        // Idempotency check
        if (order.deliveryStatus === "delivered") {
            res.json({
                success: true,
                message: "Order already delivered",
                order,
            });
            return;
        }
        // Validate current status (can complete from in_transit or arrived)
        if (order.deliveryStatus !== "in_transit" && order.deliveryStatus !== "arrived") {
            res.status(400).json({
                error: `Cannot complete delivery from status: ${order.deliveryStatus}. Must be in_transit or arrived.`
            });
            return;
        }
        // Verify OTP if provided
        if (order.deliveryOtp) {
            if (!otp) {
                res.status(400).json({ error: "OTP is required for verification" });
                return;
            }
            // Check OTP expiry (10 minutes)
            if (order.deliveryOtpExpiresAt && order.deliveryOtpExpiresAt < new Date()) {
                res.status(400).json({ error: "OTP expired, please request a new one" });
                return;
            }
            if (otp !== order.deliveryOtp) {
                res.status(400).json({ error: "Invalid OTP. Please try again." });
                return;
            }
        }
        // Update status
        order.deliveryStatus = "delivered";
        order.orderStatus = "delivered";
        order.deliveredAt = new Date();
        // Set delivery proof
        order.deliveryProof = {
            type: otp ? "otp" : "photo",
            value: otp,
            url: proofPhotoUrl,
            verifiedAt: new Date(),
            deliveredBy: deliveryBoy._id,
        };
        if (location) {
            order.riderLocation = {
                lat: location.lat,
                lng: location.lng,
                updatedAt: new Date(),
            };
        }
        // Add to history
        order.history = order.history || [];
        order.history.push({
            status: "delivered",
            deliveryStatus: "delivered",
            updatedBy: deliveryBoy._id,
            updatedByRole: "delivery",
            timestamp: new Date(),
            meta: { otp: otp ? "verified" : undefined, proofPhotoUrl, location },
        });
        await order.save();
        // Update delivery boy stats in MongoDB
        deliveryBoy.completedOrdersCount += 1;
        deliveryBoy.currentLoad = Math.max(0, (deliveryBoy.currentLoad || 1) - 1);
        await deliveryBoy.save();
        // Update load in Redis ZSET for O(1) performance
        await deliveryPartnerLoadService_1.deliveryPartnerLoadService.decrementLoad(user._id.toString(), 1);
        console.log(`📉 Updated Redis load for delivery partner ${user._id} (-1 order, delivery completed)`);
        // Send order delivered notification
        try {
            await (0, notificationService_1.dispatchNotification)(order.userId.toString(), 'ORDER_DELIVERED', {
                orderId: order._id.toString(),
                orderNumber: order._id.toString(),
                amount: order.totalAmount
            });
            // Send feedback request after 2 hours (can be configured)
            setTimeout(async () => {
                try {
                    await (0, notificationService_1.dispatchNotification)(order.userId.toString(), 'FEEDBACK_REQUEST', {
                        orderId: order._id.toString(),
                        orderNumber: order._id.toString()
                    });
                }
                catch (feedbackError) {
                    console.error("Failed to send feedback request:", feedbackError);
                }
            }, 2 * 60 * 60 * 1000); // 2 hours delay
        }
        catch (notificationError) {
            console.error("Failed to send order delivered notification:", notificationError);
        }
        // Emit socket event
        const io = req.app.get("io");
        if (io) {
            io.to(`user_${order.userId}`).emit("order:delivered", {
                orderId: order._id,
                status: "delivered",
                deliveryStatus: "delivered",
                message: "Your order has been delivered!",
            });
            io.to("admin_room").emit("order:delivered", {
                orderId: order._id,
                status: "delivered",
                deliveryStatus: "delivered",
            });
        }
        res.json({
            success: true,
            message: "Delivery completed successfully",
            order,
        });
    }
    catch (error) {
        console.error("Complete delivery error:", error);
        res.status(500).json({ error: "Failed to complete delivery" });
    }
};
exports.completeDelivery = completeDelivery;
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
