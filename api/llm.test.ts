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

const okChoice = (
  text: string,
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null = {
    prompt_tokens: 10,
    completion_tokens: 5,
    total_tokens: 15,
  },
  model = "acme/vision-1",
) => ({
  ok: true,
  status: 200,
  json: async () => ({
    choices: [{ message: { content: text } }],
    usage,
    model,
  }),
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
    vi.stubEnv("OTARI_MODELS", "");
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

  it("rejects non-GET/POST methods", async () => {
    const res = mockRes();
    await handler({ method: "DELETE" }, res);
    expect(res.statusCode).toBe(405);
  });

  it("GET returns the allowed models from OTARI_MODELS", async () => {
    vi.stubEnv("OTARI_MODELS", "acme/vision-1, other/vision-2 , acme/vision-1");
    const res = mockRes();
    await handler({ method: "GET" }, res);
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({ models: ["acme/vision-1", "other/vision-2"] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("GET falls back to OTARI_MODEL + OTARI_FALLBACK_MODEL, and to [] when unset", async () => {
    vi.stubEnv("OTARI_FALLBACK_MODEL", "other/vision-2");
    const res = mockRes();
    await handler({ method: "GET" }, res);
    expect(res.payload).toEqual({ models: ["acme/vision-1", "other/vision-2"] });

    vi.stubEnv("OTARI_MODEL", "");
    vi.stubEnv("OTARI_FALLBACK_MODEL", "");
    const resEmpty = mockRes();
    await handler({ method: "GET" }, resEmpty);
    expect(resEmpty.payload).toEqual({ models: [] });
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
    expect(res.payload).toEqual({
      text: "Golden hour glow",
      model: "acme/vision-1",
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      searched: false,
    });
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
      .mockResolvedValueOnce(okChoice("Moonlit spin", undefined, "other/vision-2"));
    const res = mockRes();
    await handler({ method: "POST", body: { messages } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({
      text: "Moonlit spin",
      model: "other/vision-2",
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      searched: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = JSON.parse(fetchMock.mock.calls[0][1].body as string) as { model: string };
    const second = JSON.parse(fetchMock.mock.calls[1][1].body as string) as { model: string };
    expect(first.model).toBe("acme/vision-1");
    expect(second.model).toBe("other/vision-2");
  });

  it("walks the whole OTARI_MODELS chain until one model answers", async () => {
    vi.stubEnv("OTARI_MODELS", "a/one, b/two, c/three");
    fetchMock
      .mockResolvedValueOnce(failWith(500))
      .mockResolvedValueOnce(failWith(503))
      .mockResolvedValueOnce(okChoice("Third time", undefined, "c/three"));
    const res = mockRes();
    await handler({ method: "POST", body: { messages } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({
      text: "Third time",
      model: "c/three",
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      searched: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const models = fetchMock.mock.calls.map(
      (c) => JSON.parse(c[1].body as string) as { model: string },
    ).map((b) => b.model);
    expect(models).toEqual(["a/one", "b/two", "c/three"]);
  });

  it("returns 502 when every model in the chain fails", async () => {
    vi.stubEnv("OTARI_MODELS", "a/one, b/two, c/three");
    fetchMock.mockResolvedValue(failWith(500));
    const res = mockRes();
    await handler({ method: "POST", body: { messages } }, res);
    expect(res.statusCode).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(3);
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

  it("rejects a model outside the allowlist with 400 and never calls Otari", async () => {
    const res = mockRes();
    await handler(
      { method: "POST", body: { messages, model: "evil/not-listed" } },
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(JSON.stringify(res.payload)).toContain("Unknown model");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("an explicitly picked model falls through to the rest of the chain when it fails", async () => {
    vi.stubEnv("OTARI_FALLBACK_MODEL", "other/vision-2");
    fetchMock
      .mockResolvedValueOnce(failWith(500))
      .mockResolvedValueOnce(okChoice("Primary covered", undefined, "acme/vision-1"));
    const res = mockRes();
    await handler(
      { method: "POST", body: { messages, model: "other/vision-2" } },
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({
      text: "Primary covered",
      model: "acme/vision-1",
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      searched: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const models = fetchMock.mock.calls.map(
      (c) => JSON.parse(c[1].body as string) as { model: string },
    ).map((b) => b.model);
    expect(models).toEqual(["other/vision-2", "acme/vision-1"]);
  });

  it("returns usage null when the upstream response carries none", async () => {
    fetchMock.mockResolvedValue(okChoice("hi", null));
    const res = mockRes();
    await handler({ method: "POST", body: { messages } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({ text: "hi", model: "acme/vision-1", usage: null, searched: false });
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

  it("search: true sends otari_web_search and reports searched: true", async () => {
    fetchMock.mockResolvedValue(okChoice("Fresh facts"));
    const res = mockRes();
    await handler({ method: "POST", body: { messages, search: true } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({
      text: "Fresh facts",
      model: "acme/vision-1",
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      searched: true,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      tools?: { type: string }[];
    };
    expect(body.tools).toEqual([{ type: "otari_web_search" }]);
  });

  it("search defaults off — no tools field is sent without search: true", async () => {
    fetchMock.mockResolvedValue(okChoice("hi"));
    const res = mockRes();
    await handler({ method: "POST", body: { messages, search: "yes" } }, res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      tools?: unknown;
    };
    expect(body.tools).toBeUndefined();
    expect(res.payload).toEqual({
      text: "hi",
      model: "acme/vision-1",
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      searched: false,
    });
  });

  it("retries the same model without the tool when the search call fails", async () => {
    fetchMock
      .mockResolvedValueOnce(failWith(400))
      .mockResolvedValueOnce(okChoice("Model knowledge only"));
    const res = mockRes();
    await handler({ method: "POST", body: { messages, search: true } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({
      text: "Model knowledge only",
      model: "acme/vision-1",
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      searched: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      tools?: { type: string }[];
    };
    const second = JSON.parse(fetchMock.mock.calls[1][1].body as string) as {
      model: string;
      tools?: unknown;
    };
    expect(first.tools).toEqual([{ type: "otari_web_search" }]);
    expect(second.model).toBe("acme/vision-1");
    expect(second.tools).toBeUndefined();
  });

  it("search failure falls through to the fallback model without tools", async () => {
    vi.stubEnv("OTARI_FALLBACK_MODEL", "other/vision-2");
    fetchMock
      .mockResolvedValueOnce(failWith(400))
      .mockResolvedValueOnce(failWith(500))
      .mockResolvedValueOnce(okChoice("Fallback facts", undefined, "other/vision-2"));
    const res = mockRes();
    await handler({ method: "POST", body: { messages, search: true } }, res);
    expect(res.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const third = JSON.parse(fetchMock.mock.calls[2][1].body as string) as {
      model: string;
      tools?: unknown;
    };
    expect(third.model).toBe("other/vision-2");
    expect(third.tools).toBeUndefined();
    expect(res.payload).toEqual({
      text: "Fallback facts",
      model: "other/vision-2",
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      searched: false,
    });
  });
});
