import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  buildCaptionMessages,
  cleanCaption,
  generateAiCaption,
  MAX_CAPTION_CHARS,
} from "@/services/otari/caption";
import { getLlmService, LlmUnavailableError } from "@/services/otari/llm";

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

  it("names every festival theme in the prompt, not just the classic four", () => {
    const expected: Record<string, string> = {
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
    for (const [themeId, name] of Object.entries(expected)) {
      const messages = buildCaptionMessages({
        imageDataUrl: "data:image/jpeg;base64,/9j/AAAA",
        locale: "en",
        themeId: themeId as Parameters<typeof buildCaptionMessages>[0]["themeId"],
      });
      const user = messages[1];
      const blocks = user.content as Array<{ type: string; text?: string }>;
      expect(String(blocks[0].text)).toContain(name);
    }
  });

  describe("otari proxy client", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
      fetchMock.mockReset();
      vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("posts the messages to /api/llm and returns the cleaned caption", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ text: '  "Golden hour glow"  ' }),
      });
      const caption = await generateAiCaption({
        imageDataUrl: "data:image/jpeg;base64,/9j/AAAA",
        locale: "en",
        themeId: "default",
      });
      expect(caption).toBe("Golden hour glow");
      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/api/llm");
      expect(init.method).toBe("POST");
      const body = JSON.parse(init.body as string) as { messages: unknown[] };
      expect(body.messages).toHaveLength(2);
      expect(JSON.stringify(body)).not.toContain("OTARI_API_KEY");
    });

    it("sends a picked model to the proxy when one is given", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ text: "Glow" }),
      });
      const caption = await generateAiCaption({
        imageDataUrl: "data:image/jpeg;base64,/9j/AAAA",
        locale: "en",
        themeId: "default",
        model: "other/vision-2",
      });
      expect(caption).toBe("Glow");
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
        model?: string;
      };
      expect(body.model).toBe("other/vision-2");
    });

    it("throws LlmUnavailableError with the proxy message on a 503", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: "AI captions are not configured yet" }),
      });
      const llm = await getLlmService();
      expect(llm.available).toBe(true);
      await expect(
        llm.complete({ messages: [{ role: "user", content: "hi" }] }),
      ).rejects.toThrowError(LlmUnavailableError);
      await expect(
        llm.complete({ messages: [{ role: "user", content: "hi" }] }),
      ).rejects.toThrowError("not configured yet");
    });

    it("throws LlmUnavailableError on a network failure", async () => {
      fetchMock.mockRejectedValue(new TypeError("fetch failed"));
      const llm = await getLlmService();
      await expect(
        llm.complete({ messages: [{ role: "user", content: "hi" }] }),
      ).rejects.toBeInstanceOf(LlmUnavailableError);
    });

    it("throws when the proxy returns an empty caption", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ text: "   " }),
      });
      await expect(
        generateAiCaption({
          imageDataUrl: "data:image/jpeg;base64,/9j/AAAA",
          locale: "en",
          themeId: "default",
        }),
      ).rejects.toThrowError("empty");
    });
  });
});
