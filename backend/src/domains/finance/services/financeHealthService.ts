import { Order } from "../../../models/Order";
import { LedgerEntry } from "../../payments/models/LedgerEntry";
import { RefundRequest } from "../../payments/models/RefundRequest";

export type FinanceHealthStatus = "OK" | "WARN" | "ERROR";

export type FinanceHealthCheck = {
  name: string;
  status: FinanceHealthStatus;
  details: any;
};

export type FinanceHealthOutput = {
  status: FinanceHealthStatus;
  checks: FinanceHealthCheck[];
};

const SAMPLE_LIMIT = 20;

function worstStatus(a: FinanceHealthStatus, b: FinanceHealthStatus): FinanceHealthStatus {
  const rank: Record<FinanceHealthStatus, number> = { OK: 0, WARN: 1, ERROR: 2 };
  return rank[b] > rank[a] ? b : a;
}

function normalizeOrderPaymentStatus(raw: any): "UNPAID" | "PAID" | "REFUNDED" | "FAILED" {
  const s = String(raw || "").trim();
  const u = s.toUpperCase();
  if (u === "PAID") return "PAID";
  if (u === "REFUNDED") return "REFUNDED";
  if (u === "FAILED") return "FAILED";
  if (u === "AWAITING_UPI_APPROVAL") return "UNPAID";
  if (u === "PENDING") return "UNPAID";

  return "UNPAID";
}

function deriveLedgerPaymentStatus(args: {
  capturedTotal: number;
  refundedTotal: number;
}): "UNPAID" | "PAID" | "REFUNDED" {
  const captured = Number(args.capturedTotal || 0);
  const refunded = Number(args.refundedTotal || 0);

  if (captured <= 0) return "UNPAID";
  if (refunded >= captured) return "REFUNDED";
  return "PAID";
}

async function checkDuplicateLedgerDedupeKeys(): Promise<FinanceHealthCheck> {
  const out = await LedgerEntry.aggregate([
    {
      $group: {
        _id: "$dedupeKey",
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { _id: 1 } },
    {
      $facet: {
        summary: [{ $count: "groups" }],
        sample: [{ $limit: SAMPLE_LIMIT }],
      },
    },
  ]);

  const groups = Number(out?.[0]?.summary?.[0]?.groups || 0);
  const sample = (out?.[0]?.sample || []).map((g: any) => ({
    dedupeKey: String(g._id),
    count: Number(g.count),
  }));

  const status: FinanceHealthStatus = groups > 0 ? "ERROR" : "OK";

  return {
    name: "Duplicate ledger entries (dedupeKey)",
    status,
    details: {
      duplicateGroups: groups,
      sample,
    },
  };
}

async function checkRefundLedgerWithoutCapture(): Promise<FinanceHealthCheck> {
  const out = await LedgerEntry.aggregate([
    { $match: { eventType: "REFUND" } },
    {
      $group: {
        _id: { orderId: "$orderId", paymentIntentId: "$paymentIntentId" },
        refundCount: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: "ledgerentries",
        let: { orderId: "$_id.orderId", paymentIntentId: "$_id.paymentIntentId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$orderId", "$$orderId"] },
                  { $eq: ["$paymentIntentId", "$$paymentIntentId"] },
                  { $eq: ["$eventType", "CAPTURE"] },
                ],
              },
            },
          },
          { $limit: 1 },
        ],
        as: "captures",
      },
    },
    { $match: { captures: { $size: 0 } } },
    { $sort: { "_id.orderId": 1, "_id.paymentIntentId": 1 } },
    {
      $facet: {
        summary: [{ $count: "pairs" }],
        sample: [{ $limit: SAMPLE_LIMIT }],
      },
    },
  ]);

  const pairs = Number(out?.[0]?.summary?.[0]?.pairs || 0);
  const sample = (out?.[0]?.sample || []).map((r: any) => ({
    orderId: String(r._id?.orderId),
    paymentIntentId: String(r._id?.paymentIntentId),
    refundCount: Number(r.refundCount || 0),
  }));

  const status: FinanceHealthStatus = pairs > 0 ? "ERROR" : "OK";

  return {
    name: "Refund exists without CAPTURE ledger",
    status,
    details: {
      pairs,
      sample,
    },
  };
}

