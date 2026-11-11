import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  buildCaptionMessages,
  cleanCaption,
  generateAiCaption,
  MAX_CAPTION_CHARS,
} from "@/services/otari/caption";
import { getLlmService, LlmUnavailableError } from "@/services/otari/llm";

describe("ai caption", () => {
  it("caps at 40 characters — the same cap as the caption input", () => {
    expect(MAX_CAPTION_CHARS).toBe(40);
    expect(cleanCaption("a".repeat(50))).toHaveLength(40);
    expect(cleanCaption("金".repeat(50))).toHaveLength(40);
  });

  it("strips wrapping quotes and collapses whitespace", () => {
    expect(cleanCaption('  "Golden hour glow"  ')).toBe("Golden hour glow");
    expect(cleanCaption("“海边\n日落”")).toBe("海边 日落");
    expect(cleanCaption("")).toBe("");
  });

  it("cuts an over-long caption at a word boundary, never mid-word", () => {
    expect(cleanCaption("Golden diamonds bloom above painted flowers.")).toBe(
      "Golden diamonds bloom above painted",
    );
    // CJK has no spaces: cut after a whole character, still capped.
    expect(cleanCaption("金".repeat(50))).toHaveLength(40);
  });

  it("sends the photo to the model as an image block in the user message", () => {
    const dataUrl = "data:image/jpeg;base64,/9j/AAAA";
    const messages = buildCaptionMessages({
      imageDataUrl: dataUrl,
      locale: "zh",
    });
    expect(messages).toHaveLength(2);
    const [system, user] = messages;
    expect(system.role).toBe("system");
    expect(typeof system.content).toBe("string");
    expect(system.content as string).toContain("Chinese");
    expect(system.content as string).toContain("30");
    expect(user.role).toBe("user");
    expect(Array.isArray(user.content)).toBe(true);
    const blocks = user.content as Array<{ type: string; [key: string]: unknown }>;
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("text");
    expect(String(blocks[0].text)).toContain("photo itself");
    expect(blocks[1]).toEqual({ type: "image", data: dataUrl });
  });

  it("never mentions a theme in the prompt — the caption is about the photo only", () => {
    for (const theme of ["Christmas", "Halloween", "Spring Festival", "Carnival", "Easter"]) {
      const messages = buildCaptionMessages({
        imageDataUrl: "data:image/jpeg;base64,/9j/AAAA",
        locale: "en",
      });
      const allText = JSON.stringify(messages);
      expect(allText).not.toContain(theme);
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
        }),
      ).rejects.toThrowError("empty");
    });
  });
});
