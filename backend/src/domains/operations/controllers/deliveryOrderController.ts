import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Order } from "../../../models/Order";
import { DeliveryBoy } from "../../../models/DeliveryBoy";
import { User } from "../../../models/User";
import Notification from "../../../models/Notification";
import { AuthRequest } from "../../../middleware/auth";
import { sendSMS } from "../../../utils/sms";
import { sendEmailOTP } from "../../../utils/sendEmailOTP";
import { sendDeliveryOtpEmail } from "../../../utils/sendDeliveryOtpEmail";
import { dispatchNotification } from "../../communication/services/notificationService";
import { deliveryPartnerLoadService } from "../services/deliveryPartnerLoadService";
import { orderStateService } from "../../orders/services/orderStateService";
import { OrderStatus } from "../../orders/enums/OrderStatus";
import { Route } from "../../../models/Route";
import { DeliveryAttempt } from "../../../models/DeliveryAttempt";
import { CodCollection } from "../../../models/CodCollection";
import { updateRouteAfterOrderStatusChange } from "../../routes/routeLifecycleService";
import { liveLocationStore } from "../../../services/liveLocationStore";

const getApprovedDeliveryBoy = async (user: any): Promise<any | null> => {
  if (!user || user.role !== "delivery") return null;
  if (String(user.status || "") !== "active") return null;

  let deliveryBoy = await DeliveryBoy.findOne({ userId: user._id });
  if (!deliveryBoy && user.phone) {
    const byPhone = await DeliveryBoy.findOne({ phone: user.phone });
    if (byPhone) {
      if (!byPhone.userId) {
        byPhone.userId = user._id;
        await byPhone.save();
      }
      deliveryBoy = byPhone;
    }
  }

  if (!deliveryBoy || !deliveryBoy.isActive) return null;
  return deliveryBoy;
};

const toRadians = (deg: number): number => (deg * Math.PI) / 180;

const haversineMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number => {
  const R = 6371000;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
};

/**
 * Get current assigned route for delivery boy
 * GET /api/delivery/routes/current
 */
export const getCurrentRoute = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const route = await Route.findOne({
      deliveryBoyId: (deliveryBoy as any)._id,
      status: { $in: ["ASSIGNED", "IN_PROGRESS"] },
    }).lean();

    if (!route) {
      res.json({ success: true, route: null });
      return;
    }

    const orderedOrderIds = (Array.isArray((route as any).routePath) ? (route as any).routePath : [])
      .filter((x: any) => String(x || "").toUpperCase() !== "WAREHOUSE")
      .map((x: any) => String(x));

    const orders = await Order.find({ _id: { $in: (route as any).orderIds } })
      .select("_id orderStatus address.lat address.lng")
      .lean();

    const statusById: Record<string, string> = {};
    const coordsById: Record<string, { lat: number; lng: number } | null> = {};
    for (const o of orders as any[]) {
      const id = String((o as any)._id);
      statusById[id] = String((o as any).orderStatus || "").toUpperCase();
      const lat = Number((o as any)?.address?.lat);
      const lng = Number((o as any)?.address?.lng);
      coordsById[id] = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    }

    const isDone = (st: string) => st === "DELIVERED" || st === "FAILED" || st === "CANCELLED";
    const nextStop = orderedOrderIds.find((id: string) => !isDone(statusById[id] || "")) || null;

    const destination = nextStop ? coordsById[nextStop] : null;
    const navigationUrl =
      nextStop && destination
        ? `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=driving`
        : null;

    const totalOrders = orderedOrderIds.length;
    const deliveredCount = Number((route as any).deliveredCount || 0);
    const failedCount = Number((route as any).failedCount || 0);
    const completedCount = deliveredCount + failedCount;
    const progressPct = totalOrders > 0 ? Math.round((completedCount / totalOrders) * 100) : 0;

    res.json({
      success: true,
      route: {
        routeId: String((route as any).routeId),
        totalOrders,
        deliveredCount,
        estimatedTimeMin: Number((route as any).estimatedTimeMin || 0),
        routePath: orderedOrderIds,
        nextStop,
        navigationUrl,
        progressPct,
      },
    });
  } catch (error) {
    console.error("Get current route error:", error);
    res.status(500).json({ error: "Failed to fetch current route" });
  }
};