async function checkRefundAmountGreaterThanCaptured(): Promise<FinanceHealthCheck> {
  const out = await LedgerEntry.aggregate([
    { $match: { eventType: { $in: ["CAPTURE", "REFUND"] } } },
    {
      $group: {
        _id: { orderId: "$orderId", paymentIntentId: "$paymentIntentId" },
        capturedTotal: {
          $sum: {
            $cond: [{ $eq: ["$eventType", "CAPTURE"] }, "$amount", 0],
          },
        },
        refundedTotal: {
          $sum: {
            $cond: [{ $eq: ["$eventType", "REFUND"] }, { $abs: "$amount" }, 0],
          },
        },
      },
    },
    { $match: { $expr: { $gt: ["$refundedTotal", "$capturedTotal"] } } },
    { $sort: { "_id.orderId": 1, "_id.paymentIntentId": 1 } },
    {
      $facet: {
        summary: [{ $count: "pairs" }],
        sample: [{ $limit: SAMPLE_LIMIT }],
      },
    },
  ]);

  const pairs = Number(out?.[0]?.summary?.[0]?.pairs || 0);
  const sample = (out?.[0]?.sample || []).map((r: any) => ({
    orderId: String(r._id?.orderId),
    paymentIntentId: String(r._id?.paymentIntentId),
    capturedTotal: Number(r.capturedTotal || 0),
    refundedTotal: Number(r.refundedTotal || 0),
  }));

  const status: FinanceHealthStatus = pairs > 0 ? "ERROR" : "OK";

  return {
    name: "Refund amount > captured amount",
    status,
    details: {
      pairs,
      sample,
    },
  };
}

async function checkOrphanLedgerEntries(): Promise<FinanceHealthCheck> {
  const out = await LedgerEntry.aggregate([
    {
      $lookup: {
        from: "orders",
        localField: "orderId",
        foreignField: "_id",
        as: "order",
      },
    },
    {
      $lookup: {
        from: "paymentintents",
        localField: "paymentIntentId",
        foreignField: "_id",
        as: "paymentIntent",
      },
    },
    {
      $match: {
        $or: [{ order: { $size: 0 } }, { paymentIntent: { $size: 0 } }],
      },
    },
    { $sort: { _id: 1 } },
    {
      $facet: {
        summary: [{ $count: "entries" }],
        sample: [
          { $limit: SAMPLE_LIMIT },
          {
            $project: {
              ledgerId: { $toString: "$_id" },
              orderId: { $toString: "$orderId" },
              paymentIntentId: { $toString: "$paymentIntentId" },
              eventType: 1,
              dedupeKey: 1,
            },
          },
        ],
      },
    },
  ]);

  const entries = Number(out?.[0]?.summary?.[0]?.entries || 0);
  const sample = out?.[0]?.sample || [];

  const status: FinanceHealthStatus = entries > 0 ? "ERROR" : "OK";

  return {
    name: "Orphan ledger entries (no order/paymentIntent)",
    status,
    details: {
      entries,
      sample,
    },
  };
}

async function checkCompletedRefundWithoutLedgerEntry(): Promise<FinanceHealthCheck> {
  const out = await RefundRequest.aggregate([
    { $match: { status: "COMPLETED" } },
    { $addFields: { refundIdString: { $toString: "$_id" } } },
    {
      $lookup: {
        from: "ledgerentries",
        let: { refundIdString: "$refundIdString" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$eventType", "REFUND"] },
                  { $eq: ["$refundId", "$$refundIdString"] },
                ],
              },
            },
          },
          { $limit: 1 },
        ],
        as: "refundLedger",
      },
    },
    { $match: { refundLedger: { $size: 0 } } },
    { $sort: { _id: 1 } },
    {
      $facet: {
        summary: [{ $count: "refunds" }],
        sample: [
          { $limit: SAMPLE_LIMIT },
          {
            $project: {
              refundRequestId: { $toString: "$_id" },
              orderId: { $toString: "$orderId" },
              paymentIntentId: { $toString: "$paymentIntentId" },
              amount: 1,
              currency: 1,
              status: 1,
              idempotencyKey: 1,
            },
          },
        ],
      },
    },
  ]);

  const refunds = Number(out?.[0]?.summary?.[0]?.refunds || 0);
  const sample = out?.[0]?.sample || [];

  const status: FinanceHealthStatus = refunds > 0 ? "ERROR" : "OK";

  return {
    name: "Refund marked COMPLETED but no ledger entry",
    status,
    details: {
      refunds,
      sample,
    },
  };
}

