import { logger } from '../utils/logger';
import { AuditLog } from "../models/AuditLog";

function isPlainObject(v: any): v is Record<string, any> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function shouldRedactKey(key: string): boolean {
  const k = String(key || "").toLowerCase();
  return (
    k.includes("password") ||
    k.includes("signature") ||
    k.includes("otp") ||
    k.includes("hash") ||
    k.includes("secret") ||
    k.includes("token") ||
    k.includes("authorization") ||
    k.includes("cookie")
  );
}

function sanitizeValue(v: any, depth: number): any {
  if (v === null || v === undefined) return v;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;

  if (v instanceof Date) return v.toISOString();

  if (Array.isArray(v)) {
    if (depth <= 0) return "[REDACTED_ARRAY]";
    return v.slice(0, 25).map((x) => sanitizeValue(x, depth - 1));
  }

  if (isPlainObject(v)) {
    if (depth <= 0) return "[REDACTED_OBJECT]";
    const out: Record<string, any> = {};
    const keys = Object.keys(v).sort().slice(0, 50);
    for (const k of keys) {
      if (shouldRedactKey(k)) {
        out[k] = "[REDACTED]";
        continue;
      }
      out[k] = sanitizeValue((v as any)[k], depth - 1);
    }
    return out;
  }

  return "[REDACTED]";
}

function inferEntity(req: any): { entityType: string; entityId: string } {
  const p = (req as any)?.params || {};
  const b = (req as any)?.body || {};

  const routeId = String(p.routeId || b.routeId || b.clusterRouteId || "").trim();
  if (routeId) return { entityType: "Route", entityId: routeId };

  const paymentIntentId = String(p.paymentIntentId || b.paymentIntentId || "").trim();
  if (paymentIntentId) return { entityType: "PaymentIntent", entityId: paymentIntentId };

  const orderId = String(p.orderId || b.orderId || "").trim();
  if (orderId) return { entityType: "Order", entityId: orderId };

  const id = String(p.id || b.id || "").trim();
  if (id) return { entityType: "Unknown", entityId: id };

  return { entityType: "Unknown", entityId: "" };
}

export const auditLog = async (req: any, _res: any, next: any) => {
  try {
    const user = (req as any).user;
    const actorId = user?._id ? String(user._id) : "";
    const actorRole = user?.role ? String(user.role) : "";
    const action = `${String(req.method || "").toUpperCase()} ${String(req.originalUrl || "")}`;

    const inferred = inferEntity(req);
    const entityType = inferred.entityId ? inferred.entityType : "Request";
    const entityId = inferred.entityId
      ? inferred.entityId
      : `${String(req.method || "").toUpperCase()} ${String(req.baseUrl || "")}${String(req.route?.path || req.path || "")}`.trim();

    const metadata = sanitizeValue(
      {
        ip: String(req.ip || ""),
        userAgent: String(req.headers?.["user-agent"] || ""),
        params: (req as any).params || {},
        query: (req as any).query || {},
        body: (req as any).body || {},
      },
      2
    );

    await AuditLog.create({
      actorId,
      actorRole,
      action,
      entityType,
      entityId,
      metadata,
      createdAt: new Date(),
    }).catch((err) => {
      logger.error("[AUDIT_LOG_ERROR]", err?.message || err);
    });
  } catch (err) {
    logger.error("[AUDIT_LOG_ERROR]", (err as any)?.message || err);
  }

  next();
};
