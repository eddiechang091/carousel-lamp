import { getLlmService, LlmUnavailableError } from "./llm";
import type { LlmMessage, LlmContentBlock } from "./llm";
import type { Locale } from "@/i18n";
import type { ThemeId } from "@/lib/themes";

// AI caption for a polaroid: the model looks at the photo (Otari
// chat completions with image input, via the /api/llm proxy) and
// writes one poetic line. The caption is about the photo itself
// only — never the lamp, the frame, or the current theme — and it is
// auto-saved by the UI as soon as it arrives (see Home).
// The cap matches the caption input's maxLength (40): the model is
// told the cap, so a complete caption is never cut short.

export const MAX_CAPTION_CHARS = 40;

const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  fr: "French",
  es: "Spanish",
  zh: "Chinese",
};

// Theme display names for the pony's festival story (festival.ts).
// NOT used for captions: a caption must describe only the photo.
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
}): LlmMessage[] {
  const language = LANGUAGE_NAMES[opts.locale] ?? "English";
  const textBlock: LlmContentBlock = {
    type: "text",
    text: `Write one poetic caption for this photo. Base it only on what the photo itself shows — its subject, mood, and details. Do not mention the setting, the frame, or any occasion. At most ${MAX_CAPTION_CHARS} characters.`,
  };
  const imageBlock: LlmContentBlock = { type: "image", data: opts.imageDataUrl };
  return [
    {
      role: "system",
      content: `You write one poetic caption for a photo. Describe only what the photo itself shows. Reply with only the caption, at most ${MAX_CAPTION_CHARS} characters, in ${language}. No quotation marks around it, no explanation, no second line.`,
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
  /** One model from the server allowlist; omit for the server default. */
  model?: string;
}): Promise<string> {
  const llm = await getLlmService();
  if (!llm.available) {
    throw new LlmUnavailableError();
  }
  const result = await llm.complete({
    messages: buildCaptionMessages(opts),
    maxTokens: 80,
    temperature: 0.9,
    model: opts.model,
  });
  const caption = cleanCaption(result.text);
  if (!caption) {
    throw new Error("AI caption came back empty");
  }
  return caption;
}
