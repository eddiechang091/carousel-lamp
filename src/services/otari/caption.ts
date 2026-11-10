import { getLlmService, LlmUnavailableError } from "./llm";
import type { LlmMessage, LlmContentBlock } from "./llm";
import type { Locale } from "@/i18n";
import type { ThemeId } from "@/lib/themes";

// AI caption for a polaroid: the model looks at the photo (Otari
// chat completions with image input, via the /api/llm proxy) and
// writes one poetic line. The result fills the caption draft — the
// user edits it and saves with the existing Save button. Nothing is
// auto-persisted.

export const MAX_CAPTION_CHARS = 20;

const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  fr: "French",
  es: "Spanish",
  zh: "Chinese",
};

// Theme display names for the AI caption prompt — the English labels
// from the theme picker (i18n `theme.*`), one per theme in the
// registry. Any theme without a mapping falls back to "Classic"
// (see ?? below); the registry in themes.ts is the authority.
const THEME_NAMES: Record<ThemeId, string> = {
  default: "Classic",
  "new-year": "New Year's Day",
  valentine: "Valentine's Day",
  "spring-festival": "Spring Festival",
  carnival: "Carnival",
  "st-patrick": "St. Patrick's Day",
  "april-fools": "April Fools' Day",
  easter: "Easter",
  "mothers-day": "Mother's Day",
  "dragon-boat": "Dragon Boat Festival",
  "mid-autumn": "Mid-Autumn Festival",
  halloween: "Halloween",
  diwali: "Diwali",
  thanksgiving: "Thanksgiving",
  christmas: "Christmas",
};

export function themeDisplayName(themeId: ThemeId): string {
  return THEME_NAMES[themeId] ?? "Classic";
}

export function buildCaptionMessages(opts: {
  imageDataUrl: string;
  locale: Locale;
  themeId: ThemeId;
}): LlmMessage[] {
  const language = LANGUAGE_NAMES[opts.locale] ?? "English";
  const theme = THEME_NAMES[opts.themeId] ?? "Classic";
  const textBlock: LlmContentBlock = {
    type: "text",
    text: `Write one poetic caption for this photo. The photo hangs on a spinning carousel lamp, current theme: ${theme}. At most ${MAX_CAPTION_CHARS} characters.`,
  };
  const imageBlock: LlmContentBlock = { type: "image", data: opts.imageDataUrl };
  return [
    {
      role: "system",
      content: `You write one poetic caption for a photo on a carousel lamp. Reply with only the caption, at most ${MAX_CAPTION_CHARS} characters, in ${language}. No quotation marks around it, no explanation, no second line.`,
    },
    { role: "user", content: [textBlock, imageBlock] },
  ];
}

// Strip wrapping quotes, collapse line breaks, enforce the character cap.
export function cleanCaption(text: string): string {
  let cleaned = text.trim().replace(/\s+/g, " ");
  cleaned = cleaned.replace(/^["'“”‘’«»「」『』]+|["'“”‘’«»「」『』]+$/g, "").trim();
  return cleaned.slice(0, MAX_CAPTION_CHARS);
}

export async function generateAiCaption(opts: {
  imageDataUrl: string;
  locale: Locale;
  themeId: ThemeId;
  /** One model from the server allowlist; omit for the server default. */
  model?: string;
}): Promise<string> {
  const llm = await getLlmService();
  if (!llm.available) {
    throw new LlmUnavailableError();
  }
  const result = await llm.complete({
    messages: buildCaptionMessages(opts),
    maxTokens: 60,
    temperature: 0.9,
    model: opts.model,
  });
  const caption = cleanCaption(result.text);
  if (!caption) {
    throw new Error("AI caption came back empty");
  }
  return caption;
}
