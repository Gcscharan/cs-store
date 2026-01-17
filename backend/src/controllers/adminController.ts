import { Request, Response } from "express";
import mongoose from "mongoose";
import crypto from "crypto";
import { Order } from "../models/Order";
import { User, IUser } from "../models/User";
import { Product } from "../models/Product";
import { DeliveryBoy } from "../models/DeliveryBoy";
import { Route as PersistedRoute } from "../models/Route";
import { liveLocationStore } from "../services/liveLocationStore";
import { createObjectCsvWriter } from "csv-writer";
import {
  cvrpRouteAssignmentService,
  OrderInput,
  VehicleInput,
} from "../services/cvrpRouteAssignmentService";

export const getStats = async (req: Request, res: Response) => {
  try {
    const { period = "month", from, to } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    if (from && to) {
      startDate = new Date(from as string);
      endDate = new Date(to as string);
    } else if (period === "day") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === "week") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Sales analytics with more detailed breakdown
    const salesData = await Order.aggregate([
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

    // Monthly sales data
    const monthlySales = await Order.aggregate([
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

    // Orders by status with detailed breakdown
    const ordersByStatus = await Order.aggregate([
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

    // Payment status breakdown
    const paymentStatusBreakdown = await Order.aggregate([
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

    // Delivery analytics with performance metrics
    const deliveryStats = await DeliveryBoy.aggregate([
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

    // Driver performance metrics
    const driverPerformance = await DeliveryBoy.find({ isActive: true })
      .select(
        "name phone vehicleType availability earnings completedOrdersCount assignedOrders"
      )
      .populate("assignedOrders", "orderStatus totalAmount")
      .sort({ completedOrdersCount: -1 })
      .limit(10);

    // User stats with role breakdown
    const userStats = await User.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]);

    // Top products by sales
    const topProducts = await Order.aggregate([
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

    // Recent orders for dashboard
    const recentOrders = await Order.find({
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
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
    return;
  }
};

export const listRoutes = async (req: Request, res: Response) => {
  try {
    const limit = Math.max(1, Math.min(200, Number((req.query as any).limit || 50)));
    const routes = await PersistedRoute.find({})
      .sort({ computedAt: -1 })
      .limit(limit)
      .lean();

    res.json({
      success: true,
      routes: routes.map((r: any) => ({
        routeId: r.routeId,
        vehicleType: r.vehicleType,
        totalDistanceKm: r.totalDistanceKm,
        estimatedTimeMin: r.estimatedTimeMin,
        status: r.status,
        deliveryBoyId: r.deliveryBoyId ? String(r.deliveryBoyId) : null,
        orderIds: Array.isArray(r.orderIds) ? r.orderIds.map((id: any) => String(id)) : [],
        routePath: Array.isArray(r.routePath) ? r.routePath.map((id: any) => String(id)) : [],
        totalOrders: Array.isArray(r.orderIds) ? r.orderIds.length : 0,
        deliveredCount: Number(r.deliveredCount || 0),
        failedCount: Number(r.failedCount || 0),
        computedAt: r.computedAt,
        assignedAt: r.assignedAt || null,
        startedAt: r.startedAt || null,
        completedAt: r.completedAt || null,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to list routes", message: error?.message || "Unknown error" });
  }
};

export const assignRoute = async (req: Request, res: Response) => {
  try {
    const routeId = String((req.params as any).routeId || "").trim();
    const deliveryBoyId = String((req.body as any)?.deliveryBoyId || "").trim();
    if (!routeId) {
      return res.status(400).json({ error: "routeId is required" });
    }
    if (!deliveryBoyId) {
      return res.status(400).json({ error: "deliveryBoyId is required" });
    }

    const route = await PersistedRoute.findOne({ routeId });
    if (!route) {
      return res.status(404).json({ error: "Route not found" });
    }

    if (String(route.status) !== "CREATED" || route.deliveryBoyId) {
      return res.status(409).json({ error: "Route already assigned or locked" });
    }

    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId).select("_id userId vehicleType isActive");
    if (!deliveryBoy) {
      return res.status(404).json({ error: "Delivery boy not found" });
    }

    const vt = String((deliveryBoy as any).vehicleType || "");
    if (vt.toUpperCase() !== "AUTO") {
      return res.status(400).json({
        error: "Delivery boy vehicleType must be AUTO",
        message: `vehicleType must be AUTO, got ${vt}`,
      });
    }

    if (!(deliveryBoy as any).isActive) {
      return res.status(400).json({ error: "Delivery boy is not active" });
    }

    const existingActive = await PersistedRoute.findOne({
      deliveryBoyId: (deliveryBoy as any)._id,
      status: { $in: ["ASSIGNED", "IN_PROGRESS"] },
    }).select("routeId status");

    if (existingActive) {
      return res.status(409).json({
        error: "Delivery boy already has an active route",
        message: `Delivery boy already has active route ${String((existingActive as any).routeId)} (${String((existingActive as any).status)})`,
      });
    }

    const now = new Date();

    route.deliveryBoyId = (deliveryBoy as any)._id;
    route.status = "ASSIGNED";
    (route as any).assignedAt = now;
    await route.save();

    const dpUserId = (deliveryBoy as any).userId ? new mongoose.Types.ObjectId(String((deliveryBoy as any).userId)) : null;

    await Order.updateMany(
      { _id: { $in: (route as any).orderIds } },
      {
        $set: {
          deliveryBoyId: (deliveryBoy as any)._id,
          deliveryPartnerId: dpUserId,
          deliveryStatus: "in_transit",
          orderStatus: "OUT_FOR_DELIVERY",
          outForDeliveryAt: now,
        },
      }
    );

    res.json({
      success: true,
      route: {
        routeId: route.routeId,
        status: route.status,
        deliveryBoyId: String((deliveryBoy as any)._id),
        totalOrders: (route as any).orderIds?.length || 0,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to assign route", message: error?.message || "Unknown error" });
  }
};

export const getRouteStatus = async (req: Request, res: Response) => {
  try {
    const routeId = String((req.params as any).routeId || "").trim();
    if (!routeId) {
      return res.status(400).json({ error: "routeId is required" });
    }

    const route = await PersistedRoute.findOne({ routeId }).lean();
    if (!route) {
      return res.status(404).json({ error: "Route not found" });
    }

    const totalOrders = Array.isArray((route as any).orderIds) ? (route as any).orderIds.length : 0;
    const deliveredCount = Number((route as any).deliveredCount || 0);
    const failedCount = Number((route as any).failedCount || 0);
    const pendingCount = Math.max(0, totalOrders - deliveredCount - failedCount);

    const start = (route as any).startedAt || (route as any).assignedAt || (route as any).computedAt;
    const elapsedMs = start ? Date.now() - new Date(start).getTime() : 0;
    const elapsedTimeMin = Math.max(0, Math.round(elapsedMs / 60000));
    const estimatedTimeMin = Number((route as any).estimatedTimeMin || 0);
    const delay = estimatedTimeMin > 0 ? elapsedTimeMin > estimatedTimeMin : false;

    res.json({
      success: true,
      routeId: (route as any).routeId,
      status: (route as any).status,
      deliveredCount,
      failedCount,
      pendingCount,
      elapsedTimeMin,
      estimatedTimeMin,
      delay,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get route status", message: error?.message || "Unknown error" });
  }
};

export const listRecentAssignedRoutes = async (req: Request, res: Response) => {
  try {
    const limit = Math.max(1, Math.min(200, Number((req.query as any).limit || 50)));
    const routes = await PersistedRoute.find({ assignedAt: { $exists: true, $ne: null } })
      .sort({ assignedAt: -1 })
      .limit(limit)
      .populate("deliveryBoyId", "name phone currentLocation")
      .lean();

    res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      routes: routes.map((r: any) => {
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
  } catch (error: any) {
    res.status(500).json({ error: "Failed to list recent assigned routes", message: error?.message || "Unknown error" });
  }
};

function normalizeOrderStatusForOpsDashboard(raw: any): string {
  const upper = String(raw || "").trim().toUpperCase();
  if (!upper) return "";
  if (upper === "OUT_FOR_DELIVERY") return "IN_TRANSIT";
  if (upper === "PENDING" || upper === "PENDING_PAYMENT") return "CREATED";
  return upper;
}

function validateLatLng(latRaw: any, lngRaw: any): { lat: number | null; lng: number | null; invalid: boolean } {
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  const ok =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0);
  return ok ? { lat, lng, invalid: false } : { lat: null, lng: null, invalid: true };
}

export const getRouteDetail = async (req: Request, res: Response) => {
  try {
    const routeId = String((req.params as any).routeId || "").trim();
    if (!routeId) {
      return res.status(400).json({ error: "routeId is required" });
    }

    const route = await PersistedRoute.findOne({ routeId })
      .populate("deliveryBoyId", "name phone")
      .lean();
    if (!route) {
      return res.status(404).json({ error: "Route not found" });
    }

    const orderedIds = (Array.isArray((route as any).routePath) ? (route as any).routePath : [])
      .filter((x: any) => String(x || "").toUpperCase() !== "WAREHOUSE")
      .map((x: any) => String(x));
    const sequenceById = new Map<string, number>();
    orderedIds.forEach((id: string, idx: number) => sequenceById.set(String(id), idx + 1));

    const orderIds = Array.isArray((route as any).orderIds) ? (route as any).orderIds : [];
    const orderDocs = await Order.find({ _id: { $in: orderIds } })
      .select("_id orderStatus deliveredAt address.lat address.lng")
      .lean();

    const byId = new Map<string, any>();
    for (const o of orderDocs as any[]) {
      byId.set(String((o as any)._id), o);
    }

    type MappedOrder = {
      orderId: string;
      sequence: number | null;
      status: string;
      deliveredAt: string | null;
      invalidLocation: boolean;
      _lat: number | null;
      _lng: number | null;
    };

    const mappedOrders: MappedOrder[] = orderedIds.map((id: string) => {
      const o = byId.get(id);
      const status = normalizeOrderStatusForOpsDashboard(o ? (o as any).orderStatus : "");
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

    const sortedOrders = mappedOrders.slice().sort((a: MappedOrder, b: MappedOrder) => {
      const as = typeof a.sequence === "number" ? a.sequence : Number.POSITIVE_INFINITY;
      const bs = typeof b.sequence === "number" ? b.sequence : Number.POSITIVE_INFINITY;
      return as - bs;
    });

    const orders = sortedOrders.map(({ _lat, _lng, ...rest }: MappedOrder) => rest);

    const checkpoints = sortedOrders
      .filter((o: MappedOrder) => typeof o._lat === "number" && typeof o._lng === "number" && Number.isFinite(o._lat) && Number.isFinite(o._lng))
      .map((o: MappedOrder) => ({
        orderId: o.orderId,
        sequence: o.sequence,
        lat: o._lat as number,
        lng: o._lng as number,
        status: o.status,
      }));

    const total = orderedIds.length;
    const delivered = Number((route as any).deliveredCount || 0);
    const failed = Number((route as any).failedCount || 0);
    const pending = Math.max(0, total - delivered - failed);
    const completed = delivered + failed;
    const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

    const warehouse = { lat: 17.094, lng: 80.598 };

    const db = (route as any).deliveryBoyId && typeof (route as any).deliveryBoyId === "object" ? (route as any).deliveryBoyId : null;

    const driverIdStr = db?._id ? String((db as any)._id) : "";
    const mem = driverIdStr ? liveLocationStore.get(driverIdStr) : null;

    // liveLocation is STRICTLY sourced from memory store (single source of truth)
    // and only when it matches this route.
    const useMemForLiveLocation = Boolean(mem && String(mem.routeId || "") === String(routeId));
    const liveLocationLastUpdatedAtMs = useMemForLiveLocation
      ? Number(mem?.receivedAt || Date.now())
      : null;
    const liveLocationIsStale = typeof liveLocationLastUpdatedAtMs === "number" && Number.isFinite(liveLocationLastUpdatedAtMs)
      ? Date.now() - liveLocationLastUpdatedAtMs > 20_000
      : true;

    res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      liveLocation:
        useMemForLiveLocation && mem && Number.isFinite(Number(mem?.lat)) && Number.isFinite(Number(mem?.lng))
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
        routeId: (route as any).routeId,
        status: (route as any).status,
        computedAt: (route as any).computedAt || null,
        assignedAt: (route as any).assignedAt || null,
        startedAt: (route as any).startedAt || null,
        completedAt: (route as any).completedAt || null,
        updatedAt: (route as any).updatedAt || null,
        deliveryBoyId: driverIdStr || null,
        deliveryBoy: db
          ? {
              id: String((db as any)._id),
              name: String((db as any).name || ""),
              phone: String((db as any).phone || ""),
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
      },
      orders,
      checkpoints,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get route detail", message: error?.message || "Unknown error" });
  }
};

export const getAdminProfile = async (req: Request, res: Response) => {
  try {
    // Get admin user from authenticated request
    const adminUser = (req as any).user;

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
  } catch (error) {
    console.error("Admin profile error:", error);
    return res.status(500).json({ error: "Failed to fetch admin profile" });
  }
};

export const getUsers = async (req: Request, res: Response) => {
  try {
    // Get admin user from authenticated request
    const adminUser = (req as any).user;

    if (!adminUser) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (adminUser.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Access denied. Admin role required." });
    }

    // Fetch all users with basic information only
    const users = await User.find({})
      .select("name email phone role createdAt isActive")
      .sort({ createdAt: -1 });

    return res.json({ users });
  } catch (error) {
    console.error("Admin users error:", error);
    return res.status(500).json({ error: "Failed to fetch users" });
  }
};

export const getAdminProducts = async (req: Request, res: Response) => {
  try {
    // Get admin user from authenticated request
    const adminUser = (req as any).user;

    if (!adminUser) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (adminUser.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Access denied. Admin role required." });
    }

    // Fetch all products
    const products = await Product.find({})
      .select(
        "name price stock category weight images description createdAt updatedAt"
      )
      .sort({ createdAt: -1 });

    return res.json({ products });
  } catch (error) {
    console.error("Admin products error:", error);
    return res.status(500).json({ error: "Failed to fetch products" });
  }
};

export const getAdminOrders = async (req: Request, res: Response) => {
  try {
    // Get admin user from authenticated request
    const adminUser = (req as any).user;

    if (!adminUser) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (adminUser.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Access denied. Admin role required." });
    }

    // Fetch all orders with populated user and delivery boy info
    const orders = await Order.find({})
      .populate("userId", "name email phone")
      .populate("deliveryBoyId", "name phone")
      .sort({ createdAt: -1 });

    return res.json({ orders });
  } catch (error) {
    console.error("Admin orders error:", error);
    return res.status(500).json({ error: "Failed to fetch orders" });
  }
};

export const getAdminDeliveryBoys = async (req: Request, res: Response) => {
  try {
    // Get admin user from authenticated request
    const adminUser = (req as any).user;

    if (!adminUser) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (adminUser.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Access denied. Admin role required." });
    }

    const deliveryBoys = await DeliveryBoy.find({})
      .populate("assignedOrders", "orderStatus totalAmount createdAt")
      .populate("userId", "name email phone status deliveryProfile createdAt")
      .sort({ createdAt: -1 });

    const normalizedDeliveryBoys = await Promise.all(
      deliveryBoys.map(async (deliveryBoy: any) => {
        let userDoc: any =
          deliveryBoy.userId && deliveryBoy.userId._id ? deliveryBoy.userId : null;

        if (!userDoc) {
          userDoc = await User.findOne({
            phone: deliveryBoy.phone,
            role: "delivery",
          }).select("name email phone status deliveryProfile createdAt");
        }

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
      })
    );

    return res.json({
      deliveryBoys: normalizedDeliveryBoys.filter((b: any) => b.user),
    });
  } catch (error) {
    console.error("Admin delivery boys error:", error);
    return res.status(500).json({ error: "Failed to fetch delivery boys" });
  }
};

export const approveDeliveryBoy = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const adminUser = (req as any).user;

    if (!adminUser) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (adminUser.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Access denied. Admin role required." });
    }

    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role !== "delivery") {
      return res.status(400).json({ error: "User is not a delivery partner" });
    }

    user.status = "active";
    await user.save();

    const deliveryBoy =
      (await DeliveryBoy.findOne({ userId: user._id })) ||
      (user.phone ? await DeliveryBoy.findOne({ phone: user.phone }) : null);

    if (!deliveryBoy) {
      return res.status(404).json({ error: "DeliveryBoy profile not found" });
    }

    deliveryBoy.isActive = true;
    deliveryBoy.availability = "offline";
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
  } catch (error) {
    console.error("Approve delivery boy error:", error);
    return res
      .status(500)
      .json({ error: "Failed to approve delivery partner" });
  }
};

export const exportOrders = async (req: Request, res: Response) => {
  try {
    const { from, to, format = "csv" } = req.query;

    const query: any = {};
    if (from && to) {
      query.createdAt = {
        $gte: new Date(from as string),
        $lte: new Date(to as string),
      };
    }

    const orders = await Order.find(query)
      .populate("userId", "name phone")
      .populate("deliveryBoyId", "name phone")
      .sort({ createdAt: -1 });

    if (format === "labels") {
      // Generate order labels for printing
      const labelsData = orders.map((order) => ({
        orderId: order._id.toString().slice(-6),
        customerName: (order.userId as any)?.name || "N/A",
        customerPhone: (order.userId as any)?.phone || "N/A",
        address: `${order.address.addressLine}, ${order.address.city}, ${order.address.pincode}`,
        items: order.items
          .map((item) => `${item.name} (Qty: ${item.qty})`)
          .join(", "),
        totalAmount: order.totalAmount,
        orderStatus: order.orderStatus,
        deliveryBoy: (order.deliveryBoyId as any)?.name || "Not Assigned",
        createdAt: order.createdAt.toLocaleDateString(),
      }));

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="order-labels-${from || "all"}-${
          to || "all"
        }.csv"`
      );

      const csvWriter = createObjectCsvWriter({
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
    } else {
      // Standard CSV export with detailed information
      const csvData = orders.map((order) => ({
        orderId: order._id,
        customerName: (order.userId as any)?.name || "N/A",
        customerPhone: (order.userId as any)?.phone || "N/A",
        deliveryBoy: (order.deliveryBoyId as any)?.name || "Not Assigned",
        deliveryBoyPhone: (order.deliveryBoyId as any)?.phone || "N/A",
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
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="orders-${from || "all"}-${to || "all"}.csv"`
      );

      const csvWriter = createObjectCsvWriter({
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
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: "Failed to export orders" });
    return;
  }
};

// Simple dashboard stats for the admin dashboard
export const getDashboardStats = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    // Get admin user from authenticated request
    const adminUser = (req as any).user;

    if (!adminUser) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (adminUser.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Access denied. Admin role required." });
    }

    // Get basic counts
    const totalProducts = await Product.countDocuments();
    const totalUsers = await User.countDocuments();
    const totalOrders = await Order.countDocuments();
    const totalDeliveryBoys = await DeliveryBoy.countDocuments();

    // Get recent orders count (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentOrders = await Order.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    // Get total revenue (from paid orders)
    const totalRevenue = await Order.aggregate([
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
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
    return;
  }
};

// Update product
export const updateProduct = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { name, description, price, category, stock, weight, image, images } =
      req.body;

    // Get admin user from authenticated request
    const adminUser = (req as any).user;

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
    const updateData: any = {
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
    } else if (image) {
      updateData.images = [image];
    }

    // Find and update product
    const product = await Product.findByIdAndUpdate(id, updateData, {
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
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({ error: "Failed to update product" });
    return;
  }
};

// Delete product
export const deleteProduct = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { id } = req.params;

    // Get admin user from authenticated request
    const adminUser = (req as any).user;

    if (!adminUser) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (adminUser.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Access denied. Admin role required." });
    }

    // Find and delete product
    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({ error: "Failed to delete product" });
    return;
  }
};

// Make user a delivery boy
export const makeDeliveryBoy = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { id } = req.params;

    // Get admin user from authenticated request
    const adminUser = (req as any).user;

    if (!adminUser) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (adminUser.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Access denied. Admin role required." });
    }

    // Find the user to update
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if delivery boy record already exists
    const existingDeliveryBoy = await DeliveryBoy.findOne({
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
    const deliveryBoy = new DeliveryBoy({
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
  } catch (error) {
    console.error("Make delivery boy error:", error);
    res.status(500).json({ error: "Failed to promote user to delivery boy" });
    return;
  }
};

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
export const computeRoutes = async (req: Request, res: Response) => {
  try {
    const mode = String(((req.query as any)?.mode || "") as string).toLowerCase();
    const { orderIds, vehicle } = req.body;

    // Default vehicle type is AUTO
    const vehicleInput: VehicleInput = vehicle || { type: "AUTO" };

    const isPreview = mode === "preview";

    // This endpoint is intentionally read-only (preview-only). Do not add persistence here.
    if (!isPreview) {
      return res.status(400).json({
        error: "Route computation is preview-only. Use assignment endpoint to persist routes.",
      });
    }

    if (isPreview) {
      (vehicleInput as any).capacity = 1;
      (vehicleInput as any).maxDistanceKm = 1000000;
    }

    // Fetch orders
    let orders;
    if (orderIds && Array.isArray(orderIds) && orderIds.length > 0) {
      // Fetch specific orders
      orders = await Order.find({
        _id: { $in: orderIds },
        orderStatus: { $in: ["PACKED", "packed"] },
      }).lean();
    } else {
      // Preview: no assignment checks. Commit-mode compute: only unassigned PACKED.
      orders = await Order.find(
        isPreview
          ? {
              orderStatus: { $in: ["PACKED", "packed"] },
            }
          : {
              orderStatus: { $in: ["PACKED", "packed"] },
              $or: [
                { deliveryBoyId: { $exists: false } },
                { deliveryBoyId: null },
              ],
            }
      ).lean();
    }

    if (orders.length === 0) {
      return res.json({
        success: true,
        mode: isPreview ? "PREVIEW" : "COMMIT",
        clusters: [],
        routes: [],
        vehicleType: (vehicleInput as any).type || "AUTO",
        metadata: {
          totalOrders: 0,
          totalRoutes: 0,
          averageOrdersPerRoute: 0,
          computationTimeMs: 0,
        },
      });
    }

    // Transform orders to CVRP input format
    const orderInputs: OrderInput[] = orders.map((order: any) => {
      const latRaw = order?.address?.lat;
      const lngRaw = order?.address?.lng;
      const isMissing =
        latRaw === null ||
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
    const result = cvrpRouteAssignmentService.computeRoutes(orderInputs, vehicleInput);

    const orderSummaryById = new Map<
      string,
      {
        orderId: string;
        lat: number | null;
        lng: number | null;
        locationStatus: "OK" | "MISSING" | "INVALID";
        locationSource: "ORDER_ADDRESS" | "PINCODE_FALLBACK" | "NONE";
        itemsQty: number;
        grossAmount: number;
        discountAmount: number;
        netAmount: number;
      }
    >();

    const isMissingCoordValue = (v: any): boolean => {
      return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
    };

    const classifyLocation = (
      latRaw: any,
      lngRaw: any
    ): {
      lat: number | null;
      lng: number | null;
      locationStatus: "OK" | "MISSING" | "INVALID";
      locationSource: "ORDER_ADDRESS" | "PINCODE_FALLBACK" | "NONE";
    } => {
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
      const inRange =
        Number.isFinite(lat) &&
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

    for (const o of orders as any[]) {
      const orderId = String(o._id);
      const items = Array.isArray(o.items) ? o.items : [];
      const latRaw = (o as any)?.address?.lat;
      const lngRaw = (o as any)?.address?.lng;
      const loc = classifyLocation(latRaw, lngRaw);
      const itemsQty = items.reduce((sum: number, it: any) => {
        const q =
          typeof it?.quantity === "number"
            ? it.quantity
            : typeof it?.qty === "number"
              ? it.qty
              : 0;
        return sum + (Number.isFinite(q) ? q : 0);
      }, 0);

      const grossAmount =
        typeof (o as any).grossAmount === "number"
          ? (o as any).grossAmount
          : typeof (o as any).totalAmount === "number"
            ? (o as any).totalAmount
            : typeof (o as any).subtotal === "number"
              ? (o as any).subtotal
              : typeof (o as any).grandTotal === "number"
                ? (o as any).grandTotal
                : 0;

      const discountAmount =
        typeof (o as any).discountAmount === "number"
          ? (o as any).discountAmount
          : typeof (o as any).discount === "number"
            ? (o as any).discount
            : 0;

      const netAmount = Math.max(
        0,
        (Number.isFinite(grossAmount) ? grossAmount : 0) -
          (Number.isFinite(discountAmount) ? discountAmount : 0)
      );

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
          return (
            orderSummaryById.get(orderId) || {
              orderId,
              lat: null,
              lng: null,
              locationStatus: "MISSING",
              locationSource: "NONE",
              itemsQty: 0,
              grossAmount: 0,
              discountAmount: 0,
              netAmount: 0,
            }
          );
        }),
        routePath: r.routePath,
      })),
      vehicleType: result.vehicleType,
      metadata: result.metadata,
    });
  } catch (error: any) {
    console.error("Route computation error:", error);
    res.status(400).json({
      error: "Route computation failed",
      message: error.message || "Unknown error occurred",
    });
  }
};

export const assignComputedCluster = async (req: Request, res: Response) => {
  try {
    const deliveryBoyId = String((req.body as any)?.deliveryBoyId || "").trim();
    const orderIds = Array.isArray((req.body as any)?.orderIds) ? (req.body as any).orderIds : [];
    const routePath = Array.isArray((req.body as any)?.routePath) ? (req.body as any).routePath : [];

    if (!deliveryBoyId) {
      return res.status(400).json({ error: "deliveryBoyId is required" });
    }
    if (!orderIds || orderIds.length === 0) {
      return res.status(400).json({ error: "orderIds is required" });
    }

    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId).select(
      "_id userId vehicleType isActive availability"
    );
    if (!deliveryBoy) {
      return res.status(404).json({ error: "Delivery boy not found" });
    }

    const vt = String((deliveryBoy as any).vehicleType || "");
    if (vt.toUpperCase() !== "AUTO") {
      return res.status(400).json({
        error: "Delivery boy vehicleType must be AUTO",
        message: `vehicleType must be AUTO, got ${vt}`,
      });
    }
    if (!(deliveryBoy as any).isActive) {
      return res.status(400).json({ error: "Delivery boy is not active" });
    }
    if (String((deliveryBoy as any).availability || "").toLowerCase() !== "available") {
      return res.status(409).json({ error: "Delivery boy is not available" });
    }

    const existingActive = await PersistedRoute.findOne({
      deliveryBoyId: (deliveryBoy as any)._id,
      status: { $in: ["ASSIGNED", "IN_PROGRESS"] },
    }).select("routeId status");
    if (existingActive) {
      return res.status(409).json({
        error: "Delivery boy already has an active route",
        message: `Delivery boy already has active route ${String((existingActive as any).routeId)} (${String((existingActive as any).status)})`,
      });
    }

    const orders = await Order.find({ _id: { $in: orderIds } }).select(
      "_id orderStatus deliveryBoyId address"
    );

    if (orders.length !== orderIds.length) {
      return res.status(400).json({
        error: "Some orders not found",
        message: `Found ${orders.length}/${orderIds.length} orders`,
      });
    }

    const notPacked = orders.filter((o: any) => !["PACKED", "packed"].includes(String(o.orderStatus)));
    if (notPacked.length > 0) {
      return res.status(409).json({
        error: "Some orders are not PACKED",
        message: `Orders must be PACKED before assignment (bad count: ${notPacked.length})`,
      });
    }

    const alreadyAssigned = orders.filter((o: any) => !!o.deliveryBoyId);
    if (alreadyAssigned.length > 0) {
      return res.status(409).json({
        error: "Some orders are already assigned",
        message: `Orders must be unassigned before assignment (bad count: ${alreadyAssigned.length})`,
      });
    }

    const orderInputs: OrderInput[] = orders.map((order: any) => {
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

    const result = cvrpRouteAssignmentService.computeRoutes(orderInputs, {
      type: "AUTO",
      capacity: 1,
      maxDistanceKm: 1000000,
    });

    const inputSet = new Set(orderIds.map((x: any) => String(x)));
    const matching = (result.routes || []).find((r) => {
      if (!Array.isArray(r.orders)) return false;
      if (r.orders.length !== inputSet.size) return false;
      for (const id of r.orders) {
        if (!inputSet.has(String(id))) return false;
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
    const digest = crypto.createHash("sha1").update(ordersJoined).digest("hex").slice(0, 12);
    const stableRouteId = `AUTO-${digest}`;

    const now = new Date();
    const dpUserId = (deliveryBoy as any).userId
      ? new mongoose.Types.ObjectId(String((deliveryBoy as any).userId))
      : null;

    const persisted = await PersistedRoute.create({
      routeId: stableRouteId,
      orderIds: (matching.orders || []).map((id) => new mongoose.Types.ObjectId(String(id))),
      routePath:
        Array.isArray(routePath) && routePath.length > 0
          ? routePath
          : Array.isArray(matching.routePath) && matching.routePath.length > 0
            ? matching.routePath
            : ["WAREHOUSE", ...(matching.orders || [])],
      vehicleType: "AUTO",
      totalDistanceKm: Number(matching.totalDistanceKm) || 0,
      estimatedTimeMin: Number(matching.estimatedTimeMin) || 0,
      status: "ASSIGNED",
      deliveryBoyId: (deliveryBoy as any)._id,
      deliveredCount: 0,
      failedCount: 0,
      computedAt: now,
      assignedAt: now,
    } as any);

    await Order.updateMany(
      { _id: { $in: (matching.orders || []).map((id) => new mongoose.Types.ObjectId(String(id))) } },
      {
        $set: {
          deliveryBoyId: (deliveryBoy as any)._id,
          deliveryPartnerId: dpUserId,
          deliveryStatus: "in_transit",
          orderStatus: "OUT_FOR_DELIVERY",
          outForDeliveryAt: now,
        },
      }
    );

    res.json({
      success: true,
      route: {
        routeId: persisted.routeId,
        status: persisted.status,
        deliveryBoyId: String((deliveryBoy as any)._id),
        totalOrders: (matching.orders || []).length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to assign route", message: error?.message || "Unknown error" });
  }
};

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
export const purgeOrders = async (req: Request, res: Response) => {
  try {
    const { confirm, alsoDeleteRoutes = true } = req.body || {};

    if (confirm !== "DELETE_ALL_ORDERS") {
      return res.status(400).json({
        error: "Invalid confirmation",
        message: 'You must include { "confirm": "DELETE_ALL_ORDERS" } in the request body.',
      });
    }

    // Count before deletion
    const ordersCount = await Order.countDocuments();
    let routesCount = 0;
    if (alsoDeleteRoutes) {
      routesCount = await PersistedRoute.countDocuments();
    }

    // Delete orders
    const deleteOrdersResult = await Order.deleteMany({});
    const deletedOrders = deleteOrdersResult.deletedCount || 0;

    // Optionally delete persisted routes
    let deletedRoutes = 0;
    if (alsoDeleteRoutes) {
      const deleteRoutesResult = await PersistedRoute.deleteMany({});
      deletedRoutes = deleteRoutesResult.deletedCount || 0;
    }

    res.json({
      success: true,
      deletedOrders,
      deletedRoutes,
      beforeCounts: { orders: ordersCount, routes: routesCount },
      afterCounts: { orders: 0, routes: alsoDeleteRoutes ? 0 : routesCount },
    });
  } catch (error: any) {
    console.error("Purge orders error:", error);
    res.status(500).json({
      error: "Failed to purge orders",
      message: error.message || "Unknown error occurred",
    });
  }
};
