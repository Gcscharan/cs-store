import redisClient from "../../../config/redis";
import { incCounterWithLabels, setGauge } from "../../../ops/opsMetrics";
import { LearningDomain, LearningInsight } from "./types";

const BY_ID_PREFIX = "tracking:learning:insights:byId:";
const INDEX_PREFIX = "tracking:learning:insights:index:";

function byIdKey(id: string): string {
  return `${BY_ID_PREFIX}${id}`;
}

function indexKey(domain: LearningDomain): string {
  return `${INDEX_PREFIX}${domain}`;
}

async function readIndex(domain: LearningDomain): Promise<string[]> {
  const raw = await redisClient.get(indexKey(domain));
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

async function writeIndex(domain: LearningDomain, ids: string[]): Promise<void> {
  const unique = Array.from(new Set(ids.map(String)));
  await redisClient.set(indexKey(domain), JSON.stringify(unique));
}

export async function getLearningInsightById(id: string): Promise<LearningInsight | null> {
  const raw = await redisClient.get(byIdKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LearningInsight;
  } catch {
    return null;
  }
}

export async function appendLearningInsight(params: { insight: LearningInsight }): Promise<{ insight: LearningInsight; created: boolean }> {
  const id = String(params.insight.id || "").trim();
  if (!id) throw new Error("insight.id is required");

  const existing = await getLearningInsightById(id);
  if (existing) {
    return { insight: existing, created: false };
  }

  await redisClient.set(byIdKey(id), JSON.stringify(params.insight));

  const idx = await readIndex(params.insight.domain);
  const next = [id, ...idx].slice(0, 2000);
  await writeIndex(params.insight.domain, next);

  incCounterWithLabels("learning_insights_total", { domain: String(params.insight.domain) });

  // Best-effort learning health gauges from insight evidence when present
  const fp = (params.insight.domain === "INCIDENT" ? Number((params.insight.evidence as any)?.falsePositiveRate) : NaN);
  if (Number.isFinite(fp)) setGauge("learning_false_positive_rate", fp);

  return { insight: params.insight, created: true };
}

export async function listLearningInsights(params: { domain: LearningDomain; limit?: number }): Promise<LearningInsight[]> {
  const limit = Math.max(1, Math.min(500, Number(params.limit || 50)));
  const idx = await readIndex(params.domain);

  const out: LearningInsight[] = [];
  for (const id of idx) {
    const r = await getLearningInsightById(id);
    if (!r) continue;
    out.push(r);
    if (out.length >= limit) break;
  }

  return out;
}
