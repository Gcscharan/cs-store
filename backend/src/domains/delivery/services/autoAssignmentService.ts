import { Order } from "../../../models/Order";
import { DeliveryBoy } from "../../../models/DeliveryBoy";
import { User } from "../../../models/User";

type LatLng = { lat: number; lng: number };

export type RankedCandidate = {
  deliveryBoyId: string;
  score: number;
  distanceKm: number;
};

function toRad(v: number): number {
  return (v * Math.PI) / 180;
}

function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) *
      Math.cos(toRad(b.lat)) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function minutesSince(d?: Date | null): number {
  if (!d) return Number.POSITIVE_INFINITY;
  const ms = Date.now() - new Date(d).getTime();
  if (!Number.isFinite(ms) || ms < 0) return Number.POSITIVE_INFINITY;
  return ms / (60 * 1000);
}

export const autoAssignmentService = {
  async rankCandidatesForOrder(orderId: string): Promise<RankedCandidate[]> {
    const order = await Order.findById(orderId)
      .select("orderStatus deliveryBoyId address")
      .lean();

    if (!order) {
      const err: any = new Error("Order not found");
      err.statusCode = 404;
      throw err;
    }

    const orderStatusUpper = String((order as any).orderStatus || "").toUpperCase();
    if (orderStatusUpper !== "PACKED") {
      return [];
    }

    if ((order as any).deliveryBoyId) {
      return [];
    }

    const orderLat = Number((order as any).address?.lat);
    const orderLng = Number((order as any).address?.lng);
    if (!Number.isFinite(orderLat) || !Number.isFinite(orderLng)) {
      return [];
    }

    const deliveryBoys = await DeliveryBoy.find({
      isActive: true,
    })
      .populate({
        path: "userId",
        model: User,
        select: "status role",
      })
      .select("assignedOrders currentLoad currentLocation lastAssignedAt rejectionsToday availability isActive userId")
      .lean();

    const eligible = deliveryBoys.filter((db: any) => {
      const u = db.userId as any;
      if (!u) return false;
      if (String(u.role || "") !== "delivery") return false;
      if (String(u.status || "") !== "active") return false;
      const lat = Number(db.currentLocation?.lat);
      const lng = Number(db.currentLocation?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
      if (lat === 0 || lng === 0) return false;
      return true;
    });

    const orderPoint = { lat: orderLat, lng: orderLng };

    const ranked: RankedCandidate[] = eligible.map((db: any) => {
      const driverPoint = {
        lat: Number(db.currentLocation.lat),
        lng: Number(db.currentLocation.lng),
      };

      const dist = distanceKm(driverPoint, orderPoint);
      const activeOrdersCount =
        (Array.isArray(db.assignedOrders) ? db.assignedOrders.length : 0) ||
        Number(db.currentLoad || 0);
      const rejectionsToday = Number(db.rejectionsToday || 0);
      const recentMinutes = minutesSince(db.lastAssignedAt);
      const recentPenalty = recentMinutes < 10 ? 3 : 0;

      const score = dist * 0.6 + activeOrdersCount * 1.5 + rejectionsToday * 2 + recentPenalty;

      return {
        deliveryBoyId: String(db._id),
        distanceKm: dist,
        score,
      };
    });

    ranked.sort((a, b) => a.score - b.score);
    return ranked;
  },
};
