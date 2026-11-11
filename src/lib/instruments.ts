// Synthesized instrument voices for the carousel lamp, rendered entirely
// with the Web Audio API — no audio files, no licensing risk, works offline.
//
// The plucked-string voice is the same Karplus-Strong physical model used
// for the Yu Gong Yi Shan score (compose_v2.py: ks_pluck, damp 0.9962):
// a noise burst circulating in a delay line of N = sampleRate / freq
// samples, averaged with feedback damp*0.5. The flute voice follows the
// same script's breathy-flute recipe (sine + 2nd/3rd harmonics, 5.2 Hz
// vibrato, breath noise). The other voices are small purpose-built
// approximations of their instruments' character: bowed strings (sawtooth
// + vibrato + slow attack, with an optional glide for erhu-style slides),
// suona reed (bright harmonic stack + strong vibrato), piano (additive
// partials with staggered decays), and a drum kit (pitch-dropping sine
// drums, filtered-noise shaker, inharmonic gong partials).
//
// These are evocative, not recordings: a trained ear can tell them from
// the real instruments, but each theme now plays in its own instrument's
// voice instead of one shared music-box tine.
import { midiToFreq } from "./theme-music";

export type VoiceId = "musicBox" | "pluck" | "flute" | "bowed" | "reed" | "piano";
export type DrumKind = "kick" | "drum" | "shaker" | "gong";

/** Seconds of ring for a plucked-string buffer. Notes overlap and ring out. */
const PLUCK_SECONDS = 2.5;

/** Deterministic pseudo-random excitation so the same note sounds the same. */
function seededNoise(n: number, seed: number): Float32Array {
  const out = new Float32Array(n);
  let s = seed >>> 0 || 1;
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    out[i] = s / 2147483648 - 1;
  }
  return out;
}

/**
 * Karplus-Strong plucked-string samples, ported from compose_v2.py's
 * ks_pluck (damp 0.9962, exponential decay envelope, peak-normalized).
 * Pure function of (freq, damp, sampleRate) so tests can check it without
 * an AudioContext.
 */
export function karplusStrongSamples(
  freq: number,
  damp: number,
  sampleRate: number,
  seconds = PLUCK_SECONDS,
): Float32Array {
  const n = Math.floor(sampleRate * seconds);
  const N = Math.max(2, Math.round(sampleRate / freq));
  const y = new Float32Array(n);
  const exc = seededNoise(N, Math.round(freq * 1000));
  // Recurrence first (zero initial conditions, as in the lfilter form),
  // envelope after — exactly like compose_v2.py.
  for (let i = 0; i < n; i++) {
    if (i < N) {
      y[i] = exc[i];
    } else {
      const a = y[i - N];
      const b = i - N - 1 >= 0 ? y[i - N - 1] : 0;
      y[i] = damp * 0.5 * (a + b);
    }
  }
  for (let i = 0; i < n; i++) {
    y[i] *= Math.exp((-1.6 * i) / n);
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(y[i]));
  if (peak > 0) {
    for (let i = 0; i < n; i++) y[i] /= peak;
  }
  return y;
}

type VoiceOptions = {
  /** Previous melody frequency, for erhu-style glides (bowed voice only). */
  glideFrom?: number;
  /** Karplus-Strong feedback damping (pluck voice only). */
  damp?: number;
  /** Overall peak gain for this note. */
  peak?: number;
};

/** Owns an AudioContext's voices: node creation, buffer caches, playback. */
export class InstrumentVoices {
  private pluckCache = new Map<string, AudioBuffer>();
  private noiseBuffer: AudioBuffer | null = null;

  constructor(
    private ctx: AudioContext,
    private master: GainNode,
  ) {}

  /** One shared white-noise buffer for breath, shaker and cymbal sounds. */
  private getNoise(): AudioBuffer {
    if (!this.noiseBuffer) {
      const len = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      buf.getChannelData(0).set(seededNoise(len, 12345));
      this.noiseBuffer = buf;
    }
    return this.noiseBuffer;
  }

