import { describe, it, expect } from "vitest";
import { THEME_MUSIC, midiToFreq } from "@/lib/theme-music";
import { THEME_IDS } from "@/lib/themes";

describe("midiToFreq", () => {
  it("maps A4 to 440 Hz and middle C to ~261.63 Hz", () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 6);
    expect(midiToFreq(60)).toBeCloseTo(261.63, 2);
    expect(midiToFreq(57)).toBeCloseTo(220, 6);
  });
});

describe("THEME_MUSIC", () => {
  it("covers every theme in the registry", () => {
    for (const id of THEME_IDS) {
      expect(THEME_MUSIC[id], `missing music for ${id}`).toBeDefined();
    }
    expect(Object.keys(THEME_MUSIC).sort()).toEqual([...THEME_IDS].sort());
  });

  it("every melody note stays in its theme's scale", () => {
    for (const [id, def] of Object.entries(THEME_MUSIC)) {
      expect(def.melody.length, `${id}: empty melody`).toBeGreaterThan(0);
      for (const [note, beats] of def.melody) {
        expect(beats, `${id}: non-positive duration`).toBeGreaterThan(0);
        expect(
          def.scale,
          `${id}: note ${note} (pc ${note % 12}) outside scale`,
        ).toContain(note % 12);
      }
    }
  });

  it("every bass entry points at a real melody index", () => {
    for (const [id, def] of Object.entries(THEME_MUSIC)) {
      for (const [index, note] of def.bass) {
        expect(index, `${id}: bass index out of range`).toBeGreaterThanOrEqual(0);
        expect(index, `${id}: bass index out of range`).toBeLessThan(def.melody.length);
        expect(note, `${id}: bass note out of range`).toBeGreaterThanOrEqual(24);
        expect(note, `${id}: bass note out of range`).toBeLessThanOrEqual(60);
      }
    }
  });

  it("every theme sounds distinct: no two melodies are the same", () => {
    const seen = new Map<string, string>();
    for (const [id, def] of Object.entries(THEME_MUSIC)) {
      const key = JSON.stringify(def.melody);
      expect(seen.get(key), `${id} duplicates ${seen.get(key)}`).toBeUndefined();
      seen.set(key, id);
    }
  });

  it("tempos vary across themes (at least 10 distinct beats)", () => {
    const beats = new Set(Object.values(THEME_MUSIC).map((d) => d.beat));
    expect(beats.size).toBeGreaterThanOrEqual(10);
  });

  it("Christmas quotes Jingle Bells (E E E opening)", () => {
    const first = THEME_MUSIC.christmas.melody.slice(0, 3).map(([n]) => n);
    expect(first).toEqual([64, 64, 64]);
  });

  it("the classic theme keeps the Greensleeves opening (A G F#)", () => {
    const first = THEME_MUSIC.default.melody.slice(0, 3).map(([n]) => n);
    expect(first).toEqual([69, 67, 66]);
  });
});