export const recordDeliveryAttempt = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orderId } = req.params;
    const body = (req as any).body || {};
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

    const order = await Order.findById(orderId).select(
      "_id orderStatus deliveryStatus deliveryBoyId deliveryPartnerId"
    );
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const assignedBoyId = (order as any).deliveryBoyId;
    const assignedPartnerId = (order as any).deliveryPartnerId;
    const actorBoyId = String((deliveryBoy as any)._id);
    const actorUserId = String((user as any)._id);
    const matchesBoy = assignedBoyId && String(assignedBoyId) === actorBoyId;
    const matchesPartner = assignedPartnerId && String(assignedPartnerId) === actorUserId;
    if (!matchesBoy && !matchesPartner) {
      res.status(403).json({ error: "You are not assigned to this order" });
      return;
    }

    const orderStatusUpper = String((order as any).orderStatus || "").trim().toUpperCase();
    const deliveryStatusLower = String((order as any).deliveryStatus || "").trim().toLowerCase();

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

    const failureReason =
      typeof body?.failureReason === "string" ? String(body.failureReason).trim().toUpperCase() : "";
    const failureNotes =
      typeof body?.failureNotes === "string" ? String(body.failureNotes).trim() : "";

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

    const orderObjectId = new mongoose.Types.ObjectId(String(orderId));

    const existingAttempt = await DeliveryAttempt.findOne({ orderId: orderObjectId })
      .select("_id status")
      .lean();
    if (existingAttempt) {
      res.status(409).json({ error: "Delivery attempt already recorded" });
      return;
    }

    const route = await Route.findOne({
      deliveryBoyId: (deliveryBoy as any)._id,
      status: { $in: ["ASSIGNED", "IN_PROGRESS"] },
      orderIds: new mongoose.Types.ObjectId(String(orderId)),
    })
      .select("_id")
      .lean();

    if (!route?._id) {
      res.status(409).json({ error: "Order is not part of an active route" });
      return;
    }

    let location: any = undefined;
    if (body?.location && typeof body.location === "object") {
      const lat = Number((body.location as any).lat);
      const lng = Number((body.location as any).lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        location = { lat, lng };
      }
    }

    const now = new Date();

    let created: any = null;
    try {
      created = await DeliveryAttempt.create({
        orderId: orderObjectId,
        routeId: new mongoose.Types.ObjectId(String((route as any)._id)),
        deliveryBoyId: new mongoose.Types.ObjectId(String((deliveryBoy as any)._id)),
        status,
        failureReason: status === "FAILED" ? failureReason : null,
        failureNotes: status === "FAILED" && failureNotes ? failureNotes : null,
        attemptedAt: now,
        ...(location ? { location } : {}),
      });
    } catch (e: any) {
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
      await Order.updateOne(
        { _id: orderObjectId },
        {
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
              from: (order as any).orderStatus,
              to: "CANCELLED",
              actorRole: "DELIVERY_PARTNER",
              actorId: String((deliveryBoy as any)._id),
              at: cancelAt,
              meta: {
                failureReason,
                failureNotes: failureNotes || null,
              },
            },
          },
        }
      );

      try {
        await updateRouteAfterOrderStatusChange({
          orderId: String(orderId),
          newStatus: OrderStatus.CANCELLED,
          occurredAt: cancelAt,
        });
      } catch (e) {
        console.error("Route lifecycle update failed (CANCELLED):", e);
      }
    }

    const io = (req as any).app.get("io");
    if (io) {
      const payload: any = {
        orderId: String(orderId),
        deliveryBoyId: String((deliveryBoy as any)._id),
        status,
        ...(status === "FAILED" ? { failureReason } : {}),
      };
      io.to("admin_room").emit(
        status === "FAILED" ? "delivery_attempt_failed" : "delivery_attempt_success",
        payload
      );
    }

    res.status(201).json({
      success: true,
      attempt: {
        _id: (created as any)._id,
        orderId: String((created as any).orderId),
        routeId: String((created as any).routeId),
        deliveryBoyId: String((created as any).deliveryBoyId),
        status: String((created as any).status),
        failureReason: (created as any).failureReason ?? null,
        failureNotes: (created as any).failureNotes ?? null,
        attemptedAt: (created as any).attemptedAt,
        location: (created as any).location,
        createdAt: (created as any).createdAt,
      },
    });
  } catch (error) {
    next(error as any);
  }
};

