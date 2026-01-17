import { describe, expect, it } from "vitest";
import { formatEta } from "./formatEta";

describe("formatEta", () => {
  it("shows quick-commerce copy for high confidence short window", () => {
    const now = new Date("2026-01-07T10:00:00.000Z");
    const text = formatEta(
      {
        start: "2026-01-07T10:30:00.000Z",
        end: "2026-01-07T10:45:00.000Z",
        confidence: "high",
      },
      now
    );

    expect(text.startsWith("Arriving today in ")).toBe(true);
    expect(text.includes("mins")).toBe(true);
    expect(text.includes("–")).toBe(true);
    expect(text.includes("T")).toBe(false);
  });

  it("shows 'today by' for medium confidence / long window", () => {
    const now = new Date("2026-01-07T10:00:00.000Z");
    const text = formatEta(
      {
        start: "2026-01-07T12:00:00.000Z",
        end: "2026-01-07T21:00:00.000Z",
        confidence: "medium",
      },
      now
    );

    expect(text.startsWith("Arriving today by ")).toBe(true);
    expect(text.includes("T")).toBe(false);
  });

  it("shows tomorrow wording for next-day window", () => {
    const now = new Date(2026, 0, 7, 22, 0, 0);
    const startLocal = new Date(2026, 0, 8, 10, 0, 0);
    const endLocal = new Date(2026, 0, 8, 12, 0, 0);
    const text = formatEta(
      {
        start: startLocal.toISOString(),
        end: endLocal.toISOString(),
        confidence: "high",
      },
      now
    );

    expect(text.startsWith("Arriving tomorrow, ")).toBe(true);
    expect(text.includes(" – ")).toBe(true);
  });
});
