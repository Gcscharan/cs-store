"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRouteOverview = exports.getGstReportHandler = exports.purgeOrders = exports.assignComputedCluster = exports.computeRoutes = exports.makeDeliveryBoy = exports.deleteProduct = exports.updateProduct = exports.getDashboardStats = exports.exportOrders = exports.suspendDeliveryBoy = exports.approveDeliveryBoy = exports.getAdminDeliveryBoys = exports.getAdminOrders = exports.getAdminProducts = exports.getUsers = exports.getAdminProfile = exports.getRouteDetail = exports.listRecentAssignedRoutes = exports.getRouteStatus = exports.assignRoute = exports.listRoutes = exports.getStats = void 0;
const logger_1 = require("../utils/logger");
const mongoose_1 = __importDefault(require("mongoose"));
const crypto_1 = __importDefault(require("crypto"));
const Order_1 = require("../models/Order");
const User_1 = require("../models/User");
const Product_1 = require("../models/Product");
const DeliveryBoy_1 = require("../models/DeliveryBoy");
const Route_1 = require("../models/Route");
const liveLocationStore_1 = require("../services/liveLocationStore");
const csv_writer_1 = require("csv-writer");
const cache_1 = require("../middleware/cache");
const orderStateService_1 = require("../domains/orders/services/orderStateService");
const OrderStatus_1 = require("../domains/orders/enums/OrderStatus");
const cvrpRouteAssignmentService_1 = require("../services/cvrpRouteAssignmentService");
const gstReportService_1 = require("../domains/finance/services/gstReportService");
const getStats = async (req, res) => {
    try {
        const { period = "month", from, to } = req.query;
        // Calculate date range
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
        const dateMatch = { createdAt: { $gte: startDate, $lte: endDate } };
        const paidMatch = { ...dateMatch, paymentStatus: "PAID" };
        // Run all aggregations in parallel for performance
        const [salesData, monthlySales, ordersByStatus, paymentStatusBreakdown, deliveryStats, driverPerformance, userStats, topProducts, recentOrders,] = await Promise.all([
            // Sales analytics with more detailed breakdown
            Order_1.Order.aggregate([
                { $match: paidMatch },
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
            ]),
            // Monthly sales data
            Order_1.Order.aggregate([
                { $match: paidMatch },
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
            ]),
            // Orders by status with detailed breakdown
            Order_1.Order.aggregate([
                { $match: dateMatch },
                {
                    $group: {
                        _id: "$orderStatus",
                        count: { $sum: 1 },
                        totalValue: { $sum: "$totalAmount" },
                    },
                },
            ]),
            // Payment status breakdown
            Order_1.Order.aggregate([
                { $match: dateMatch },
                {
                    $group: {
                        _id: "$paymentStatus",
                        count: { $sum: 1 },
                        totalValue: { $sum: "$totalAmount" },
                    },
                },
            ]),
            // Delivery analytics with performance metrics
            DeliveryBoy_1.DeliveryBoy.aggregate([
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
            ]),
            // Driver performance metrics
            DeliveryBoy_1.DeliveryBoy.find({ isActive: true })
                .select("name phone vehicleType availability earnings completedOrdersCount")
                .sort({ completedOrdersCount: -1 })
                .limit(10)
                .lean(),
            // User stats with role breakdown
            User_1.User.aggregate([
                {
                    $group: {
                        _id: "$role",
                        count: { $sum: 1 },
                    },
                },
            ]),
            // Top products by sales
            Order_1.Order.aggregate([
                { $match: paidMatch },
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
            ]),
            // Recent orders for dashboard
            Order_1.Order.find(dateMatch)
                .select("orderStatus paymentStatus totalAmount createdAt userId deliveryBoyId")
                .populate("userId", "name phone")
                .populate("deliveryBoyId", "name phone")
                .sort({ createdAt: -1 })
                .limit(10)
                .lean(),
        ]);
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
        logger_1.logger.error("Admin stats error:", error);
        res.status(500).json({ error: "Failed to fetch stats" });
        return;
    }
};
exports.getStats = getStats;
const listRoutes = async (req, res) => {
    try {
        const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));
        const routes = await Route_1.Route.find({})
            .sort({ computedAt: -1 })
            .limit(limit)
            .lean();
        res.json({
            success: true,
            routes: routes.map((r) => ({
                routeId: r.routeId,
                vehicleType: r.vehicleType,
                totalDistanceKm: r.totalDistanceKm,
                estimatedTimeMin: r.estimatedTimeMin,
                status: r.status,
                deliveryBoyId: r.deliveryBoyId ? String(r.deliveryBoyId) : null,
                orderIds: Array.isArray(r.orderIds) ? r.orderIds.map((id) => String(id)) : [],
                routePath: Array.isArray(r.routePath) ? r.routePath.map((id) => String(id)) : [],
                totalOrders: Array.isArray(r.orderIds) ? r.orderIds.length : 0,
                deliveredCount: Number(r.deliveredCount || 0),
                failedCount: Number(r.failedCount || 0),
                computedAt: r.computedAt,
                assignedAt: r.assignedAt || null,
                startedAt: r.startedAt || null,
                completedAt: r.completedAt || null,
            })),
        });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to list routes", message: error?.message || "Unknown error" });
    }
};
exports.listRoutes = listRoutes;
const assignRoute = async (req, res) => {
    try {
        const routeId = String(req.params.routeId || "").trim();
        const deliveryBoyId = String(req.body?.deliveryBoyId || "").trim();
        if (!routeId) {
            return res.status(400).json({ error: "routeId is required" });
        }
        if (!deliveryBoyId) {
            return res.status(400).json({ error: "deliveryBoyId is required" });
        }
        const route = await Route_1.Route.findOne({ routeId });
        if (!route) {
            return res.status(404).json({ error: "Route not found" });
        }
        if (String(route.status) !== "CREATED" || route.deliveryBoyId) {
            return res.status(409).json({ error: "Route already assigned or locked" });
        }
        const deliveryBoy = await DeliveryBoy_1.DeliveryBoy.findById(deliveryBoyId).select("_id userId vehicleType isActive");
        if (!deliveryBoy) {
            return res.status(404).json({ error: "Delivery boy not found" });
        }
        const vt = String(deliveryBoy.vehicleType || "");
        const vtUpper = vt.trim().toUpperCase();
        const allowedVehicleTypes = new Set(["AUTO", "CAR"]);
        if (!allowedVehicleTypes.has(vtUpper)) {
            return res.status(400).json({
                error: "Delivery boy vehicleType not allowed",
                message: `vehicleType must be one of ${Array.from(allowedVehicleTypes).join(", ")}, got ${vt}`,
            });
        }
        if (!deliveryBoy.isActive) {
            return res.status(400).json({ error: "Delivery boy is not active" });
        }
        const existingActive = await Route_1.Route.findOne({
            deliveryBoyId: deliveryBoy._id,
            status: { $in: ["ASSIGNED", "IN_PROGRESS"] },
        }).select("routeId status");
        if (existingActive) {
            return res.status(409).json({
                error: "Delivery boy already has an active route",
                message: `Delivery boy already has active route ${String(existingActive.routeId)} (${String(existingActive.status)})`,
            });
        }
        const now = new Date();
        route.deliveryBoyId = deliveryBoy._id;
        route.status = "ASSIGNED";
        route.assignedAt = now;
        await route.save();
        const dpUserId = deliveryBoy.userId ? new mongoose_1.default.Types.ObjectId(String(deliveryBoy.userId)) : null;
        // Transition each order status via orderStateService (required by Order model)
        const orderIds = route.orderIds || [];
        const actorId = String(req.user?._id || "");
        for (const orderId of orderIds) {
            await orderStateService_1.orderStateService.transition({
                orderId: String(orderId),
                toStatus: OrderStatus_1.OrderStatus.ASSIGNED,
                actorRole: "ADMIN",
                actorId,
                meta: {
                    deliveryPartnerName: String(deliveryBoy.name || "") || undefined,
                },
            });
            // Update delivery fields separately (not orderStatus)
            await Order_1.Order.updateOne({ _id: orderId }, {
                $set: {
                    deliveryBoyId: deliveryBoy._id,
                    deliveryPartnerId: dpUserId,
                    deliveryStatus: "in_transit",
                    outForDeliveryAt: now,
                },
            });
        }
        res.json({
            success: true,
            route: {
                routeId: route.routeId,
                status: route.status,
                deliveryBoyId: String(deliveryBoy._id),
                totalOrders: route.orderIds?.length || 0,
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to assign route", message: error?.message || "Unknown error" });
    }
};
exports.assignRoute = assignRoute;
const getRouteStatus = async (req, res) => {
    try {
        const routeId = String(req.params.routeId || "").trim();
        if (!routeId) {
            return res.status(400).json({ error: "routeId is required" });
        }
        const route = await Route_1.Route.findOne({ routeId }).lean();
        if (!route) {
            return res.status(404).json({ error: "Route not found" });
        }
        const totalOrders = Array.isArray(route.orderIds) ? route.orderIds.length : 0;
        const deliveredCount = Number(route.deliveredCount || 0);
        const failedCount = Number(route.failedCount || 0);
        const pendingCount = Math.max(0, totalOrders - deliveredCount - failedCount);
        const start = route.startedAt || route.assignedAt || route.computedAt;
        const elapsedMs = start ? Date.now() - new Date(start).getTime() : 0;
        const elapsedTimeMin = Math.max(0, Math.round(elapsedMs / 60000));
        const estimatedTimeMin = Number(route.estimatedTimeMin || 0);
        const delay = estimatedTimeMin > 0 ? elapsedTimeMin > estimatedTimeMin : false;
        res.json({
            success: true,
            routeId: route.routeId,
            status: route.status,
            deliveredCount,
            failedCount,
            pendingCount,
            elapsedTimeMin,
            estimatedTimeMin,
            delay,
        });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to get route status", message: error?.message || "Unknown error" });
    }
};
exports.getRouteStatus = getRouteStatus;
const listRecentAssignedRoutes = async (req, res) => {
    try {
        const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));
        const routes = await Route_1.Route.find({ assignedAt: { $exists: true, $ne: null } })
            .sort({ assignedAt: -1 })
            .limit(limit)
            .populate("deliveryBoyId", "name phone currentLocation")
            .lean();
        res.json({
            success: true,
            generatedAt: new Date().toISOString(),
            routes: routes.map((r) => {
                const total = Array.isArray(r.orderIds) ? r.orderIds.length : 0;
                const delivered = Number(r.deliveredCount || 0);
                const failed = Number(r.failedCount || 0);
                const pending = Math.max(0, total - delivered - failed);
                const completed = delivered + failed;
                const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;
                const db = r.deliveryBoyId && typeof r.deliveryBoyId === "object" ? r.deliveryBoyId : null;
                return {
                    routeId: r.routeId,
                    status: r.status,
                    assignedAt: r.assignedAt || null,
                    updatedAt: r.updatedAt || null,
                    deliveryBoy: db
                        ? {
                            id: String(db._id),
                            name: String(db.name || ""),
                            phone: String(db.phone || ""),
                        }
                        : null,
                    counts: {
                        total,
                        delivered,
                        failed,
                        pending,
                        completed,
                    },
                    progressPct,
                };
            }),
        });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to list recent assigned routes", message: error?.message || "Unknown error" });
    }
};
exports.listRecentAssignedRoutes = listRecentAssignedRoutes;
function normalizeOrderStatusForOpsDashboard(raw) {
    const upper = String(raw || "").trim().toUpperCase();
    if (!upper)
        return "";
    if (upper === "OUT_FOR_DELIVERY")
        return "IN_TRANSIT";
    if (upper === "PENDING" || upper === "PENDING_PAYMENT")
        return "CREATED";
    return upper;
}
function validateLatLng(latRaw, lngRaw) {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    const ok = Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180 &&
        !(lat === 0 && lng === 0);
    return ok ? { lat, lng, invalid: false } : { lat: null, lng: null, invalid: true };
}
const getRouteDetail = async (req, res) => {
    try {
        const routeId = String(req.params.routeId || "").trim();
        if (!routeId) {
            return res.status(400).json({ error: "routeId is required" });
        }
        const route = await Route_1.Route.findOne({ routeId })
            .populate("deliveryBoyId", "name phone")
            .lean();
        if (!route) {
            return res.status(404).json({ error: "Route not found" });
        }
        const orderedIds = (Array.isArray(route.routePath) ? route.routePath : [])
            .filter((x) => String(x || "").toUpperCase() !== "WAREHOUSE")
            .map((x) => String(x));
        const sequenceById = new Map();
        orderedIds.forEach((id, idx) => sequenceById.set(String(id), idx + 1));
        const orderIds = Array.isArray(route.orderIds) ? route.orderIds : [];
        const orderDocs = await Order_1.Order.find({ _id: { $in: orderIds } })
            .select("_id orderStatus deliveredAt address.lat address.lng")
            .lean();
        const byId = new Map();
        for (const o of orderDocs) {
            byId.set(String(o._id), o);
        }
        const mappedOrders = orderedIds.map((id) => {
            const o = byId.get(id);
            const status = normalizeOrderStatusForOpsDashboard(o ? o.orderStatus : "");
            const { lat, lng, invalid } = validateLatLng(o?.address?.lat, o?.address?.lng);
            return {
                orderId: id,
                sequence: sequenceById.get(id) || null,
                status: status || "UNKNOWN",
                deliveredAt: o?.deliveredAt ? new Date(o.deliveredAt).toISOString() : null,
                invalidLocation: invalid,
                _lat: lat,
                _lng: lng,
            };
        });
        const sortedOrders = mappedOrders.slice().sort((a, b) => {
            const as = typeof a.sequence === "number" ? a.sequence : Number.POSITIVE_INFINITY;
            const bs = typeof b.sequence === "number" ? b.sequence : Number.POSITIVE_INFINITY;
            return as - bs;
        });
        const orders = sortedOrders.map(({ _lat, _lng, ...rest }) => rest);
        const checkpoints = sortedOrders
            .filter((o) => typeof o._lat === "number" && typeof o._lng === "number" && Number.isFinite(o._lat) && Number.isFinite(o._lng))
            .map((o) => ({
            orderId: o.orderId,
            sequence: o.sequence,
            lat: o._lat,
            lng: o._lng,
            status: o.status,
        }));
        const total = orderedIds.length;
        const delivered = Number(route.deliveredCount || 0);
        const failed = Number(route.failedCount || 0);
        const pending = Math.max(0, total - delivered - failed);
        const completed = delivered + failed;
        const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;
        const warehouse = { lat: 17.094, lng: 80.598 };
        const db = route.deliveryBoyId && typeof route.deliveryBoyId === "object" ? route.deliveryBoyId : null;
        const driverIdStr = db?._id ? String(db._id) : "";
        const mem = driverIdStr ? await liveLocationStore_1.liveLocationStore.getAsync(driverIdStr) : null;
        // liveLocation is STRICTLY sourced from memory store (single source of truth)
        // and only when it matches this route.
        const useMemForLiveLocation = Boolean(mem && String(mem.routeId || "") === String(routeId));
        const liveLocationLastUpdatedAtMs = useMemForLiveLocation
            ? Number(mem?.receivedAt || Date.now())
            : null;
        const liveLocationIsStale = typeof liveLocationLastUpdatedAtMs === "number" && Number.isFinite(liveLocationLastUpdatedAtMs)
            ? Date.now() - liveLocationLastUpdatedAtMs > 20000
            : true;
        res.json({
            success: true,
            generatedAt: new Date().toISOString(),
            liveLocation: useMemForLiveLocation && mem && Number.isFinite(Number(mem?.lat)) && Number.isFinite(Number(mem?.lng))
                ? {
                    driverId: driverIdStr,
                    routeId: mem?.routeId ? String(mem.routeId) : null,
                    lat: Number(mem?.lat),
                    lng: Number(mem?.lng),
                    lastUpdatedAt: typeof liveLocationLastUpdatedAtMs === "number" && Number.isFinite(liveLocationLastUpdatedAtMs)
                        ? new Date(liveLocationLastUpdatedAtMs).toISOString()
                        : null,
                    stale: liveLocationIsStale,
                }
                : null,
            route: {
                routeId: route.routeId,
                status: route.status,
                computedAt: route.computedAt || null,
                assignedAt: route.assignedAt || null,
                startedAt: route.startedAt || null,
                completedAt: route.completedAt || null,
                updatedAt: route.updatedAt || null,
                deliveryBoyId: driverIdStr || null,
                deliveryBoy: db
                    ? {
                        id: String(db._id),
                        name: String(db.name || ""),
                        phone: String(db.phone || ""),
                    }
                    : null,
                counts: {
                    total,
                    delivered,
                    failed,
                    pending,
                    completed,
                },
                progressPct,
                warehouse,
                // Outlier fields
                isOutlierRoute: route.isOutlierRoute || false,
                outlierReason: route.outlierReason || null,
            },
            orders,
            checkpoints,
        });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to get route detail", message: error?.message || "Unknown error" });
    }
};
exports.getRouteDetail = getRouteDetail;
const getAdminProfile = async (req, res) => {
    try {
        // Get admin user from authenticated request
        const adminUser = req.user;
        if (!adminUser) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        if (adminUser.role !== "admin") {
            return res
                .status(403)
                .json({ error: "Access denied. Admin role required." });
        }
        // Return only essential admin profile information
        const adminProfile = {
            name: adminUser.name || "Unknown",
            email: adminUser.email || "Unknown",
            phone: adminUser.phone || "Unknown",
            role: adminUser.role || "admin",
        };
        return res.json(adminProfile);
    }
    catch (error) {
        logger_1.logger.error("Admin profile error:", error);
        return res.status(500).json({ error: "Failed to fetch admin profile" });
    }
};
exports.getAdminProfile = getAdminProfile;
const getUsers = async (req, res) => {
    try {
        // Get admin user from authenticated request
        const adminUser = req.user;
        if (!adminUser) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        if (adminUser.role !== "admin") {
            return res
                .status(403)
                .json({ error: "Access denied. Admin role required." });
        }
        // Pagination
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
        const skip = (page - 1) * limit;
        // Role filter
        const roleFilter = req.query.role;
        const query = {};
        if (roleFilter)
            query.role = roleFilter;
        const [users, total] = await Promise.all([
            User_1.User.find(query)
                .select("name email phone role createdAt status")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            User_1.User.countDocuments(query),
        ]);
        return res.json({
            users,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        logger_1.logger.error("Admin users error:", error);
        return res.status(500).json({ error: "Failed to fetch users" });
    }
};
exports.getUsers = getUsers;
const getAdminProducts = async (req, res) => {
    try {
        // Get admin user from authenticated request
        const adminUser = req.user;
        if (!adminUser) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        if (adminUser.role !== "admin") {
            return res
                .status(403)
                .json({ error: "Access denied. Admin role required." });
        }
        // Pagination
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
        const skip = (page - 1) * limit;
        // Category filter
        const categoryFilter = req.query.category;
        const query = { deletedAt: null, isSellable: { $ne: false } };
        if (categoryFilter)
            query.category = categoryFilter;
        const [products, total] = await Promise.all([
            Product_1.Product.find(query)
                .select("name price stock category weight images description createdAt updatedAt")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Product_1.Product.countDocuments(query),
        ]);
        return res.json({
            products,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        logger_1.logger.error("Admin products error:", error);
        return res.status(500).json({ error: "Failed to fetch products" });
    }
};
exports.getAdminProducts = getAdminProducts;
const getAdminOrders = async (req, res) => {
    try {
        // Get admin user from authenticated request
        const adminUser = req.user;
        if (!adminUser) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        if (adminUser.role !== "admin") {
            return res
                .status(403)
                .json({ error: "Access denied. Admin role required." });
        }
        // Pagination
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
        const skip = (page - 1) * limit;
        // Status filter
        const statusFilter = req.query.status;
        const query = {};
        if (statusFilter)
            query.orderStatus = statusFilter;
        // Use .lean() and field projection for performance
        const [orders, total] = await Promise.all([
            Order_1.Order.find(query)
                .select("orderStatus paymentStatus totalAmount createdAt userId deliveryBoyId items payment")
                .populate("userId", "name email phone")
                .populate("deliveryBoyId", "name phone")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Order_1.Order.countDocuments(query),
        ]);
        return res.json({
            orders,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        logger_1.logger.error("Admin orders error:", error);
        return res.status(500).json({ error: "Failed to fetch orders" });
    }
};
exports.getAdminOrders = getAdminOrders;
const getAdminDeliveryBoys = async (req, res) => {
    try {
        // Get admin user from authenticated request
        const adminUser = req.user;
        if (!adminUser) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        if (adminUser.role !== "admin") {
            return res
                .status(403)
                .json({ error: "Access denied. Admin role required." });
        }
        // Pagination
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
        const skip = (page - 1) * limit;
        // Status filter
        const statusFilter = req.query.status;
        const query = {};
        if (statusFilter === "active")
            query.isActive = true;
        else if (statusFilter === "inactive")
            query.isActive = false;
        // Use .lean() and limit fields for performance
        const [deliveryBoys, total] = await Promise.all([
            DeliveryBoy_1.DeliveryBoy.find(query)
                .select("name phone vehicleType availability isActive earnings completedOrdersCount currentLoad lastAssignedAt currentLocation userId")
                .populate("userId", "name email phone status deliveryProfile createdAt")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            DeliveryBoy_1.DeliveryBoy.countDocuments(query),
        ]);
        // Batch fetch missing users by phone to avoid N+1
        const phonesWithoutUser = deliveryBoys
            .filter((db) => !db.userId)
            .map((db) => db.phone)
            .filter(Boolean);
        const additionalUsers = phonesWithoutUser.length
            ? await User_1.User.find({ phone: { $in: phonesWithoutUser }, role: "delivery" })
                .select("name email phone status deliveryProfile createdAt")
                .lean()
            : [];
        const userByPhone = new Map(additionalUsers.map((u) => [u.phone, u]));
        const normalizedDeliveryBoys = deliveryBoys.map((deliveryBoy) => {
            const userDoc = deliveryBoy.userId || userByPhone.get(deliveryBoy.phone);
            return {
                user: userDoc
                    ? {
                        _id: userDoc._id,
                        name: userDoc.name,
                        email: userDoc.email,
                        phone: userDoc.phone,
                        status: userDoc.status,
                        deliveryProfile: userDoc.deliveryProfile,
                        createdAt: userDoc.createdAt,
                    }
                    : null,
                deliveryBoy: {
                    _id: deliveryBoy._id,
                    availability: deliveryBoy.availability,
                    isActive: deliveryBoy.isActive,
                    vehicleType: deliveryBoy.vehicleType,
                    earnings: deliveryBoy.earnings,
                    completedOrdersCount: deliveryBoy.completedOrdersCount,
                    currentLoad: deliveryBoy.currentLoad,
                    lastAssignedAt: deliveryBoy.lastAssignedAt,
                    currentLocation: deliveryBoy.currentLocation,
                },
            };
        });
        return res.json({
            deliveryBoys: normalizedDeliveryBoys.filter((b) => b.user),
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        logger_1.logger.error("Admin delivery boys error:", error);
        return res.status(500).json({ error: "Failed to fetch delivery boys" });
    }
};
exports.getAdminDeliveryBoys = getAdminDeliveryBoys;
const approveDeliveryBoy = async (req, res) => {
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
        const { id } = req.params;
        const user = await User_1.User.findById(id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        if (user.role !== "delivery") {
            return res.status(400).json({ error: "User is not a delivery partner" });
        }
        user.status = "active";
        await user.save();
        const deliveryBoy = (await DeliveryBoy_1.DeliveryBoy.findOne({ userId: user._id })) ||
            (user.phone ? await DeliveryBoy_1.DeliveryBoy.findOne({ phone: user.phone }) : null);
        if (!deliveryBoy) {
            return res.status(404).json({ error: "DeliveryBoy profile not found" });
        }
        deliveryBoy.isActive = true;
        deliveryBoy.availability = "available";
        if (!deliveryBoy.userId) {
            deliveryBoy.userId = user._id;
        }
        await deliveryBoy.save();
        return res.json({
            success: true,
            message: "Delivery partner approved successfully",
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                status: user.status,
            },
            deliveryBoy: {
                _id: deliveryBoy._id,
                isActive: deliveryBoy.isActive,
                availability: deliveryBoy.availability,
            },
        });
    }
    catch (error) {
        logger_1.logger.error("Approve delivery boy error:", error);
        return res
            .status(500)
            .json({ error: "Failed to approve delivery partner" });
    }
};
exports.approveDeliveryBoy = approveDeliveryBoy;
const suspendDeliveryBoy = async (req, res) => {
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
        const { id } = req.params;
        const { reason } = req.body;
        const user = await User_1.User.findById(id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        if (user.role !== "delivery") {
            return res.status(400).json({ error: "User is not a delivery partner" });
        }
        user.status = "suspended";
        await user.save();
        const deliveryBoy = (await DeliveryBoy_1.DeliveryBoy.findOne({ userId: user._id })) ||
            (user.phone ? await DeliveryBoy_1.DeliveryBoy.findOne({ phone: user.phone }) : null);
        if (deliveryBoy) {
            deliveryBoy.isActive = false;
            deliveryBoy.availability = "offline";
            await deliveryBoy.save();
        }
        return res.json({
            success: true,
            message: "Delivery partner suspended successfully",
            reason: reason || "Suspended by admin",
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                status: user.status,
            },
            deliveryBoy: deliveryBoy
                ? {
                    _id: deliveryBoy._id,
                    isActive: deliveryBoy.isActive,
                    availability: deliveryBoy.availability,
                }
                : null,
        });
    }
    catch (error) {
        logger_1.logger.error("Suspend delivery boy error:", error);
        return res
            .status(500)
            .json({ error: "Failed to suspend delivery partner" });
    }
};
exports.suspendDeliveryBoy = suspendDeliveryBoy;
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
            // Generate order labels for printing
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
            // Standard CSV export with detailed information
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
        logger_1.logger.error("Export error:", error);
        res.status(500).json({ error: "Failed to export orders" });
        return;
    }
};
exports.exportOrders = exportOrders;
// Simple dashboard stats for the admin dashboard
const getDashboardStats = async (req, res) => {
    try {
        // Get admin user from authenticated request
        const adminUser = req.user;
        if (!adminUser) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        if (adminUser.role !== "admin") {
            return res
                .status(403)
                .json({ error: "Access denied. Admin role required." });
        }
        // Get basic counts
        const totalProducts = await Product_1.Product.countDocuments();
        const totalUsers = await User_1.User.countDocuments();
        const totalOrders = await Order_1.Order.countDocuments();
        const totalDeliveryBoys = await DeliveryBoy_1.DeliveryBoy.countDocuments();
        // Get recent orders count (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentOrders = await Order_1.Order.countDocuments({
            createdAt: { $gte: thirtyDaysAgo },
        });
        // Get total revenue (from paid orders)
        const totalRevenue = await Order_1.Order.aggregate([
            { $match: { paymentStatus: "PAID" } },
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
        logger_1.logger.error("Dashboard stats error:", error);
        res.status(500).json({ error: "Failed to fetch dashboard stats" });
        return;
    }
};
exports.getDashboardStats = getDashboardStats;
// Update product
const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, price, category, stock, weight, image, images } = req.body;
        // Get admin user from authenticated request
        const adminUser = req.user;
        if (!adminUser) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        if (adminUser.role !== "admin") {
            return res
                .status(403)
                .json({ error: "Access denied. Admin role required." });
        }
        // Validate required fields
        if (!name || !description || !price || !category || stock === undefined) {
            return res.status(400).json({
                error: "Name, description, price, category, and stock are required",
            });
        }
        // Prepare update data
        const updateData = {
            name,
            description,
            price: Number(price),
            category,
            stock: Number(stock),
            weight: weight ? Number(weight) : undefined,
            updatedAt: new Date(),
        };
        // Handle images - prioritize images array over single image
        if (images && Array.isArray(images)) {
            updateData.images = images;
        }
        else if (image) {
            updateData.images = [image];
        }
        // Find and update product
        const product = await Product_1.Product.findOneAndUpdate({ _id: id, deletedAt: null, isSellable: { $ne: false } }, updateData, {
            new: true,
            runValidators: true,
        });
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }
        await cache_1.invalidateCache.product(String(id));
        res.json({
            message: "Product updated successfully",
            product,
        });
    }
    catch (error) {
        logger_1.logger.error("Update product error:", error);
        res.status(500).json({ error: "Failed to update product" });
        return;
    }
};
exports.updateProduct = updateProduct;
// Delete product
const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        // Get admin user from authenticated request
        const adminUser = req.user;
        if (!adminUser) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        if (adminUser.role !== "admin") {
            return res
                .status(403)
                .json({ error: "Access denied. Admin role required." });
        }
        // Soft delete product
        const product = await Product_1.Product.findOneAndUpdate({ _id: id, deletedAt: null, isSellable: { $ne: false } }, { $set: { isSellable: false, isActive: false, deletedAt: new Date() } }, { new: true });
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }
        await cache_1.invalidateCache.product(String(id));
        res.json({
            message: "Product deleted successfully",
        });
    }
    catch (error) {
        logger_1.logger.error("Delete product error:", error);
        res.status(500).json({ error: "Failed to delete product" });
        return;
    }
};
exports.deleteProduct = deleteProduct;
// Make user a delivery boy
const makeDeliveryBoy = async (req, res) => {
    try {
        const { id } = req.params;
        // Get admin user from authenticated request
        const adminUser = req.user;
        if (!adminUser) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        if (adminUser.role !== "admin") {
            return res
                .status(403)
                .json({ error: "Access denied. Admin role required." });
        }
        // Find the user to update
        const user = await User_1.User.findById(id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        // Check if delivery boy record already exists
        const existingDeliveryBoy = await DeliveryBoy_1.DeliveryBoy.findOne({
            phone: user.phone,
        });
        if (existingDeliveryBoy) {
            return res.status(400).json({ error: "User is already a delivery boy" });
        }
        // Update user role to delivery
        user.role = "delivery";
        user.status = "pending";
        await user.save();
        // Create delivery boy record
        const deliveryBoy = new DeliveryBoy_1.DeliveryBoy({
            name: user.name,
            phone: user.phone,
            email: user.email,
            userId: user._id,
            vehicleType: "bike", // Default vehicle type
            currentLocation: {
                lat: 0,
                lng: 0,
                lastUpdatedAt: new Date(),
            },
            availability: "offline",
            isActive: false,
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
        logger_1.logger.error("Make delivery boy error:", error);
        res.status(500).json({ error: "Failed to promote user to delivery boy" });
        return;
    }
};
exports.makeDeliveryBoy = makeDeliveryBoy;
/**
 * Compute optimized routes for pending orders using CVRP algorithm
 * POST /api/admin/routes/compute
 *
 * Request body:
 * {
 *   orderIds?: string[],  // Optional: specific order IDs. If not provided, fetches all PACKED orders
 *   vehicle?: { type: string }  // Optional: defaults to AUTO
 * }
 *
 * Returns optimized routes that can be assigned to delivery boys
 */
const computeRoutes = async (req, res) => {
    try {
        const mode = String((req.query?.mode || "")).toLowerCase();
        const { orderIds, vehicle } = req.body;
        // Default vehicle type is AUTO
        const vehicleInput = vehicle || { type: "AUTO" };
        const isPreview = mode === "preview";
        // This endpoint is intentionally read-only (preview-only). Do not add persistence here.
        if (!isPreview) {
            return res.status(400).json({
                error: "Route computation is preview-only. Use assignment endpoint to persist routes.",
            });
        }
        if (isPreview) {
            vehicleInput.capacity = 1;
            vehicleInput.maxDistanceKm = 1000000;
        }
        // Fetch orders - ALWAYS exclude already-assigned orders and orders in active routes
        let orders;
        // First, find all order IDs that are part of active routes (ASSIGNED, IN_PROGRESS only)
        // Note: CREATED routes are not yet assigned to a delivery boy, so their orders should still be available
        const activeRouteOrderIds = await Route_1.Route.find({
            status: { $in: ["ASSIGNED", "IN_PROGRESS"] },
        })
            .select("orderIds")
            .lean();
        const excludedOrderIds = new Set();
        for (const route of activeRouteOrderIds) {
            for (const oid of route.orderIds || []) {
                excludedOrderIds.add(String(oid));
            }
        }
        logger_1.logger.info("[DEBUG] computeRoutes: Active routes found:", { activeRouteOrderIds: activeRouteOrderIds.length, excludedOrderIds: Array.from(excludedOrderIds) });
        if (orderIds && Array.isArray(orderIds) && orderIds.length > 0) {
            // Fetch specific orders - exclude any that are in active routes
            const validOrderIds = orderIds.filter((id) => !excludedOrderIds.has(String(id)));
            orders = await Order_1.Order.find({
                _id: { $in: validOrderIds },
                orderStatus: { $in: ["PACKED", "packed"] },
                $or: [
                    { deliveryBoyId: { $exists: false } },
                    { deliveryBoyId: null },
                ],
            }).lean();
        }
        else {
            // Fetch all eligible orders - only exclude orders in active routes (ASSIGNED/IN_PROGRESS)
            // Note: We don't filter by deliveryBoyId here because orders in CREATED routes should be reassignable
            const baseQuery = {
                orderStatus: { $in: ["PACKED", "packed"] },
            };
            logger_1.logger.info("[DEBUG] computeRoutes: Fetching orders with query:", JSON.stringify(baseQuery));
            orders = await Order_1.Order.find(baseQuery).lean();
            logger_1.logger.info("[DEBUG] computeRoutes: Found orders before route filter:", orders.length);
            if (orders.length > 0) {
                logger_1.logger.info("[DEBUG] computeRoutes: Order IDs found:", orders.map((o) => String(o._id)));
                logger_1.logger.info("[DEBUG] computeRoutes: Order details:", orders.map((o) => ({ id: String(o._id), status: o.orderStatus, deliveryBoyId: o.deliveryBoyId || null })));
            }
            // Filter out orders that are in active routes
            orders = orders.filter((order) => !excludedOrderIds.has(String(order._id)));
            logger_1.logger.info("[DEBUG] computeRoutes: Orders after excluding active routes:", { ordersCount: orders.length, excludedIds: excludedOrderIds.size });
        }
        if (orders.length === 0) {
            return res.json({
                success: true,
                mode: isPreview ? "PREVIEW" : "COMMIT",
                clusters: [],
                routes: [],
                vehicleType: vehicleInput.type || "AUTO",
                metadata: {
                    totalOrders: 0,
                    totalRoutes: 0,
                    averageOrdersPerRoute: 0,
                    computationTimeMs: 0,
                },
            });
        }
        // Transform orders to CVRP input format
        const orderInputs = orders.map((order) => {
            const latRaw = order?.address?.lat;
            const lngRaw = order?.address?.lng;
            const isMissing = latRaw === null ||
                latRaw === undefined ||
                (typeof latRaw === "string" && latRaw.trim() === "") ||
                lngRaw === null ||
                lngRaw === undefined ||
                (typeof lngRaw === "string" && lngRaw.trim() === "");
            if (isMissing) {
                throw new Error(`Order ${String(order._id)} missing delivery address coordinates`);
            }
            return {
                orderId: String(order._id),
                lat: Number(latRaw),
                lng: Number(lngRaw),
                pincode: order.address.pincode,
                locality: order.address.city || order.address.admin_district,
            };
        });
        // Compute routes using CVRP service
        const result = cvrpRouteAssignmentService_1.cvrpRouteAssignmentService.computeRoutes(orderInputs, vehicleInput);
        const orderSummaryById = new Map();
        const isMissingCoordValue = (v) => {
            return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
        };
        const classifyLocation = (latRaw, lngRaw) => {
            if (isMissingCoordValue(latRaw) || isMissingCoordValue(lngRaw)) {
                return {
                    lat: null,
                    lng: null,
                    locationStatus: "MISSING",
                    locationSource: "NONE",
                };
            }
            const lat = Number(latRaw);
            const lng = Number(lngRaw);
            const inRange = Number.isFinite(lat) &&
                Number.isFinite(lng) &&
                lat >= -90 &&
                lat <= 90 &&
                lng >= -180 &&
                lng <= 180;
            const isZeroZero = lat === 0 && lng === 0;
            if (!inRange || isZeroZero) {
                return {
                    lat: null,
                    lng: null,
                    locationStatus: "INVALID",
                    locationSource: "ORDER_ADDRESS",
                };
            }
            return {
                lat,
                lng,
                locationStatus: "OK",
                locationSource: "ORDER_ADDRESS",
            };
        };
        for (const o of orders) {
            const orderId = String(o._id);
            const items = Array.isArray(o.items) ? o.items : [];
            const latRaw = o?.address?.lat;
            const lngRaw = o?.address?.lng;
            const loc = classifyLocation(latRaw, lngRaw);
            const itemsQty = items.reduce((sum, it) => {
                const q = typeof it?.quantity === "number"
                    ? it.quantity
                    : typeof it?.qty === "number"
                        ? it.qty
                        : 0;
                return sum + (Number.isFinite(q) ? q : 0);
            }, 0);
            const grossAmount = typeof o.grossAmount === "number"
                ? o.grossAmount
                : typeof o.totalAmount === "number"
                    ? o.totalAmount
                    : typeof o.subtotal === "number"
                        ? o.subtotal
                        : typeof o.grandTotal === "number"
                            ? o.grandTotal
                            : 0;
            const discountAmount = typeof o.discountAmount === "number"
                ? o.discountAmount
                : typeof o.discount === "number"
                    ? o.discount
                    : 0;
            const netAmount = Math.max(0, (Number.isFinite(grossAmount) ? grossAmount : 0) -
                (Number.isFinite(discountAmount) ? discountAmount : 0));
            orderSummaryById.set(orderId, {
                orderId,
                lat: loc.lat,
                lng: loc.lng,
                locationStatus: loc.locationStatus,
                locationSource: loc.locationSource,
                itemsQty,
                grossAmount: Number.isFinite(grossAmount) ? grossAmount : 0,
                discountAmount: Number.isFinite(discountAmount) ? discountAmount : 0,
                netAmount,
            });
        }
        return res.json({
            success: true,
            mode: "PREVIEW",
            clusters: (result.routes || []).map((r, idx) => ({
                tempClusterId: `TMP-${idx + 1}`,
                orderCount: r.orderCount,
                distanceKm: r.totalDistanceKm,
                estimatedTimeMin: r.estimatedTimeMin,
                orders: (r.orders || []).map((id) => {
                    const orderId = String(id);
                    return (orderSummaryById.get(orderId) || {
                        orderId,
                        lat: null,
                        lng: null,
                        locationStatus: "MISSING",
                        locationSource: "NONE",
                        itemsQty: 0,
                        grossAmount: 0,
                        discountAmount: 0,
                        netAmount: 0,
                    });
                }),
                routePath: r.routePath,
            })),
            vehicleType: result.vehicleType,
            metadata: result.metadata,
        });
    }
    catch (error) {
        logger_1.logger.error("Route computation error:", error);
        res.status(400).json({
            error: "Route computation failed",
            message: error.message || "Unknown error occurred",
        });
    }
};
exports.computeRoutes = computeRoutes;
const assignComputedCluster = async (req, res) => {
    try {
        const deliveryBoyId = String(req.body?.deliveryBoyId || "").trim();
        const orderIds = Array.isArray(req.body?.orderIds) ? req.body.orderIds : [];
        const routePath = Array.isArray(req.body?.routePath) ? req.body.routePath : [];
        if (!deliveryBoyId) {
            return res.status(400).json({ error: "deliveryBoyId is required" });
        }
        if (!orderIds || orderIds.length === 0) {
            return res.status(400).json({ error: "orderIds is required" });
        }
        const deliveryBoy = await DeliveryBoy_1.DeliveryBoy.findById(deliveryBoyId).select("_id userId vehicleType isActive availability");
        if (!deliveryBoy) {
            return res.status(404).json({ error: "Delivery boy not found" });
        }
        const vt = String(deliveryBoy.vehicleType || "");
        const vtUpper = vt.trim().toUpperCase();
        const allowedVehicleTypes = new Set(["AUTO", "CAR"]);
        if (!allowedVehicleTypes.has(vtUpper)) {
            return res.status(400).json({
                error: "Delivery boy vehicleType not allowed",
                message: `vehicleType must be one of ${Array.from(allowedVehicleTypes).join(", ")}, got ${vt}`,
            });
        }
        if (!deliveryBoy.isActive) {
            return res.status(400).json({ error: "Delivery boy is not active" });
        }
        if (String(deliveryBoy.availability || "").toLowerCase() !== "available") {
            return res.status(409).json({ error: "Delivery boy is not available" });
        }
        const existingActive = await Route_1.Route.findOne({
            deliveryBoyId: deliveryBoy._id,
            status: { $in: ["ASSIGNED", "IN_PROGRESS"] },
        }).select("routeId status");
        if (existingActive) {
            return res.status(409).json({
                error: "Delivery boy already has an active route",
                message: `Delivery boy already has active route ${String(existingActive.routeId)} (${String(existingActive.status)})`,
            });
        }
        const orders = await Order_1.Order.find({ _id: { $in: orderIds } }).select("_id orderStatus deliveryBoyId address");
        if (orders.length !== orderIds.length) {
            return res.status(400).json({
                error: "Some orders not found",
                message: `Found ${orders.length}/${orderIds.length} orders`,
            });
        }
        const notPacked = orders.filter((o) => !["PACKED", "packed"].includes(String(o.orderStatus)));
        if (notPacked.length > 0) {
            return res.status(409).json({
                error: "Some orders are not PACKED",
                message: `Orders must be PACKED before assignment (bad count: ${notPacked.length})`,
            });
        }
        const alreadyAssigned = orders.filter((o) => !!o.deliveryBoyId);
        if (alreadyAssigned.length > 0) {
            return res.status(409).json({
                error: "Some orders are already assigned",
                message: `Orders must be unassigned before assignment (bad count: ${alreadyAssigned.length})`,
            });
        }
        const orderInputs = orders.map((order) => {
            if (!order.address?.lat || !order.address?.lng) {
                throw new Error(`Order ${order._id} missing delivery address coordinates`);
            }
            return {
                orderId: String(order._id),
                lat: order.address.lat,
                lng: order.address.lng,
                pincode: order.address.pincode,
                locality: order.address.city || order.address.admin_district,
            };
        });
        const result = cvrpRouteAssignmentService_1.cvrpRouteAssignmentService.computeRoutes(orderInputs, {
            type: "AUTO",
            capacity: 1,
            maxDistanceKm: 1000000,
        });
        const inputSet = new Set(orderIds.map((x) => String(x)));
        const matching = (result.routes || []).find((r) => {
            if (!Array.isArray(r.orders))
                return false;
            if (r.orders.length !== inputSet.size)
                return false;
            for (const id of r.orders) {
                if (!inputSet.has(String(id)))
                    return false;
            }
            return true;
        });
        if (!matching) {
            return res.status(400).json({
                error: "Selected cluster is not valid for current orders",
                message: "Recompute preview and try again",
            });
        }
        const ordersJoined = (matching.orders || []).join(",");
        const digest = crypto_1.default.createHash("sha1").update(ordersJoined).digest("hex").slice(0, 12);
        const stableRouteId = `AUTO-${digest}`;
        const now = new Date();
        const dpUserId = deliveryBoy.userId
            ? new mongoose_1.default.Types.ObjectId(String(deliveryBoy.userId))
            : null;
        const persisted = await Route_1.Route.create({
            routeId: stableRouteId,
            orderIds: (matching.orders || []).map((id) => new mongoose_1.default.Types.ObjectId(String(id))),
            routePath: Array.isArray(routePath) && routePath.length > 0
                ? routePath
                : Array.isArray(matching.routePath) && matching.routePath.length > 0
                    ? matching.routePath
                    : ["WAREHOUSE", ...(matching.orders || [])],
            vehicleType: "AUTO",
            totalDistanceKm: Number(matching.totalDistanceKm) || 0,
            estimatedTimeMin: Number(matching.estimatedTimeMin) || 0,
            status: "ASSIGNED",
            deliveryBoyId: deliveryBoy._id,
            deliveredCount: 0,
            failedCount: 0,
            computedAt: now,
            assignedAt: now,
        });
        // Transition each order status via orderStateService (required by Order model)
        const assignedOrderIds = (matching.orders || []).map((id) => String(id));
        const actorId = String(req.user?._id || "");
        for (const orderId of assignedOrderIds) {
            await orderStateService_1.orderStateService.transition({
                orderId: String(orderId),
                toStatus: OrderStatus_1.OrderStatus.ASSIGNED,
                actorRole: "ADMIN",
                actorId,
                meta: {
                    deliveryPartnerName: String(deliveryBoy.name || "") || undefined,
                },
            });
            // Update delivery fields separately (not orderStatus)
            await Order_1.Order.updateOne({ _id: orderId }, {
                $set: {
                    deliveryBoyId: deliveryBoy._id,
                    deliveryPartnerId: dpUserId,
                    deliveryStatus: "in_transit",
                    outForDeliveryAt: now,
                },
            });
        }
        res.json({
            success: true,
            route: {
                routeId: persisted.routeId,
                status: persisted.status,
                deliveryBoyId: String(deliveryBoy._id),
                totalOrders: (matching.orders || []).length,
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to assign route", message: error?.message || "Unknown error" });
    }
};
exports.assignComputedCluster = assignComputedCluster;
/**
 * Purge all orders and optionally persisted routes (admin-only, requires confirmation)
 * POST /api/admin/orders/purge
 *
 * Expected body:
 * {
 *   confirm: "DELETE_ALL_ORDERS",
 *   alsoDeleteRoutes?: boolean (default: true)
 * }
 */
const purgeOrders = async (req, res) => {
    try {
        const { confirm, alsoDeleteRoutes = true } = req.body || {};
        if (confirm !== "DELETE_ALL_ORDERS") {
            return res.status(400).json({
                error: "Invalid confirmation",
                message: 'You must include { "confirm": "DELETE_ALL_ORDERS" } in the request body.',
            });
        }
        // Count before deletion
        const ordersCount = await Order_1.Order.countDocuments();
        let routesCount = 0;
        if (alsoDeleteRoutes) {
            routesCount = await Route_1.Route.countDocuments();
        }
        // Delete orders
        const deleteOrdersResult = await Order_1.Order.deleteMany({});
        const deletedOrders = deleteOrdersResult.deletedCount || 0;
        // Optionally delete persisted routes
        let deletedRoutes = 0;
        if (alsoDeleteRoutes) {
            const deleteRoutesResult = await Route_1.Route.deleteMany({});
            deletedRoutes = deleteRoutesResult.deletedCount || 0;
        }
        res.json({
            success: true,
            deletedOrders,
            deletedRoutes,
            beforeCounts: { orders: ordersCount, routes: routesCount },
            afterCounts: { orders: 0, routes: alsoDeleteRoutes ? 0 : routesCount },
        });
    }
    catch (error) {
        logger_1.logger.error("Purge orders error:", error);
        res.status(500).json({
            error: "Failed to purge orders",
            message: error.message || "Unknown error occurred",
        });
    }
};
exports.purgeOrders = purgeOrders;
/**
 * Get GST Report
 *
 * Returns aggregated GST totals (CGST, SGST, IGST) for a date range.
 * Only includes orders that are DELIVERED and PAID.
 *
 * Query params:
 * - from: ISO date string (required)
 * - to: ISO date string (required)
 */
const getGstReportHandler = async (req, res) => {
    try {
        const { from, to } = req.query;
        if (!from || !to) {
            return res.status(400).json({
                error: "Missing required query parameters",
                message: "Both 'from' and 'to' date parameters are required",
            });
        }
        const fromDate = new Date(from);
        const toDate = new Date(to);
        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            return res.status(400).json({
                error: "Invalid date format",
                message: "from and to must be valid ISO date strings",
            });
        }
        if (fromDate >= toDate) {
            return res.status(400).json({
                error: "Invalid date range",
                message: "'from' date must be before 'to' date",
            });
        }
        const report = await (0, gstReportService_1.getGstReport)({ from: fromDate, to: toDate });
        res.json(report);
    }
    catch (error) {
        logger_1.logger.error("GST report error:", error);
        res.status(500).json({
            error: "Failed to generate GST report",
            message: error.message || "Unknown error occurred",
        });
    }
};
exports.getGstReportHandler = getGstReportHandler;
/**
 * Get Route Health Overview
 *
 * Returns summary statistics about route health for admin dashboard.
 */
const getRouteOverview = async (req, res) => {
    try {
        const AUTO_CAPACITY_MIN = parseInt(process.env.ROUTE_CAPACITY_MIN || '20');
        const AUTO_CAPACITY_MAX = parseInt(process.env.ROUTE_CAPACITY_MAX || '30');
        // Get all routes
        const routes = await Route_1.Route.find({}).lean();
        // Count by status
        const statusCounts = {
            CREATED: 0,
            ASSIGNED: 0,
            IN_PROGRESS: 0,
            COMPLETED: 0,
        };
        let underloadedRoutes = 0;
        let overloadedRoutes = 0;
        let cancelledOrdersInRoutes = 0;
        for (const route of routes) {
            const status = route.status;
            if (statusCounts[status] !== undefined) {
                statusCounts[status]++;
            }
            const orderCount = route.orderIds?.length || 0;
            // Check capacity
            if (orderCount < AUTO_CAPACITY_MIN) {
                underloadedRoutes++;
            }
            else if (orderCount > AUTO_CAPACITY_MAX) {
                overloadedRoutes++;
            }
            // Check for cancelled orders (failed count indicates cancellations)
            cancelledOrdersInRoutes += route.failedCount || 0;
        }
        // Count unassigned orders (PACKED without deliveryBoyId and not in any route)
        const allRouteOrderIds = new Set();
        for (const route of routes) {
            if (route.status !== 'COMPLETED') {
                for (const oid of route.orderIds || []) {
                    allRouteOrderIds.add(String(oid));
                }
            }
        }
        const unassignedOrders = await Order_1.Order.countDocuments({
            orderStatus: { $in: ['PACKED', 'packed'] },
            $or: [
                { deliveryBoyId: { $exists: false } },
                { deliveryBoyId: null },
            ],
            _id: { $nin: Array.from(allRouteOrderIds).map(id => new mongoose_1.default.Types.ObjectId(id)) },
        });
        // Get last computed time
        const lastComputedRoute = await Route_1.Route.findOne({})
            .sort({ computedAt: -1 })
            .select('computedAt')
            .lean();
        const lastComputedAt = lastComputedRoute?.computedAt || null;
        // Get next scheduled recompute (from auto scheduler if available)
        let nextScheduledRecompute = null;
        try {
            const { getNextScheduledRecompute } = await Promise.resolve().then(() => __importStar(require('../services/routeAutoScheduler')));
            nextScheduledRecompute = getNextScheduledRecompute();
        }
        catch {
            // Auto scheduler not available
        }
        const summary = {
            totalRoutes: routes.length,
            statusCounts,
            assignedRoutes: statusCounts.ASSIGNED + statusCounts.IN_PROGRESS,
            unassignedOrders,
            underloadedRoutes,
            overloadedRoutes,
            cancelledOrdersInRoutes,
            lastComputedAt,
            nextScheduledRecompute,
            capacityConfig: {
                min: AUTO_CAPACITY_MIN,
                max: AUTO_CAPACITY_MAX,
            },
        };
        // Hub-wise breakdown
        const hubStats = [];
        // Group routes by hub
        const routesByHub = new Map();
        for (const route of routes) {
            const hubId = route.hubId || 'warehouse';
            if (!routesByHub.has(hubId))
                routesByHub.set(hubId, []);
            routesByHub.get(hubId).push(route);
        }
        // Get hub names from config
        let hubs = [{ id: 'warehouse', name: 'Warehouse (Local)' }];
        try {
            const { HUBS } = await Promise.resolve().then(() => __importStar(require('../services/hubAssignmentService')));
            hubs = [...hubs, ...HUBS.map(h => ({ id: h.id, name: h.name }))];
        }
        catch {
            // Hub service not available
        }
        // Build hub stats
        for (const hub of hubs) {
            const hubRoutes = routesByHub.get(hub.id) || [];
            const totalOrders = hubRoutes.reduce((sum, r) => sum + (r.orderIds?.length || 0), 0);
            const totalRoutes = hubRoutes.length;
            const assignedRoutes = hubRoutes.filter(r => r.status === 'ASSIGNED' || r.status === 'IN_PROGRESS').length;
            // Count pending orders for this hub (orders not in any route yet)
            // This is approximate - would need order hub assignment for exact count
            const pendingOrders = hubRoutes.filter(r => r.status === 'CREATED')
                .reduce((sum, r) => sum + Math.max(0, AUTO_CAPACITY_MIN - (r.orderIds?.length || 0)), 0);
            hubStats.push({
                hubId: hub.id,
                hubName: hub.name,
                totalOrders,
                totalRoutes,
                assignedRoutes,
                pendingOrders,
            });
        }
        // Count outlier routes
        const outlierRoutes = routes.filter(r => r.isOutlierRoute === true);
        const outlierOrderIds = outlierRoutes.flatMap(r => r.orderIds?.map(id => String(id)) || []);
        res.json({
            success: true,
            summary,
            hubs: hubStats,
            outliers: {
                count: outlierRoutes.length,
                orderIds: outlierOrderIds,
            },
            generatedAt: new Date().toISOString(),
        });
    }
    catch (error) {
        logger_1.logger.error('Route overview error:', error);
        res.status(500).json({
            error: 'Failed to get route overview',
            message: error.message || 'Unknown error occurred',
        });
    }
};
exports.getRouteOverview = getRouteOverview;
