import redisClient from "../../../config/redis";
import { OnCallSchedule } from "./types";

const INDEX_KEY = "tracking:oncall:schedules:index";
const BY_ID_PREFIX = "tracking:oncall:schedules:byId:";

function byIdKey(id: string): string {
  return `${BY_ID_PREFIX}${id}`;
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

export async function getOnCallScheduleById(id: string): Promise<OnCallSchedule | null> {
  const raw = await redisClient.get(byIdKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OnCallSchedule;
  } catch {
    return null;
  }
}

export async function upsertOnCallSchedule(params: { schedule: OnCallSchedule }): Promise<OnCallSchedule> {
  const id = String(params.schedule.id || "").trim();
  if (!id) throw new Error("schedule.id is required");

  await redisClient.set(byIdKey(id), JSON.stringify(params.schedule));

  const idx = await readIndex();
  const next = [id, ...idx.filter((x) => x !== id)].slice(0, 200);
  await writeIndex(next);

  return params.schedule;
}

export async function listOnCallSchedules(params?: { limit?: number }): Promise<OnCallSchedule[]> {
  const limit = Math.max(1, Math.min(200, Number(params?.limit || 100)));
  const idx = await readIndex();

  const out: OnCallSchedule[] = [];
  for (const id of idx) {
    const s = await getOnCallScheduleById(id);
    if (!s) continue;
    out.push(s);
    if (out.length >= limit) break;
  }

  return out;
}
