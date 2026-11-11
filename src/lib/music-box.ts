// Retro music-box background melody, synthesised entirely with the Web Audio
// API so no external audio files need to be loaded. Each festival theme has
// its own tune (see theme-music.ts — Greensleeves for the classic lamp,
// Jingle Bells for Christmas, and so on), rendered with a bright, ringing
// tine timbre.
import { THEME_MUSIC, midiToFreq } from "./theme-music";
import type { ThemeId } from "./themes";

export class MusicBoxAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: number | null = null;
  private nextNoteTime = 0;
  private noteIndex = 0;
  private theme: ThemeId = "default";
  private bassByIndex = new Map<number, number>(THEME_MUSIC.default.bass);

  private get def() {
    return THEME_MUSIC[this.theme];
  }

  /** Switch tune when the carousel theme changes; restarts the loop cleanly. */
  setTheme(themeId: ThemeId) {
    if (themeId === this.theme) return;
    this.theme = themeId;
    this.bassByIndex = new Map<number, number>(THEME_MUSIC[themeId].bass);
    this.noteIndex = 0;
    if (this.timer !== null && this.context) {
      this.nextNoteTime = this.context.currentTime + 0.1;
    }
  }

  private ensureContext() {
    this.context ??= new AudioContext();
    if (!this.master) {
      this.master = this.context.createGain();
      this.master.gain.value = 0.13;
      this.master.connect(this.context.destination);
    }
  }

  start() {
    try {
      this.ensureContext();
      const a = this.context!;
      // Resume FIRST, before the already-playing guard: on page load the
      // fresh context is suspended (browser autoplay policy) and that first
      // resume() is rejected. A later start() — e.g. from the first
      // pointer/key gesture — must get another chance to resume, so this
      // runs even while the scheduler interval is already ticking.
      void a.resume();
      if (this.timer !== null) return; // already playing
      this.noteIndex = 0;
      this.nextNoteTime = a.currentTime + 0.1;
      this.timer = window.setInterval(() => this.schedule(), 25);
    } catch {
      /* Background music is a nice-to-have; ignore when audio is unavailable. */
    }
  }

  stop() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private schedule() {
    const a = this.context;
    if (!a || this.timer === null) return;
    const { melody, beat } = this.def;
    while (this.nextNoteTime < a.currentTime + 0.12) {
      const [note, beats] = melody[this.noteIndex];
      this.playTone(midiToFreq(note), this.nextNoteTime, 1.7, 0.5);
      const bass = this.bassByIndex.get(this.noteIndex);
      if (bass !== undefined) this.playTone(midiToFreq(bass), this.nextNoteTime, 2.4, 0.22);
      this.nextNoteTime += beats * beat;
      this.noteIndex = (this.noteIndex + 1) % melody.length;
    }
  }

  private playTone(frequency: number, time: number, decay: number, peak: number) {
    const a = this.context!;
    // A music-box tine rings with a fundamental plus a couple of bright partials.
    const partials: [number, number][] = [
      [1, 1],
      [2, 0.35],
      [2.76, 0.14],
    ];
    for (const [ratio, weight] of partials) {
      const osc = a.createOscillator();
      const gain = a.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency * ratio;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(peak * weight, time + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
      osc.connect(gain).connect(this.master!);
      osc.start(time);
      osc.stop(time + decay + 0.05);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    }
  }

  dispose() {
    this.stop();
    void this.context?.close();
    this.context = null;
    this.master = null;
  }
}