  private pluckBuffer(freq: number, damp: number): AudioBuffer {
    const key = `${freq.toFixed(1)}:${damp}`;
    const hit = this.pluckCache.get(key);
    if (hit) return hit;
    const samples = karplusStrongSamples(freq, damp, this.ctx.sampleRate);
    const buf = this.ctx.createBuffer(1, samples.length, this.ctx.sampleRate);
    buf.getChannelData(0).set(samples);
    this.pluckCache.set(key, buf);
    return buf;
  }

  private vibrato(target: AudioParam, rateHz: number, depthHz: number, time: number) {
    const lfo = this.ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = rateHz;
    const depth = this.ctx.createGain();
    depth.gain.value = depthHz;
    lfo.connect(depth);
    depth.connect(target);
    lfo.start(time);
    lfo.stop(time + 4);
    return lfo;
  }

  /** Play one melody/bass note in the given voice at the given time. */
  playNote(
    voice: VoiceId,
    freq: number,
    time: number,
    noteSeconds: number,
    opts: VoiceOptions = {},
  ): void {
    switch (voice) {
      case "musicBox":
        this.playMusicBox(freq, time, opts.peak ?? 0.5);
        break;
      case "pluck":
        this.playPluck(freq, time, opts.damp ?? 0.9962, opts.peak ?? 0.5);
        break;
      case "flute":
        this.playFlute(freq, time, noteSeconds, opts.peak ?? 0.4);
        break;
      case "bowed":
        this.playBowed(freq, time, noteSeconds, opts.peak ?? 0.35, opts.glideFrom);
        break;
      case "reed":
        this.playReed(freq, time, noteSeconds, opts.peak ?? 0.32);
        break;
      case "piano":
        this.playPiano(freq, time, opts.peak ?? 0.45);
        break;
    }
  }

