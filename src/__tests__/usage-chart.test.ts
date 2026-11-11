import { describe, it, expect } from "vitest";
import {
  computeChartSeries,
  modelColor,
  shortModelName,
  MODEL_COLORS,
  CHART_WIDTH,
  CHART_HEIGHT,
} from "@/components/UsageChart";
import type { UsageEntry } from "@/services/otari/usage";

const entry = (t: number, tokens: number, model = "acme/vision-1"): UsageEntry => ({
  t,
  model,
  tokens,
});

describe("usage chart series", () => {
  it("returns [] with no entries", () => {
    expect(computeChartSeries([])).toEqual([]);
  });

  it("centers a single point and scales it to the top", () => {
    const [series] = computeChartSeries([entry(1, 40)]);
    expect(series.model).toBe("acme/vision-1");
    expect(series.total).toBe(40);
    expect(series.points).toHaveLength(1);
    expect(series.points[0].x).toBe(CHART_WIDTH / 2);
    expect(series.points[0].y).toBe(6); // max token value sits at the top pad
    expect(series.points[0].tokens).toBe(40);
  });

  it("splits calls by model, each with its own color and total", () => {
    const series = computeChartSeries(
      [entry(1, 10, "a/one"), entry(2, 20, "b/two"), entry(3, 5, "a/one")],
      ["a/one", "b/two"],
    );
    expect(series).toHaveLength(2);
    const [a, b] = series;
    expect(a.model).toBe("a/one");
    expect(a.total).toBe(15);
    expect(a.points).toHaveLength(2);
    expect(b.model).toBe("b/two");
    expect(b.total).toBe(20);
    expect(b.points).toHaveLength(1);
    expect(a.color).toBe(MODEL_COLORS[0]);
    expect(b.color).toBe(MODEL_COLORS[1]);
    expect(a.color).not.toBe(b.color);
    // x is the shared call order: a/one sits at both ends, b/two between.
    expect(a.points[0].x).toBe(6);
    expect(a.points[1].x).toBe(CHART_WIDTH - 6);
    expect(b.points[0].x).toBeGreaterThan(a.points[0].x);
    expect(b.points[0].x).toBeLessThan(a.points[1].x);
    // y is scaled by the shared max (20): b/two's point sits at the top pad.
    expect(b.points[0].y).toBe(6);
    expect(a.points[0].y).toBeGreaterThan(6);
    expect(a.points[0].y).toBeLessThan(CHART_HEIGHT - 6);
  });

  it("orders series by the allowlist even when first seen later", () => {
    const series = computeChartSeries(
      [entry(1, 10, "b/two"), entry(2, 10, "a/one")],
      ["a/one", "b/two"],
    );
    expect(series.map((s) => s.model)).toEqual(["a/one", "b/two"]);
    expect(series[0].color).toBe(MODEL_COLORS[0]);
    expect(series[1].color).toBe(MODEL_COLORS[1]);
  });

  it("charts only the last 20 calls", () => {
    const entries = Array.from({ length: 25 }, (_, i) => entry(i, 10 + i));
    const [series] = computeChartSeries(entries);
    expect(series.points).toHaveLength(20);
    expect(series.points[0].t).toBe(5);
    expect(series.points[19].t).toBe(24);
    expect(series.total).toBe(
      Array.from({ length: 20 }, (_, i) => 15 + i).reduce((a, b) => a + b, 0),
    );
  });

  it("assigns stable colors to models outside the allowlist", () => {
    const first = modelColor("other/unknown");
    expect(MODEL_COLORS).toContain(first);
    expect(modelColor("other/unknown")).toBe(first);
    expect(modelColor("other/unknown", ["a/one"])).toBe(first);
  });

  it("shortens model ids to the part after the slash", () => {
    expect(shortModelName("deepseek/deepseek-v4.1-flash-1017")).toBe("deepseek-v4.1-flash-1017");
    expect(shortModelName("plain")).toBe("plain");
  });
});
