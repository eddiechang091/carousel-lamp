// Token-usage history for the Model dashboard chart.
//
// Every successful /api/llm call records one entry (see llm.ts).
// Kept in localStorage under `carousel-lamp:otari-usage` so the chart
// survives reloads; capped at 50 entries, oldest dropped first.
// Corrupt or foreign data is ignored, never thrown.

export type UsageEntry = {
  /** Epoch ms of the call. */
  t: number;
  /** The model that actually answered (provider/model). */
  model: string;
  /** Total tokens for the call (prompt + completion). */
  tokens: number;
};

export const USAGE_STORAGE_KEY = "carousel-lamp:otari-usage";
export const MAX_USAGE_ENTRIES = 50;

function isUsageEntry(value: unknown): value is UsageEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.t === "number" &&
    typeof entry.model === "string" &&
    entry.model.length > 0 &&
    typeof entry.tokens === "number" &&
    Number.isFinite(entry.tokens)
  );
}

export function readUsageEntries(): UsageEntry[] {
  try {
    const raw = localStorage.getItem(USAGE_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isUsageEntry);
  } catch {
    return [];
  }
}

export function recordUsage(entry: UsageEntry): UsageEntry[] {
  const next = [...readUsageEntries(), entry].slice(-MAX_USAGE_ENTRIES);
  try {
    localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or unavailable — the chart just shows what it has.
  }
  return next;
}

export function clearUsageEntries(): void {
  try {
    localStorage.removeItem(USAGE_STORAGE_KEY);
  } catch {
    // Ignore — nothing to clear.
  }
}
