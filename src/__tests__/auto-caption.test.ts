import { describe, it, expect, vi, type Mock } from "vitest";
import { createAutoCaptionRunner } from "@/services/otari/auto-caption";
import type { Locale } from "@/i18n";

type Generate = (opts: {
  imageDataUrl: string;
  locale: Locale;
}) => Promise<string>;

const baseReq = {
  imageDataUrl: "data:image/jpeg;base64,/9j/AAAA",
  locale: "en" as const,
};

function setup(generate: Mock<Generate>) {
  const events: string[] = [];
  const runner = createAutoCaptionRunner({
    generate,
    onStart: (slot) => events.push(`start:${slot}`),
    onCaption: (slot, text) => events.push(`caption:${slot}:${text}`),
    onError: (slot) => events.push(`error:${slot}`),
    onDone: (slot) => events.push(`done:${slot}`),
    retryDelayMs: 0,
  });
  return { runner, events };
}

describe("auto-caption runner", () => {
  it("skips an empty preview and never calls the model", async () => {
    const generate = vi.fn<Generate>().mockResolvedValue("Glow");
    const { runner, events } = setup(generate);
    await runner.request(0, { ...baseReq, imageDataUrl: "" });
    expect(generate).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it("skips a photo that already has a saved caption", async () => {
    const generate = vi.fn<Generate>().mockResolvedValue("Glow");
    const { runner } = setup(generate);
    await runner.request(0, { ...baseReq, hasCaption: true });
    expect(generate).not.toHaveBeenCalled();
  });

  it("calls the model once per slot and dedupes a second request", async () => {
    const generate = vi.fn<Generate>().mockResolvedValue("Golden hour glow");
    const { runner, events } = setup(generate);
    await runner.request(2, baseReq);
    await runner.request(2, baseReq);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(events).toEqual(["start:2", "caption:2:Golden hour glow", "done:2"]);
  });

  it("retries once automatically after a failure, then succeeds", async () => {
    const generate = vi
      .fn<Generate>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue("Moonlit spin");
    const { runner, events } = setup(generate);
    await runner.request(1, baseReq);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(events).toEqual(["start:1", "start:1", "caption:1:Moonlit spin", "done:1"]);
    // Success is deduped unless forced.
    await runner.request(1, baseReq);
    expect(generate).toHaveBeenCalledTimes(2);
    await runner.request(1, { ...baseReq, force: true });
    expect(generate).toHaveBeenCalledTimes(3);
  });

  it("reports the error once when the retry fails too", async () => {
    const generate = vi.fn<Generate>().mockRejectedValue(new Error("boom"));
    const { runner, events } = setup(generate);
    await runner.request(1, baseReq);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(events).toEqual(["start:1", "start:1", "error:1", "done:1"]);
    // A failed slot can be retried by hand afterwards.
    await runner.request(1, baseReq);
    expect(generate).toHaveBeenCalledTimes(4);
  });

  it("passes the photo and locale to the model — no theme", async () => {
    const generate = vi.fn<Generate>().mockResolvedValue("Glow");
    const { runner } = setup(generate);
    await runner.request(0, baseReq);
    expect(generate).toHaveBeenCalledWith({
      imageDataUrl: "data:image/jpeg;base64,/9j/AAAA",
      locale: "en",
    });
  });
});
