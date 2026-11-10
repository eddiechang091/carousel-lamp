import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildFestivalMessages,
  cleanFacts,
  askFestivalFacts,
  nudgeAllowed,
  MAX_FACTS_CHARS,
  NUDGE_INTERVAL_MS,
  MAX_NUDGES_PER_SESSION,
} from "@/services/otari/festival";

describe("festival facts prompt", () => {
  it("names the current festival and the language", () => {
    const messages = buildFestivalMessages({ themeId: "dragon-boat", locale: "en" });
    expect(messages).toHaveLength(2);
    expect(messages[0].content as string).toContain("Dragon Boat Festival");
    expect(messages[0].content as string).toContain("English");
    expect(messages[1].content).toContain("Dragon Boat Festival");
  });

  it("asks about carousel lamps for the Classic theme", () => {
    const messages = buildFestivalMessages({ themeId: "default", locale: "zh" });
    expect(messages[0].content as string).toContain("carousel lamps");
    expect(messages[0].content as string).toContain("Chinese");
  });

  it("is text-only — no image blocks", () => {
    const messages = buildFestivalMessages({ themeId: "christmas", locale: "en" });
    for (const message of messages) {
      expect(typeof message.content).toBe("string");
    }
  });
});

describe("cleanFacts", () => {
  it("collapses whitespace and caps at the bubble size", () => {
    expect(cleanFacts("  Hello\n  world  ")).toBe("Hello world");
    const long = cleanFacts("x".repeat(MAX_FACTS_CHARS + 100));
    expect(long.length).toBeLessThanOrEqual(MAX_FACTS_CHARS);
    expect(long.endsWith("…")).toBe(true);
  });
});

describe("nudgeAllowed", () => {
  it("allows the first nudge, caps at 3 per session, and spaces them 180s apart", () => {
    expect(nudgeAllowed(0, null, 0)).toBe(true);
    expect(nudgeAllowed(1, 1_000, 1_000 + NUDGE_INTERVAL_MS - 1)).toBe(false);
    expect(nudgeAllowed(1, 1_000, 1_000 + NUDGE_INTERVAL_MS)).toBe(true);
    expect(nudgeAllowed(MAX_NUDGES_PER_SESSION, null, 0)).toBe(false);
  });
});

describe("askFestivalFacts", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts text-only messages and returns the cleaned facts", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ text: "  Dragon Boat Festival honours Qu Yuan.  " }),
    });
    const facts = await askFestivalFacts({
      themeId: "dragon-boat",
      locale: "en",
      model: "other/vision-2",
    });
    expect(facts).toBe("Dragon Boat Festival honours Qu Yuan.");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      messages: { content: unknown }[];
      model?: string;
    };
    expect(body.messages).toHaveLength(2);
    expect(body.model).toBe("other/vision-2");
    for (const message of body.messages) {
      expect(typeof message.content).toBe("string");
    }
  });

  it("throws when the proxy returns empty facts", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ text: "   " }),
    });
    await expect(
      askFestivalFacts({ themeId: "christmas", locale: "en" }),
    ).rejects.toThrowError("empty");
  });
});
