import { LedgerEntry } from "../models/LedgerEntry";
import type { LedgerEventType, PaymentGateway } from "../types";

export async function appendLedgerEntry(args: {
  paymentIntentId: string;
  orderId: string;
  gateway: PaymentGateway;
  eventType: LedgerEventType;
  amount: number;
  currency: string;
  gatewayEventId: string;
  dedupeKey: string;
  occurredAt?: Date;
  raw?: any;
}): Promise<{ created: boolean }>{
  try {
    await LedgerEntry.create({
      paymentIntentId: args.paymentIntentId,
      orderId: args.orderId,
      gateway: args.gateway,
      eventType: args.eventType,
      amount: args.amount,
      currency: args.currency,
      gatewayEventId: args.gatewayEventId,
      dedupeKey: args.dedupeKey,
      occurredAt: args.occurredAt,
      raw: args.raw,
    });

    return { created: true };
  } catch (e: any) {
    // Mongo duplicate key error
    if (e && (e.code === 11000 || String(e.message || "").includes("E11000"))) {
      return { created: false };
    }
    throw e;
  }
}
