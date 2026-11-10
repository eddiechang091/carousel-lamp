import { describe, it, expect, vi, type Mock } from "vitest";
import { createAutoCaptionRunner } from "@/services/otari/auto-caption";
import type { Locale } from "@/i18n";
import type { ThemeId } from "@/lib/themes";

type Generate = (opts: {
  imageDataUrl: string;
  locale: Locale;
  themeId: ThemeId;
}) => Promise<string>;

const baseReq = {
  imageDataUrl: "data:image/jpeg;base64,/9j/AAAA",
  locale: "en" as const,
  themeId: "christmas" as const,
};

function setup(generate: Mock<Generate>) {
  const events: string[] = [];
  const runner = createAutoCaptionRunner({
    generate,
    onStart: (slot) => events.push(`start:${slot}`),
    onCaption: (slot, text) => events.push(`caption:${slot}:${text}`),
    onError: (slot) => events.push(`error:${slot}`),
    onDone: (slot) => events.push(`done:${slot}`),
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

  it("allows a retry after a failure, and a forced retry after success", async () => {
    const generate = vi
      .fn<Generate>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue("Moonlit spin");
    const { runner, events } = setup(generate);
    await runner.request(1, baseReq);
    expect(events).toEqual(["start:1", "error:1", "done:1"]);
    await runner.request(1, baseReq);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(events).toContain("caption:1:Moonlit spin");
    // Success is deduped unless forced.
    await runner.request(1, baseReq);
    expect(generate).toHaveBeenCalledTimes(2);
    await runner.request(1, { ...baseReq, force: true });
    expect(generate).toHaveBeenCalledTimes(3);
  });

  it("passes the photo, locale and theme to the model", async () => {
    const generate = vi.fn<Generate>().mockResolvedValue("Glow");
    const { runner } = setup(generate);
    await runner.request(0, baseReq);
    expect(generate).toHaveBeenCalledWith({
      imageDataUrl: "data:image/jpeg;base64,/9j/AAAA",
      locale: "en",
      themeId: "christmas",
    });
  });
});
