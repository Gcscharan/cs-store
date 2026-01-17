import express from "express";
import crypto from "crypto";
import redisClient from "../config/redis";
import { authenticateToken } from "../middleware/auth";
import { auditLog } from "../middleware/auditLog";
import { listEscalationPolicies, upsertEscalationPolicy } from "../domains/tracking/phase6/oncallPolicyStore";
import { listOnCallSchedules, upsertOnCallSchedule } from "../domains/tracking/phase6/oncallScheduleStore";
import { addIncidentNote, listIncidentTimeline } from "../domains/tracking/phase6/incidentsTimelineStore";

type OpsRole = "OPS_VIEWER" | "OPS_ADMIN";

const OPS_ROLE_KEY_PREFIX = "ops:role:";

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

router.get("/policies", authenticateToken, requireOpsRole("OPS_VIEWER"), async (req, res) => {
  const limit = Math.max(1, Math.min(500, Number((req.query as any)?.limit || 100)));
  const items = await listEscalationPolicies({ limit });
  sendWithEtag(req, res, { count: items.length, items, generatedAt: new Date().toISOString() }, 5);
});

router.post("/policies", authenticateToken, requireOpsRole("OPS_ADMIN"), auditLog, async (req: any, res) => {
  const policy = req?.body || {};
  const id = String(policy?.id || "").trim();
  if (!id) return res.status(400).json({ message: "id is required" });

  const appliesTo = Array.isArray(policy?.appliesTo) ? policy.appliesTo.map(String) : [];
  if (appliesTo.length === 0) return res.status(400).json({ message: "appliesTo is required" });

  const severity = String(policy?.severity || "").toUpperCase();
  if (!severity) return res.status(400).json({ message: "severity is required" });

  const steps = Array.isArray(policy?.steps) ? policy.steps : [];
  if (steps.length === 0) return res.status(400).json({ message: "steps is required" });

  const suppressionWindowMinutes = Math.max(0, Number(policy?.suppressionWindowMinutes || 0));

  const normalized = {
    id,
    appliesTo,
    severity,
    steps: steps.map((s: any) => ({
      afterMinutes: Math.max(0, Number(s?.afterMinutes || 0)),
      target: String(s?.target || "").toUpperCase(),
    })),
    suppressionWindowMinutes,
  };

  const saved = await upsertEscalationPolicy({ policy: normalized as any });
  res.json({ success: true, policy: saved });
});

router.get("/schedules", authenticateToken, requireOpsRole("OPS_VIEWER"), async (req, res) => {
  const limit = Math.max(1, Math.min(200, Number((req.query as any)?.limit || 100)));
  const items = await listOnCallSchedules({ limit });
  sendWithEtag(req, res, { count: items.length, items, generatedAt: new Date().toISOString() }, 5);
});

router.post("/schedules", authenticateToken, requireOpsRole("OPS_ADMIN"), auditLog, async (req: any, res) => {
  const schedule = req?.body || {};
  const id = String(schedule?.id || "").trim();
  if (!id) return res.status(400).json({ message: "id is required" });

  const team = String(schedule?.team || "").trim();
  if (!team) return res.status(400).json({ message: "team is required" });

  const primaryUserId = String(schedule?.primary?.userId || "").trim();
  if (!primaryUserId) return res.status(400).json({ message: "primary.userId is required" });

  const timezone = String(schedule?.timezone || "UTC");
  const effectiveFrom = schedule?.effectiveFrom ? new Date(String(schedule.effectiveFrom)).toISOString() : new Date().toISOString();

  const normalized = {
    id,
    team,
    primary: { userId: primaryUserId, email: schedule?.primary?.email ? String(schedule.primary.email) : undefined },
    secondary: schedule?.secondary?.userId
      ? { userId: String(schedule.secondary.userId), email: schedule?.secondary?.email ? String(schedule.secondary.email) : undefined }
      : undefined,
    timezone,
    effectiveFrom,
  };

  const saved = await upsertOnCallSchedule({ schedule: normalized as any });
  res.json({ success: true, schedule: saved });
});

router.get("/incidents/:id/timeline", authenticateToken, requireOpsRole("OPS_VIEWER"), async (req, res) => {
  const id = String((req.params as any).id || "");
  const limit = Math.max(1, Math.min(500, Number((req.query as any)?.limit || 200)));
  const items = await listIncidentTimeline({ incidentId: id, limit });
  sendWithEtag(req, res, { count: items.length, items, generatedAt: new Date().toISOString() }, 5);
});

router.post("/incidents/:id/notes", authenticateToken, requireOpsRole("OPS_ADMIN"), auditLog, async (req: any, res) => {
  const incidentId = String((req.params as any).id || "");
  const text = String(req?.body?.text || "").trim();
  if (!text) return res.status(400).json({ message: "text is required" });

  const entry = await addIncidentNote({
    incidentId,
    note: { text },
    actor: { userId: String(req?.user?._id || ""), email: String(req?.user?.email || "") },
    now: new Date(),
  });

  res.json({ success: true, entry });
});

export default router;
