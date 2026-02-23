import mongoose from "mongoose";

import { PaymentIntent } from "../models/PaymentIntent";
import type { PaymentGateway, PaymentIntentStatus } from "../types";

export type PaymentsReconciliationQuery = {
  gateway?: PaymentGateway;
  status?: string | string[];
  isLocked?: boolean;
  minAgeMinutes?: number;
  maxAgeMinutes?: number;
  limit?: number;
  cursor?: string;
};

export type PaymentsReconciliationItem = {
  paymentIntentId: string;
  orderId: string;
  orderPaymentStatus?: string;
  gateway: PaymentGateway;
  status: PaymentIntentStatus;
  isLocked: boolean;
  lockReason?: string;
  createdAt: Date;
  updatedAt: Date;
  ageMinutes: number;
  lastScannedAt?: Date;
};

export type PaymentsReconciliationResult = {
  items: PaymentsReconciliationItem[];
  nextCursor?: string;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const NON_TERMINAL_EXCLUDE: PaymentIntentStatus[] = [
  "CAPTURED",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
];

type CursorValue = { updatedAt: string; id: string };

function normalizeStatusFilter(v: string | string[] | undefined): string[] | undefined {
  if (!v) return undefined;

  const arr = Array.isArray(v) ? v : [v];
  const out: string[] = [];

  for (const raw of arr) {
    for (const part of String(raw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)) {
      out.push(part.toUpperCase());
    }
  }

  return out.length ? out : undefined;
}

function clampLimit(v: any): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

function encodeCursor(c: CursorValue): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64");
}

function decodeCursor(raw: string): CursorValue | null {
  try {
    const json = Buffer.from(String(raw), "base64").toString("utf8");
    const parsed = JSON.parse(json);
    if (!parsed?.updatedAt || !parsed?.id) return null;
    return { updatedAt: String(parsed.updatedAt), id: String(parsed.id) };
  } catch {
    return null;
  }
}

export async function getPaymentsReconciliation(
  query: PaymentsReconciliationQuery,
  args?: { now?: Date }
): Promise<PaymentsReconciliationResult> {
  const now = args?.now ? args.now.getTime() : Date.now();

  const gateway = (query.gateway || "RAZORPAY") as PaymentGateway;
  const limit = clampLimit(query.limit);
  const requestedStatuses = normalizeStatusFilter(query.status);

  const effectiveStatuses = requestedStatuses
    ? requestedStatuses.filter((s) => !NON_TERMINAL_EXCLUDE.includes(s as any))
    : undefined;

  if (requestedStatuses && (!effectiveStatuses || effectiveStatuses.length === 0)) {
    return { items: [] };
  }

  const match: Record<string, any> = {
    gateway,
    status: effectiveStatuses
      ? { $in: effectiveStatuses }
      : { $nin: NON_TERMINAL_EXCLUDE },
  };

  if (typeof query.isLocked === "boolean") {
    match.isLocked = query.isLocked;
  }

  if (typeof query.minAgeMinutes === "number" && Number.isFinite(query.minAgeMinutes)) {
    const minAgeMs = Math.max(0, query.minAgeMinutes) * 60_000;
    match.updatedAt = { ...(match.updatedAt || {}), $lte: new Date(now - minAgeMs) };
  }

  if (typeof query.maxAgeMinutes === "number" && Number.isFinite(query.maxAgeMinutes)) {
    const maxAgeMs = Math.max(0, query.maxAgeMinutes) * 60_000;
    match.updatedAt = { ...(match.updatedAt || {}), $gte: new Date(now - maxAgeMs) };
  }

  const decoded = query.cursor ? decodeCursor(query.cursor) : null;
  const cursorStage = decoded
    ? {
        $or: [
          { updatedAt: { $gt: new Date(decoded.updatedAt) } },
          {
            updatedAt: new Date(decoded.updatedAt),
            _id: { $gt: new mongoose.Types.ObjectId(decoded.id) },
          },
        ],
      }
    : null;

  const pipeline: any[] = [{ $match: match }];
  if (cursorStage) pipeline.push({ $match: cursorStage });

  pipeline.push(
    {
      $lookup: {
        from: "orders",
        localField: "orderId",
        foreignField: "_id",
        as: "order",
        pipeline: [{ $project: { paymentStatus: 1 } }],
      },
    },
    { $unwind: { path: "$order", preserveNullAndEmptyArrays: true } },
    { $match: { "order.paymentStatus": { $ne: "PAID" } } },
    { $sort: { updatedAt: 1, _id: 1 } },
    { $limit: limit + 1 },
    {
      $project: {
        _id: 1,
        orderId: 1,
        orderPaymentStatus: "$order.paymentStatus",
        gateway: 1,
        status: 1,
        isLocked: 1,
        lockReason: 1,
        createdAt: 1,
        updatedAt: 1,
        lastScannedAt: 1,
      },
    }
  );

  const docs = (await (PaymentIntent as any).aggregate(pipeline)) as any[];

  const hasNext = docs.length > limit;
  const page = hasNext ? docs.slice(0, limit) : docs;

  const items: PaymentsReconciliationItem[] = page.map((d) => {
    const updatedAt = new Date(d.updatedAt);
    const ageMinutes = Math.floor((now - updatedAt.getTime()) / 60_000);

    return {
      paymentIntentId: String(d._id),
      orderId: String(d.orderId),
      orderPaymentStatus: d.orderPaymentStatus ? String(d.orderPaymentStatus) : undefined,
      gateway: String(d.gateway) as PaymentGateway,
      status: String(d.status) as PaymentIntentStatus,
      isLocked: !!d.isLocked,
      lockReason: d.lockReason ? String(d.lockReason) : undefined,
      createdAt: new Date(d.createdAt),
      updatedAt,
      ageMinutes,
      lastScannedAt: d.lastScannedAt ? new Date(d.lastScannedAt) : undefined,
    };
  });

  const nextCursor = hasNext
    ? encodeCursor({
        updatedAt: new Date(page[page.length - 1].updatedAt).toISOString(),
        id: String(page[page.length - 1]._id),
      })
    : undefined;

  return { items, nextCursor };
}

export const __private__ = {
  decodeCursor,
  encodeCursor,
  normalizeStatusFilter,
};
