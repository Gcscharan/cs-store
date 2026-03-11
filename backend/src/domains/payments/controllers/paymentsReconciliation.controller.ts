import { logger } from '../../../utils/logger';
import { Request, Response } from "express";

import {
  __private__,
  getPaymentsReconciliation,
  type PaymentsReconciliationQuery,
} from "../services/paymentsReconciliationService";
import type { PaymentGateway } from "../types";

const RECONCILIATION_CSV_SCHEMA_VERSION = "payments_reconciliation_v1";

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (s.includes("\"")) {
    const escaped = s.replace(/\"/g, '""');
    return `"${escaped}"`;
  }
  if (s.includes(",") || s.includes("\n") || s.includes("\r")) {
    return `"${s}"`;
  }
  return s;
}

function toIso(v: any): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(v);
  return Number.isFinite(d.getTime()) ? d.toISOString() : "";
}

function parseBoolean(raw: any): boolean | undefined {
  if (raw === undefined) return undefined;
  const v = String(raw).trim().toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

function parseNumber(raw: any): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function parseGateway(raw: any): PaymentGateway | undefined {
  if (raw === undefined) return undefined;
  const v = String(raw).trim().toUpperCase();
  if (v === "RAZORPAY") return "RAZORPAY";
  return undefined;
}

export async function getPaymentsReconciliationHandler(req: Request, res: Response) {
  const status = (req.query as any).status;
  const gateway = (req.query as any).gateway;
  const cursor = (req.query as any).cursor;

  if (gateway !== undefined && !parseGateway(gateway)) {
    return res.status(400).json({ message: "Unsupported gateway" });
  }

  if (cursor && !__private__.decodeCursor(String(cursor))) {
    return res.status(400).json({ message: "Invalid cursor" });
  }

  const query: PaymentsReconciliationQuery = {
    gateway: parseGateway(gateway),
    status: status as any,
    isLocked: parseBoolean((req.query as any).isLocked),
    minAgeMinutes: parseNumber((req.query as any).minAgeMinutes),
    maxAgeMinutes: parseNumber((req.query as any).maxAgeMinutes),
    limit: parseNumber((req.query as any).limit),
    cursor: cursor ? String(cursor) : undefined,
  };

  const result = await getPaymentsReconciliation(query);

  logger.info(
    `[PaymentsReconciliation] results=${result.items.length} filters=${JSON.stringify({
      gateway: query.gateway || "RAZORPAY",
      status: __private__.normalizeStatusFilter(query.status as any) || null,
      isLocked: query.isLocked ?? null,
      minAgeMinutes: query.minAgeMinutes ?? null,
      maxAgeMinutes: query.maxAgeMinutes ?? null,
      limit: query.limit ?? null,
      cursor: query.cursor ? "(present)" : null,
    })}`
  );

  if (result.nextCursor) {
    res.setHeader("X-Next-Cursor", result.nextCursor);
  }

  return res.status(200).json(result.items);
}

export async function getPaymentsReconciliationCsvHandler(req: Request, res: Response) {
  const status = (req.query as any).status;
  const gateway = (req.query as any).gateway;
  const cursor = (req.query as any).cursor;

  if (gateway !== undefined && !parseGateway(gateway)) {
    return res.status(400).json({ message: "Unsupported gateway" });
  }

  if (cursor && !__private__.decodeCursor(String(cursor))) {
    return res.status(400).json({ message: "Invalid cursor" });
  }

  const query: PaymentsReconciliationQuery = {
    gateway: parseGateway(gateway),
    status: status as any,
    isLocked: parseBoolean((req.query as any).isLocked),
    minAgeMinutes: parseNumber((req.query as any).minAgeMinutes),
    maxAgeMinutes: parseNumber((req.query as any).maxAgeMinutes),
    limit: parseNumber((req.query as any).limit),
    cursor: cursor ? String(cursor) : undefined,
  };

  const result = await getPaymentsReconciliation(query);

  const filename = `payments-reconciliation-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const header = [
    "schema_version",
    "payment_intent_id",
    "order_id",
    "order_payment_status",
    "gateway",
    "intent_status",
    "is_locked",
    "lock_reason",
    "age_minutes",
    "last_scanned_at",
    "created_at",
    "updated_at",
  ].join(",");

  const lines: string[] = [header];
  for (const it of result.items as any[]) {
    lines.push(
      [
        RECONCILIATION_CSV_SCHEMA_VERSION,
        String(it.paymentIntentId || ""),
        String(it.orderId || ""),
        it.orderPaymentStatus ? String(it.orderPaymentStatus) : "",
        String(it.gateway || ""),
        String(it.status || ""),
        it.isLocked ? "true" : "false",
        it.lockReason ? String(it.lockReason) : "",
        Number.isFinite(Number(it.ageMinutes)) ? String(it.ageMinutes) : "",
        toIso(it.lastScannedAt),
        toIso(it.createdAt),
        toIso(it.updatedAt),
      ].map(csvEscape).join(",")
    );
  }

  return res.status(200).send(`${lines.join("\n")}\n`);
}
