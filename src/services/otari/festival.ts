import { getLlmService, LlmUnavailableError } from "./llm";
import type { LlmMessage } from "./llm";
import type { Locale } from "@/i18n";
import type { ThemeId } from "@/lib/themes";
import { themeDisplayName } from "./caption";

// Festival facts for the pony mascot: text-only chat completions via
// the same /api/llm proxy, with Otari's built-in web search switched
// on (search: true). The model searches the web for the latest about
// the festival, so each click can surface fresh facts instead of the
// same background every time. The reply is kept short enough to read
// in a chat bubble.

export const MAX_FACTS_CHARS = 420;

// One angle per click, picked at random, so two taps in a row ask for
// different kinds of fresh facts instead of repeating the same answer.
export const FESTIVAL_FACT_ANGLES = [
  "this year's celebrations and latest news",
  "food and drink traditions",
  "a surprising historical fact",
  "how different countries celebrate it",
  "a recent record, event, or viral moment",
] as const;

export function pickFactAngle(random: () => number = Math.random): string {
  return FESTIVAL_FACT_ANGLES[Math.floor(random() * FESTIVAL_FACT_ANGLES.length)];
}

// Nudge cadence (Lucky Cat pattern): first nudge 2s after entry, then
// at most every 20s idle, max 3 nudges per session, only when no
// editor/modal is open and no bubble is showing.
export const FIRST_NUDGE_IDLE_MS = 2_000;
export const NUDGE_INTERVAL_MS = 20_000;
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
  /** Rotating angle for this click; defaults to a random pick. */
  angle?: string;
  /** Today's date (YYYY-MM-DD); defaults to the local date. */
  today?: string;
}): LlmMessage[] {
  const language =
    { en: "English", fr: "French", es: "Spanish", zh: "Chinese" }[opts.locale] ??
    "English";
  const theme = themeDisplayName(opts.themeId);
  const topic =
    opts.themeId === "default"
      ? "carousel lamps"
      : `${theme} festival`;
  const angle = opts.angle ?? pickFactAngle();
  const today = opts.today ?? new Date().toLocaleDateString("en-CA");
  return [
    {
      role: "system",
      content: `You are a cheerful festival guide for a carousel lamp. Today is ${today}. Search the web for the latest about ${topic} and reply with one line of background plus 2-3 short fun facts, focusing on ${angle}, at most ${MAX_FACTS_CHARS} characters in total, in ${language}. Prefer fresh, current facts over well-known ones, so each answer feels new. Plain sentences only, no markdown, no greeting, no second paragraph.`,
    },
    {
      role: "user",
      content: `Tell me the latest about ${topic} for the carousel lamp, focusing on ${angle}.`,
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
}): Promise<{ facts: string; searched: boolean }> {
  const llm = await getLlmService();
  if (!llm.available) {
    throw new LlmUnavailableError();
  }
  const result = await llm.complete({
    messages: buildFestivalMessages(opts),
    maxTokens: 200,
    temperature: 0.8,
    model: opts.model,
    search: true,
  });
  const facts = cleanFacts(result.text);
  if (!facts) {
    throw new Error("Festival facts came back empty");
  }
  return { facts, searched: result.searched ?? false };
}
