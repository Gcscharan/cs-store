"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelOrder = exports.getOrderById = exports.getOrders = void 0;
const Order_1 = require("../models/Order");
const Product_1 = require("../models/Product");
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
            .populate("deliveryBoyId", "name phone vehicleType");
        const total = await Order_1.Order.countDocuments(query);
        res.json({
            orders,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch orders" });
    }
};
exports.getOrders = getOrders;
const getOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const userRole = req.user.role;
        const query = { _id: id };
        if (userRole !== "admin") {
            query.userId = userId;
        }
        const order = await Order_1.Order.findOne(query)
            .populate("deliveryBoyId", "name phone vehicleType currentLocation")
            .populate("items.productId", "name images");
        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }
        res.json(order);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch order" });
    }
};
exports.getOrderById = getOrderById;
const cancelOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const order = await Order_1.Order.findOne({ _id: id, userId });
        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }
        if (order.orderStatus === "delivered") {
            return res.status(400).json({ error: "Cannot cancel delivered order" });
        }
        if (order.orderStatus === "cancelled") {
            return res.status(400).json({ error: "Order already cancelled" });
        }
        order.orderStatus = "cancelled";
        await order.save();
        for (const item of order.items) {
            await Product_1.Product.findByIdAndUpdate(item.productId, {
                $inc: { stock: item.qty },
            });
        }
        res.json({
            message: "Order cancelled successfully",
            order,
        });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to cancel order" });
    }
};
exports.cancelOrder = cancelOrder;
//# sourceMappingURL=orderController.js.map