export const getAdminOrderAttempt = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orderId } = req.params;
    const attempt = await DeliveryAttempt.findOne({
      orderId: new mongoose.Types.ObjectId(String(orderId)),
    }).lean();

    res.json({
      success: true,
      attempt: attempt
        ? {
            _id: (attempt as any)._id,
            orderId: String((attempt as any).orderId),
            routeId: String((attempt as any).routeId),
            deliveryBoyId: String((attempt as any).deliveryBoyId),
            status: String((attempt as any).status),
            failureReason: (attempt as any).failureReason ?? null,
            failureNotes: (attempt as any).failureNotes ?? null,
            attemptedAt: (attempt as any).attemptedAt,
            location: (attempt as any).location,
            createdAt: (attempt as any).createdAt,
          }
        : null,
    });
  } catch (error) {
    next(error as any);
  }
};

export const getAdminCodCollection = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orderId } = req.params;
    const collection = await CodCollection.findOne({
      orderId: new mongoose.Types.ObjectId(String(orderId)),
    })
      .populate("collectedByActorId", "name phone email")
      .lean();

    res.json({
      success: true,
      codCollection: collection
        ? {
            _id: String((collection as any)._id),
            orderId: String((collection as any).orderId),
            mode: String((collection as any).mode),
            amount: Number((collection as any).amount),
            currency: String((collection as any).currency),
            collectedAt: (collection as any).collectedAt,
            idempotencyKey: String((collection as any).idempotencyKey),
            upiRef: (collection as any).upiRef ?? null,
            notes: (collection as any).notes ?? null,
            collectedBy: (collection as any).collectedByActorId
              ? {
                  _id: String((collection as any).collectedByActorId?._id),
                  name: String((collection as any).collectedByActorId?.name || ""),
                  phone: String((collection as any).collectedByActorId?.phone || ""),
                  email: (collection as any).collectedByActorId?.email
                    ? String((collection as any).collectedByActorId?.email)
                    : null,
                }
              : null,
            createdAt: (collection as any).createdAt,
          }
        : null,
    });
  } catch (error) {
    next(error as any);
  }
};

/**
 * Get delivery boy info
 * GET /api/delivery/info
 */
export const getDeliveryBoyInfo = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
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
  } catch (error) {
    console.error("Get delivery boy info error:", error);
    res.status(500).json({
      error: "Failed to fetch delivery info. Please try again later.",
    });
  }
};

/**
 * Get delivery boy's assigned orders
 * GET /api/delivery/orders
 */
export const getDeliveryOrders = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
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
    const orders = await Order.find({
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

    const normalizedOrders = orders.map((o: any) => {
      const raw = String(o.orderStatus || "").toUpperCase();
      if (raw === "OUT_FOR_DELIVERY") {
        return { ...o.toObject(), orderStatus: "IN_TRANSIT" };
      }
      return o;
    });

    const computedCompletedOrdersCount = await Order.countDocuments({
      $and: [
        {
          $or: [
            { deliveryBoyId: (deliveryBoy as any)._id },
            { deliveryBoyId: (user as any)._id },
            { deliveryPartnerId: (user as any)._id },
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
  } catch (error) {
    console.error("Get delivery orders error:", error);
    res.status(500).json({
      error: "Failed to fetch orders. Please try again later.",
    });
  }
};

/**
 * Accept an order assignment
 * POST /api/delivery/orders/:orderId/accept
 */
export const acceptOrder = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  throw new Error(
    "Order status mutation is frozen. Use orderStateService.transition()"
  );
};

/**
 * Reject an order assignment
 * POST /api/delivery/orders/:orderId/reject
 */
export const rejectOrder = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
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
    const order = await Order.findById(orderId);
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
    } as any);

    await order.save();

    // Emit socket event to reassign
    const io = (req as any).app.get("io");
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
  } catch (error) {
    console.error("Reject order error:", error);
    res.status(500).json({
      error: "Failed to reject order. Please try again later.",
    });
  }
};

/**
 * Update delivery boy location
 * PUT /api/delivery/location
 */
