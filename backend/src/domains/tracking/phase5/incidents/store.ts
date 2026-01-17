import redisClient from "../../../../config/redis";
import { DetectedIncident, IncidentRecord, IncidentStatus } from "./types";
import { incidentIdFor } from "./detect";

const INDEX_KEY = "tracking:incidents:index";
const BY_ID_PREFIX = "tracking:incidents:byId:";

function byIdKey(id: string): string {
  return `${BY_ID_PREFIX}${id}`;
}

function nowIso(now: Date): string {
  return now.toISOString();
}

async function readIndex(): Promise<string[]> {
  const raw = await redisClient.get(INDEX_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

async function writeIndex(ids: string[]): Promise<void> {
  const unique = Array.from(new Set(ids.map(String)));
  await redisClient.set(INDEX_KEY, JSON.stringify(unique));
}

export async function getIncidentById(id: string): Promise<IncidentRecord | null> {
  const raw = await redisClient.get(byIdKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as IncidentRecord;
  } catch {
    return null;
  }
}

export async function upsertDetectedIncident(params: {
  detected: DetectedIncident;
  now: Date;
}): Promise<{ record: IncidentRecord; created: boolean }> {
  const id = incidentIdFor(params.detected);
  const existing = await getIncidentById(id);
  const ts = nowIso(params.now);

  if (existing) {
    const merged: IncidentRecord = {
      ...existing,
      lastSeenAt: ts,
      evidence: params.detected.evidence ?? existing.evidence,
    };
    await redisClient.set(byIdKey(id), JSON.stringify(merged));
    return { record: merged, created: false };
  }

  const record: IncidentRecord = {
    id,
    type: params.detected.type,
    severity: params.detected.severity,
    scope: params.detected.scope,
    subject: params.detected.subject,
    status: "OPEN",
    detectedAt: ts,
    lastSeenAt: ts,
    evidence: params.detected.evidence,
  };

  await redisClient.set(byIdKey(id), JSON.stringify(record));
  const idx = await readIndex();
  idx.unshift(id);
  await writeIndex(idx.slice(0, 2000));

  return { record, created: true };
}

export async function listIncidents(params: {
  status?: IncidentStatus;
  type?: string;
  severity?: string;
  limit?: number;
}): Promise<IncidentRecord[]> {
  const limit = Math.max(1, Math.min(500, Number(params.limit || 100)));
  const idx = await readIndex();

  const out: IncidentRecord[] = [];
  for (const id of idx) {
    const r = await getIncidentById(id);
    if (!r) continue;
    if (params.status && r.status !== params.status) continue;
    if (params.type && String(r.type) !== String(params.type)) continue;
    if (params.severity && String(r.severity) !== String(params.severity)) continue;
    out.push(r);
    if (out.length >= limit) break;
  }

  return out;
}

export async function ackIncident(params: {
  id: string;
  now: Date;
  actor: { userId?: string; email?: string };
}): Promise<IncidentRecord | null> {
  const existing = await getIncidentById(params.id);
  if (!existing) return null;
  if (existing.status !== "OPEN") return existing;

  const next: IncidentRecord = {
    ...existing,
    status: "ACKED",
    ackedAt: nowIso(params.now),
    ackedBy: params.actor,
  };
  await redisClient.set(byIdKey(params.id), JSON.stringify(next));
  return next;
}

export async function closeIncident(params: {
  id: string;
  now: Date;
  actor: { userId?: string; email?: string };
  reason: string;
}): Promise<IncidentRecord | null> {
  const existing = await getIncidentById(params.id);
  if (!existing) return null;
  if (existing.status === "CLOSED") return existing;

  const next: IncidentRecord = {
    ...existing,
    status: "CLOSED",
    closedAt: nowIso(params.now),
    closedBy: params.actor,
    closeReason: params.reason,
  };
  await redisClient.set(byIdKey(params.id), JSON.stringify(next));
  return next;
}
