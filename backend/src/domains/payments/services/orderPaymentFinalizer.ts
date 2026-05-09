import mongoose from "mongoose";
import { Order } from "../../../models/Order";
import { logger } from "../../../utils/logger";
import { paymentMetricsService } from "./paymentMetricsService";

export async function finalizeOrderOnCapturedPayment(args: {
  orderId: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  capturedAt?: Date;
  confirmedBy?: 'WEBHOOK' | 'POLLING' | 'RECONCILIATION';
  session?: mongoose.ClientSession;
}): Promise<{ updated: boolean }>{
  const update: any = { paymentStatus: "PAID" };
  if (args.razorpayOrderId) update.razorpayOrderId = args.razorpayOrderId;
  if (args.razorpayPaymentId) update.razorpayPaymentId = args.razorpayPaymentId;
  if (args.capturedAt) update.paymentReceivedAt = args.capturedAt;
  update.paymentConfirmedBy = args.confirmedBy ?? 'WEBHOOK';
  update.finalizedAt = new Date(); // exactly-once boundary — written atomically with PAID

  const run = async (session: mongoose.ClientSession): Promise<{ updated: boolean }> => {
    // Track finalization attempt (Task 8.2)
    paymentMetricsService.trackFinalizationAttempt({
      orderId: args.orderId,
      confirmedBy: args.confirmedBy ?? 'WEBHOOK',
    });

    // ATOMIC OPERATION: Use compare-and-set to ensure exactly-once finalization
    // This eliminates the race condition between read and write operations
    const result = await Order.updateOne(
      {
        _id: args.orderId,
        finalizedAt: { $exists: false },  // Atomic guard - only update if not finalized
      },
      { $set: update },
      { session, context: { paymentStatusSource: "WEBHOOK_PAYMENT_CAPTURED" } } as any
    );

    // Check if update succeeded by examining modifiedCount
    if (result.modifiedCount === 0) {
      // Order already finalized by another worker - this is the ONLY way to know if we won the race
      logger.info("[PAYMENT][FINALIZATION_GUARD] Order already finalized — skipping duplicate write", {
        orderId: args.orderId,
        confirmedBy: args.confirmedBy,
      });
      
      // Track finalization conflict (Task 8.2)
      paymentMetricsService.trackFinalizationConflict({
        orderId: args.orderId,
        confirmedBy: args.confirmedBy ?? 'WEBHOOK',
      });
      
      return { updated: false };
    }

    // Success - we won the race and finalized the order atomically
    logger.info("[PAYMENT][FINALIZED] Order marked PAID atomically", {
      orderId: args.orderId,
      confirmedBy: args.confirmedBy,
    });

    // Emit SLA latency metric — non-fatal if order.createdAt is unavailable
    try {
      const order = await Order.findById(args.orderId)
        .select("createdAt")
        .session(session);
      
      const confirmedAt = update.finalizedAt as Date;
      const createdAt = (order as any)?.createdAt;
      if (createdAt && confirmedAt) {
        paymentMetricsService.trackPaymentLatency({
          orderId: args.orderId,
          createdAt: new Date(createdAt),
          confirmedAt,
          source: args.confirmedBy ?? 'WEBHOOK',
        });
      }
    } catch {
      // metrics are non-fatal
    }

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
