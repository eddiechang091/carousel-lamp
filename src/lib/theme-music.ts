// Per-theme music for the carousel lamp: one tune per festival, played
// with the same Web Audio music-box timbre as the classic melody — still
// fully procedural, no audio files, no licensing risk, works offline.
// Melodies are written as MIDI note numbers ([note, duration in beats]);
// two of them quote public-domain tunes (Jingle Bells, 1857; Auld Lang
// Syne, 1788) and the rest are short original lines in a scale, tempo
// and rhythm chosen for the festival. `scale` lists the allowed pitch
// classes (0 = C) so tests can check every note stays in key; the two
// chromatic themes (April Fools', Halloween) list all twelve.

import type { DrumKind, VoiceId } from "./instruments";
import type { ThemeId } from "./themes";

export type ThemeMusicDef = {
  /** Seconds per quarter note. */
  beat: number;
  /** Melody as [MIDI note, duration in beats]; loops forever. */
  melody: [number, number][];
  /** Soft low accompaniment as [melody index, MIDI note]. */
  bass: [number, number][];
  /** Allowed pitch classes (0 = C) for the melody. */
  scale: number[];
  /** Where the tune comes from (public-domain quote or original line). */
  tune: string;
  /** Melody instrument voice. */
  voice: VoiceId;
  /** Bass accompaniment voice. */
  bassVoice: VoiceId;
  /** Karplus-Strong damping for the pluck voice (per-theme brightness). */
  pluckDamp?: number;
  /** Drum pattern, 16 eighth-note steps over two bars; null = rest. */
  percussion?: (DrumKind | null)[];
};

/** Equal-tempered frequency for a MIDI note number (A4 = 69 = 440 Hz). */
export function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