export const updateLocation = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      lat,
      lng,
      accuracy,
      speed,
      heading,
      timestamp,
      routeId,
    } = req.body;
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
    if (now - tsNum > 30_000) {
      res.status(422).json({ error: "stale timestamp" });
      return;
    }

    const deliveryBoy = await getApprovedDeliveryBoy(user);
    if (!deliveryBoy) {
      res.status(403).json({ error: "Account not approved or delivery profile not active" });
      return;
    }

    if (String((deliveryBoy as any).availability || "").toLowerCase() === "offline") {
      res.status(403).json({ error: "OFF_DUTY" });
      return;
    }

    // Lightweight abuse protection: max 1 update/sec, burst 5. If exceeded, drop silently.
    if (!liveLocationStore.allowIngest(String((deliveryBoy as any)._id))) {
      res.status(204).send();
      return;
    }

    // Route ownership validation: must match the delivery boy's current active route.
    const activeRoute = await Route.findOne({
      deliveryBoyId: (deliveryBoy as any)._id,
      status: { $in: ["ASSIGNED", "IN_PROGRESS"] },
    })
      .select("routeId orderIds status")
      .lean();

    if (!activeRoute) {
      res.status(403).json({ error: "NO_ACTIVE_ROUTE" });
      return;
    }

    if (String((activeRoute as any).routeId) !== routeIdStr) {
      res.status(403).json({ error: "ROUTE_MISMATCH" });
      return;
    }

    // Anti-spoof: reject impossible jumps using server receive time (do not trust client time).
    const driverIdStr = String((deliveryBoy as any)._id);
    const prev = liveLocationStore.get(driverIdStr);
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

    const orderIds = Array.isArray((activeRoute as any).orderIds)
      ? (activeRoute as any).orderIds.map((x: any) => String(x))
      : [];

    liveLocationStore.update(driverIdStr, {
      routeId: routeIdStr,
      orderIds,
      lat: latNum,
      lng: lngNum,
      accuracy: accuracyNum,
      speed: Number.isFinite(speedNum as any) ? (speedNum as number) : null,
      heading: Number.isFinite(headingNum as any) ? (headingNum as number) : null,
      timestamp: tsNum,
    });

    res.status(204).send();
    return;
  } catch (error) {
    console.error("Update location error:", error);
    res.status(500).json({
      error: "Failed to update location. Please try again later.",
    });
  }
};

/**
 * Toggle delivery boy online/offline status
 * PUT /api/delivery/status
 */
export const toggleStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
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
    const io = (req as any).app.get("io");
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
  } catch (error) {
    console.error("Toggle status error:", error);
    res.status(500).json({
      error: "Failed to update status. Please try again later.",
    });
  }
};

/**
 * Get delivery boy earnings
 * GET /api/delivery/earnings
 */
export const getEarnings = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
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

    const range: any = {};
    if (from) range.$gte = new Date(from as string);
    if (to) range.$lte = new Date(to as string);

    const query: any = {
      $and: [
        {
          $or: [
            { deliveryBoyId: (deliveryBoy as any)._id },
            { deliveryBoyId: (user as any)._id },
            { deliveryPartnerId: (user as any)._id },
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
    const orders = await Order.find(query).sort({ deliveredAt: -1, createdAt: -1 });

    // Calculate earnings
    const totalEarnings = orders.reduce(
      (sum, order) => sum + (order.earnings?.deliveryFee || 0),
      0
    );
    const totalTips = orders.reduce(
      (sum, order) => sum + (order.earnings?.tip || 0),
      0
    );

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
  } catch (error) {
    console.error("Get earnings error:", error);
    res.status(500).json({
      error: "Failed to fetch earnings. Please try again later.",
    });
  }
};

/**
 * Mark order as picked up
 * POST /api/delivery/orders/:orderId/pickup
 */
export const pickupOrder = async (
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

    const deliveryBoy = await getApprovedDeliveryBoy(user);
    if (!deliveryBoy) {
      res.status(403).json({ error: "Account not approved or delivery profile not active" });
      return;
    }

    const order = await orderStateService.transition({
      orderId,
      toStatus: OrderStatus.PICKED_UP,
      actorRole: "DELIVERY_PARTNER",
      actorId: String(deliveryBoy._id),
    });

    try {
      await updateRouteAfterOrderStatusChange({
        orderId: String(orderId),
        newStatus: OrderStatus.PICKED_UP,
        occurredAt: new Date(),
      });
    } catch (e) {
      console.error("Route lifecycle update failed (PICKED_UP):", e);
    }

    const io = (req as any).app.get("io");
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
  } catch (error: any) {
    const statusCode = Number(error?.statusCode) || 500;
    res.status(statusCode).json({ error: error?.message || "Failed to pickup order" });
  }
};

/**
 * Start delivery (in transit)
 * POST /api/delivery/orders/:orderId/start-delivery
 */
export const startDelivery = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
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

    const order = await orderStateService.transition({
      orderId,
      toStatus: OrderStatus.IN_TRANSIT,
      actorRole: "DELIVERY_PARTNER",
      actorId: String(deliveryBoy._id),
    });

    try {
      await updateRouteAfterOrderStatusChange({
        orderId: String(orderId),
        newStatus: OrderStatus.IN_TRANSIT,
        occurredAt: new Date(),
      });
    } catch (e) {
      console.error("Route lifecycle update failed (IN_TRANSIT):", e);
    }

    res.json({
      success: true,
      order,
    });
  } catch (error) {
    next(error as any);
  }
};