  /** The original music-box tine: fundamental + bright partials. */
  private playMusicBox(freq: number, time: number, peak: number): void {
    const partials: [number, number][] = [
      [1, 1],
      [2, 0.35],
      [2.76, 0.14],
    ];
    for (const [ratio, weight] of partials) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq * ratio;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(peak * weight, time + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.7);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(time);
      osc.stop(time + 1.75);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    }
  }

  private playPluck(freq: number, time: number, damp: number, peak: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.pluckBuffer(freq, damp);
    const gain = this.ctx.createGain();
    gain.gain.value = peak;
    src.connect(gain);
    gain.connect(this.master);
    src.start(time);
    src.stop(time + PLUCK_SECONDS);
    src.onended = () => {
      src.disconnect();
      gain.disconnect();
    };
  }

  /** Breath flute (dizi): sine + harmonics, breath noise, gentle vibrato. */
  private playFlute(freq: number, time: number, noteSeconds: number, peak: number): void {
    const dur = Math.max(0.25, noteSeconds);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peak, time + 0.09);
    gain.gain.setValueAtTime(peak, time + Math.max(0.1, dur - 0.15));
    gain.gain.linearRampToValueAtTime(0, time + dur + 0.1);
    gain.connect(this.master);
    // 5.2 Hz vibrato, +/-0.4% — the compose_v2.py flute recipe. One LFO
    // drives every harmonic, depth scaled by the harmonic ratio.
    const lfo = this.ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 5.2;
    lfo.start(time);
    lfo.stop(time + dur + 0.15);
    // Fundamental + 2nd/3rd harmonics, as in compose_v2.py's flute_note.
    const harmonics: [number, number][] = [
      [1, 1],
      [2, 0.22],
      [3, 0.07],
    ];
    for (const [ratio, weight] of harmonics) {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq * ratio;
      const depth = this.ctx.createGain();
      depth.gain.value = freq * ratio * 0.004;
      lfo.connect(depth);
      depth.connect(osc.frequency);
      const og = this.ctx.createGain();
      og.gain.value = weight;
      osc.connect(og);
      og.connect(gain);
      osc.start(time);
      osc.stop(time + dur + 0.15);
    }
    // Breath: band-passed noise around the fundamental.
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.getNoise();
    noise.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = 1.2;
    const ng = this.ctx.createGain();
    ng.gain.value = 0.06;
    noise.connect(bp);
    bp.connect(ng);
    ng.connect(gain);
    noise.start(time);
    noise.stop(time + dur + 0.15);
  }

  /** Bowed string (erhu / violin): sawtooth + vibrato + slow attack. */
  private playBowed(
    freq: number,
    time: number,
    noteSeconds: number,
    peak: number,
    glideFrom?: number,
  ): void {
    const dur = Math.max(0.25, noteSeconds);
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    if (glideFrom !== undefined && glideFrom > 0 && glideFrom !== freq) {
      osc.frequency.setValueAtTime(glideFrom, time);
      osc.frequency.exponentialRampToValueAtTime(freq, time + 0.07);
    } else {
      osc.frequency.value = freq;
    }
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2200;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peak, time + 0.12);
    gain.gain.setValueAtTime(peak, time + Math.max(0.13, dur - 0.12));
    gain.gain.linearRampToValueAtTime(0, time + dur + 0.12);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    this.vibrato(osc.frequency, 5.5, freq * 0.008, time);
    osc.start(time);
    osc.stop(time + dur + 0.15);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  /** Suona reed: bright harmonic stack + fast attack, through a lowpass. */
  private playReed(freq: number, time: number, noteSeconds: number, peak: number): void {
    const dur = Math.max(0.2, noteSeconds);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 3400;
    filter.connect(this.master);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peak, time + 0.03);
    gain.gain.setValueAtTime(peak, time + Math.max(0.05, dur - 0.08));
    gain.gain.linearRampToValueAtTime(0, time + dur + 0.08);
    gain.connect(filter);
    const harmonics: [number, number][] = [
      [1, 1],
      [2, 0.45],
      [3, 0.2],
    ];
    for (const [ratio, weight] of harmonics) {
      const osc = this.ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq * ratio;
      const og = this.ctx.createGain();
      og.gain.value = weight;
      osc.connect(og);
      og.connect(gain);
      osc.start(time);
      osc.stop(time + dur + 0.1);
    }
  }

  /** Piano: additive partials with staggered decays. */
  private playPiano(freq: number, time: number, peak: number): void {
    const partials: [number, number, number][] = [
      [1, 1, 2.2],
      [2, 0.45, 1.0],
      [3, 0.22, 0.5],
      [4.2, 0.1, 0.25],
    ];
    for (const [ratio, weight, decay] of partials) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq * ratio;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(peak * weight, time + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(time);
      osc.stop(time + decay + 0.05);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    }
  }

  /** One drum-kit hit at the given time. */
  playDrum(kind: DrumKind, time: number): void {
    switch (kind) {
      case "kick": {
        const osc = this.ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(160, time);
        osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.9, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(time);
        osc.stop(time + 0.3);
        break;
      }
      case "drum": {
        const osc = this.ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(220, time);
        osc.frequency.exponentialRampToValueAtTime(110, time + 0.08);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.7, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(time);
        osc.stop(time + 0.2);
        break;
      }
      case "shaker": {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.getNoise();
        const hp = this.ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 6000;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.18, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.07);
        noise.connect(hp);
        hp.connect(gain);
        gain.connect(this.master);
        noise.start(time);
        noise.stop(time + 0.09);
        break;
      }
      case "gong": {
        // Inharmonic partials with a long shimmering decay.
        const partials: [number, number, number][] = [
          [1, 1, 2.8],
          [2.76, 0.4, 1.8],
          [5.4, 0.18, 1.0],
        ];
        for (const [ratio, weight, decay] of partials) {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = 98 * ratio; // low G2 gong
          gain.gain.setValueAtTime(0, time);
          gain.gain.linearRampToValueAtTime(0.25 * weight, time + 0.005);
          gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
          osc.connect(gain);
          gain.connect(this.master);
          osc.start(time);
          osc.stop(time + decay + 0.05);
        }
        break;
      }
    }
  }
}

/** Convenience: MIDI note number to frequency (re-exported for voices). */
export { midiToFreq };
