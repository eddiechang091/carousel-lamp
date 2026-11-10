import type { UsageEntry } from "@/services/otari/usage";

// Token-usage line chart for the Model dashboard: total tokens per
// call, newest last. Pure point math (unit-tested) + a thin SVG.

export type ChartPoint = {
  x: number;
  y: number;
  tokens: number;
  model: string;
  t: number;
};

export const CHART_WIDTH = 260;
export const CHART_HEIGHT = 80;
export const MAX_CHART_POINTS = 20;

export function computeChartPoints(
  entries: UsageEntry[],
  width = CHART_WIDTH,
  height = CHART_HEIGHT,
): ChartPoint[] {
  const slice = entries.slice(-MAX_CHART_POINTS);
  if (slice.length === 0) return [];
  const max = Math.max(...slice.map((e) => e.tokens), 1);
  const pad = 6;
  return slice.map((entry, i) => {
    const x =
      slice.length === 1
        ? width / 2
        : pad + (i * (width - pad * 2)) / (slice.length - 1);
    const y = height - pad - (entry.tokens / max) * (height - pad * 2);
    return { x, y, tokens: entry.tokens, model: entry.model, t: entry.t };
  });
}

export default function UsageChart({ entries }: { entries: UsageEntry[] }) {
  const points = computeChartPoints(entries);
  if (points.length === 0) return null;
  const line = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  return (
    <svg
      className="usage-chart"
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      role="img"
      aria-label={`Token usage, last ${points.length} calls, latest ${last.tokens} tokens`}
    >
      <polyline points={line} fill="none" strokeWidth="2" />
      {points.map((p) => (
        <circle key={p.t} cx={p.x} cy={p.y} r="3" />
      ))}
    </svg>
  );
}
