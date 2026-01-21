import { Order } from "../../../models/Order";

export async function finalizeOrderOnCapturedPayment(args: {
  orderId: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  capturedAt?: Date;
}): Promise<{ updated: boolean }>{
  const update: any = {
    paymentStatus: "PAID",
  };

  if (args.razorpayOrderId) update.razorpayOrderId = args.razorpayOrderId;
  if (args.razorpayPaymentId) update.razorpayPaymentId = args.razorpayPaymentId;
  if (args.capturedAt) update.paymentReceivedAt = args.capturedAt;

  const existing = await Order.findById(args.orderId).select("paymentStatus");
  if (!existing) return { updated: false };

  const ps = String((existing as any).paymentStatus || "").toUpperCase();
  if (ps === "PAID") {
    return { updated: false };
  }

  await Order.updateOne(
    { _id: args.orderId },
    { $set: update }
  );

  return { updated: true };
}
