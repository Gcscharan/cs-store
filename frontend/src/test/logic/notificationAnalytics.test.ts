import { describe, expect, it } from "vitest";
import {
  formatPeriodLabel,
  getDateRangeFromTimeRange,
  getPeriodForRange,
  computeDeliverySuccessRate,
  transformToLineChartData,
} from "@/utils/notificationAnalytics";

describe("notificationAnalytics utilities", () => {
  describe("formatPeriodLabel", () => {
    it("formats hourly period with zero-padded date and hour", () => {
      const id = { year: 2025, month: 1, day: 5, hour: 9 };
      expect(formatPeriodLabel(id, "hourly")).toBe("01/05 09:00");
    });

    it("formats hourly period with double-digit month/day/hour", () => {
      const id = { year: 2025, month: 12, day: 25, hour: 14 };
      expect(formatPeriodLabel(id, "hourly")).toBe("12/25 14:00");
    });

    it("formats weekly period with week number and year", () => {
      const id = { year: 2025, week: 3 };
      expect(formatPeriodLabel(id, "weekly")).toBe("W3 2025");
    });

    it("formats daily period with zero-padded month/day", () => {
      const id = { year: 2025, month: 3, day: 7 };
      expect(formatPeriodLabel(id, "daily")).toBe("03/07");
    });

    it("handles missing hour as 0 for hourly", () => {
      const id = { year: 2025, month: 6, day: 15 };
      expect(formatPeriodLabel(id, "hourly")).toBe("06/15 00:00");
    });
  });

  describe("getDateRangeFromTimeRange", () => {
    const now = new Date("2025-06-15T12:00:00.000Z");

    it("returns today start of day for 'today'", () => {
      const { startDate, endDate } = getDateRangeFromTimeRange("today", now);
      const start = new Date(startDate);
      expect(start.getFullYear()).toBe(2025);
      expect(start.getMonth()).toBe(5); // June = 5
      expect(start.getDate()).toBe(15);
      expect(endDate).toBe(now.toISOString());
    });

    it("returns 7 days ago for '7days'", () => {
      const { startDate, endDate } = getDateRangeFromTimeRange("7days", now);
      const start = new Date(startDate);
      const diff = now.getTime() - start.getTime();
      expect(diff).toBe(7 * 24 * 60 * 60 * 1000);
      expect(endDate).toBe(now.toISOString());
    });

    it("returns 30 days ago for '30days'", () => {
      const { startDate, endDate } = getDateRangeFromTimeRange("30days", now);
      const start = new Date(startDate);
      const diff = now.getTime() - start.getTime();
      expect(diff).toBe(30 * 24 * 60 * 60 * 1000);
      expect(endDate).toBe(now.toISOString());
    });
  });

  describe("getPeriodForRange", () => {
    it("returns 'hourly' for today", () => {
      expect(getPeriodForRange("today")).toBe("hourly");
    });

    it("returns 'daily' for 7days", () => {
      expect(getPeriodForRange("7days")).toBe("daily");
    });

    it("returns 'daily' for 30days", () => {
      expect(getPeriodForRange("30days")).toBe("daily");
    });
  });

  describe("computeDeliverySuccessRate", () => {
    it("returns 100 when all totals are 0", () => {
      expect(computeDeliverySuccessRate({ sent: 0, delivered: 0, opened: 0, failed: 0 })).toBe(100);
    });

    it("returns 100 when only sent (no completions)", () => {
      expect(computeDeliverySuccessRate({ sent: 50, delivered: 0, opened: 0, failed: 0 })).toBe(100);
    });

    it("returns 100 when all completed are successful", () => {
      expect(computeDeliverySuccessRate({ sent: 10, delivered: 80, opened: 10, failed: 0 })).toBe(100);
    });

    it("returns 0 when all completed are failures", () => {
      expect(computeDeliverySuccessRate({ sent: 0, delivered: 0, opened: 0, failed: 100 })).toBe(0);
    });

    it("returns correct percentage for mixed results", () => {
      // 70 delivered + 10 opened = 80 successful out of 80+20=100 completed
      expect(computeDeliverySuccessRate({ sent: 5, delivered: 70, opened: 10, failed: 20 })).toBe(80);
    });

    it("rounds to nearest integer", () => {
      // 2 successful out of 3 completed = 66.67% → 67
      expect(computeDeliverySuccessRate({ sent: 0, delivered: 1, opened: 1, failed: 1 })).toBe(67);
    });
  });

  describe("transformToLineChartData", () => {
    it("transforms period data into chart format", () => {
      const input = [
        { _id: { year: 2025, month: 6, day: 10 }, sent: 5, delivered: 10, opened: 3, failed: 2, total: 20 },
        { _id: { year: 2025, month: 6, day: 11 }, sent: 8, delivered: 15, opened: 5, failed: 1, total: 29 },
      ];

      const result = transformToLineChartData(input, "daily");

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        label: "06/10",
        sent: 5 + 10 + 3 + 2, // total across all statuses
        delivered: 10 + 3,     // delivered + opened
        failed: 2,
      });
      expect(result[1]).toEqual({
        label: "06/11",
        sent: 8 + 15 + 5 + 1,
        delivered: 15 + 5,
        failed: 1,
      });
    });

    it("returns empty array for empty input", () => {
      expect(transformToLineChartData([], "daily")).toEqual([]);
    });
  });
});
