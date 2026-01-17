import mongoose from "mongoose";
import { Order } from "../../models/Order";
import { Route } from "../../models/Route";
import { OrderStatus } from "../orders/enums/OrderStatus";

function normalizeStatus(raw: any): string {
  return String(raw || "").trim().toUpperCase();
}

export async function updateRouteAfterOrderStatusChange(params: {
  orderId: string;
  newStatus: OrderStatus;
  occurredAt?: Date;
}): Promise<void> {
  const orderId = String(params.orderId || "");
  if (!orderId) return;

  const route = await Route.findOne({
    orderIds: new mongoose.Types.ObjectId(orderId),
    status: { $in: ["ASSIGNED", "IN_PROGRESS"] },
  }).select("_id status orderIds deliveredCount failedCount assignedAt startedAt estimatedTimeMin");

  if (!route) return;

  const occurredAt = params.occurredAt || new Date();

  const orders = await Order.find({ _id: { $in: route.orderIds } })
    .select("_id orderStatus")
    .lean();

  let deliveredCount = 0;
  let failedCount = 0;
  for (const o of orders as any[]) {
    const st = normalizeStatus((o as any).orderStatus);
    if (st === "DELIVERED") deliveredCount += 1;
    if (st === "FAILED" || st === "CANCELLED") failedCount += 1;
  }

  const totalOrders = route.orderIds.length;
  const completedCount = deliveredCount + failedCount;

  const shouldStart =
    route.status === "ASSIGNED" &&
    [
      OrderStatus.PICKED_UP,
      OrderStatus.IN_TRANSIT,
      OrderStatus.DELIVERED,
      OrderStatus.FAILED,
      OrderStatus.CANCELLED,
    ].includes(params.newStatus);

  if (shouldStart) {
    route.status = "IN_PROGRESS";
    if (!route.startedAt) route.startedAt = occurredAt;
  }

  route.deliveredCount = deliveredCount;
  route.failedCount = failedCount;

  if (totalOrders > 0 && completedCount >= totalOrders) {
    route.status = "COMPLETED";
    if (!route.startedAt) route.startedAt = route.assignedAt || occurredAt;
    (route as any).completedAt = occurredAt;
  }

  await route.save();
}
