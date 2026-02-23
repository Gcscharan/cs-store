"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLog = void 0;
const AuditLog_1 = require("../models/AuditLog");
function isPlainObject(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
}
function shouldRedactKey(key) {
    const k = String(key || "").toLowerCase();
    return (k.includes("password") ||
        k.includes("signature") ||
        k.includes("otp") ||
        k.includes("hash") ||
        k.includes("secret") ||
        k.includes("token") ||
        k.includes("authorization") ||
        k.includes("cookie"));
}
function sanitizeValue(v, depth) {
    if (v === null || v === undefined)
        return v;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
        return v;
    if (v instanceof Date)
        return v.toISOString();
    if (Array.isArray(v)) {
        if (depth <= 0)
            return "[REDACTED_ARRAY]";
        return v.slice(0, 25).map((x) => sanitizeValue(x, depth - 1));
    }
    if (isPlainObject(v)) {
        if (depth <= 0)
            return "[REDACTED_OBJECT]";
        const out = {};
        const keys = Object.keys(v).sort().slice(0, 50);
        for (const k of keys) {
            if (shouldRedactKey(k)) {
                out[k] = "[REDACTED]";
                continue;
            }
            out[k] = sanitizeValue(v[k], depth - 1);
        }
        return out;
    }
    return "[REDACTED]";
}
function inferEntity(req) {
    const p = req?.params || {};
    const b = req?.body || {};
    const paymentIntentId = String(p.paymentIntentId || b.paymentIntentId || "").trim();
    if (paymentIntentId)
        return { entityType: "PaymentIntent", entityId: paymentIntentId };
    const orderId = String(p.orderId || b.orderId || "").trim();
    if (orderId)
        return { entityType: "Order", entityId: orderId };
    const id = String(p.id || b.id || "").trim();
    if (id)
        return { entityType: "Unknown", entityId: id };
    return { entityType: "Unknown", entityId: "" };
}
const auditLog = async (req, _res, next) => {
    try {
        const user = req.user;
        const actorId = user?._id ? String(user._id) : "";
        const actorRole = user?.role ? String(user.role) : "";
        const action = `${String(req.method || "").toUpperCase()} ${String(req.originalUrl || "")}`;
        const { entityType, entityId } = inferEntity(req);
        const metadata = sanitizeValue({
            ip: String(req.ip || ""),
            userAgent: String(req.headers?.["user-agent"] || ""),
            params: req.params || {},
            query: req.query || {},
            body: req.body || {},
        }, 2);
        await AuditLog_1.AuditLog.create({
            actorId,
            actorRole,
            action,
            entityType,
            entityId,
            metadata,
            createdAt: new Date(),
        }).catch(() => undefined);
    }
    catch {
    }
    next();
};
exports.auditLog = auditLog;
