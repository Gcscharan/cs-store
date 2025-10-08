"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportOrders = exports.getStats = void 0;
const Order_1 = require("../models/Order");
const User_1 = require("../models/User");
const DeliveryBoy_1 = require("../models/DeliveryBoy");
const csv_writer_1 = require("csv-writer");
const getStats = async (req, res) => {
    try {
        const { period = "month" } = req.query;
        const now = new Date();
        let startDate;
        if (period === "day") {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }
        else if (period === "week") {
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }
        else {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        const salesData = await Order_1.Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate },
                    paymentStatus: "paid",
                },
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                    },
                    totalSales: { $sum: "$totalAmount" },
                    orderCount: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);
        const ordersByStatus = await Order_1.Order.aggregate([
            {
                $match: { createdAt: { $gte: startDate } },
            },
            {
                $group: {
                    _id: "$orderStatus",
                    count: { $sum: 1 },
                },
            },
        ]);
        const deliveryStats = await DeliveryBoy_1.DeliveryBoy.aggregate([
            {
                $group: {
                    _id: null,
                    totalDrivers: { $sum: 1 },
                    activeDrivers: {
                        $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
                    },
                    availableDrivers: {
                        $sum: { $cond: [{ $eq: ["$availability", "available"] }, 1, 0] },
                    },
                    totalEarnings: { $sum: "$earnings" },
                    totalCompletedOrders: { $sum: "$completedOrdersCount" },
                },
            },
        ]);
        const userStats = await User_1.User.aggregate([
            {
                $group: {
                    _id: "$role",
                    count: { $sum: 1 },
                },
            },
        ]);
        res.json({
            salesData,
            ordersByStatus,
            deliveryStats: deliveryStats[0] || {},
            userStats,
            period,
            startDate,
            endDate: now,
        });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch stats" });
    }
};
exports.getStats = getStats;
const exportOrders = async (req, res) => {
    try {
        const { from, to } = req.query;
        const query = {};
        if (from && to) {
            query.createdAt = {
                $gte: new Date(from),
                $lte: new Date(to),
            };
        }
        const orders = await Order_1.Order.find(query)
            .populate("userId", "name phone")
            .populate("deliveryBoyId", "name phone")
            .sort({ createdAt: -1 });
        const csvData = orders.map((order) => ({
            orderId: order._id,
            customerName: order.userId?.name || "N/A",
            customerPhone: order.userId?.phone || "N/A",
            deliveryBoy: order.deliveryBoyId?.name || "Not Assigned",
            totalAmount: order.totalAmount,
            orderStatus: order.orderStatus,
            paymentStatus: order.paymentStatus,
            address: `${order.address.addressLine}, ${order.address.city}, ${order.address.pincode}`,
            createdAt: order.createdAt.toISOString(),
        }));
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="orders-${from || "all"}-${to || "all"}.csv"`);
        const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
            path: "/tmp/orders.csv",
            header: [
                { id: "orderId", title: "Order ID" },
                { id: "customerName", title: "Customer Name" },
                { id: "customerPhone", title: "Customer Phone" },
                { id: "deliveryBoy", title: "Delivery Boy" },
                { id: "totalAmount", title: "Total Amount" },
                { id: "orderStatus", title: "Order Status" },
                { id: "paymentStatus", title: "Payment Status" },
                { id: "address", title: "Address" },
                { id: "createdAt", title: "Created At" },
            ],
        });
        await csvWriter.writeRecords(csvData);
        res.download("/tmp/orders.csv");
    }
    catch (error) {
        res.status(500).json({ error: "Failed to export orders" });
    }
};
exports.exportOrders = exportOrders;
//# sourceMappingURL=adminController.js.map