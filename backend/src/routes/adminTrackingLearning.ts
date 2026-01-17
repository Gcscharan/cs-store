import express from "express";
import crypto from "crypto";
import redisClient from "../config/redis";
import { authenticateToken } from "../middleware/auth";
import { listLearningInsights } from "../domains/tracking/phase7/store";
import { LearningDomain } from "../domains/tracking/phase7/types";

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

async function listDomain(req: express.Request, res: express.Response, domain: LearningDomain): Promise<void> {
  const limit = Math.max(1, Math.min(200, Number((req.query as any)?.limit || 50)));
  const items = await listLearningInsights({ domain, limit });
  sendWithEtag(req, res, { domain, count: items.length, items, generatedAt: new Date().toISOString() }, 10);
}

router.get("/eta", authenticateToken, requireOpsRole("OPS_VIEWER"), async (req, res) => listDomain(req, res, "ETA"));
router.get("/incidents", authenticateToken, requireOpsRole("OPS_VIEWER"), async (req, res) => listDomain(req, res, "INCIDENT"));
router.get("/escalations", authenticateToken, requireOpsRole("OPS_VIEWER"), async (req, res) => listDomain(req, res, "ESCALATION"));
router.get("/killswitch", authenticateToken, requireOpsRole("OPS_VIEWER"), async (req, res) => listDomain(req, res, "KILLSWITCH"));

export default router;
