import redisClient from "../../../config/redis";

export type TrackingKillSwitchMode = "OFF" | "INGEST_ONLY" | "CUSTOMER_READ_ENABLED";

const REDIS_KEY = "tracking:killswitch:mode";
const CACHE_TTL_MS = process.env.NODE_ENV === "test" ? 0 : 1000;

let cache:
  | {
      mode: TrackingKillSwitchMode;
      expiresAt: number;
    }
  | undefined;

function isValidMode(v: any): v is TrackingKillSwitchMode {
  return v === "OFF" || v === "INGEST_ONLY" || v === "CUSTOMER_READ_ENABLED";
}

function getEnvDefaultMode(): TrackingKillSwitchMode {
  const raw = String(process.env.TRACKING_KILL_SWITCH_MODE || "OFF").toUpperCase();
  return isValidMode(raw) ? raw : "OFF";
}

export async function getTrackingKillSwitchMode(): Promise<TrackingKillSwitchMode> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache.mode;
  }

  try {
    const v = await redisClient.get(REDIS_KEY);
    const mode = isValidMode(v) ? v : getEnvDefaultMode();
    cache = { mode, expiresAt: now + CACHE_TTL_MS };
    return mode;
  } catch (e) {
    const mode = getEnvDefaultMode();
    cache = { mode, expiresAt: now + CACHE_TTL_MS };
    return mode;
  }
}

export async function setTrackingKillSwitchMode(params: {
  mode: TrackingKillSwitchMode;
  actor?: {
    userId?: string;
    email?: string;
    ip?: string;
  };
}): Promise<void> {
  const next = params.mode;
  if (!isValidMode(next)) {
    throw new Error("Invalid kill switch mode");
  }

  const prev = await getTrackingKillSwitchMode();
  await redisClient.set(REDIS_KEY, next);
  cache = { mode: next, expiresAt: Date.now() + CACHE_TTL_MS };

  const log = {
    type: "tracking_kill_switch_toggle",
    prev,
    next,
    actor: params.actor || null,
    ts: new Date().toISOString(),
  };
  console.log(JSON.stringify(log));
}
