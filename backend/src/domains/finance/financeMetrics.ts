export type CurrencyCode = string;

export type FinanceGateway = "RAZORPAY" | "COD" | string;

/**
 * FinanceSaleEvent
 * - Represents revenue that is already confirmed by backend truth.
 * - For Razorpay, this should be derived from LedgerEntry(eventType=CAPTURE).
 * - For COD, this should be derived from CodCollection.
 */
export type FinanceSaleEvent = {
  kind: "SALE";
  source: "RAZORPAY_CAPTURE" | "COD_COLLECTION";
  gateway: FinanceGateway;
  orderId: string;
  paymentIntentId?: string;
  amount: number;
  currency: CurrencyCode;
  /**
   * The accounting recognition timestamp for the sale.
   * - Prefer gateway occurredAt if available
   * - Otherwise fallback to recordedAt/collectedAt
   */
  occurredAt: Date;
};

/**
 * FinanceRefundEvent
 * - Represents money returned to the customer, recognized on completion date.
 * - This module intentionally only supports completion-recognition.
 *   (Initiated/processing refund states are operational, not accounting.)
 */
export type FinanceRefundEvent = {
  kind: "REFUND";
  gateway: FinanceGateway;
  orderId: string;
  paymentIntentId?: string;
  refundId?: string;
  amount: number;
  currency: CurrencyCode;
  /**
   * Refund recognition timestamp.
   * MUST be the completion/processed timestamp.
   */
  completedAt: Date;
};

export type FinanceLedgerEventType = "sale" | "refund";

export type FinanceLedgerRow = {
  /** ISO date string YYYY-MM-DD in UTC */
  date: string;
  eventType: FinanceLedgerEventType;
  orderId: string;
  paymentIntentId?: string;
  gateway: FinanceGateway;
  amount: number;
  currency: CurrencyCode;
};

export type DateRange = {
  /** inclusive */
  from: Date;
  /** exclusive */
  to: Date;
};

export type FinanceTotals = {
  currency: CurrencyCode;

  /** Sum of all SALE events in range */
  grossRevenue: number;

  /** Subset of grossRevenue that comes from Razorpay capture */
  capturedRevenue: number;

  /** Sum of all REFUND completed events in range */
  refundedAmount: number;

  /** grossRevenue - refundedAmount */
  netRevenue: number;

  /** refundedAmount / grossRevenue (0 if grossRevenue is 0) */
  refundRate: number;
};

export type PaymentIntentStatusCategory = "SUCCESS" | "FAILED" | "PENDING";

export type PaymentIntentSnapshot = {
  paymentIntentId: string;
  gateway: FinanceGateway;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type GatewayPerformance = {
  gateway: FinanceGateway;
  successCount: number;
  failedCount: number;
  pendingCount: number;
  /** successCount / (successCount + failedCount + pendingCount) */
  captureRate: number;
};

function isoDayUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function inRange(d: Date, range: DateRange): boolean {
  const t = d.getTime();
  return t >= range.from.getTime() && t < range.to.getTime();
}

function safeNumber(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function roundTo2(n: number): number {
  // Keep reporting stable; assumes currency minor units are not used.
  return Math.round(n * 100) / 100;
}

export function buildRevenueLedgerRows(args: {
  sales: FinanceSaleEvent[];
  refunds?: FinanceRefundEvent[];
  range: DateRange;
  currency?: CurrencyCode;
}): FinanceLedgerRow[] {
  const currency = args.currency || "INR";
  const refunds = args.refunds || [];

  const rows: FinanceLedgerRow[] = [];

  for (const s of args.sales) {
    if (!s || s.kind !== "SALE") continue;
    if (!inRange(s.occurredAt, args.range)) continue;
    if (String(s.currency || "") !== currency) continue;

    rows.push({
      date: isoDayUTC(s.occurredAt),
      eventType: "sale",
      orderId: String(s.orderId),
      paymentIntentId: s.paymentIntentId ? String(s.paymentIntentId) : undefined,
      gateway: s.gateway,
      amount: safeNumber(s.amount),
      currency,
    });
  }

  for (const r of refunds) {
    if (!r || r.kind !== "REFUND") continue;
    if (!inRange(r.completedAt, args.range)) continue;
    if (String(r.currency || "") !== currency) continue;

    rows.push({
      date: isoDayUTC(r.completedAt),
      eventType: "refund",
      orderId: String(r.orderId),
      paymentIntentId: r.paymentIntentId ? String(r.paymentIntentId) : undefined,
      gateway: r.gateway,
      amount: safeNumber(r.amount),
      currency,
    });
  }

  // Deterministic order: date asc, refund after sale for the same date, then ids.
  const typeRank: Record<FinanceLedgerEventType, number> = { sale: 0, refund: 1 };

  rows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const tr = typeRank[a.eventType] - typeRank[b.eventType];
    if (tr !== 0) return tr;
    if (a.orderId !== b.orderId) return a.orderId < b.orderId ? -1 : 1;
    const ap = a.paymentIntentId || "";
    const bp = b.paymentIntentId || "";
    if (ap !== bp) return ap < bp ? -1 : 1;
    return 0;
  });

  return rows;
}

