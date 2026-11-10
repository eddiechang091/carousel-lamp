import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getLlmService } from "@/services/otari/llm";
import { readUsageEntries, clearUsageEntries } from "@/services/otari/usage";

// The proxy client: model choice, usage passthrough, and the
// localStorage recording the dashboard chart reads.
describe("llm client", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    clearUsageEntries();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearUsageEntries();
  });

  it("sends a picked model and returns the usage and model actually used", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        text: "Glow",
        model: "other/vision-2",
        usage: { prompt_tokens: 120, completion_tokens: 8, total_tokens: 128 },
      }),
    });
    const llm = await getLlmService();
    const result = await llm.complete({
      messages: [{ role: "user", content: "hi" }],
      model: "other/vision-2",
    });
    expect(result.text).toBe("Glow");
    expect(result.model).toBe("other/vision-2");
    expect(result.usage).toEqual({
      prompt_tokens: 120,
      completion_tokens: 8,
      total_tokens: 128,
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      model?: string;
    };
    expect(body.model).toBe("other/vision-2");
  });

  it("records each successful call's usage in localStorage for the chart", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        text: "Glow",
        model: "acme/vision-1",
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    });
    const llm = await getLlmService();
    await llm.complete({ messages: [{ role: "user", content: "hi" }] });
    await llm.complete({ messages: [{ role: "user", content: "hi" }] });
    const entries = readUsageEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      t: expect.any(Number),
      model: "acme/vision-1",
      tokens: 15,
    });
  });

  it("records nothing when the proxy reports no usage", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ text: "Glow" }),
    });
    const llm = await getLlmService();
    const result = await llm.complete({ messages: [{ role: "user", content: "hi" }] });
    expect(result.usage).toBeNull();
    expect(readUsageEntries()).toEqual([]);
  });
});
