import express from "express";
import crypto from "crypto";
import redisClient from "../config/redis";
import { authenticateToken } from "../middleware/auth";
import { auditLog } from "../middleware/auditLog";
import { incCounterWithLabels } from "../ops/opsMetrics";
import { runEscalationTick } from "../domains/tracking/phase6/escalationRunner";
import { getLatestSloSnapshot, upsertHourlySloSnapshot } from "../domains/tracking/phase6/sloSnapshots";

type OpsRole = "OPS_VIEWER" | "OPS_ADMIN";

const OPS_ROLE_KEY_PREFIX = "ops:role:";
const LAST_STATUS_KEY = "tracking:escalations:last_status";

function etagOf(body: any): string {
  const stable =
    body && typeof body === "object" && !Array.isArray(body)
      ? (() => {
          const copy: any = { ...(body as any) };
          delete copy.generatedAt;
          return copy;
        })()
      : body;
  const json = JSON.stringify(stable);
  return 'W/"' + crypto.createHash("sha1").update(json).digest("hex") + '"';
}

function sendWithEtag(req: express.Request, res: express.Response, body: any, maxAgeSeconds: number = 5): void {
  const etag = etagOf(body);
  res.setHeader("ETag", etag);
  res.setHeader("Cache-Control", `private, max-age=${Math.max(0, Math.min(30, Number(maxAgeSeconds || 0)))}`);

  const ifNoneMatch = String(req.headers["if-none-match"] || "");
  if (ifNoneMatch && ifNoneMatch === etag) {
    res.status(304).end();
    return;
  }

  res.status(200).json(body);
}

async function getOpsRoleForUser(userId: string): Promise<OpsRole> {
  const raw = await redisClient.get(`${OPS_ROLE_KEY_PREFIX}${userId}`);
  const v = String(raw || "").toUpperCase();
  if (v === "OPS_ADMIN") return "OPS_ADMIN";
  if (v === "OPS_VIEWER") return "OPS_VIEWER";
  return "OPS_VIEWER";
}

function requireOpsRole(minRole: OpsRole) {
  return async (req: any, res: any, next: any) => {
    if (!req.user || String(req.user.role || "") !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const userId = String(req.user._id || "");
    const role = await getOpsRoleForUser(userId);

    if (minRole === "OPS_ADMIN" && role !== "OPS_ADMIN") {
      return res.status(403).json({ message: "OPS_ADMIN access required" });
    }

    (req as any).opsRole = role;
    next();
  };
}

const router = express.Router();

router.post("/run", authenticateToken, requireOpsRole("OPS_ADMIN"), auditLog, async (req: any, res) => {
  const now = req?.body?.now ? new Date(String(req.body.now)) : new Date();
  const limitIncidents = req?.body?.limitIncidents ? Number(req.body.limitIncidents) : 200;

  const result = await runEscalationTick({ now, limitIncidents });

  // Metrics: emitted escalations and suppressed alerts.
  for (const d of result.decisions) {
    if (d.action === "EMITTED") {
      incCounterWithLabels("tracking_escalations_total", {
        severity: String((d as any).severity || "UNKNOWN"),
        step: String(d.stepIndex),
      });
      incCounterWithLabels("tracking_oncall_pages_total", { step: String(d.stepIndex) });
    }
    if (d.action === "SUPPRESSED") {
      incCounterWithLabels("tracking_alerts_suppressed_total", { reason: "suppression_window" });
    }
  }

  const snapshot = await upsertHourlySloSnapshot(now);

  const status = {
    lastRunAt: now.toISOString(),
    scannedIncidents: result.scannedIncidents,
    decisions: result.decisions,
    sloSnapshot: snapshot,
    generatedAt: new Date().toISOString(),
  };

  await redisClient.set(LAST_STATUS_KEY, JSON.stringify(status));

  sendWithEtag(req, res, status, 5);
});

router.get("/status", authenticateToken, requireOpsRole("OPS_VIEWER"), async (req, res) => {
  const raw = await redisClient.get(LAST_STATUS_KEY);
  const parsed = raw ? (() => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  })() : null;

  const snapshot = await getLatestSloSnapshot();

  const body = {
    last: parsed,
    sloSnapshot: snapshot,
    generatedAt: new Date().toISOString(),
  };

  sendWithEtag(req, res, body, 5);
});

export default router;
