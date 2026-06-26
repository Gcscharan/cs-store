/**
 * Utility functions for the Notification Analytics Dashboard.
 * Extracted for testability.
 */

/** Supported time range options */
export type TimeRange = "today" | "7days" | "30days";

/** Formats the time period _id from MongoDB aggregation into a display label */
export function formatPeriodLabel(id: Record<string, number>, period: string): string {
  if (period === "hourly") {
    const h = id.hour ?? 0;
    return `${String(id.month).padStart(2, "0")}/${String(id.day).padStart(2, "0")} ${String(h).padStart(2, "0")}:00`;
  }
  if (period === "weekly") {
    return `W${id.week} ${id.year}`;
  }
  // daily
  return `${String(id.month).padStart(2, "0")}/${String(id.day).padStart(2, "0")}`;
}

/** Computes start/end ISO date strings from a time range selection */
export function getDateRangeFromTimeRange(range: TimeRange, now: Date = new Date()): { startDate: string; endDate: string } {
  const endDate = now.toISOString();
  let startDate: string;

  switch (range) {
    case "today":
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      break;
    case "7days":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case "30days":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      break;
    default:
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  }

  return { startDate, endDate };
}

/** Determines the period granularity for the API based on time range */
export function getPeriodForRange(range: TimeRange): "hourly" | "daily" {
  switch (range) {
    case "today":
      return "hourly";
    case "7days":
    case "30days":
    default:
      return "daily";
  }
}

/** Computes delivery success rate from totals */
export function computeDeliverySuccessRate(totals: {
  sent: number;
  delivered: number;
  opened: number;
  failed: number;
}): number {
  const { sent, delivered, opened, failed } = totals;
  const total = sent + delivered + opened + failed;
  if (total === 0) return 100;
  const successful = delivered + opened;
  const completed = successful + failed;
  if (completed === 0) return 100;
  return Math.round((successful / completed) * 100);
}

/** Transforms time period data into chart-friendly format */
export function transformToLineChartData(
  byTimePeriod: Array<{
    _id: Record<string, number>;
    sent: number;
    delivered: number;
    opened: number;
    failed: number;
    total: number;
  }>,
  period: string
): Array<{ label: string; sent: number; delivered: number; failed: number }> {
  return byTimePeriod.map((item) => ({
    label: formatPeriodLabel(item._id, period),
    sent: item.sent + item.delivered + item.opened + item.failed,
    delivered: item.delivered + item.opened,
    failed: item.failed,
  }));
}
