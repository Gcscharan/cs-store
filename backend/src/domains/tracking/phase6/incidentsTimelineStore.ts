import crypto from "crypto";
import redisClient from "../../../config/redis";
import { IncidentTimelineEntry } from "./types";

const BY_INCIDENT_PREFIX = "tracking:oncall:incidents:timeline:";
const NOTE_DEDUP_PREFIX = "tracking:oncall:incidents:noteDedup:";

function byIncidentKey(incidentId: string): string {
  return `${BY_INCIDENT_PREFIX}${incidentId}`;
}

function noteDedupKey(incidentId: string, noteId: string): string {
  return `${NOTE_DEDUP_PREFIX}${incidentId}:${noteId}`;
}

function stableId(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 16);
}

async function readEntries(incidentId: string): Promise<IncidentTimelineEntry[]> {
  const raw = await redisClient.get(byIncidentKey(incidentId));
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as IncidentTimelineEntry[]) : [];
  } catch {
    return [];
  }
}

async function writeEntries(incidentId: string, entries: IncidentTimelineEntry[]): Promise<void> {
  await redisClient.set(byIncidentKey(incidentId), JSON.stringify(entries));
}

export async function listIncidentTimeline(params: { incidentId: string; limit?: number }): Promise<IncidentTimelineEntry[]> {
  const limit = Math.max(1, Math.min(500, Number(params.limit || 200)));
  const entries = await readEntries(params.incidentId);
  return entries.slice(0, limit);
}

export async function appendIncidentTimelineEntry(params: {
  incidentId: string;
  entry: Omit<IncidentTimelineEntry, "id"> & { id?: string };
}): Promise<IncidentTimelineEntry> {
  const incidentId = String(params.incidentId || "").trim();
  if (!incidentId) throw new Error("incidentId is required");

  const at = String((params.entry as any).at || new Date().toISOString());
  const type = String((params.entry as any).type || "");
  if (!type) throw new Error("entry.type is required");

  const id = String(params.entry.id || stableId(`${incidentId}:${type}:${at}:${JSON.stringify(params.entry.actor || {})}`));

  const next: IncidentTimelineEntry = {
    id,
    type: params.entry.type,
    at,
    actor: params.entry.actor,
    message: params.entry.message,
    details: params.entry.details,
  };

  const existing = await readEntries(incidentId);
  if (existing.some((e) => e.id === id)) return existing.find((e) => e.id === id) as IncidentTimelineEntry;

  const merged = [next, ...existing].slice(0, 2000);
  await writeEntries(incidentId, merged);
  return next;
}

export async function addIncidentNote(params: {
  incidentId: string;
  note: { text: string };
  actor: { userId?: string; email?: string };
  now: Date;
}): Promise<IncidentTimelineEntry> {
  const incidentId = String(params.incidentId || "").trim();
  const text = String(params.note?.text || "").trim();
  if (!incidentId) throw new Error("incidentId is required");
  if (!text) throw new Error("text is required");

  const at = params.now.toISOString();
  const actorKey = `${String(params.actor?.userId || "")}:${String(params.actor?.email || "")}`;
  const noteId = stableId(`${incidentId}:note:${at}:${actorKey}:${text}`);

  const dedupK = noteDedupKey(incidentId, noteId);
  const exists = await redisClient.exists(dedupK);
  if (!exists) {
    await redisClient.set(dedupK, "1", { EX: 60 * 60 * 24 * 365 });
  }

  const entry = await appendIncidentTimelineEntry({
    incidentId,
    entry: {
      id: noteId,
      type: "note",
      at,
      actor: params.actor,
      message: text,
    },
  });

  return entry;
}
