// Background melody for the carousel lamp, synthesised entirely with the
// Web Audio API so no external audio files need to be loaded. Each festival
// theme has its own tune (see theme-music.ts) played in its own instrument
// voice (see instruments.ts): suona + festive drums for Spring Festival,
// guzheng plucks + dizi flute for Mid-Autumn, piano for Christmas and New
// Year, fiddle for St. Patrick's, samba drums for Carnival — and the
// original music-box tine for the classic lamp.

import { InstrumentVoices } from "./instruments";
import { midiToFreq, THEME_MUSIC } from "./theme-music";
import type { ThemeId } from "./themes";

export class MusicBoxAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices: InstrumentVoices | null = null;
  private timer: number | null = null;
  private nextNoteTime = 0;
  private noteIndex = 0;
  private prevMelodyFreq: number | undefined = undefined;
  private theme: ThemeId = "default";
  private bassByIndex = new Map<number, number>(THEME_MUSIC.default.bass);
  // Drum pattern clock: 16 eighth-note steps over two bars, in step with
  // the melody's beat. Only themes with a percussion pattern use it.
  private percNextTime = 0;
  private percStep = 0;

  private get def() {
    return THEME_MUSIC[this.theme];
  }

  /** Switch tune (and instrument voice) when the carousel theme changes. */
  setTheme(themeId: ThemeId) {
    if (themeId === this.theme) return;
    this.theme = themeId;
    this.bassByIndex = new Map<number, number>(THEME_MUSIC[themeId].bass);
    this.noteIndex = 0;
    this.prevMelodyFreq = undefined;
    this.percStep = 0;
    if (this.timer !== null && this.context) {
      this.nextNoteTime = this.context.currentTime + 0.1;
      this.percNextTime = this.context.currentTime + 0.1;
    }
  }

  private ensureContext() {
    this.context ??= new AudioContext();
    if (!this.master) {
      this.master = this.context.createGain();
      this.master.gain.value = 0.13;
      this.master.connect(this.context.destination);
    }
    this.voices ??= new InstrumentVoices(this.context, this.master);
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
      this.prevMelodyFreq = undefined;
      this.percStep = 0;
      this.nextNoteTime = a.currentTime + 0.1;
      this.percNextTime = a.currentTime + 0.1;
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
    if (!a || this.timer === null || !this.voices) return;
    const { melody, beat, voice, bassVoice, pluckDamp, percussion } = this.def;
    // If the interval was starved (background tab, slow device), the note
    // clock falls behind real time. Skip the missed notes instead of
    // bursting them all at once as a chord.
    if (this.nextNoteTime < a.currentTime - 0.25) {
      this.nextNoteTime = a.currentTime + 0.05;
    }
    while (this.nextNoteTime < a.currentTime + 0.12) {
      const [note, beats] = melody[this.noteIndex];
      const freq = midiToFreq(note);
      const noteSeconds = beats * beat;
      this.voices.playNote(voice, freq, this.nextNoteTime, noteSeconds, {
        glideFrom: this.prevMelodyFreq,
        damp: pluckDamp,
      });
      const bass = this.bassByIndex.get(this.noteIndex);
      if (bass !== undefined) {
        this.voices.playNote(bassVoice, midiToFreq(bass), this.nextNoteTime, noteSeconds, {
          peak: 0.22,
          damp: pluckDamp,
        });
      }
      this.prevMelodyFreq = freq;
      this.nextNoteTime += noteSeconds;
      this.noteIndex = (this.noteIndex + 1) % melody.length;
    }
    if (percussion) {
      if (this.percNextTime < a.currentTime - 0.25) {
        this.percNextTime = a.currentTime + 0.05;
        this.percStep = 0; // re-align the pattern to the bar start
      }
      const stepSeconds = beat / 2;
      while (this.percNextTime < a.currentTime + 0.12) {
        const hit = percussion[this.percStep % percussion.length];
        if (hit) this.voices.playDrum(hit, this.percNextTime);
        this.percNextTime += stepSeconds;
        this.percStep++;
      }
    }
  }

  dispose() {
    this.stop();
    void this.context?.close();
    this.context = null;
    this.master = null;
    this.voices = null;
  }
}
