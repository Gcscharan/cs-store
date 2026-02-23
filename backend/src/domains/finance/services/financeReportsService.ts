import { LedgerEntry } from "../../payments/models/LedgerEntry";
import { PaymentIntent } from "../../payments/models/PaymentIntent";
import type { PaymentIntentStatus } from "../../payments/types";
import { CodCollection } from "../../../models/CodCollection";

import {
  buildRevenueLedgerRows,
  computeFinanceTotals,
  computeGatewayPerformance,
  type CurrencyCode,
  type DateRange,
  type FinanceGateway,
  type FinanceLedgerRow,
  type FinanceRefundEvent,
  type FinanceSaleEvent,
  type FinanceTotals,
  type GatewayPerformance,
  type PaymentIntentSnapshot,
} from "../financeMetrics";

export type FinanceReportQuery = {
  from: Date;
  to: Date;
  currency: CurrencyCode;
  gateway?: FinanceGateway;
  limit: number;
};

function clampLimit(raw: any): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 1000;
  return Math.min(Math.floor(n), 5000);
}

export const __private__ = {
  clampLimit,
};

function rangeFromQuery(q: FinanceReportQuery): DateRange {
  return { from: q.from, to: q.to };
}

function selectEventTime(d: { occurredAt?: Date; recordedAt?: Date }): Date {
  return d.occurredAt instanceof Date && Number.isFinite(d.occurredAt.getTime())
    ? d.occurredAt
    : d.recordedAt instanceof Date && Number.isFinite(d.recordedAt.getTime())
      ? d.recordedAt
      : new Date(0);
}

export async function getRevenueLedger(args: FinanceReportQuery): Promise<{ rows: FinanceLedgerRow[] }> {
  const range = rangeFromQuery(args);

  const ledgerMatch: any = {
    eventType: { $in: ["CAPTURE", "REFUND"] },
    ...(args.gateway ? { gateway: String(args.gateway).toUpperCase() } : {}),
    $or: [
      { occurredAt: { $gte: args.from, $lt: args.to } },
      { occurredAt: { $exists: false }, recordedAt: { $gte: args.from, $lt: args.to } },
      { occurredAt: null, recordedAt: { $gte: args.from, $lt: args.to } },
    ],
  };

  const ledgerDocs: any[] = await LedgerEntry.find(ledgerMatch)
    .sort({ recordedAt: 1, _id: 1 })
    .limit(args.limit)
    .lean();

  const sales: FinanceSaleEvent[] = [];
  const refunds: FinanceRefundEvent[] = [];

  for (const d of ledgerDocs) {
    const eventType = String(d?.eventType || "").toUpperCase();
    const occurredAt = selectEventTime({ occurredAt: d?.occurredAt, recordedAt: d?.recordedAt });

    if (eventType === "CAPTURE") {
      sales.push({
        kind: "SALE",
        source: "RAZORPAY_CAPTURE",
        gateway: String(d?.gateway || "RAZORPAY"),
        orderId: String(d?.orderId || ""),
        paymentIntentId: d?.paymentIntentId ? String(d.paymentIntentId) : undefined,
        amount: Number(d?.amount || 0),
        currency: String(d?.currency || args.currency),
        occurredAt,
      });
    }

    if (eventType === "REFUND") {
      refunds.push({
        kind: "REFUND",
        gateway: String(d?.gateway || "RAZORPAY"),
        orderId: String(d?.orderId || ""),
        paymentIntentId: d?.paymentIntentId ? String(d.paymentIntentId) : undefined,
        refundId: d?.gatewayEventId ? String(d.gatewayEventId) : undefined,
        amount: Math.abs(Number(d?.amount || 0)),
        currency: String(d?.currency || args.currency),
        completedAt: occurredAt,
      });
    }
  }

  const codMatch: any = {
    collectedAt: { $gte: args.from, $lt: args.to },
  };
  const codDocs: any[] = await CodCollection.find(codMatch)
    .sort({ collectedAt: 1, _id: 1 })
    .limit(args.limit)
    .lean();

  for (const c of codDocs) {
    sales.push({
      kind: "SALE",
      source: "COD_COLLECTION",
      gateway: "COD",
      orderId: String(c?.orderId || ""),
      amount: Number(c?.amount || 0),
      currency: String(c?.currency || args.currency),
      occurredAt: c?.collectedAt instanceof Date ? c.collectedAt : new Date(0),
    });
  }

  const rows = buildRevenueLedgerRows({ sales, refunds, range, currency: args.currency });
  return { rows };
}

export type RefundLedgerRow = {
  refundId?: string;
  status?: string;
  completedAt: string;
  orderId: string;
  paymentIntentId?: string;
  gateway: FinanceGateway;
  amount: number;
  currency: CurrencyCode;
};

