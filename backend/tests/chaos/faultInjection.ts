export type FaultConfig = {
  mongoDown?: boolean;
  redisTimeoutMs?: number;
  paymentGatewayDelayMs?: number;
  webhookDuplicate?: boolean;
  networkLatencyMs?: number;
};

export function withFaults<T>(faults: FaultConfig, fn: () => Promise<T>): Promise<T> {
  const g = globalThis as any;
  g.__chaosFaults = faults;
  return fn().finally(() => {
    delete g.__chaosFaults;
  });
}

export function getFaults(): FaultConfig {
  const g = globalThis as any;
  return (g.__chaosFaults || {}) as FaultConfig;
}

export async function maybeDelay(ms?: number) {
  const n = Number(ms || 0);
  if (!Number.isFinite(n) || n <= 0) return;
  await new Promise((r) => setTimeout(r, n));
}
