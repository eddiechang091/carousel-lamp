import { getLlmService, LlmUnavailableError } from "./llm";
import type { LlmMessage, LlmContentBlock } from "./llm";
import type { Locale } from "@/i18n";
import type { ThemeId } from "@/lib/themes";

// AI caption for a polaroid: the model looks at the photo (Anna
// llm.complete vision, host >= 1.1.0-beta.169) and writes one poetic line.
// The result fills the caption draft — the user edits it and saves with
// the existing Save button. Nothing is auto-persisted.

export const MAX_CAPTION_CHARS = 20;

const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  fr: "French",
  es: "Spanish",
  zh: "Chinese",
};

const THEME_NAMES: Record<ThemeId, string> = {
  default: "Classic",
  halloween: "Halloween",
  christmas: "Christmas",
  lunar: "Lunar New Year",
};

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
}): Promise<string> {
  const llm = await getLlmService();
  if (!llm.available) {
    throw new LlmUnavailableError();
  }
  const result = await llm.complete({
    messages: buildCaptionMessages(opts),
    maxTokens: 60,
    temperature: 0.9,
  });
  const caption = cleanCaption(result.text);
  if (!caption) {
    throw new Error("AI caption came back empty");
  }
  return caption;
}
