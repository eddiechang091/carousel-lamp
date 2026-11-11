import type { UsageEntry } from "@/services/otari/usage";

// Token-usage line chart for the Model dashboard: one line per model,
// each in its own color, total tokens per call, newest last, plus a
// legend with each model's total over the window. Pure point math
// (unit-tested) + a thin SVG.

export type ChartPoint = {
  x: number;
  y: number;
  tokens: number;
  model: string;
  t: number;
};

export type ChartSeries = {
  model: string;
  color: string;
  /** Tokens summed over the charted window for this model. */
  total: number;
  points: ChartPoint[];
};

export const CHART_WIDTH = 260;
export const CHART_HEIGHT = 80;
export const MAX_CHART_POINTS = 20;

// One color per model, assigned by the model's position in the
// allowlist so a model keeps its color as entries roll in. Mid-tone
// hues read on both the light and the dark dashboard panel.
export const MODEL_COLORS = [
  "#C0392B",
  "#1E8449",
  "#2471A3",
  "#9A7B0A",
  "#7D3C98",
  "#148F77",
  "#A9326B",
  "#CA6F1E",
];

export function modelColor(model: string, models: string[] = []): string {
  const idx = models.indexOf(model);
  if (idx >= 0) return MODEL_COLORS[idx % MODEL_COLORS.length];
  // Unknown model (e.g. an entry from a model since removed): a stable
  // hash keeps its color from jumping between renders.
  let h = 0;
  for (let i = 0; i < model.length; i++) h = (h * 31 + model.charCodeAt(i)) >>> 0;
  return MODEL_COLORS[h % MODEL_COLORS.length];
}

export function shortModelName(model: string): string {
  const slash = model.lastIndexOf("/");
  return slash >= 0 ? model.slice(slash + 1) : model;
}

export function computeChartSeries(
  entries: UsageEntry[],
  models: string[] = [],
  width = CHART_WIDTH,
  height = CHART_HEIGHT,
): ChartSeries[] {
  const slice = entries.slice(-MAX_CHART_POINTS);
  if (slice.length === 0) return [];
  const max = Math.max(...slice.map((e) => e.tokens), 1);
  const pad = 6;
  const pointFor = (entry: UsageEntry, i: number): ChartPoint => {
    const x =
      slice.length === 1
        ? width / 2
        : pad + (i * (width - pad * 2)) / (slice.length - 1);
    const y = height - pad - (entry.tokens / max) * (height - pad * 2);
    return { x, y, tokens: entry.tokens, model: entry.model, t: entry.t };
  };
  const byModel = new Map<string, { points: ChartPoint[]; total: number }>();
  slice.forEach((entry, i) => {
    const group = byModel.get(entry.model) ?? { points: [], total: 0 };
    group.points.push(pointFor(entry, i));
    group.total += entry.tokens;
    byModel.set(entry.model, group);
  });
  // Series order: allowlist order first, then any other model by first
  // appearance (Array.sort is stable, so returning 0 keeps it).
  const ordered = [...byModel.keys()].sort((a, b) => {
    const ia = models.indexOf(a);
    const ib = models.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return 0;
  });
  return ordered.map((model) => {
    const group = byModel.get(model)!;
    return { model, color: modelColor(model, models), total: group.total, points: group.points };
  });
}

export default function UsageChart({
  entries,
  models = [],
}: {
  entries: UsageEntry[];
  models?: string[];
}) {
  const series = computeChartSeries(entries, models);
  if (series.length === 0) return null;
  const shown = series.reduce((n, s) => n + s.points.length, 0);
  const last = entries[entries.length - 1];
  return (
    <>
      <svg
        className="usage-chart"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label={`Token usage by model, last ${shown} calls, latest ${last.tokens} tokens`}
      >
        {series.map((s) => (
          <g key={s.model}>
            <polyline
              points={s.points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
              fill="none"
              strokeWidth="2"
              style={{ stroke: s.color }}
            />
            {s.points.map((p) => (
              <circle key={p.t} cx={p.x} cy={p.y} r="3" style={{ fill: s.color }} />
            ))}
          </g>
        ))}
      </svg>
      <ul className="usage-legend">
        {series.map((s) => (
          <li key={s.model} title={s.model}>
            <span className="swatch" style={{ background: s.color }} />
            {shortModelName(s.model)} · {s.total}
          </li>
        ))}
      </ul>
    </>
  );
}
