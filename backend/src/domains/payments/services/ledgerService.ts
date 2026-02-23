import { LedgerEntry } from "../models/LedgerEntry";
import type { LedgerEventType, PaymentGateway } from "../types";
import type mongoose from "mongoose";

export async function appendLedgerEntry(args: {
  paymentIntentId: string;
  orderId: string;
  gateway: PaymentGateway;
  eventType: LedgerEventType;
  refundId?: string;
  amount: number;
  currency: string;
  gatewayEventId: string;
  dedupeKey: string;
  occurredAt?: Date;
  raw?: any;
  // Optional transaction session so we can atomically finalize (ledger + inventory + order status)
  // in the same webhook processing transaction.
  session?: mongoose.ClientSession;
}): Promise<{ created: boolean }>{
  try {
    const doc = {
      paymentIntentId: args.paymentIntentId,
      orderId: args.orderId,
      gateway: args.gateway,
      eventType: args.eventType,
      refundId: args.refundId,
      amount: args.amount,
      currency: args.currency,
      gatewayEventId: args.gatewayEventId,
      dedupeKey: args.dedupeKey,
      occurredAt: args.occurredAt,
      raw: args.raw,
    };

    if (args.session) {
      // Mongoose requires array form when using sessions.
      await LedgerEntry.create([doc] as any, { session: args.session } as any);
    } else {
      await LedgerEntry.create(doc as any);
    }

    return { created: true };
  } catch (e: any) {
    // Mongo duplicate key error
    if (e && (e.code === 11000 || String(e.message || "").includes("E11000"))) {
      return { created: false };
    }
    throw e;
  }
}