const C_MAJOR = [0, 2, 4, 5, 7, 9, 11];
const PENTATONIC_C = [0, 2, 4, 7, 9];
const CHROMATIC = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export const THEME_MUSIC: Record<ThemeId, ThemeMusicDef> = {
  // Greensleeves in A minor — the original classic melody, unchanged.
  default: {
    beat: 0.5,
    melody: [
      [69, 1], [67, 0.5], [66, 0.5], [64, 2],
      [62, 2], [64, 1], [66, 1], [67, 2],
      [69, 1], [67, 0.5], [66, 0.5], [64, 2],
      [62, 2], [64, 1], [66, 3],
    ],
    bass: [[0, 45], [4, 38], [8, 45], [12, 38]],
    scale: [0, 2, 4, 6, 7, 9, 11],
    tune: "Greensleeves (traditional, public domain)",
    voice: "musicBox",
    bassVoice: "musicBox",
  },
  christmas: {
    beat: 0.42,
    // Jingle Bells chorus (James Pierpont, 1857 — public domain).
    melody: [
      [64, 1], [64, 1], [64, 2], [64, 1], [64, 1], [64, 2],
      [64, 1], [67, 1], [60, 1.5], [62, 0.5], [64, 2],
      [65, 1], [65, 1], [65, 1], [65, 1], [65, 1],
      [64, 1], [64, 1], [64, 1], [64, 1],
      [62, 1], [62, 1], [64, 1], [62, 1], [67, 2],
    ],
    bass: [[0, 48], [5, 43], [11, 41], [16, 43], [20, 43], [24, 48]],
    scale: C_MAJOR,
    tune: "Jingle Bells chorus (public domain, 1857)",
    voice: "piano",
    bassVoice: "piano",
  },
  "new-year": {
    beat: 0.55,
    // Auld Lang Syne-inspired opening (Robert Burns, 1788 — public domain).
    melody: [
      [60, 1], [65, 1], [65, 1], [65, 1], [64, 1], [62, 1],
      [60, 1], [60, 1], [62, 1], [65, 1], [64, 1], [62, 1], [60, 2],
      [62, 1], [64, 1], [65, 1], [67, 1], [69, 1], [67, 1], [65, 1], [64, 2],
    ],
    bass: [[0, 48], [7, 41], [12, 48], [16, 43]],
    scale: C_MAJOR,
    tune: "Auld Lang Syne-inspired (public domain, 1788)",
    voice: "piano",
    bassVoice: "piano",
  },
  valentine: {
    beat: 0.6,
    // Slow waltz, gentle arpeggio line.
    melody: [
      [60, 1], [64, 1], [67, 1], [64, 1], [69, 1], [67, 1],
      [64, 1], [60, 1], [65, 1], [69, 1], [67, 1], [65, 1],
      [64, 1], [62, 1], [60, 2],
    ],
    bass: [[0, 48], [4, 43], [8, 41], [12, 48]],
    scale: C_MAJOR,
    tune: "Original slow waltz",
    voice: "bowed",
    bassVoice: "piano",
  },
  "spring-festival": {
    beat: 0.42,
    // Bright pentatonic bounce.
    melody: [
      [67, 1], [69, 1], [72, 1], [69, 1], [67, 1], [64, 1],
      [67, 1], [69, 1], [72, 2], [69, 1], [67, 1], [64, 1],
      [62, 1], [64, 2], [67, 1], [69, 1], [72, 1], [74, 1],
      [72, 1], [69, 1], [67, 2],
    ],
    bass: [[0, 48], [8, 43], [13, 48], [17, 43]],
    scale: PENTATONIC_C,
    tune: "Original pentatonic line",
    voice: "reed",
    bassVoice: "reed",
    percussion: ["gong", null, "shaker", null, "drum", null, "shaker", null, "drum", null, "shaker", null, "drum", null, "shaker", null],
  },
  carnival: {
    beat: 0.34,
    // Fast samba-flavoured run, off-beat feel.
    melody: [
      [60, 0.5], [64, 0.5], [67, 0.5], [69, 0.5],
      [72, 0.5], [69, 0.5], [67, 0.5], [64, 0.5],
      [67, 0.5], [69, 0.5], [72, 1], [74, 0.5],
      [72, 0.5], [69, 0.5], [67, 1], [64, 1],
    ],
    bass: [[0, 48], [8, 43], [12, 48]],
    scale: C_MAJOR,
    tune: "Original samba-flavoured line",
    voice: "none",
    bassVoice: "none",
    percussion: ["kick", "shaker", "drum", "shaker", "kick", "shaker", "drum", "shaker", "kick", "shaker", "drum", "shaker", "kick", "shaker", "drum", "shaker"],
  },
  "st-patrick": {
    beat: 0.32,
    // Jig in D major, 6/8 lilt.
    melody: [
      [62, 1], [66, 0.5], [69, 0.5], [66, 1], [67, 1],
      [66, 0.5], [64, 0.5], [62, 1], [64, 1], [66, 1],
      [69, 1], [67, 1], [66, 0.5], [64, 0.5], [62, 2],
    ],
    bass: [[0, 38], [8, 43]],
    scale: [2, 4, 6, 7, 9, 11, 1],
    tune: "Original Irish jig",
    voice: "bowed",
    bassVoice: "pluck",
  },
  "april-fools": {
    beat: 0.38,
    // Playful chromatic slides — the joke is in the wrong notes.
    melody: [
      [60, 0.5], [64, 0.5], [67, 0.5], [66, 0.5],
      [67, 0.5], [65, 0.5], [64, 0.5], [63, 0.5],
      [64, 1], [67, 1], [69, 0.5], [68, 0.5],
      [67, 0.5], [65, 0.5], [64, 1], [60, 1],
    ],
    bass: [[0, 48], [8, 43]],
    scale: CHROMATIC,
    tune: "Original chromatic prank",
    voice: "pluck",
    bassVoice: "pluck",
    pluckDamp: 0.994,
  },
  easter: {
    beat: 0.5,
    // Gentle spring line in G major.
    melody: [
      [67, 1], [71, 1], [74, 1], [71, 1], [69, 1], [67, 1],
      [69, 1], [71, 1], [74, 2], [71, 1], [69, 1], [67, 1],
      [66, 1], [67, 2], [62, 1], [67, 1], [71, 1], [74, 1],
      [76, 1], [74, 1], [71, 1], [69, 2],
    ],
    bass: [[0, 43], [8, 48], [14, 43]],
    scale: [7, 9, 11, 0, 2, 4, 6],
    tune: "Original spring line",
    voice: "flute",
    bassVoice: "pluck",
  },
  "mothers-day": {
    beat: 0.6,
    // Warm and slow in F major.
    melody: [
      [65, 1], [69, 1], [72, 1], [69, 1], [67, 1], [65, 1],
      [64, 1], [65, 2], [65, 1], [69, 1], [72, 1], [74, 1],
      [72, 1], [69, 1], [67, 1], [65, 2], [60, 1], [65, 1],
      [69, 1], [72, 1], [69, 1], [65, 1], [64, 2],
    ],
    bass: [[0, 41], [8, 48], [16, 41]],
    scale: [5, 7, 9, 10, 0, 2, 4],
    tune: "Original warm line",
    voice: "bowed",
    bassVoice: "piano",
  },
  "dragon-boat": {
    beat: 0.36,
    // Driving pentatonic with a drum-like downbeat.
    melody: [
      [60, 1], [60, 0.5], [64, 0.5], [67, 1], [69, 1],
      [67, 0.5], [64, 0.5], [62, 1], [64, 1], [67, 1],
      [69, 1], [72, 1], [69, 0.5], [67, 0.5], [64, 1], [62, 2],
    ],
    bass: [[0, 48], [4, 48], [8, 43], [12, 48]],
    scale: PENTATONIC_C,
    tune: "Original driving pentatonic line",
    voice: "pluck",
    bassVoice: "pluck",
    percussion: ["gong", null, "drum", null, "drum", null, "drum", null, "drum", null, "drum", null, "drum", null, "drum", null],
  },
  "mid-autumn": {
    beat: 0.62,
    // Slow, dreamy A-minor pentatonic under the moon.
    melody: [
      [69, 2], [72, 1], [69, 1], [67, 1], [64, 2], [67, 1],
      [69, 1], [72, 2], [76, 1], [74, 1], [72, 1], [69, 2],
      [67, 1], [64, 1], [62, 1], [64, 2],
    ],
    bass: [[0, 45], [6, 40], [11, 45]],
    scale: [9, 0, 2, 4, 7],
    tune: "Original moonlit line",
    voice: "flute",
    bassVoice: "pluck",
  },
  halloween: {
    beat: 0.48,
    // Spooky semitone creep in A minor.
    melody: [
      [69, 1], [68, 1], [69, 1], [72, 1], [71, 1], [68, 1],
      [69, 2], [64, 1], [65, 1], [68, 1], [69, 1], [71, 1],
      [72, 1], [71, 1], [68, 1], [69, 2],
    ],
    bass: [[0, 45], [6, 40], [11, 45]],
    scale: CHROMATIC,
    tune: "Original spooky line",
    voice: "bowed",
    bassVoice: "bowed",
  },
  diwali: {
    beat: 0.44,
    // Raga-flavoured line (flat 2nd and 6th over a C drone feel).
    melody: [
      [60, 1], [61, 1], [64, 1], [65, 1], [67, 1], [68, 1],
      [67, 1], [65, 1], [64, 1], [61, 1], [60, 2],
      [64, 1], [67, 1], [68, 1], [71, 1], [72, 1],
      [71, 1], [68, 1], [67, 1], [64, 2],
    ],
    bass: [[0, 48], [10, 48], [15, 43]],
    scale: [0, 1, 4, 5, 7, 8, 11],
    tune: "Original raga-flavoured line",
    voice: "pluck",
    bassVoice: "pluck",
    pluckDamp: 0.997,
  },
  thanksgiving: {
    beat: 0.52,
    // Warm folk line in G major.
    melody: [
      [67, 1], [69, 1], [71, 1], [74, 1], [71, 1], [69, 1],
      [67, 1], [66, 1], [67, 2], [67, 1], [71, 1], [74, 1],
      [76, 1], [74, 1], [71, 1], [69, 1], [67, 2],
      [71, 1], [74, 1], [71, 1], [69, 1], [67, 1], [62, 2],
    ],
    bass: [[0, 43], [9, 48], [17, 43]],
    scale: [7, 9, 11, 0, 2, 4, 6],
    tune: "Original harvest folk line",
    voice: "piano",
    bassVoice: "piano",
  },
};
