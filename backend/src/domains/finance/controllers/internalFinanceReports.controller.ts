import type { Request, Response } from "express";

import {
  getGatewayPerformance,
  getNetRevenueStatement,
  getRefundLedger,
  getRevenueLedger,
  __private__,
} from "../services/financeReportsService";

const REVENUE_LEDGER_CSV_SCHEMA_VERSION = "finance_revenue_ledger_v1";
const REFUND_LEDGER_CSV_SCHEMA_VERSION = "finance_refund_ledger_v1";
const NET_REVENUE_CSV_SCHEMA_VERSION = "finance_net_revenue_statement_v1";
const GATEWAY_PERF_CSV_SCHEMA_VERSION = "finance_gateway_performance_v1";

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

function nonEmpty(v: any): string | undefined {
  const s = String(v || "").trim();
  return s ? s : undefined;
}

function parseIsoDate(raw: any): Date | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

function parseLimit(raw: any): number {
  return __private__.clampLimit(raw);
}

function parseCurrency(raw: any): string {
  const s = String(raw || "INR").trim();
  return s || "INR";
}

function mustGetRange(req: Request): { from: Date; to: Date } | { error: true } {
  const from = parseIsoDate((req.query as any).from);
  const to = parseIsoDate((req.query as any).to);
  if (!from || !to) return { error: true };
  return { from, to };
}

export async function getRevenueLedgerHandler(req: Request, res: Response) {
  const range = mustGetRange(req);
  if ((range as any).error) return res.status(400).json({ error: "INVALID_INPUT" });

  const limit = parseLimit((req.query as any).limit);
  const currency = parseCurrency((req.query as any).currency);
  const gateway = nonEmpty((req.query as any).gateway);

  const out = await getRevenueLedger({
    from: (range as any).from,
    to: (range as any).to,
    currency,
    gateway,
    limit,
  });

  return res.status(200).json({ rows: out.rows });
}

export async function getRevenueLedgerCsvHandler(req: Request, res: Response) {
  const range = mustGetRange(req);
  if ((range as any).error) return res.status(400).json({ error: "INVALID_INPUT" });

  const limit = parseLimit((req.query as any).limit);
  const currency = parseCurrency((req.query as any).currency);
  const gateway = nonEmpty((req.query as any).gateway);

  const out = await getRevenueLedger({
    from: (range as any).from,
    to: (range as any).to,
    currency,
    gateway,
    limit,
  });

  const filename = `finance-revenue-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const header = [
    "schema_version",
    "date",
    "event_type",
    "order_id",
    "payment_intent_id",
    "gateway",
    "amount",
    "currency",
  ].join(",");

  const lines: string[] = [header];
  for (const r of out.rows) {
    lines.push(
      [
        REVENUE_LEDGER_CSV_SCHEMA_VERSION,
        r.date,
        r.eventType,
        r.orderId,
        r.paymentIntentId || "",
        r.gateway,
        r.amount,
        r.currency,
      ].map(csvEscape).join(",")
    );
  }

  return res.status(200).send(`${lines.join("\n")}\n`);
}

export async function getRefundLedgerHandler(req: Request, res: Response) {
  const range = mustGetRange(req);
  if ((range as any).error) return res.status(400).json({ error: "INVALID_INPUT" });

  const limit = parseLimit((req.query as any).limit);
  const currency = parseCurrency((req.query as any).currency);
  const gateway = nonEmpty((req.query as any).gateway);

  const out = await getRefundLedger({
    from: (range as any).from,
    to: (range as any).to,
    currency,
    gateway,
    limit,
  });

  return res.status(200).json({ rows: out.rows });
}

export async function getRefundLedgerCsvHandler(req: Request, res: Response) {
  const range = mustGetRange(req);
  if ((range as any).error) return res.status(400).json({ error: "INVALID_INPUT" });

  const limit = parseLimit((req.query as any).limit);
  const currency = parseCurrency((req.query as any).currency);
  const gateway = nonEmpty((req.query as any).gateway);

  const out = await getRefundLedger({
    from: (range as any).from,
    to: (range as any).to,
    currency,
    gateway,
    limit,
  });

  const filename = `finance-refund-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const header = [
    "schema_version",
    "refund_id",
    "status",
    "completed_at",
    "order_id",
    "payment_intent_id",
    "gateway",
    "amount",
    "currency",
  ].join(",");

  const lines: string[] = [header];
  for (const r of out.rows) {
    lines.push(
      [
        REFUND_LEDGER_CSV_SCHEMA_VERSION,
        r.refundId || "",
        r.status || "",
        r.completedAt,
        r.orderId,
        r.paymentIntentId || "",
        r.gateway,
        r.amount,
        r.currency,
      ].map(csvEscape).join(",")
    );
  }

  return res.status(200).send(`${lines.join("\n")}\n`);
}

