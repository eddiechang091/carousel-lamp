import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MusicBoxAudio } from "@/lib/music-box";

// Mock Web Audio: jsdom has no AudioContext. The mock records resume()
// calls and oscillator frequencies so the autoplay fix and the scheduler
// can be tested without real audio.

class MockOscillator {
  type = "";
  frequency = { value: 0 };
  onended: (() => void) | null = null;
  connect = vi.fn().mockReturnThis();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class MockGain {
  gain = {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  connect = vi.fn().mockReturnThis();
  disconnect = vi.fn();
}

class MockAudioContext {
  static instances: MockAudioContext[] = [];
  currentTime = 100;
  state: "suspended" | "running" = "suspended";
  destination = {};
  resume = vi.fn(() => {
    this.state = "running";
    return Promise.resolve();
  });
  close = vi.fn(() => Promise.resolve());
  createGain = vi.fn(() => new MockGain());
  createOscillator = vi.fn(() => new MockOscillator());
  constructor() {
    MockAudioContext.instances.push(this);
  }
}

describe("MusicBoxAudio autoplay", () => {
  beforeEach(() => {
    MockAudioContext.instances = [];
    vi.stubGlobal("AudioContext", MockAudioContext);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("start() resumes a suspended context", () => {
    const box = new MusicBoxAudio();
    box.start();
    const ctx = MockAudioContext.instances[0];
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(ctx.state).toBe("running");
    box.stop();
  });

  it("a second start() (first-gesture path) resumes again — autoplay bug", () => {
    // Regression test for the mute→unmute bug: the first start() on page
    // load leaves the context suspended (autoplay policy rejects resume),
    // and the begin handler's start() must get another chance to resume.
    const box = new MusicBoxAudio();
    box.start();
    const ctx = MockAudioContext.instances[0];
    // Simulate the browser rejecting the load-time resume: back to suspended.
    ctx.state = "suspended";
    box.start();
    expect(ctx.resume).toHaveBeenCalledTimes(2);
    box.stop();
  });

  it("stop() then start() resumes again", () => {
    const box = new MusicBoxAudio();
    box.start();
    box.stop();
    box.start();
    expect(MockAudioContext.instances[0].resume).toHaveBeenCalledTimes(2);
    box.stop();
  });

  it("start() never throws when audio is unavailable", () => {
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          throw new Error("no audio device");
        }
      },
    );
    const box = new MusicBoxAudio();
    expect(() => box.start()).not.toThrow();
    expect(() => box.start()).not.toThrow();
    expect(() => box.stop()).not.toThrow();
  });

  it("scheduler plays the default (Greensleeves) melody notes", () => {
    const box = new MusicBoxAudio();
    box.start();
    const ctx = MockAudioContext.instances[0];
    // Advance the clock so the scheduler fires and currentTime moves past
    // the scheduled notes.
    ctx.currentTime = 100.6;
    vi.advanceTimersByTime(100);
    const oscillators = ctx.createOscillator.mock.results.map(
      (r) => r.value as MockOscillator,
    );
    expect(oscillators.length).toBeGreaterThan(0);
    // First melody note is A4 (440 Hz); partials follow at 2x / 2.76x.
    expect(oscillators[0].frequency.value).toBeCloseTo(440, 1);
    expect(oscillators[1].frequency.value).toBeCloseTo(880, 1);
    box.stop();
  });

  it("setTheme switches the active melody mid-play", () => {
    const box = new MusicBoxAudio();
    box.start();
    const ctx = MockAudioContext.instances[0];
    ctx.currentTime = 100.6;
    vi.advanceTimersByTime(100);
    const played = ctx.createOscillator.mock.results.length;
    expect(played).toBeGreaterThan(0);
    box.setTheme("christmas");
    ctx.currentTime = 101.5;
    vi.advanceTimersByTime(100);
    const freqs = ctx.createOscillator.mock.results
      .slice(played)
      .map((r) => (r.value as MockOscillator).frequency.value);
    expect(freqs.length).toBeGreaterThan(0);
    // First Christmas note is E4 (329.63 Hz) — the Jingle Bells opening.
    expect(freqs[0]).toBeCloseTo(329.63, 1);
    box.stop();
  });

  it("setTheme before start applies on the next start", () => {
    const box = new MusicBoxAudio();
    box.setTheme("christmas");
    box.start();
    const ctx = MockAudioContext.instances[0];
    ctx.currentTime = 100.6;
    vi.advanceTimersByTime(100);
    const oscillators = ctx.createOscillator.mock.results.map(
      (r) => r.value as MockOscillator,
    );
    expect(oscillators.length).toBeGreaterThan(0);
    expect(oscillators[0].frequency.value).toBeCloseTo(329.63, 1);
    box.stop();
  });
});