export async function getRefundLedger(args: FinanceReportQuery): Promise<{ rows: RefundLedgerRow[] }> {
  const match: any = {
    eventType: "REFUND",
    ...(args.gateway ? { gateway: String(args.gateway).toUpperCase() } : {}),
    $or: [
      { occurredAt: { $gte: args.from, $lt: args.to } },
      { occurredAt: { $exists: false }, recordedAt: { $gte: args.from, $lt: args.to } },
      { occurredAt: null, recordedAt: { $gte: args.from, $lt: args.to } },
    ],
  };

  const docs: any[] = await LedgerEntry.find(match)
    .sort({ recordedAt: 1, _id: 1 })
    .limit(args.limit)
    .lean();

  const rows: RefundLedgerRow[] = docs.map((d) => {
    const completedAt = selectEventTime({ occurredAt: d?.occurredAt, recordedAt: d?.recordedAt });
    const rawStatus = (d as any)?.raw?.status;

    return {
      refundId: d?.gatewayEventId ? String(d.gatewayEventId) : undefined,
      status: rawStatus ? String(rawStatus) : undefined,
      completedAt: completedAt.toISOString(),
      orderId: String(d?.orderId || ""),
      paymentIntentId: d?.paymentIntentId ? String(d.paymentIntentId) : undefined,
      gateway: String(d?.gateway || "RAZORPAY"),
      amount: Math.abs(Number(d?.amount || 0)),
      currency: String(d?.currency || args.currency),
    };
  });

  return { rows };
}

export async function getNetRevenueStatement(args: FinanceReportQuery): Promise<{ totals: FinanceTotals }> {
  const range = rangeFromQuery(args);

  const ledgerMatch: any = {
    eventType: { $in: ["CAPTURE", "REFUND"] },
    ...(args.gateway ? { gateway: String(args.gateway).toUpperCase() } : {}),
    $or: [
      { occurredAt: { $gte: args.from, $lt: args.to } },
      { occurredAt: { $exists: false }, recordedAt: { $gte: args.from, $lt: args.to } },
      { occurredAt: null, recordedAt: { $gte: args.from, $lt: args.to } },
    ],
  };

  const ledgerDocs: any[] = await LedgerEntry.find(ledgerMatch)
    .sort({ recordedAt: 1, _id: 1 })
    .limit(args.limit)
    .lean();

  const sales: FinanceSaleEvent[] = [];
  const refunds: FinanceRefundEvent[] = [];

  for (const d of ledgerDocs) {
    const eventType = String(d?.eventType || "").toUpperCase();
    const occurredAt = selectEventTime({ occurredAt: d?.occurredAt, recordedAt: d?.recordedAt });

    if (eventType === "CAPTURE") {
      sales.push({
        kind: "SALE",
        source: "RAZORPAY_CAPTURE",
        gateway: String(d?.gateway || "RAZORPAY"),
        orderId: String(d?.orderId || ""),
        paymentIntentId: d?.paymentIntentId ? String(d.paymentIntentId) : undefined,
        amount: Number(d?.amount || 0),
        currency: String(d?.currency || args.currency),
        occurredAt,
      });
    }

    if (eventType === "REFUND") {
      refunds.push({
        kind: "REFUND",
        gateway: String(d?.gateway || "RAZORPAY"),
        orderId: String(d?.orderId || ""),
        paymentIntentId: d?.paymentIntentId ? String(d.paymentIntentId) : undefined,
        refundId: d?.gatewayEventId ? String(d.gatewayEventId) : undefined,
        amount: Math.abs(Number(d?.amount || 0)),
        currency: String(d?.currency || args.currency),
        completedAt: occurredAt,
      });
    }
  }

  const codDocs: any[] = await CodCollection.find({ collectedAt: { $gte: args.from, $lt: args.to } })
    .sort({ collectedAt: 1, _id: 1 })
    .limit(args.limit)
    .lean();

  for (const c of codDocs) {
    sales.push({
      kind: "SALE",
      source: "COD_COLLECTION",
      gateway: "COD",
      orderId: String(c?.orderId || ""),
      amount: Number(c?.amount || 0),
      currency: String(c?.currency || args.currency),
      occurredAt: c?.collectedAt instanceof Date ? c.collectedAt : new Date(0),
    });
  }

  const totals = computeFinanceTotals({ sales, refunds, range, currency: args.currency });
  return { totals };
}

export async function getGatewayPerformance(args: {
  from: Date;
  to: Date;
  gateway?: FinanceGateway;
  limit: number;
}): Promise<{ rows: GatewayPerformance[] }> {
  const match: any = {
    createdAt: { $gte: args.from, $lt: args.to },
    ...(args.gateway ? { gateway: String(args.gateway).toUpperCase() } : {}),
  };

  const docs: any[] = await PaymentIntent.find(match)
    .select("_id gateway status createdAt updatedAt")
    .sort({ createdAt: 1, _id: 1 })
    .limit(args.limit)
    .lean();

  const intents: PaymentIntentSnapshot[] = docs.map((d) => ({
    paymentIntentId: String(d._id),
    gateway: String(d.gateway || "RAZORPAY"),
    status: String(d.status || "") as PaymentIntentStatus,
    createdAt: new Date(d.createdAt),
    updatedAt: new Date(d.updatedAt),
  }));

  const rows = computeGatewayPerformance({ intents });
  return { rows };
}
