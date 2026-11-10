import { describe, it, expect } from "vitest";
import {
  computeChartPoints,
  CHART_WIDTH,
  CHART_HEIGHT,
} from "@/components/UsageChart";
import type { UsageEntry } from "@/services/otari/usage";

const entry = (t: number, tokens: number): UsageEntry => ({
  t,
  model: "acme/vision-1",
  tokens,
});

describe("usage chart points", () => {
  it("returns [] with no entries", () => {
    expect(computeChartPoints([])).toEqual([]);
  });

  it("centers a single point and scales it to the top", () => {
    const [point] = computeChartPoints([entry(1, 40)]);
    expect(point.x).toBe(CHART_WIDTH / 2);
    expect(point.y).toBe(6); // max token value sits at the top pad
    expect(point.tokens).toBe(40);
  });

  it("scales by the max value and spreads x across the width", () => {
    const points = computeChartPoints([entry(1, 10), entry(2, 20), entry(3, 5)]);
    expect(points).toHaveLength(3);
    expect(points[0].x).toBe(6);
    expect(points[2].x).toBe(CHART_WIDTH - 6);
    // 20 tokens is the max — its y is the top pad; 5 tokens sits lower.
    expect(points[1].y).toBe(6);
    expect(points[2].y).toBeGreaterThan(points[0].y);
    expect(points[2].y).toBeLessThan(CHART_HEIGHT - 6);
  });

  it("charts only the last 20 calls", () => {
    const entries = Array.from({ length: 25 }, (_, i) => entry(i, 10 + i));
    const points = computeChartPoints(entries);
    expect(points).toHaveLength(20);
    expect(points[0].t).toBe(5);
    expect(points[19].t).toBe(24);
  });
});