/**
 * Mark as arrived at delivery location
 * POST /api/delivery/orders/:orderId/arrived
 */
export const markArrived = async (
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

    const deliveryBoy = await getApprovedDeliveryBoy(user);
    if (!deliveryBoy) {
      res.status(403).json({ error: "Account not approved or delivery profile not active" });
      return;
    }

    const order = await Order.findById(orderId);
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const assignedPartnerId = (order as any).deliveryPartnerId;
    const assignedBoyId = (order as any).deliveryBoyId;
    const actorBoyId = String((deliveryBoy as any)._id);
    const actorUserId = String((user as any)._id);
    const matchesPartner = assignedPartnerId && String(assignedPartnerId) === actorUserId;
    const matchesBoy = assignedBoyId && String(assignedBoyId) === actorBoyId;
    if (!matchesPartner && !matchesBoy) {
      res.status(403).json({ error: "Access denied for this order" });
      return;
    }

    if ((order as any).arrivedAt) {
      res.status(200).json({
        success: true,
        message: "Arrival already recorded",
        order,
      });
      return;
    }

    const status = String((order as any).orderStatus || "").toUpperCase();
    const okToArrive = status === "IN_TRANSIT" || status === "OUT_FOR_DELIVERY";
    if (!okToArrive) {
      res.status(409).json({
        error: "Invalid order status for arrived",
        message: `Cannot mark arrived when orderStatus=${status}`,
      });
      return;
    }

    (order as any).arrivedAt = new Date();
    await order.save();

    try {
      await Notification.create({
        userId: new mongoose.Types.ObjectId(String((order as any).userId?._id || (order as any).userId)),
        title: "Delivery Arrived",
        message: "Your delivery partner has arrived at the delivery location.",
        body: "Your delivery partner has arrived at the delivery location.",
        type: "delivery_arrived",
        category: "delivery",
        isRead: false,
        orderId: new mongoose.Types.ObjectId(String(orderId)),
        deepLink: "/notifications",
      });
    } catch (e) {
      console.error("Failed to create arrived in-app notification:", e);
    }

    const io = (req as any).app.get("io");
    if (io) {
      const customerRoom = `user_${String((order as any).userId?._id || (order as any).userId || "")}`;
      if (String((order as any).userId?._id || (order as any).userId || "")) {
        io.to(customerRoom).emit("notification:refresh");
      }
      io.to("admin_room").emit("order_arrived", {
        orderId: String(orderId),
        deliveryBoyId: String((deliveryBoy as any)._id),
      });
    }

    res.json({ success: true, order });
  } catch (error: any) {
    console.error("Mark arrived error:", error);
    const statusCode = Number(error?.statusCode) || 500;
    res.status(statusCode).json({ error: error?.message || "Failed to mark arrived" });
  }
};

