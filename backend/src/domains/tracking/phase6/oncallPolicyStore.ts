import redisClient from "../../../config/redis";
import { EscalationPolicy } from "./types";

const INDEX_KEY = "tracking:oncall:policies:index";
const BY_ID_PREFIX = "tracking:oncall:policies:byId:";

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

export async function getEscalationPolicyById(id: string): Promise<EscalationPolicy | null> {
  const raw = await redisClient.get(byIdKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EscalationPolicy;
  } catch {
    return null;
  }
}

export async function upsertEscalationPolicy(params: { policy: EscalationPolicy }): Promise<EscalationPolicy> {
  const id = String(params.policy.id || "").trim();
  if (!id) throw new Error("policy.id is required");

  await redisClient.set(byIdKey(id), JSON.stringify(params.policy));

  const idx = await readIndex();
  const next = [id, ...idx.filter((x) => x !== id)].slice(0, 500);
  await writeIndex(next);

  return params.policy;
}

export async function listEscalationPolicies(params?: { limit?: number }): Promise<EscalationPolicy[]> {
  const limit = Math.max(1, Math.min(500, Number(params?.limit || 100)));
  const idx = await readIndex();

  const out: EscalationPolicy[] = [];
  for (const id of idx) {
    const p = await getEscalationPolicyById(id);
    if (!p) continue;
    out.push(p);
    if (out.length >= limit) break;
  }

  return out;
}
