import redisClient from "../../../config/redis";
import { getInternalMetricsSnapshot } from "../../../ops/opsMetrics";

export interface SloSnapshot {
  bucketStartIso: string;
  freshnessLivePct: number;
  etaErrorAvgMs: number;
  slaBreachPreventedTotal: number;
  generatedAt: string;
}

const INDEX_KEY = "tracking:oncall:slo:snapshots:index";
const BY_TS_PREFIX = "tracking:oncall:slo:snapshots:byTs:";

function byTsKey(bucketStartIso: string): string {
  return `${BY_TS_PREFIX}${bucketStartIso}`;
}

function hourBucketStartIso(now: Date): string {
  const d = new Date(now);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
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

function getLabeledCounterValue(prefix: string, labels: Record<string, string>): number {
  const snap = getInternalMetricsSnapshot();
  const key = `${prefix}:${Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(",")}`;
  return Number((snap.labeledCounters as any)[key] || 0);
}

export function computeSloSnapshot(now: Date): SloSnapshot {
  const live = getLabeledCounterValue("tracking_projection_freshness_total", { freshness: "LIVE" });
  const stale = getLabeledCounterValue("tracking_projection_freshness_total", { freshness: "STALE" });
  const offline = getLabeledCounterValue("tracking_projection_freshness_total", { freshness: "OFFLINE" });
  const total = live + stale + offline;
  const freshnessLivePct = total > 0 ? (100 * live) / total : 100;

  const snap = getInternalMetricsSnapshot();
  const etaErrorSum = Number((snap.counters as any)?.tracking_phase3_eta_error_ms_sum || 0);
  const etaErrorCount = Number((snap.counters as any)?.tracking_phase3_eta_error_count || 0);
  const etaErrorAvgMs = etaErrorCount > 0 ? etaErrorSum / etaErrorCount : 0;

  const slaBreachPreventedTotal = getLabeledCounterValue("sla_breach_prevented_total", { type: "SLA_BREACH_RISK" });

  return {
    bucketStartIso: hourBucketStartIso(now),
    freshnessLivePct,
    etaErrorAvgMs,
    slaBreachPreventedTotal,
    generatedAt: now.toISOString(),
  };
}

export async function upsertHourlySloSnapshot(now: Date): Promise<SloSnapshot> {
  const s = computeSloSnapshot(now);

  await redisClient.set(byTsKey(s.bucketStartIso), JSON.stringify(s));
  const idx = await readIndex();
  const next = [s.bucketStartIso, ...idx.filter((x) => x !== s.bucketStartIso)].slice(0, 24 * 14);
  await writeIndex(next);

  return s;
}

export async function getLatestSloSnapshot(): Promise<SloSnapshot | null> {
  const idx = await readIndex();
  if (!idx.length) return null;
  const raw = await redisClient.get(byTsKey(idx[0]));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SloSnapshot;
  } catch {
    return null;
  }
}
