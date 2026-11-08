import { describe, it, expect, beforeEach } from 'vitest';
import {
  readMusicPref,
  saveMusicPref,
  readThemePref,
  saveThemePref,
  readSavedView,
  saveView,
  VIEW_STORAGE_KEY,
  MUSIC_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from '@/lib/view-storage';

beforeEach(() => {
  localStorage.clear();
});

describe('music preference', () => {
  it('returns false when nothing is stored', () => {
    expect(readMusicPref()).toBe(false);
  });

  it('persists true', () => {
    saveMusicPref(true);
    expect(localStorage.getItem(MUSIC_STORAGE_KEY)).toBe('1');
    expect(readMusicPref()).toBe(true);
  });

  it('persists false', () => {
    saveMusicPref(true);
    saveMusicPref(false);
    expect(localStorage.getItem(MUSIC_STORAGE_KEY)).toBe('0');
    expect(readMusicPref()).toBe(false);
  });
});

describe('theme preference', () => {
  it('returns "auto" when nothing is stored', () => {
    expect(readThemePref()).toBe('auto');
  });

  it('persists theme mode', () => {
    saveThemePref('halloween');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('halloween');
    expect(readThemePref()).toBe('halloween');
  });
});

describe('saved view', () => {
  it('returns undefined when nothing is stored', () => {
    expect(readSavedView()).toBeUndefined();
  });

  it('round-trips a valid view', () => {
    const view = {
      night: true,
      spinning: false,
      position: [0, 5, 10] as [number, number, number],
      target: [0, 0, 0] as [number, number, number],
      angle: 1.2,
    };
    saveView(view);
    expect(readSavedView()).toEqual(view);
  });

  it('rejects a view with an out-of-range distance', () => {
    // position very far from target → distance > 50
    const view = {
      night: false,
      spinning: false,
      position: [0, 0, 99] as [number, number, number],
      target: [0, 0, 0] as [number, number, number],
      angle: 0,
    };
    localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(view));
    expect(readSavedView()).toBeUndefined();
  });

  it('rejects malformed JSON', () => {
    localStorage.setItem(VIEW_STORAGE_KEY, '{bad json');
    expect(readSavedView()).toBeUndefined();
  });

  it('rejects a view missing required fields', () => {
    localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify({ night: true }));
    expect(readSavedView()).toBeUndefined();
  });
});
