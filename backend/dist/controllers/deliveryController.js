"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyOrders = exports.updateStatus = exports.updateLocation = exports.assignDelivery = exports.getAvailableDrivers = void 0;
const DeliveryBoy_1 = require("../models/DeliveryBoy");
const Order_1 = require("../models/Order");
const getAvailableDrivers = async (req, res) => {
    try {
        const drivers = await DeliveryBoy_1.DeliveryBoy.find({
            availability: "available",
            isActive: true,
        }).select("name phone vehicleType currentLocation");
        res.json({ drivers });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch available drivers" });
    }
};
exports.getAvailableDrivers = getAvailableDrivers;
const assignDelivery = async (req, res) => {
    try {
        const { orderId, driverId } = req.body;
        const order = await Order_1.Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }
        const driver = await DeliveryBoy_1.DeliveryBoy.findById(driverId);
        if (!driver) {
            return res.status(404).json({ error: "Driver not found" });
        }
        if (driver.availability !== "available") {
            return res.status(400).json({ error: "Driver not available" });
        }
        order.deliveryBoyId = driver._id;
        order.orderStatus = "assigned";
        await order.save();
        driver.assignedOrders.push(order._id);
        driver.availability = "busy";
        await driver.save();
        res.json({
            message: "Order assigned to driver successfully",
            order,
            driver,
        });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to assign delivery" });
    }
};
exports.assignDelivery = assignDelivery;
const updateLocation = async (req, res) => {
    try {
        const { lat, lng } = req.body;
        const driverId = req.user._id;
        const driver = await DeliveryBoy_1.DeliveryBoy.findById(driverId);
        if (!driver) {
            return res.status(404).json({ error: "Driver not found" });
        }
        driver.currentLocation = {
            lat,
            lng,
            lastUpdatedAt: new Date(),
        };
        await driver.save();
        res.json({
            message: "Location updated successfully",
            location: driver.currentLocation,
        });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update location" });
    }
};
exports.updateLocation = updateLocation;
const updateStatus = async (req, res) => {
    try {
        const { orderId, status, proofImage } = req.body;
        const driverId = req.user._id;
        const order = await Order_1.Order.findOne({
            _id: orderId,
            deliveryBoyId: driverId,
        });
        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }
        order.orderStatus = status;
        await order.save();
        if (status === "delivered") {
            const driver = await DeliveryBoy_1.DeliveryBoy.findById(driverId);
            if (driver) {
                const baseEarnings = 50;
                const distanceEarnings = 0;
                const timeEarnings = 0;
                const totalEarnings = baseEarnings + distanceEarnings + timeEarnings;
                driver.earnings += totalEarnings;
                driver.completedOrdersCount += 1;
                driver.availability = "available";
                driver.assignedOrders = driver.assignedOrders.filter((id) => id.toString() !== orderId);
                await driver.save();
            }
        }
        res.json({
            message: "Status updated successfully",
            order,
        });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update status" });
    }
};
exports.updateStatus = updateStatus;
const getMyOrders = async (req, res) => {
    try {
        const driverId = req.user._id;
        const { status } = req.query;
        const query = { deliveryBoyId: driverId };
        if (status)
            query.orderStatus = status;
        const orders = await Order_1.Order.find(query)
            .sort({ createdAt: -1 })
            .populate("userId", "name phone");
        res.json({ orders });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch orders" });
    }
};
exports.getMyOrders = getMyOrders;
//# sourceMappingURL=deliveryController.js.map