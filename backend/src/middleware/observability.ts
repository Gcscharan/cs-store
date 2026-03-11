import { logger } from '../utils/logger';
import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";

import { incCounterWithLabels, observeHistogramMs } from "../ops/opsMetrics";

type RequestWithId = Request & { requestId?: string };

function statusClass(code: number): string {
  if (code >= 500) return "5xx";
  if (code >= 400) return "4xx";
  if (code >= 300) return "3xx";
  if (code >= 200) return "2xx";
  return "1xx";
}

function resolveRoute(req: Request): string {
  const anyReq = req as any;
  const routePath = anyReq?.route?.path;
  const baseUrl = String(anyReq?.baseUrl || "");
  if (routePath) return `${baseUrl}${routePath}`;
  return "unknown";
}

export function requestIdMiddleware(req: RequestWithId, res: Response, next: NextFunction) {
  const incoming = String(req.header("x-request-id") || req.header("X-Request-Id") || "").trim();
  const id = incoming || crypto.randomUUID();
  req.requestId = id;
  res.setHeader("x-request-id", id);
  next();
}

export function httpObservabilityMiddleware(req: RequestWithId, res: Response, next: NextFunction) {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const endedAt = process.hrtime.bigint();
    const durationMs = Number(endedAt - startedAt) / 1_000_000;

    const route = resolveRoute(req);
    const method = String(req.method || "GET").toUpperCase();
    const status = Number(res.statusCode || 0);
    const cls = statusClass(status);

    // Metrics (low-cardinality labels)
    incCounterWithLabels("http_requests_total", { method, route, status_class: cls }, 1);
    observeHistogramMs(
      "http_request_duration_ms",
      durationMs,
      { method, route, status_class: cls },
      [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
    );

    // Structured access log (single line JSON)
    // Keep it lightweight: do not log bodies.
    const line = {
      ts: new Date().toISOString(),
      level: "info",
      msg: "http_request",
      requestId: req.requestId,
      method,
      route,
      path: req.originalUrl,
      status,
      durationMs: Math.round(durationMs * 10) / 10,
    };
    logger.info(JSON.stringify(line));
  });

  next();
}