export const getCodCollection = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const order = await Order.findById(orderId).select(
      "_id deliveryBoyId deliveryPartnerId orderStatus deliveryStatus paymentMethod arrivedAt totalAmount"
    );
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const assignedPartnerId = (order as any).deliveryPartnerId;
    const assignedBoyId = (order as any).deliveryBoyId;
    const actorBoyId = String((deliveryBoy as any)._id);
    const actorUserId = String((user as any)._id);
    const matchesPartner = assignedPartnerId && String(assignedPartnerId) === actorUserId;
    const matchesBoy = assignedBoyId && String(assignedBoyId) === actorBoyId;
    if (!matchesPartner && !matchesBoy) {
      res.status(403).json({ error: "Access denied for this order" });
      return;
    }

    const collection = await CodCollection.findOne({
      orderId: new mongoose.Types.ObjectId(String(orderId)),
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
        _id: String((collection as any)._id),
        orderId: String((collection as any).orderId),
        mode: String((collection as any).mode),
        amount: Number((collection as any).amount),
        currency: String((collection as any).currency),
        collectedByActorId: String((collection as any).collectedByActorId),
        collectedAt: (collection as any).collectedAt,
        idempotencyKey: String((collection as any).idempotencyKey),
        upiRef: (collection as any).upiRef ?? null,
        notes: (collection as any).notes ?? null,
        deviceContext: (collection as any).deviceContext ?? null,
        createdAt: (collection as any).createdAt,
      },
    });
  } catch (error: any) {
    console.error("Get COD collection error:", error);
    const statusCode = Number(error?.statusCode) || 500;
    res.status(statusCode).json({ error: error?.message || "Failed to fetch COD collection" });
  }
};