/**
 * Computes accounting-safe totals for a date range.
 *
 * Accounting rules:
 * - Revenue is recognized on the SALE event timestamp (capture/collection date).
 * - Refunds are recognized on REFUND completion timestamp, not initiation.
 * - Partial refunds are naturally supported by summing refund amounts.
 */
export function computeFinanceTotals(args: {
  sales: FinanceSaleEvent[];
  refunds?: FinanceRefundEvent[];
  range: DateRange;
  currency?: CurrencyCode;
}): FinanceTotals {
  const currency = args.currency || "INR";
  const refunds = args.refunds || [];

  let gross = 0;
  let captured = 0;
  let refunded = 0;

  for (const s of args.sales) {
    if (!s || s.kind !== "SALE") continue;
    if (!inRange(s.occurredAt, args.range)) continue;
    if (String(s.currency || "") !== currency) continue;

    const amt = safeNumber(s.amount);
    gross += amt;
    if (s.source === "RAZORPAY_CAPTURE") {
      captured += amt;
    }
  }

  for (const r of refunds) {
    if (!r || r.kind !== "REFUND") continue;
    if (!inRange(r.completedAt, args.range)) continue;
    if (String(r.currency || "") !== currency) continue;

    refunded += safeNumber(r.amount);
  }

  const net = gross - refunded;
  const refundRate = gross > 0 ? refunded / gross : 0;

  return {
    currency,
    grossRevenue: roundTo2(gross),
    capturedRevenue: roundTo2(captured),
    refundedAmount: roundTo2(refunded),
    netRevenue: roundTo2(net),
    refundRate: roundTo2(refundRate),
  };
}

export function categorizePaymentIntentStatus(statusRaw: string): PaymentIntentStatusCategory {
  const s = String(statusRaw || "").trim().toUpperCase();

  if (s === "CAPTURED") return "SUCCESS";
  if (s === "FAILED" || s === "CANCELLED" || s === "EXPIRED") return "FAILED";

  // Everything else is operationally pending.
  return "PENDING";
}

export function computeGatewayPerformance(args: {
  intents: PaymentIntentSnapshot[];
  range?: DateRange;
}): GatewayPerformance[] {
  const map = new Map<FinanceGateway, { success: number; failed: number; pending: number }>();

  for (const it of args.intents) {
    if (!it) continue;
    if (args.range && !inRange(it.createdAt, args.range)) continue;

    const gateway = it.gateway;
    const category = categorizePaymentIntentStatus(it.status);

    const agg = map.get(gateway) || { success: 0, failed: 0, pending: 0 };
    if (category === "SUCCESS") agg.success += 1;
    if (category === "FAILED") agg.failed += 1;
    if (category === "PENDING") agg.pending += 1;
    map.set(gateway, agg);
  }

  const out: GatewayPerformance[] = [];
  for (const [gateway, v] of map.entries()) {
    const denom = v.success + v.failed + v.pending;
    const rate = denom > 0 ? v.success / denom : 0;
    out.push({
      gateway,
      successCount: v.success,
      failedCount: v.failed,
      pendingCount: v.pending,
      captureRate: rate,
    });
  }

  out.sort((a, b) => String(a.gateway).localeCompare(String(b.gateway)));
  return out;
}
