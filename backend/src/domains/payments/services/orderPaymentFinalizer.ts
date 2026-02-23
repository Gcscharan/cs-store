import mongoose from "mongoose";
import { Order } from "../../../models/Order";
import { InventoryReservation } from "../../../models/InventoryReservation";
import { inventoryReservationService } from "../../orders/services/inventoryReservationService";
import { logger } from "../../../utils/logger";

export async function finalizeOrderOnCapturedPayment(args: {
  orderId: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  capturedAt?: Date;
  // Optional session: webhook processor can include (ledger + paymentIntent + inventory + order) atomically.
  session?: mongoose.ClientSession;
}): Promise<{ updated: boolean }>{
  const update: any = { paymentStatus: "PAID" };
  if (args.razorpayOrderId) update.razorpayOrderId = args.razorpayOrderId;
  if (args.razorpayPaymentId) update.razorpayPaymentId = args.razorpayPaymentId;
  if (args.capturedAt) update.paymentReceivedAt = args.capturedAt;

  const run = async (session: mongoose.ClientSession): Promise<{ updated: boolean }> => {
    const existing = await Order.findById(args.orderId)
      .select("paymentStatus items")
      .session(session);
    if (!existing) return { updated: false };

    const ps = String((existing as any).paymentStatus || "").toUpperCase();
    if (ps === "PAID") {
      logger.error("CRITICAL_INVARIANT_BREACH: Order already PAID before finalizer", undefined, {
        orderId: (existing as any)._id,
      });
      const err: any = new Error("Order already finalized");
      err.statusCode = 409;
      throw err;
    }

    const orderItems = Array.isArray((existing as any).items) ? ((existing as any).items as any[]) : [];
    const items = orderItems.map((it) => ({
      productId: it.productId,
      qty: Number(it.qty ?? it.quantity ?? 0),
    }));

    // Inventory locking invariant:
    // - Never set Order.paymentStatus=PAID unless inventory is committed (stock decremented).
    // - If reservations are missing (e.g. drift), attempt to reserve now with atomic guards.
    if (items.length > 0) {
      await inventoryReservationService.reserveForOrder({
        session,
        orderId: new mongoose.Types.ObjectId(args.orderId),
        ttlMs: 30 * 60_000,
        items,
      });

      const res = await inventoryReservationService.commitReservationsForOrder({
        session,
        orderId: new mongoose.Types.ObjectId(args.orderId),
      });

      if (!res.committed) {
        // Either already committed, or missing reservations. Refuse to mark paid if nothing was committed
        // and there is no evidence of a previous commit.
        const committedCount = await InventoryReservation.countDocuments({
          orderId: new mongoose.Types.ObjectId(args.orderId),
          status: "COMMITTED",
        }).session(session);
        if (Number(committedCount || 0) === 0) {
          const err: any = new Error("Inventory commit missing for paid order");
          err.statusCode = 409;
          throw err;
        }
      }
    }

    await Order.updateOne(
      { _id: args.orderId },
      { $set: update },
      { session, context: { paymentStatusSource: "WEBHOOK_PAYMENT_CAPTURED" } } as any
    );
    return { updated: true };
  };

  if (args.session) {
    return run(args.session);
  }

  const session = await mongoose.startSession();
  try {
    let out: { updated: boolean } = { updated: false };
    await session.withTransaction(async () => {
      out = await run(session);
    });
    return out;
  } finally {
    session.endSession();
  }
}
