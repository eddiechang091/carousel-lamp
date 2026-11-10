import { getLlmService, LlmUnavailableError } from "./llm";
import type { LlmMessage } from "./llm";
import type { Locale } from "@/i18n";
import type { ThemeId } from "@/lib/themes";
import { themeDisplayName } from "./caption";

// Festival facts for the pony mascot: text-only chat completions via
// the same /api/llm proxy. The model answers from its own knowledge —
// no live web search is claimed anywhere (see README). The reply is
// kept short enough to read in a chat bubble.

export const MAX_FACTS_CHARS = 420;

// Nudge cadence (Lucky Cat pattern): first nudge after 60s idle, then
// at most every 180s, max 3 nudges per session, only when no
// editor/modal is open and no bubble is showing.
export const FIRST_NUDGE_IDLE_MS = 60_000;
export const NUDGE_INTERVAL_MS = 180_000;
export const MAX_NUDGES_PER_SESSION = 3;
export const NUDGE_BUBBLE_MS = 12_000;

export function nudgeAllowed(
  nudgesShown: number,
  lastNudgeAt: number | null,
  now: number,
): boolean {
  if (nudgesShown >= MAX_NUDGES_PER_SESSION) return false;
  if (lastNudgeAt === null) return true;
  return now - lastNudgeAt >= NUDGE_INTERVAL_MS;
}

export function buildFestivalMessages(opts: {
  themeId: ThemeId;
  locale: Locale;
}): LlmMessage[] {
  const language =
    { en: "English", fr: "French", es: "Spanish", zh: "Chinese" }[opts.locale] ??
    "English";
  const theme = themeDisplayName(opts.themeId);
  const topic =
    opts.themeId === "default"
      ? "carousel lamps"
      : `${theme} festival`;
  return [
    {
      role: "system",
      content: `You are a cheerful festival guide for a carousel lamp. Reply with one line of background plus 2-3 short fun facts about ${topic}, at most ${MAX_FACTS_CHARS} characters in total, in ${language}. Plain sentences only, no markdown, no greeting, no second paragraph.`,
    },
    {
      role: "user",
      content: `Tell me about ${topic} for the carousel lamp.`,
    },
  ];
}

// Trim, collapse whitespace, enforce the bubble-size cap.
export function cleanFacts(text: string): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (cleaned.length <= MAX_FACTS_CHARS) return cleaned;
  return `${cleaned.slice(0, MAX_FACTS_CHARS - 1).trimEnd()}…`;
}

export async function askFestivalFacts(opts: {
  themeId: ThemeId;
  locale: Locale;
  /** One model from the server allowlist; omit for the server default. */
  model?: string;
}): Promise<string> {
  const llm = await getLlmService();
  if (!llm.available) {
    throw new LlmUnavailableError();
  }
  const result = await llm.complete({
    messages: buildFestivalMessages(opts),
    maxTokens: 200,
    temperature: 0.8,
    model: opts.model,
  });
  const facts = cleanFacts(result.text);
  if (!facts) {
    throw new Error("Festival facts came back empty");
  }
  return facts;
}