async function checkLedgerTotalsVsOrderPaymentStatus(): Promise<FinanceHealthCheck> {
  const out = await Order.aggregate([
    {
      $lookup: {
        from: "ledgerentries",
        let: { orderId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$orderId", "$$orderId"] } } },
          { $match: { eventType: { $in: ["CAPTURE", "REFUND"] } } },
          {
            $group: {
              _id: "$orderId",
              capturedTotal: {
                $sum: { $cond: [{ $eq: ["$eventType", "CAPTURE"] }, "$amount", 0] },
              },
              refundedTotal: {
                $sum: { $cond: [{ $eq: ["$eventType", "REFUND"] }, { $abs: "$amount" }, 0] },
              },
            },
          },
        ],
        as: "ledgerAgg",
      },
    },
    {
      $addFields: {
        capturedTotal: { $ifNull: [{ $arrayElemAt: ["$ledgerAgg.capturedTotal", 0] }, 0] },
        refundedTotal: { $ifNull: [{ $arrayElemAt: ["$ledgerAgg.refundedTotal", 0] }, 0] },
      },
    },
    {
      $project: {
        orderId: { $toString: "$_id" },
        paymentStatus: 1,
        capturedTotal: 1,
        refundedTotal: 1,
      },
    },
    { $sort: { orderId: 1 } },
  ]);

  let errorCount = 0;
  let warnCount = 0;
  const sample: any[] = [];

  for (const row of out) {
    const orderStatusNorm = normalizeOrderPaymentStatus(row.paymentStatus);
    const ledgerDerived = deriveLedgerPaymentStatus({
      capturedTotal: Number(row.capturedTotal || 0),
      refundedTotal: Number(row.refundedTotal || 0),
    });

    const hasMismatch =
      (ledgerDerived === "UNPAID" && (orderStatusNorm === "PAID" || orderStatusNorm === "REFUNDED")) ||
      (ledgerDerived === "PAID" && orderStatusNorm === "UNPAID") ||
      (ledgerDerived === "REFUNDED" && orderStatusNorm !== "REFUNDED");

    if (!hasMismatch) continue;

    let severity: FinanceHealthStatus = "WARN";

    if (ledgerDerived === "UNPAID" && (orderStatusNorm === "PAID" || orderStatusNorm === "REFUNDED")) {
      severity = "ERROR";
    } else if (ledgerDerived === "PAID" && orderStatusNorm === "FAILED") {
      severity = "ERROR";
    } else if (ledgerDerived === "PAID" && orderStatusNorm === "UNPAID") {
      severity = "WARN";
    } else if (ledgerDerived === "REFUNDED" && orderStatusNorm !== "REFUNDED") {
      severity = "WARN";
    }

    if (severity === "ERROR") errorCount += 1;
    if (severity === "WARN") warnCount += 1;

    if (sample.length < SAMPLE_LIMIT) {
      sample.push({
        orderId: String(row.orderId),
        orderPaymentStatus: row.paymentStatus,
        ledgerDerivedStatus: ledgerDerived,
        capturedTotal: Number(row.capturedTotal || 0),
        refundedTotal: Number(row.refundedTotal || 0),
        severity,
      });
    }
  }

  let status: FinanceHealthStatus = "OK";
  if (errorCount > 0) status = "ERROR";
  else if (warnCount > 0) status = "WARN";

  return {
    name: "Ledger total ≠ Order.paymentStatus",
    status,
    details: {
      errors: errorCount,
      warnings: warnCount,
      sample,
    },
  };
}

export async function getFinanceHealth(): Promise<FinanceHealthOutput> {
  const checks = await Promise.all([
    checkRefundLedgerWithoutCapture(),
    checkRefundAmountGreaterThanCaptured(),
    checkDuplicateLedgerDedupeKeys(),
    checkOrphanLedgerEntries(),
    checkCompletedRefundWithoutLedgerEntry(),
    checkLedgerTotalsVsOrderPaymentStatus(),
  ]);

  let status: FinanceHealthStatus = "OK";
  for (const c of checks) {
    status = worstStatus(status, c.status);
  }

  return { status, checks };
}

export const __private__ = {
  SAMPLE_LIMIT,
  normalizeOrderPaymentStatus,
  deriveLedgerPaymentStatus,
  worstStatus,
};
