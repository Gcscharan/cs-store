export type EtaWindow = {
  start: string;
  end: string;
  confidence?: "high" | "medium";
};

function isSameYmd(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isTomorrow(target: Date, now: Date): boolean {
  const t = new Date(target);
  const n = new Date(now);
  t.setHours(0, 0, 0, 0);
  n.setHours(0, 0, 0, 0);
  const diffDays = Math.round((t.getTime() - n.getTime()) / (24 * 60 * 60 * 1000));
  return diffDays === 1;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function roundTo5(n: number): number {
  return Math.round(n / 5) * 5;
}

export function formatEta(eta: EtaWindow, nowInput?: Date): string {
  const now = nowInput ?? new Date();
  const start = new Date(eta.start);
  const end = new Date(eta.end);

  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return "Arriving soon";
  }

  const minsToStart = Math.max(0, Math.round((start.getTime() - now.getTime()) / 60000));
  const minsToEnd = Math.max(0, Math.round((end.getTime() - now.getTime()) / 60000));
  const windowMins = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));

  const isQuickCommerce = eta.confidence === "high" && minsToEnd <= 180 && windowMins <= 120;
  if (isQuickCommerce) {
    const a = Math.max(10, roundTo5(minsToStart));
    const b = Math.max(a + 5, roundTo5(minsToEnd));
    return `Arriving today in ${a}–${b} mins`;
  }

  const sameDay = isSameYmd(start, now);
  const tomorrow = isTomorrow(start, now);

  const startTime = formatTime(start);
  const endTime = formatTime(end);

  if (sameDay) {
    if (windowMins >= 180 || eta.confidence === "medium") {
      return `Arriving today by ${endTime}`;
    }
    return `Arriving today, ${startTime} – ${endTime}`;
  }

  if (tomorrow) {
    return `Arriving tomorrow, ${startTime} – ${endTime}`;
  }

  const weekday = start.toLocaleDateString(undefined, { weekday: "short" });
  return `Arriving ${weekday}, ${startTime} – ${endTime}`;
}