export async function getNetRevenueHandler(req: Request, res: Response) {
  const range = mustGetRange(req);
  if ((range as any).error) return res.status(400).json({ error: "INVALID_INPUT" });

  const limit = parseLimit((req.query as any).limit);
  const currency = parseCurrency((req.query as any).currency);
  const gateway = nonEmpty((req.query as any).gateway);

  const out = await getNetRevenueStatement({
    from: (range as any).from,
    to: (range as any).to,
    currency,
    gateway,
    limit,
  });

  return res.status(200).json({ totals: out.totals });
}

export async function getNetRevenueCsvHandler(req: Request, res: Response) {
  const range = mustGetRange(req);
  if ((range as any).error) return res.status(400).json({ error: "INVALID_INPUT" });

  const limit = parseLimit((req.query as any).limit);
  const currency = parseCurrency((req.query as any).currency);
  const gateway = nonEmpty((req.query as any).gateway);

  const out = await getNetRevenueStatement({
    from: (range as any).from,
    to: (range as any).to,
    currency,
    gateway,
    limit,
  });

  const filename = `finance-net-revenue-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const header = [
    "schema_version",
    "currency",
    "gross_revenue",
    "captured_revenue",
    "refunded_amount",
    "net_revenue",
    "refund_rate",
  ].join(",");

  const t = out.totals;
  const lines: string[] = [header];
  lines.push(
    [
      NET_REVENUE_CSV_SCHEMA_VERSION,
      t.currency,
      t.grossRevenue,
      t.capturedRevenue,
      t.refundedAmount,
      t.netRevenue,
      t.refundRate,
    ].map(csvEscape).join(",")
  );

  return res.status(200).send(`${lines.join("\n")}\n`);
}

export async function getGatewayPerformanceHandler(req: Request, res: Response) {
  const range = mustGetRange(req);
  if ((range as any).error) return res.status(400).json({ error: "INVALID_INPUT" });

  const limit = parseLimit((req.query as any).limit);
  const gateway = nonEmpty((req.query as any).gateway);

  const out = await getGatewayPerformance({
    from: (range as any).from,
    to: (range as any).to,
    gateway,
    limit,
  });

  return res.status(200).json({ rows: out.rows });
}

export async function getGatewayPerformanceCsvHandler(req: Request, res: Response) {
  const range = mustGetRange(req);
  if ((range as any).error) return res.status(400).json({ error: "INVALID_INPUT" });

  const limit = parseLimit((req.query as any).limit);
  const gateway = nonEmpty((req.query as any).gateway);

  const out = await getGatewayPerformance({
    from: (range as any).from,
    to: (range as any).to,
    gateway,
    limit,
  });

  const filename = `finance-gateway-performance-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const header = [
    "schema_version",
    "gateway",
    "success_count",
    "failed_count",
    "pending_count",
    "capture_rate",
  ].join(",");

  const lines: string[] = [header];
  for (const r of out.rows) {
    lines.push(
      [
        GATEWAY_PERF_CSV_SCHEMA_VERSION,
        r.gateway,
        r.successCount,
        r.failedCount,
        r.pendingCount,
        r.captureRate,
      ].map(csvEscape).join(",")
    );
  }

  return res.status(200).send(`${lines.join("\n")}\n`);
}
