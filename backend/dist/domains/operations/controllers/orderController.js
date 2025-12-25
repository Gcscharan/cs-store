"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePaymentStatus = exports.getPaymentStatus = exports.placeOrderCOD = exports.cancelOrder = exports.getOrderById = exports.getOrders = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Order_1 = require("../../../models/Order");
const Pincode_1 = require("../../../models/Pincode");
const DeliveryBoy_1 = require("../../../models/DeliveryBoy");
const Product_1 = require("../../../models/Product");
const Cart_1 = require("../../../models/Cart");
const User_1 = require("../../../models/User");
const deliveryFeeCalculator_1 = require("../../../utils/deliveryFeeCalculator");
const notificationService_1 = require("../../communication/services/notificationService");
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
        res.json({
            order: {
                ...order.toObject(),
                status: order.orderStatus, // Map orderStatus to status for test compatibility
            }
        });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch order" });
    }
};
exports.getOrderById = getOrderById;
const cancelOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const order = await Order_1.Order.findOne({ _id: id, userId });
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
            await Product_1.Product.findByIdAndUpdate(item.productId, {
                $inc: { stock: item.qty },
            });
        }
        // Send cancellation notification
        try {
            await (0, notificationService_1.dispatchNotification)(userId.toString(), 'ORDER_CANCELLED', {
                orderId: order._id.toString(),
                orderNumber: order._id.toString(),
                amount: order.totalAmount
            });
        }
        catch (notificationError) {
            console.error("Failed to send order cancellation notification:", notificationError);
        }
        res.json({
            message: "Order cancelled successfully",
            order: {
                ...order.toObject(),
                status: order.orderStatus, // Map orderStatus to status for test compatibility
            },
        });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to cancel order" });
    }
};
exports.cancelOrder = cancelOrder;
const placeOrderCOD = async (req, res) => {
    try {
        const userId = req.user?._id;
        const { items, address, totalAmount } = req.body;
        if (!userId) {
            return res.status(401).json({ message: "User not authenticated" });
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: "Items are required" });
        }
        if (!address) {
            return res.status(400).json({ message: "Delivery address is required" });
        }
        if (!totalAmount || totalAmount <= 0) {
            return res.status(400).json({ message: "Invalid total amount" });
        }
        // Validate required address fields
        if (!address.label || !address.addressLine || !address.pincode || !address.city || !address.state) {
            return res.status(400).json({ message: "Address is missing required fields (label, addressLine, pincode, city, state)" });
        }
        // Validate that address has valid coordinates (from auto-geocoding)
        // With auto-geocoding, we no longer need strict pincode validation
        if (!address.lat || !address.lng || address.lat === 0 || address.lng === 0) {
            console.error('❌ Order blocked: Invalid address coordinates', {
                pincode: address.pincode,
                lat: address.lat,
                lng: address.lng
            });
            return res.status(400).json({
                error: "Address coordinates are missing. Please update your address with complete details."
            });
        }
        // Optional: Check pincode in database (for logging only, not blocking)
        const pincodeExists = await Pincode_1.Pincode.findOne({ pincode: address.pincode });
        if (!pincodeExists) {
            console.warn(`⚠️ Pincode ${address.pincode} not in database, but allowing order with geocoded coordinates`);
        }
        // Fetch user to get complete address details (name, phone)
        const user = await User_1.User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        // Enrich address with user's name and phone from saved addresses
        const enrichedAddress = { ...address };
        // Try to find matching address from user's saved addresses to get name and phone
        const savedAddress = user.addresses.find((addr) => addr.pincode === address.pincode &&
            addr.label === address.label);
        if (savedAddress) {
            enrichedAddress.name = savedAddress.name || user.name;
            enrichedAddress.phone = savedAddress.phone || user.phone;
        }
        else {
            // Fallback to user's profile name and phone
            enrichedAddress.name = user.name;
            enrichedAddress.phone = user.phone;
        }
        // Convert productId strings to ObjectIds and validate items
        const formattedItems = items.map((item) => {
            if (!item.productId) {
                throw new Error("Item missing productId");
            }
            return {
                productId: typeof item.productId === 'string' ? new mongoose_1.default.Types.ObjectId(item.productId) : item.productId,
                name: item.name || "Product",
                price: Number(item.price) || 0,
                qty: Number(item.qty) || 1,
            };
        });
        // Calculate delivery fee based on user's address
        // Note: totalAmount from frontend already includes delivery fee
        // We need to extract cart subtotal to calculate actual delivery fee
        const cartSubtotal = formattedItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
        // Calculate delivery fee using user's address coordinates
        const deliveryFeeDetails = await (0, deliveryFeeCalculator_1.calculateDeliveryFee)(enrichedAddress, cartSubtotal);
        console.log('💾 Storing Order with Delivery Fee:', {
            orderId: 'pending',
            cartSubtotal: `₹${cartSubtotal}`,
            deliveryFee: `₹${deliveryFeeDetails.finalFee}`,
            totalAmount: `₹${totalAmount}`,
            isFreeDelivery: deliveryFeeDetails.isFreeDelivery,
        });
        // Create order with pending payment (COD)
        const order = new Order_1.Order({
            userId,
            items: formattedItems,
            totalAmount,
            address: enrichedAddress, // Use enriched address with name and phone
            paymentMethod: "cod",
            paymentStatus: "pending",
            orderStatus: "created",
            earnings: {
                deliveryFee: deliveryFeeDetails.finalFee,
                tip: 0,
                commission: 0,
            },
        });
        await order.save();
        // Decrease product stock for each ordered item
        try {
            for (const item of formattedItems) {
                // Use $inc with negative qty, Mongo will prevent race conditions at document level
                const updateResult = await Product_1.Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.qty } }, { new: true });
                if (updateResult && updateResult.stock < 0) {
                    // Ensure stock never goes below 0
                    updateResult.stock = 0;
                    await updateResult.save();
                }
            }
        }
        catch (stockError) {
            console.error("Failed to decrement product stock on COD order", stockError);
        }
        // Optionally auto-assign a delivery boy if available
        const availableDeliveryBoy = await DeliveryBoy_1.DeliveryBoy.findOne({
            availability: "available",
            isActive: true,
        });
        if (availableDeliveryBoy) {
            order.deliveryBoyId = availableDeliveryBoy._id;
            order.orderStatus = "assigned";
            availableDeliveryBoy.assignedOrders.push(order._id);
            availableDeliveryBoy.availability = "busy";
            await availableDeliveryBoy.save();
            await order.save();
        }
        // Clear user's cart after successful order placement
        await Cart_1.Cart.findOneAndUpdate({ userId }, { items: [], total: 0, itemCount: 0 }, { new: true });
        // Send order confirmation notification
        try {
            await (0, notificationService_1.dispatchNotification)(userId.toString(), 'ORDER_CONFIRMED', {
                orderId: order._id.toString(),
                orderNumber: order._id.toString(),
                amount: order.totalAmount
            });
        }
        catch (notificationError) {
            console.error("Failed to send order confirmation notification:", notificationError);
        }
        return res.status(200).json({
            message: "Order placed with Cash on Delivery",
            order,
        });
    }
    catch (error) {
        console.error("COD order placement error:", error);
        return res.status(500).json({
            error: "Failed to place order (COD)",
            message: error.message || "Unknown error occurred"
        });
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
        if (!userId) {
            return res.status(401).json({ message: "User not authenticated" });
        }
        // Find the order
        const order = await Order_1.Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        // Verify the order belongs to the authenticated delivery boy or user
        const deliveryBoy = await DeliveryBoy_1.DeliveryBoy.findOne({ userId, isActive: true });
        const isDeliveryBoy = deliveryBoy && order.deliveryBoyId?.toString() === deliveryBoy._id.toString();
        const isOrderOwner = order.userId.toString() === userId.toString();
        if (!isDeliveryBoy && !isOrderOwner) {
            return res.status(403).json({ message: "You are not authorized to update this order" });
        }
        // Only allow updating payment status for COD orders
        if (order.paymentMethod !== "cod") {
            return res.status(400).json({ message: "Payment status can only be updated for COD orders" });
        }
        // Update payment status to paid with timestamp
        order.paymentStatus = "paid";
        order.paymentReceivedAt = new Date();
        await order.save();
        console.log(`💰 Payment status updated for order ${orderId}: ${order.paymentStatus}`);
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
        return res.status(200).json({
            success: true,
            message: "Payment status updated successfully",
            order,
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
