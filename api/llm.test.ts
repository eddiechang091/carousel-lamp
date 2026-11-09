import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import handler from "./llm";

function mockRes() {
  const res = {
    statusCode: 0,
    payload: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.payload = payload;
    },
  };
  return res;
}

const okChoice = (text: string) => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content: text } }] }),
});

const failWith = (status: number) => ({
  ok: false,
  status,
  json: async () => ({ error: { message: "upstream boom" } }),
});

describe("api/llm proxy", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("OTARI_API_KEY", "test-key-otk");
    vi.stubEnv("OTARI_MODEL", "acme/vision-1");
    vi.stubEnv("OTARI_FALLBACK_MODEL", "");
    vi.stubEnv("OTARI_BASE_URL", "");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const messages = [
    {
      role: "user",
      content: [
        { type: "text", text: "Write one poetic caption for this photo." },
        { type: "image", data: "data:image/jpeg;base64,/9j/AAAA" },
      ],
    },
  ];

  it("rejects non-POST methods", async () => {
    const res = mockRes();
    await handler({ method: "GET" }, res);
    expect(res.statusCode).toBe(405);
  });

  it("rejects a missing messages array", async () => {
    const res = mockRes();
    await handler({ method: "POST", body: {} }, res);
    expect(res.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 503 with a clear message when the key is missing", async () => {
    vi.stubEnv("OTARI_API_KEY", "");
    const res = mockRes();
    await handler({ method: "POST", body: { messages } }, res);
    expect(res.statusCode).toBe(503);
    expect(JSON.stringify(res.payload)).toContain("OTARI_API_KEY");
    expect(JSON.stringify(res.payload)).not.toContain("test-key-otk");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 503 with a clear message when the model is missing", async () => {
    vi.stubEnv("OTARI_MODEL", "");
    const res = mockRes();
    await handler({ method: "POST", body: { messages } }, res);
    expect(res.statusCode).toBe(503);
    expect(JSON.stringify(res.payload)).toContain("OTARI_MODEL");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls Otari with image blocks converted to image_url and returns the text", async () => {
    fetchMock.mockResolvedValue(okChoice("Golden hour glow"));
    const res = mockRes();
    await handler(
      { method: "POST", body: { messages, maxTokens: 60, temperature: 0.9 } },
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({ text: "Golden hour glow" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.otari.ai/api/v1/chat/completions");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key-otk");
    const body = JSON.parse(init.body as string) as {
      model: string;
      messages: { content: { type: string; image_url?: { url: string } }[] }[];
    };
    expect(body.model).toBe("acme/vision-1");
    expect(body.messages[0].content[1]).toEqual({
      type: "image_url",
      image_url: { url: "data:image/jpeg;base64,/9j/AAAA" },
    });
    // The key goes to Otari only — never back to the browser.
    expect(JSON.stringify(res.payload)).not.toContain("test-key-otk");
  });

  it("retries once with the fallback model when the primary fails", async () => {
    vi.stubEnv("OTARI_FALLBACK_MODEL", "other/vision-2");
    fetchMock
      .mockResolvedValueOnce(failWith(500))
      .mockResolvedValueOnce(okChoice("Moonlit spin"));
    const res = mockRes();
    await handler({ method: "POST", body: { messages } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({ text: "Moonlit spin" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = JSON.parse(fetchMock.mock.calls[0][1].body as string) as { model: string };
    const second = JSON.parse(fetchMock.mock.calls[1][1].body as string) as { model: string };
    expect(first.model).toBe("acme/vision-1");
    expect(second.model).toBe("other/vision-2");
  });

  it("returns 502 when the primary fails and no fallback is configured", async () => {
    fetchMock.mockResolvedValue(failWith(500));
    const res = mockRes();
    await handler({ method: "POST", body: { messages } }, res);
    expect(res.statusCode).toBe(502);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("maps a 401 to a key error and a 421 to a region error", async () => {
    fetchMock.mockResolvedValue(failWith(401));
    const res401 = mockRes();
    await handler({ method: "POST", body: { messages } }, res401);
    expect(res401.statusCode).toBe(502);
    expect(JSON.stringify(res401.payload)).toContain("OTARI_API_KEY");

    fetchMock.mockResolvedValue(failWith(421));
    const res421 = mockRes();
    await handler({ method: "POST", body: { messages } }, res421);
    expect(res421.statusCode).toBe(502);
    expect(JSON.stringify(res421.payload)).toContain("OTARI_BASE_URL");
  });

  it("honors OTARI_BASE_URL (EU endpoint)", async () => {
    vi.stubEnv("OTARI_BASE_URL", "https://eu.api.otari.ai/api/v1");
    fetchMock.mockResolvedValue(okChoice("hi"));
    const res = mockRes();
    await handler({ method: "POST", body: { messages } }, res);
    expect(res.statusCode).toBe(200);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://eu.api.otari.ai/api/v1/chat/completions");
  });
});
