"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeDeliveryBoy = exports.deleteProduct = exports.updateProduct = exports.getDashboardStats = exports.exportOrders = exports.getAdminDeliveryBoys = exports.getAdminOrders = exports.getAdminProducts = exports.getUsers = exports.getAdminProfile = exports.getStats = void 0;
const Order_1 = require("../models/Order");
const User_1 = require("../models/User");
const Product_1 = require("../models/Product");
const DeliveryBoy_1 = require("../models/DeliveryBoy");
const csv_writer_1 = require("csv-writer");
const getStats = async (req, res) => {
    try {
        const { period = "month", from, to } = req.query;
        const now = new Date();
        let startDate;
        let endDate = now;
        if (from && to) {
            startDate = new Date(from);
            endDate = new Date(to);
        }
        else if (period === "day") {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }
        else if (period === "week") {
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }
        else if (period === "month") {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        else {
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
        const salesData = await Order_1.Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
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
                    averageOrderValue: { $avg: "$totalAmount" },
                },
            },
            { $sort: { _id: 1 } },
        ]);
        const monthlySales = await Order_1.Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    paymentStatus: "paid",
                },
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m", date: "$createdAt" },
                    },
                    totalSales: { $sum: "$totalAmount" },
                    orderCount: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);
        const ordersByStatus = await Order_1.Order.aggregate([
            {
                $match: { createdAt: { $gte: startDate, $lte: endDate } },
            },
            {
                $group: {
                    _id: "$orderStatus",
                    count: { $sum: 1 },
                    totalValue: { $sum: "$totalAmount" },
                },
            },
        ]);
        const paymentStatusBreakdown = await Order_1.Order.aggregate([
            {
                $match: { createdAt: { $gte: startDate, $lte: endDate } },
            },
            {
                $group: {
                    _id: "$paymentStatus",
                    count: { $sum: 1 },
                    totalValue: { $sum: "$totalAmount" },
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
                    busyDrivers: {
                        $sum: { $cond: [{ $eq: ["$availability", "busy"] }, 1, 0] },
                    },
                    totalEarnings: { $sum: "$earnings" },
                    totalCompletedOrders: { $sum: "$completedOrdersCount" },
                    averageEarnings: { $avg: "$earnings" },
                },
            },
        ]);
        const driverPerformance = await DeliveryBoy_1.DeliveryBoy.find({ isActive: true })
            .select("name phone vehicleType availability earnings completedOrdersCount assignedOrders")
            .populate("assignedOrders", "orderStatus totalAmount")
            .sort({ completedOrdersCount: -1 })
            .limit(10);
        const userStats = await User_1.User.aggregate([
            {
                $group: {
                    _id: "$role",
                    count: { $sum: 1 },
                },
            },
        ]);
        const topProducts = await Order_1.Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    paymentStatus: "paid",
                },
            },
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.name",
                    totalQuantity: { $sum: "$items.qty" },
                    totalRevenue: { $sum: { $multiply: ["$items.price", "$items.qty"] } },
                },
            },
            { $sort: { totalRevenue: -1 } },
            { $limit: 10 },
        ]);
        const recentOrders = await Order_1.Order.find({
            createdAt: { $gte: startDate, $lte: endDate },
        })
            .populate("userId", "name phone")
            .populate("deliveryBoyId", "name phone")
            .sort({ createdAt: -1 })
            .limit(10);
        res.json({
            salesData,
            monthlySales,
            ordersByStatus,
            paymentStatusBreakdown,
            deliveryStats: deliveryStats[0] || {},
            driverPerformance,
            userStats,
            topProducts,
            recentOrders,
            period,
            startDate,
            endDate,
        });
    }
    catch (error) {
        console.error("Admin stats error:", error);
        res.status(500).json({ error: "Failed to fetch stats" });
        return;
    }
};
exports.getStats = getStats;
const getAdminProfile = async (req, res) => {
    try {
        const adminUser = req.user;
        if (!adminUser) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        if (adminUser.role !== "admin") {
            return res
                .status(403)
                .json({ error: "Access denied. Admin role required." });
        }
        const adminProfile = {
            name: adminUser.name || "Unknown",
            email: adminUser.email || "Unknown",
            phone: adminUser.phone || "Unknown",
            role: adminUser.role || "admin",
        };
        return res.json(adminProfile);
    }
    catch (error) {
        console.error("Admin profile error:", error);
        return res.status(500).json({ error: "Failed to fetch admin profile" });
    }
};
exports.getAdminProfile = getAdminProfile;
const getUsers = async (req, res) => {
    try {
        const adminUser = req.user;
        if (!adminUser) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        if (adminUser.role !== "admin") {
            return res
                .status(403)
                .json({ error: "Access denied. Admin role required." });
        }
        const users = await User_1.User.find({})
            .select("name email phone role createdAt isActive")
            .sort({ createdAt: -1 });
        return res.json({ users });
    }
    catch (error) {
        console.error("Admin users error:", error);
        return res.status(500).json({ error: "Failed to fetch users" });
    }
};
exports.getUsers = getUsers;
const getAdminProducts = async (req, res) => {
    try {
        const adminUser = req.user;
        if (!adminUser) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        if (adminUser.role !== "admin") {
            return res
                .status(403)
                .json({ error: "Access denied. Admin role required." });
        }
        const products = await Product_1.Product.find({})
            .select("name price stock category weight images description createdAt updatedAt")
            .sort({ createdAt: -1 });
        return res.json({ products });
    }
    catch (error) {
        console.error("Admin products error:", error);
        return res.status(500).json({ error: "Failed to fetch products" });
    }
};
exports.getAdminProducts = getAdminProducts;
const getAdminOrders = async (req, res) => {
    try {
        const adminUser = req.user;
        if (!adminUser) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        if (adminUser.role !== "admin") {
            return res
                .status(403)
                .json({ error: "Access denied. Admin role required." });
        }
        const orders = await Order_1.Order.find({})
            .populate("userId", "name email phone")
            .populate("deliveryBoyId", "name phone")
            .sort({ createdAt: -1 });
        return res.json({ orders });
    }
    catch (error) {
        console.error("Admin orders error:", error);
        return res.status(500).json({ error: "Failed to fetch orders" });
    }
};
exports.getAdminOrders = getAdminOrders;
const getAdminDeliveryBoys = async (req, res) => {
    try {
        const adminUser = req.user;
        if (!adminUser) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        if (adminUser.role !== "admin") {
            return res
                .status(403)
                .json({ error: "Access denied. Admin role required." });
        }
        const deliveryBoys = await DeliveryBoy_1.DeliveryBoy.find({})
            .populate("assignedOrders", "orderStatus totalAmount createdAt")
            .sort({ createdAt: -1 });
        return res.json({ deliveryBoys });
    }
    catch (error) {
        console.error("Admin delivery boys error:", error);
        return res.status(500).json({ error: "Failed to fetch delivery boys" });
    }
};
exports.getAdminDeliveryBoys = getAdminDeliveryBoys;
const exportOrders = async (req, res) => {
    try {
        const { from, to, format = "csv" } = req.query;
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
        if (format === "labels") {
            const labelsData = orders.map((order) => ({
                orderId: order._id.toString().slice(-6),
                customerName: order.userId?.name || "N/A",
                customerPhone: order.userId?.phone || "N/A",
                address: `${order.address.addressLine}, ${order.address.city}, ${order.address.pincode}`,
                items: order.items
                    .map((item) => `${item.name} (Qty: ${item.qty})`)
                    .join(", "),
                totalAmount: order.totalAmount,
                orderStatus: order.orderStatus,
                deliveryBoy: order.deliveryBoyId?.name || "Not Assigned",
                createdAt: order.createdAt.toLocaleDateString(),
            }));
            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", `attachment; filename="order-labels-${from || "all"}-${to || "all"}.csv"`);
            const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
                path: "/tmp/order-labels.csv",
                header: [
                    { id: "orderId", title: "Order #" },
                    { id: "customerName", title: "Customer" },
                    { id: "customerPhone", title: "Phone" },
                    { id: "address", title: "Delivery Address" },
                    { id: "items", title: "Items" },
                    { id: "totalAmount", title: "Amount" },
                    { id: "orderStatus", title: "Status" },
                    { id: "deliveryBoy", title: "Driver" },
                    { id: "createdAt", title: "Date" },
                ],
            });
            await csvWriter.writeRecords(labelsData);
            res.download("/tmp/order-labels.csv");
        }
        else {
            const csvData = orders.map((order) => ({
                orderId: order._id,
                customerName: order.userId?.name || "N/A",
                customerPhone: order.userId?.phone || "N/A",
                deliveryBoy: order.deliveryBoyId?.name || "Not Assigned",
                deliveryBoyPhone: order.deliveryBoyId?.phone || "N/A",
                totalAmount: order.totalAmount,
                orderStatus: order.orderStatus,
                paymentStatus: order.paymentStatus,
                address: `${order.address.addressLine}, ${order.address.city}, ${order.address.pincode}`,
                items: order.items
                    .map((item) => `${item.name} (₹${item.price} x ${item.qty})`)
                    .join("; "),
                itemsCount: order.items.length,
                createdAt: order.createdAt.toISOString(),
                updatedAt: order.updatedAt.toISOString(),
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
                    { id: "deliveryBoyPhone", title: "Driver Phone" },
                    { id: "totalAmount", title: "Total Amount" },
                    { id: "orderStatus", title: "Order Status" },
                    { id: "paymentStatus", title: "Payment Status" },
                    { id: "address", title: "Delivery Address" },
                    { id: "items", title: "Items" },
                    { id: "itemsCount", title: "Items Count" },
                    { id: "createdAt", title: "Created At" },
                    { id: "updatedAt", title: "Updated At" },
                ],
            });
            await csvWriter.writeRecords(csvData);
            res.download("/tmp/orders.csv");
        }
    }
    catch (error) {
        console.error("Export error:", error);
        res.status(500).json({ error: "Failed to export orders" });
        return;
    }
};
exports.exportOrders = exportOrders;
const getDashboardStats = async (req, res) => {
    try {
        const adminUser = req.user;
        if (!adminUser) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        if (adminUser.role !== "admin") {
            return res
                .status(403)
                .json({ error: "Access denied. Admin role required." });
        }
        const totalProducts = await Product_1.Product.countDocuments();
        const totalUsers = await User_1.User.countDocuments();
        const totalOrders = await Order_1.Order.countDocuments();
        const totalDeliveryBoys = await DeliveryBoy_1.DeliveryBoy.countDocuments();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentOrders = await Order_1.Order.countDocuments({
            createdAt: { $gte: thirtyDaysAgo },
        });
        const totalRevenue = await Order_1.Order.aggregate([
            { $match: { paymentStatus: "paid" } },
            { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]);
        res.json({
            totalProducts,
            totalUsers,
            totalOrders,
            totalDeliveryBoys,
            recentOrders,
            totalRevenue: totalRevenue[0]?.total || 0,
        });
        return;
    }
    catch (error) {
        console.error("Dashboard stats error:", error);
        res.status(500).json({ error: "Failed to fetch dashboard stats" });
        return;
    }
};
exports.getDashboardStats = getDashboardStats;
const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, price, category, stock, weight, image, images } = req.body;
        const adminUser = req.user;
        if (!adminUser) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        if (adminUser.role !== "admin") {
            return res
                .status(403)
                .json({ error: "Access denied. Admin role required." });
        }
        if (!name || !description || !price || !category || stock === undefined) {
            return res.status(400).json({
                error: "Name, description, price, category, and stock are required",
            });
        }
        const updateData = {
            name,
            description,
            price: Number(price),
            category,
            stock: Number(stock),
            weight: weight ? Number(weight) : undefined,
            updatedAt: new Date(),
        };
        if (images && Array.isArray(images)) {
            updateData.images = images;
        }
        else if (image) {
            updateData.images = [image];
        }
        const product = await Product_1.Product.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        });
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }
        res.json({
            message: "Product updated successfully",
            product,
        });
    }
    catch (error) {
        console.error("Update product error:", error);
        res.status(500).json({ error: "Failed to update product" });
        return;
    }
};
exports.updateProduct = updateProduct;
const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const adminUser = req.user;
        if (!adminUser) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        if (adminUser.role !== "admin") {
            return res
                .status(403)
                .json({ error: "Access denied. Admin role required." });
        }
        const product = await Product_1.Product.findByIdAndDelete(id);
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }
        res.json({
            message: "Product deleted successfully",
        });
    }
    catch (error) {
        console.error("Delete product error:", error);
        res.status(500).json({ error: "Failed to delete product" });
        return;
    }
};
exports.deleteProduct = deleteProduct;
const makeDeliveryBoy = async (req, res) => {
    try {
        const { id } = req.params;
        const adminUser = req.user;
        if (!adminUser) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        if (adminUser.role !== "admin") {
            return res
                .status(403)
                .json({ error: "Access denied. Admin role required." });
        }
        const user = await User_1.User.findById(id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const existingDeliveryBoy = await DeliveryBoy_1.DeliveryBoy.findOne({
            phone: user.phone,
        });
        if (existingDeliveryBoy) {
            return res.status(400).json({ error: "User is already a delivery boy" });
        }
        user.role = "delivery";
        await user.save();
        const deliveryBoy = new DeliveryBoy_1.DeliveryBoy({
            name: user.name,
            phone: user.phone,
            vehicleType: "bike",
            currentLocation: {
                lat: 0,
                lng: 0,
                lastUpdatedAt: new Date(),
            },
            availability: "offline",
            isActive: true,
            earnings: 0,
            completedOrdersCount: 0,
            assignedOrders: [],
        });
        await deliveryBoy.save();
        res.json({
            success: true,
            message: "User promoted to Delivery Boy",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
            deliveryBoy: {
                id: deliveryBoy._id,
                name: deliveryBoy.name,
                phone: deliveryBoy.phone,
                vehicleType: deliveryBoy.vehicleType,
            },
        });
    }
    catch (error) {
        console.error("Make delivery boy error:", error);
        res.status(500).json({ error: "Failed to promote user to delivery boy" });
        return;
    }
};
exports.makeDeliveryBoy = makeDeliveryBoy;
//# sourceMappingURL=adminController.js.map