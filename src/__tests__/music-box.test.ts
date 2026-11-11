import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MusicBoxAudio } from "@/lib/music-box";

// Mock Web Audio: jsdom has no AudioContext. The mock records resume()
// calls and oscillator frequencies so the autoplay fix and the scheduler
// can be tested without real audio.

class MockOscillator {
  type = "";
  frequency = {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
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

class MockAudioBuffer {
  duration: number;
  private channel: Float32Array;
  constructor(
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.duration = length / sampleRate;
    this.channel = new Float32Array(length);
  }
  getChannelData = vi.fn(() => this.channel);
}

class MockBufferSource {
  buffer: AudioBuffer | null = null;
  loop = false;
  onended: (() => void) | null = null;
  connect = vi.fn().mockReturnThis();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class MockBiquadFilter {
  type = "";
  frequency = { value: 0 };
  Q = { value: 0 };
  connect = vi.fn().mockReturnThis();
  disconnect = vi.fn();
}

class MockAudioContext {
  static instances: MockAudioContext[] = [];
  currentTime = 100;
  sampleRate = 44100;
  state: "suspended" | "running" = "suspended";
  destination = {};
  resume = vi.fn(() => {
    this.state = "running";
    return Promise.resolve();
  });
  close = vi.fn(() => Promise.resolve());
  createGain = vi.fn(() => new MockGain());
  createOscillator = vi.fn(() => new MockOscillator());
  createBuffer = vi.fn(
    (_ch: number, length: number, sampleRate: number) =>
      new MockAudioBuffer(length, sampleRate),
  );
  createBufferSource = vi.fn(() => new MockBufferSource());
  createBiquadFilter = vi.fn(() => new MockBiquadFilter());
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

  it("scheduler skips missed notes instead of bursting after a long stall", () => {
    const box = new MusicBoxAudio();
    box.start();
    const ctx = MockAudioContext.instances[0];
    // Simulate a background tab / starved main thread: 5s pass with no
    // scheduler tick. Without the catch-up snap this would schedule ~12
    // Greensleeves notes (36 oscillators) at once as a chord.
    ctx.currentTime = 105;
    vi.advanceTimersByTime(100);
    const oscillators = ctx.createOscillator.mock.results.map(
      (r) => r.value as MockOscillator,
    );
    expect(oscillators.length).toBeLessThan(12);
    expect(oscillators.length).toBeGreaterThan(0);
    box.stop();
  });

  it("setTheme to spring-festival (suona reed) creates sawtooth oscillators", () => {
    const box = new MusicBoxAudio();
    box.start();
    const ctx = MockAudioContext.instances[0];
    box.setTheme("spring-festival");
    ctx.currentTime = 100.6;
    vi.advanceTimersByTime(100);
    const oscillators = ctx.createOscillator.mock.results.map(
      (r) => r.value as MockOscillator,
    );
    expect(oscillators.some((o) => o.type === "sawtooth")).toBe(true);
    box.stop();
  });

  it("setTheme to mid-autumn (dizi + guzheng) creates buffer sources", () => {
    const box = new MusicBoxAudio();
    box.start();
    const ctx = MockAudioContext.instances[0];
    box.setTheme("mid-autumn");
    ctx.currentTime = 100.6;
    vi.advanceTimersByTime(100);
    // Flute breath noise + Karplus-Strong plucked bass both use buffers.
    expect(ctx.createBufferSource.mock.calls.length).toBeGreaterThan(0);
    expect(ctx.createBuffer.mock.calls.length).toBeGreaterThan(0);
    box.stop();
  });

  it("percussion pattern keeps its phase after a stall (shaker still lands)", () => {
    const box = new MusicBoxAudio();
    box.start();
    const ctx = MockAudioContext.instances[0];
    box.setTheme("spring-festival");
    // Spring Festival step is 0.21s (beat 0.42 / 2). A 3.9s stall skips
    // floor(3.9 / 0.21) = 18 steps; step 18 % 16 = 2 is a shaker, which is
    // the only drum kind that creates a buffer source — the reed melody
    // and bass use oscillators, so any buffer here is the shaker.
    ctx.currentTime = 104;
    vi.advanceTimersByTime(100);
    expect(ctx.createBufferSource.mock.calls.length).toBeGreaterThan(0);
    box.stop();
  });

  it("setTheme to carnival schedules drum hits on the percussion clock", () => {
    const box = new MusicBoxAudio();
    box.start();
    const ctx = MockAudioContext.instances[0];
    box.setTheme("carnival");
    ctx.currentTime = 100.6;
    vi.advanceTimersByTime(100);
    // Samba shaker uses a noise buffer source; kick/drum use pitch-dropping
    // sine oscillators (frequency ramp calls).
    const sources = ctx.createBufferSource.mock.calls.length;
    const ramps = ctx.createOscillator.mock.results.filter((r) =>
      (r.value as MockOscillator).frequency.exponentialRampToValueAtTime.mock.calls.length > 0,
    ).length;
    expect(sources + ramps).toBeGreaterThan(0);
    box.stop();
  });

  it("setTheme to st-patrick (fiddle) glides between notes", () => {
    const box = new MusicBoxAudio();
    box.start();
    const ctx = MockAudioContext.instances[0];
    box.setTheme("st-patrick");
    // Advance the clock in small steps so consecutive notes schedule with
    // the previous note's frequency as the glide source.
    for (let i = 0; i < 6; i++) {
      ctx.currentTime += 0.3;
      vi.advanceTimersByTime(100);
    }
    const oscillators = ctx.createOscillator.mock.results.map(
      (r) => r.value as MockOscillator,
    );
    expect(oscillators.length).toBeGreaterThan(0);
    // Bowed voice glides from the previous note (setValueAtTime + ramp).
    expect(
      oscillators.some(
        (o) =>
          o.frequency.setValueAtTime.mock.calls.length > 0 &&
          o.frequency.exponentialRampToValueAtTime.mock.calls.length > 0,
      ),
    ).toBe(true);
    box.stop();
  });
});