export const createCodCollection = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const body = (req as any).body || {};
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

    const order = await Order.findById(orderId).select(
      "_id deliveryBoyId deliveryPartnerId orderStatus deliveryStatus paymentMethod arrivedAt totalAmount"
    );
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const assignedPartnerId = (order as any).deliveryPartnerId;
    const assignedBoyId = (order as any).deliveryBoyId;
    const actorBoyId = String((deliveryBoy as any)._id);
    const actorUserId = String((user as any)._id);
    const matchesPartner = assignedPartnerId && String(assignedPartnerId) === actorUserId;
    const matchesBoy = assignedBoyId && String(assignedBoyId) === actorBoyId;
    if (!matchesPartner && !matchesBoy) {
      res.status(403).json({ error: "Access denied for this order" });
      return;
    }

    const orderStatusUpper = String((order as any).orderStatus || "").toUpperCase();
    const deliveryStatusLower = String((order as any).deliveryStatus || "").toLowerCase();
    if (orderStatusUpper === "DELIVERED" || deliveryStatusLower === "delivered") {
      res.status(409).json({ error: "Order is already delivered" });
      return;
    }
    if (orderStatusUpper === "CANCELLED" || deliveryStatusLower === "cancelled") {
      res.status(409).json({ error: "Order is cancelled" });
      return;
    }

    const paymentMethodLower = String((order as any).paymentMethod || "").toLowerCase();
    if (paymentMethodLower !== "cod") {
      res.status(422).json({ error: "NOT_COD_ORDER" });
      return;
    }

    if (!(order as any).arrivedAt) {
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

    const amountNum = Number((order as any).totalAmount);
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      res.status(500).json({ error: "Invalid order amount" });
      return;
    }

    const orderObjectId = new mongoose.Types.ObjectId(String(orderId));
    const now = new Date();

    let created: any = null;
    try {
      created = await CodCollection.create({
        orderId: orderObjectId,
        mode,
        amount: amountNum,
        currency: "INR",
        collectedByActorId: new mongoose.Types.ObjectId(String((deliveryBoy as any)._id)),
        collectedAt: now,
        idempotencyKey,
        upiRef: body?.upiRef ? String(body.upiRef).trim() : null,
        notes: body?.notes ? String(body.notes).trim() : null,
        deviceContext: body?.deviceContext && typeof body.deviceContext === "object" ? body.deviceContext : null,
      });
    } catch (e: any) {
      const msg = String(e?.message || "");
      const isDup = e?.code === 11000 || msg.includes("E11000");
      if (isDup) {
        const existing = await CodCollection.findOne({ orderId: orderObjectId }).lean();
        if (existing && String((existing as any).idempotencyKey) === idempotencyKey) {
          res.status(200).json({
            success: true,
            codCollection: {
              _id: String((existing as any)._id),
              orderId: String((existing as any).orderId),
              mode: String((existing as any).mode),
              amount: Number((existing as any).amount),
              currency: String((existing as any).currency),
              collectedByActorId: String((existing as any).collectedByActorId),
              collectedAt: (existing as any).collectedAt,
              idempotencyKey: String((existing as any).idempotencyKey),
              upiRef: (existing as any).upiRef ?? null,
              notes: (existing as any).notes ?? null,
              deviceContext: (existing as any).deviceContext ?? null,
              createdAt: (existing as any).createdAt,
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
        _id: String((created as any)._id),
        orderId: String((created as any).orderId),
        mode: String((created as any).mode),
        amount: Number((created as any).amount),
        currency: String((created as any).currency),
        collectedByActorId: String((created as any).collectedByActorId),
        collectedAt: (created as any).collectedAt,
        idempotencyKey: String((created as any).idempotencyKey),
        upiRef: (created as any).upiRef ?? null,
        notes: (created as any).notes ?? null,
        deviceContext: (created as any).deviceContext ?? null,
        createdAt: (created as any).createdAt,
      },
    });
  } catch (error: any) {
    console.error("Create COD collection error:", error);
    const statusCode = Number(error?.statusCode) || 500;
    res.status(statusCode).json({ error: error?.message || "Failed to record COD collection" });
  }
};

export const deliverAttempt = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const order = await Order.findById(orderId).populate("userId", "name phone email");
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const assignedPartnerId = (order as any).deliveryPartnerId;
    const assignedBoyId = (order as any).deliveryBoyId;
    const actorId = String((deliveryBoy as any)._id);
    const matchesPartner = assignedPartnerId && String(assignedPartnerId) === actorId;
    const matchesBoy = assignedBoyId && String(assignedBoyId) === actorId;
    if (!matchesPartner && !matchesBoy) {
      res.status(403).json({ error: "Access denied for this order" });
      return;
    }

    const status = String((order as any).orderStatus || "").toUpperCase();
    const deliveryStatusLower = String((order as any).deliveryStatus || "").toLowerCase();
    if (status === "CANCELLED" || deliveryStatusLower === "cancelled") {
      res.status(409).json({ error: `Cannot attempt delivery for cancelled order (orderStatus=${status})` });
      return;
    }

    if (!(order as any).arrivedAt) {
      res.status(409).json({ error: "ARRIVAL_REQUIRED_BEFORE_OTP" });
      return;
    }

    const paymentMethodLower = String((order as any).paymentMethod || "").toLowerCase();
    if (paymentMethodLower === "cod") {
      const existingCollection = await CodCollection.findOne({
        orderId: new mongoose.Types.ObjectId(String(orderId)),
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
    (order as any).deliveryOtp = otp;
    (order as any).deliveryOtpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
    (order as any).deliveryOtpGeneratedAt = now;
    (order as any).deliveryOtpIssuedTo = (deliveryBoy as any)._id;
    await order.save();

    const customer = (order as any).userId as any;
    const otpToSend = String((order as any).deliveryOtp || "").trim();

    let smsSent = false;
    let emailSent = false;

    if (customer?.phone) {
      const smsMessage = `Your CS Store delivery OTP is ${otpToSend}. Valid for 5 minutes.`;
      try {
        await sendSMS(String(customer.phone), smsMessage);
        smsSent = true;
      } catch (e) {
        console.error("Failed to send delivery OTP via SMS:", e);
      }
    }

    if (customer?.email) {
      try {
        await sendDeliveryOtpEmail(String(customer.email), otpToSend, String(orderId));
        emailSent = true;
      } catch (e) {
        console.error("Failed to send delivery OTP via email:", e);
      }
    }

    try {
      const orderLabel = String(orderId).slice(-6).toUpperCase();
      await Notification.create({
        userId: new mongoose.Types.ObjectId(String((order as any).userId?._id || (order as any).userId)),
        title: "Delivery OTP",
        message: `Your delivery OTP for Order #${orderLabel} is ${otpToSend}`,
        body: `Your delivery OTP for Order #${orderLabel} is ${otpToSend}`,
        type: "delivery_otp",
        category: "delivery",
        priority: "high",
        isRead: false,
        orderId: new mongoose.Types.ObjectId(String(orderId)),
        deepLink: "/notifications",
      });
    } catch (e) {
      console.error("Failed to create OTP in-app notification:", e);
    }

    const io = (req as any).app.get("io");
    if (io) {
      const customerRoom = `user_${String((order as any).userId?._id || (order as any).userId || "")}`;
      if (String((order as any).userId?._id || (order as any).userId || "")) {
        io.to(customerRoom).emit("notification:refresh", {
          kind: "delivery_otp",
          orderId: String(orderId),
        });
      }
    }

    res.json({
      success: true,
      otpExpiresAt: (order as any).deliveryOtpExpiresAt,
      otpSentTo: {
        sms: smsSent,
        email: emailSent,
      },
    });
  } catch (error: any) {
    console.error("Delivery attempt error:", error);
    const statusCode = Number(error?.statusCode) || 500;
    res.status(statusCode).json({ error: error?.message || "Failed to start delivery attempt" });
  }
};

export const verifyDeliveryOtp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { otp, photoUrl, signature, geo, deviceId } = (req as any).body || {};
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

    const orderDoc = await Order.findById(orderId).select(
      "_id userId orderStatus deliveryStatus deliveryOtpExpiresAt deliveryOtpIssuedTo"
    );
    if (!orderDoc) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const status = String((orderDoc as any).orderStatus || "").toUpperCase();
    const deliveryStatusLower = String((orderDoc as any).deliveryStatus || "").toLowerCase();
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

    const issuedTo = (orderDoc as any).deliveryOtpIssuedTo;
    if (!issuedTo || String(issuedTo) !== String((deliveryBoy as any)._id)) {
      res.status(403).json({ error: "OTP is not issued for this delivery partner" });
      return;
    }

    const order = await orderStateService.transition({
      orderId,
      toStatus: OrderStatus.DELIVERED,
      actorRole: "DELIVERY_PARTNER",
      actorId: String((deliveryBoy as any)._id),
      meta: {
        otp,
        photoUrl,
        signature,
        geo,
        deviceId,
      },
    });

    try {
      await Order.findByIdAndUpdate(orderId, {
        $unset: { deliveryOtp: 1, deliveryOtpExpiresAt: 1 },
      });
    } catch (e) {
      console.error("Failed to invalidate delivery OTP after verification:", e);
    }

    try {
      await updateRouteAfterOrderStatusChange({
        orderId: String(orderId),
        newStatus: OrderStatus.DELIVERED,
        occurredAt: new Date(),
      });
    } catch (e) {
      console.error("Route lifecycle update failed (DELIVERED):", e);
    }

    const io = (req as any).app.get("io");
    if (io) {
      io.to("admin_room").emit("order_delivered", {
        orderId: String(orderId),
        deliveryBoyId: String((deliveryBoy as any)._id),
      });

      const customerRoom = `user_${String((order as any)?.userId || "")}`;
      if (String((order as any)?.userId || "")) {
        io.to(customerRoom).emit("order_delivered", {
          orderId: String(orderId),
        });
      }
    }

    res.json({ success: true, order });
  } catch (error: any) {
    console.error("Verify OTP error:", error);
    const statusCode = Number(error?.statusCode) || 500;
    res.status(statusCode).json({ error: error?.message || "Failed to verify OTP" });
  }
};

/**
 * Complete delivery with OTP verification
 * POST /api/delivery/orders/:orderId/complete
 */
export const completeDelivery = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    res.status(410).json({
      error: "This endpoint is disabled. Use /verify-otp to complete delivery.",
    });
  } catch (error) {
    next(error as any);
  }
};

/**
 * Fail delivery
 * POST /api/delivery/orders/:orderId/fail
 */
export const failDelivery = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { failureReasonCode, failureNotes } = (req as any).body || {};
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

    const order = await orderStateService.transition({
      orderId,
      toStatus: OrderStatus.FAILED,
      actorRole: "DELIVERY_PARTNER",
      actorId: String(deliveryBoy._id),
      meta: {
        failureReasonCode,
        failureNotes,
      },
    });

    try {
      await updateRouteAfterOrderStatusChange({
        orderId: String(orderId),
        newStatus: OrderStatus.FAILED,
        occurredAt: new Date(),
      });
    } catch (e) {
      console.error("Route lifecycle update failed (FAILED):", e);
    }

    res.json({
      success: true,
      order,
    });
  } catch (error) {
    next(error as any);
  }
};

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
