import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchAllowedModels,
  readSelectedModel,
  saveSelectedModel,
} from "@/services/otari/models";

describe("model allowlist", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("GETs the model list from the proxy", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        models: ["deepseek/deepseek-v4.1-flash-1017", "moonshotai/kimi-k3.1-pro"],
      }),
    });
    await expect(fetchAllowedModels()).resolves.toEqual([
      "deepseek/deepseek-v4.1-flash-1017",
      "moonshotai/kimi-k3.1-pro",
    ]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/llm");
    expect(init.method).toBe("GET");
  });

  it("returns [] on a bad response, a foreign payload or a network failure", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    await expect(fetchAllowedModels()).resolves.toEqual([]);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ models: "not-an-array" }),
    });
    await expect(fetchAllowedModels()).resolves.toEqual([]);
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(fetchAllowedModels()).resolves.toEqual([]);
  });

  it("persists the picked model, and null clears it (server default)", () => {
    expect(readSelectedModel()).toBeNull();
    saveSelectedModel("moonshotai/kimi-k3.1-pro");
    expect(readSelectedModel()).toBe("moonshotai/kimi-k3.1-pro");
    saveSelectedModel(null);
    expect(readSelectedModel()).toBeNull();
  });
});
