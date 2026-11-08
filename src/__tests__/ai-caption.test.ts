import { describe, expect, it } from "vitest";
import {
  buildCaptionMessages,
  cleanCaption,
  MAX_CAPTION_CHARS,
} from "@/services/anna/caption";
import {
  getLlmService,
  isVisionNotCapableError,
  LlmVisionNotCapableError,
} from "@/services/anna/llm";

describe("ai caption", () => {
  it("caps at 20 characters", () => {
    expect(MAX_CAPTION_CHARS).toBe(20);
    expect(cleanCaption("a".repeat(30))).toHaveLength(20);
    expect(cleanCaption("金色黄昏里我们笑得像孩子一样追着风跑过整个夏天")).toHaveLength(20);
  });

  it("strips wrapping quotes and collapses whitespace", () => {
    expect(cleanCaption('  "Golden hour glow"  ')).toBe("Golden hour glow");
    expect(cleanCaption("“海边\n日落”")).toBe("海边 日落");
    expect(cleanCaption("")).toBe("");
  });

  it("sends the photo to the model as an image block in the user message", () => {
    const dataUrl = "data:image/jpeg;base64,/9j/AAAA";
    const messages = buildCaptionMessages({
      imageDataUrl: dataUrl,
      locale: "zh",
      themeId: "christmas",
    });
    expect(messages).toHaveLength(2);
    const [system, user] = messages;
    expect(system.role).toBe("system");
    expect(typeof system.content).toBe("string");
    expect(system.content as string).toContain("Chinese");
    expect(system.content as string).toContain("20");
    expect(user.role).toBe("user");
    expect(Array.isArray(user.content)).toBe(true);
    const blocks = user.content as Array<{ type: string; [key: string]: unknown }>;
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("text");
    expect(String(blocks[0].text)).toContain("Christmas");
    expect(blocks[1]).toEqual({ type: "image", data: dataUrl });
  });

  it("detects the vision-not-capable fail-fast error", () => {
    const err = new Error("host rejected call") as Error & { code?: string };
    err.code = "APP_MODEL_NOT_VISION_CAPABLE";
    expect(isVisionNotCapableError(err)).toBe(true);
    expect(isVisionNotCapableError(new LlmVisionNotCapableError())).toBe(true);
    expect(isVisionNotCapableError(new Error("boom"))).toBe(false);
    expect(isVisionNotCapableError(null)).toBe(false);
  });

  it("is unavailable outside the Anna host, even with image content", async () => {
    const llm = await getLlmService();
    expect(llm.available).toBe(false);
    await expect(
      llm.complete({
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Caption this" },
              { type: "image", data: "data:image/jpeg;base64,AAAA" },
            ],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(Error);
  });
});
