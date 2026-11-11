import { describe, expect, it } from "vitest";
import { karplusStrongSamples } from "@/lib/instruments";

// Karplus-Strong plucked-string samples, ported from the Yu Gong Yi Shan
// score script (compose_v2.py ks_pluck, damp 0.9962). Pure function of
// (freq, damp, sampleRate) — no AudioContext needed.

describe("karplusStrongSamples (Yu Gong ks_pluck port)", () => {
  it("renders 2.5s at the context sample rate", () => {
    const s = karplusStrongSamples(440, 0.9962, 44100);
    expect(s.length).toBe(44100 * 2.5);
  });

  it("is deterministic for the same note", () => {
    const a = karplusStrongSamples(440, 0.9962, 44100);
    const b = karplusStrongSamples(440, 0.9962, 44100);
    expect(a).toEqual(b);
  });

  it("rings then decays: late energy is far below early energy", () => {
    const s = karplusStrongSamples(220, 0.9962, 44100);
    const energy = (from: number, to: number) => {
      let e = 0;
      for (let i = from; i < to; i++) e += s[i] * s[i];
      return e / (to - from);
    };
    const early = energy(0, 4410);
    const late = energy(s.length - 4410, s.length);
    expect(early).toBeGreaterThan(0);
    expect(late).toBeLessThan(early * 0.05);
  });

  it("is peak-normalized", () => {
    const s = karplusStrongSamples(330, 0.9962, 44100);
    let peak = 0;
    for (const v of s) peak = Math.max(peak, Math.abs(v));
    expect(peak).toBeCloseTo(1, 6);
  });

  it("a higher damping rings longer than a lower one", () => {
    const bright = karplusStrongSamples(440, 0.994, 44100);
    const mellow = karplusStrongSamples(440, 0.997, 44100);
    const midEnergy = (s: Float32Array) => {
      let e = 0;
      const from = Math.floor(s.length * 0.4);
      const to = Math.floor(s.length * 0.6);
      for (let i = from; i < to; i++) e += s[i] * s[i];
      return e;
    };
    expect(midEnergy(mellow)).toBeGreaterThan(midEnergy(bright));
  });
});
