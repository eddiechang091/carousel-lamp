import { describe, it, expect, vi } from 'vitest';
import {
  autoThemeForDate,
  easterSunday,
  normalizeThemeMode,
  resolveTheme,
  THEMES,
  THEME_IDS,
} from '@/lib/themes';

const ALL_IDS = [
  'default',
  'new-year',
  'valentine',
  'spring-festival',
  'carnival',
  'st-patrick',
  'april-fools',
  'easter',
  'mothers-day',
  'dragon-boat',
  'mid-autumn',
  'halloween',
  'diwali',
  'thanksgiving',
  'christmas',
] as const;

describe('THEME_IDS', () => {
  it('contains all fifteen theme identifiers in calendar order', () => {
    expect(THEME_IDS).toEqual([...ALL_IDS]);
  });
});

describe('THEMES registry', () => {
  it('has a complete palette for every theme id', () => {
    const hex = /^#[0-9a-fA-F]{6}$/;
    for (const id of ALL_IDS) {
      const p = THEMES[id];
      expect(p, id).toBeDefined();
      for (const key of ['cream', 'red', 'sky', 'green', 'yellow', 'gold'] as const) {
        expect(p.mat[key], `${id}.mat.${key}`).toMatch(hex);
      }
      for (const key of ['roofA', 'roofB', 'fascia', 'shade', 'shadeEmissive', 'concealedEmissive', 'glow', 'beamTint'] as const) {
        expect(p[key], `${id}.${key}`).toMatch(hex);
      }
      expect(p.hues).toHaveLength(5);
      for (const h of p.hues) expect(h, `${id}.hues`).toMatch(hex);
      expect(p.bgDay).toContain('radial-gradient');
      expect(p.bgNight).toContain('radial-gradient');
    }
  });

  it('gives New Year a dark backdrop (neon on obsidian)', () => {
    expect(THEMES['new-year'].mat.gold).toBe('#d4af37');
    expect(THEMES['new-year'].bgDay).toContain('#1d1c19');
  });

  it('uses the spec main colors for Spring Festival', () => {
    expect(THEMES['spring-festival'].mat.red).toBe('#de2910');
    expect(THEMES['spring-festival'].mat.gold).toBe('#ffd700');
  });
});

describe('normalizeThemeMode', () => {
  it("maps the legacy 'lunar' value to spring-festival", () => {
    expect(normalizeThemeMode('lunar')).toBe('spring-festival');
  });

  it('passes through auto and every current id', () => {
    expect(normalizeThemeMode('auto')).toBe('auto');
    for (const id of ALL_IDS) expect(normalizeThemeMode(id)).toBe(id);
  });

  it('falls back to auto for unknown values', () => {
    expect(normalizeThemeMode('')).toBe('auto');
    expect(normalizeThemeMode('easter-egg')).toBe('auto');
  });
});

describe('easterSunday', () => {
  it('matches the known Gregorian dates', () => {
    // 2026 Apr 5, 2027 Mar 28, 2028 Apr 16, 2029 Apr 1.
    expect(easterSunday(2026)).toEqual(new Date(2026, 3, 5, 12));
    expect(easterSunday(2027)).toEqual(new Date(2027, 2, 28, 12));
    expect(easterSunday(2028)).toEqual(new Date(2028, 3, 16, 12));
    expect(easterSunday(2029)).toEqual(new Date(2029, 3, 1, 12));
  });
});

describe('autoThemeForDate', () => {
  it('returns halloween during late October and on Oct 31', () => {
    expect(autoThemeForDate(new Date(2024, 9, 25))).toBe('halloween'); // Oct 25
    expect(autoThemeForDate(new Date(2024, 9, 31))).toBe('halloween'); // Oct 31
    expect(autoThemeForDate(new Date(2024, 10, 4))).toBe('halloween'); // Nov 4
  });

  it('returns default outside the halloween window', () => {
    expect(autoThemeForDate(new Date(2024, 9, 24))).toBe('default'); // Oct 24
    expect(autoThemeForDate(new Date(2024, 10, 5))).toBe('default'); // Nov 5
  });

  it('returns christmas during late December', () => {
    expect(autoThemeForDate(new Date(2024, 11, 20))).toBe('christmas'); // Dec 20
    expect(autoThemeForDate(new Date(2024, 11, 30))).toBe('christmas'); // Dec 30
  });

  it('returns new-year around Jan 1, not default', () => {
    expect(autoThemeForDate(new Date(2024, 11, 31))).toBe('new-year'); // Dec 31
    expect(autoThemeForDate(new Date(2025, 0, 1))).toBe('new-year'); // Jan 1
    expect(autoThemeForDate(new Date(2025, 0, 4))).toBe('new-year'); // Jan 4
    expect(autoThemeForDate(new Date(2025, 0, 5))).toBe('default'); // Jan 5
  });

  it('returns spring-festival for Chinese New Year 2026 window', () => {
    // CNY 2026: Feb 17 at noon. Window: Feb 14 noon → Feb 24 noon.
    expect(autoThemeForDate(new Date(2026, 1, 15))).toBe('spring-festival'); // Feb 15
    expect(autoThemeForDate(new Date(2026, 1, 17))).toBe('spring-festival'); // Feb 17 (CNY day)
    expect(autoThemeForDate(new Date(2026, 1, 23))).toBe('spring-festival'); // Feb 23
  });

  it('returns valentine around Feb 14 in a year without CNY overlap', () => {
    expect(autoThemeForDate(new Date(2025, 1, 11))).toBe('valentine'); // Feb 11
    expect(autoThemeForDate(new Date(2025, 1, 14))).toBe('valentine'); // Feb 14
    expect(autoThemeForDate(new Date(2025, 1, 17))).toBe('valentine'); // Feb 17
    expect(autoThemeForDate(new Date(2025, 1, 10))).toBe('default'); // Feb 10
    expect(autoThemeForDate(new Date(2025, 1, 18))).toBe('default'); // Feb 18
  });

  it('returns carnival on Mardi Gras (Easter − 47 days)', () => {
    // Mardi Gras 2026 (Feb 17) and 2027 (Feb 9) fall inside the CNY window,
    // where Spring Festival outranks Carnival — so verify with 2028/2030.
    // Mardi Gras 2028 is Feb 29 (leap day); 2030 is Mar 5 (Easter Apr 21).
    expect(autoThemeForDate(new Date(2028, 1, 26))).toBe('carnival'); // Feb 26
    expect(autoThemeForDate(new Date(2028, 1, 29))).toBe('carnival'); // Feb 29
    expect(autoThemeForDate(new Date(2028, 2, 3))).toBe('carnival'); // Mar 3
    expect(autoThemeForDate(new Date(2030, 2, 5))).toBe('carnival'); // Mar 5, 2030
    expect(autoThemeForDate(new Date(2028, 2, 4))).toBe('default'); // Mar 4, 2028
  });

  it('returns st-patrick around Mar 17', () => {
    expect(autoThemeForDate(new Date(2025, 2, 14))).toBe('st-patrick'); // Mar 14
    expect(autoThemeForDate(new Date(2025, 2, 17))).toBe('st-patrick'); // Mar 17
    expect(autoThemeForDate(new Date(2025, 2, 20))).toBe('st-patrick'); // Mar 20
    expect(autoThemeForDate(new Date(2025, 2, 21))).toBe('default'); // Mar 21
  });

  it('returns easter around Easter Sunday and beats April Fools on Apr 1, 2029', () => {
    expect(autoThemeForDate(new Date(2026, 3, 5))).toBe('easter'); // Apr 5, 2026
    expect(autoThemeForDate(new Date(2027, 2, 28))).toBe('easter'); // Mar 28, 2027
    expect(autoThemeForDate(new Date(2029, 3, 1))).toBe('easter'); // Apr 1, 2029
  });

  it('returns april-fools around Apr 1 in other years', () => {
    expect(autoThemeForDate(new Date(2025, 2, 29))).toBe('april-fools'); // Mar 29
    expect(autoThemeForDate(new Date(2025, 3, 1))).toBe('april-fools'); // Apr 1
    expect(autoThemeForDate(new Date(2025, 3, 4))).toBe('april-fools'); // Apr 4
    expect(autoThemeForDate(new Date(2025, 3, 5))).toBe('default'); // Apr 5
  });

  it("returns mothers-day on the 2nd Sunday of May ± 3 days", () => {
    // 2026: May 10. 2027: May 9.
    expect(autoThemeForDate(new Date(2026, 4, 7))).toBe('mothers-day'); // May 7
    expect(autoThemeForDate(new Date(2026, 4, 10))).toBe('mothers-day'); // May 10
    expect(autoThemeForDate(new Date(2026, 4, 13))).toBe('mothers-day'); // May 13
    expect(autoThemeForDate(new Date(2026, 4, 14))).toBe('default'); // May 14
    expect(autoThemeForDate(new Date(2027, 4, 9))).toBe('mothers-day'); // May 9, 2027
  });

  it('returns dragon-boat around the lunar 5th day of the 5th month', () => {
    expect(autoThemeForDate(new Date(2026, 5, 16))).toBe('dragon-boat'); // Jun 16
    expect(autoThemeForDate(new Date(2026, 5, 19))).toBe('dragon-boat'); // Jun 19
    expect(autoThemeForDate(new Date(2026, 5, 22))).toBe('dragon-boat'); // Jun 22
    expect(autoThemeForDate(new Date(2026, 5, 23))).toBe('default'); // Jun 23
    expect(autoThemeForDate(new Date(2028, 4, 28))).toBe('dragon-boat'); // May 28, 2028
  });

  it('returns mid-autumn around the lunar 15th day of the 8th month', () => {
    expect(autoThemeForDate(new Date(2026, 8, 22))).toBe('mid-autumn'); // Sep 22
    expect(autoThemeForDate(new Date(2026, 8, 25))).toBe('mid-autumn'); // Sep 25
    expect(autoThemeForDate(new Date(2026, 8, 28))).toBe('mid-autumn'); // Sep 28
    expect(autoThemeForDate(new Date(2026, 8, 29))).toBe('default'); // Sep 29
    expect(autoThemeForDate(new Date(2028, 9, 3))).toBe('mid-autumn'); // Oct 3, 2028
  });

  it('returns diwali around Lakshmi Puja, and halloween still wins Oct 31', () => {
    expect(autoThemeForDate(new Date(2026, 10, 5))).toBe('diwali'); // Nov 5
    expect(autoThemeForDate(new Date(2026, 10, 8))).toBe('diwali'); // Nov 8
    expect(autoThemeForDate(new Date(2026, 10, 11))).toBe('diwali'); // Nov 11
    expect(autoThemeForDate(new Date(2027, 9, 29))).toBe('diwali'); // Oct 29, 2027
    expect(autoThemeForDate(new Date(2027, 9, 31))).toBe('halloween'); // Oct 31, 2027
  });

  it('returns thanksgiving on the 2nd Monday of October (Canada) ± 3 days', () => {
    // 2026: Oct 12. 2027: Oct 11.
    expect(autoThemeForDate(new Date(2026, 9, 9))).toBe('thanksgiving'); // Oct 9
    expect(autoThemeForDate(new Date(2026, 9, 12))).toBe('thanksgiving'); // Oct 12
    expect(autoThemeForDate(new Date(2026, 9, 15))).toBe('thanksgiving'); // Oct 15
    expect(autoThemeForDate(new Date(2026, 9, 16))).toBe('default'); // Oct 16
    expect(autoThemeForDate(new Date(2027, 9, 11))).toBe('thanksgiving'); // Oct 11, 2027
  });

  it('returns default for a regular summer date', () => {
    expect(autoThemeForDate(new Date(2024, 5, 15))).toBe('default'); // Jun 15
  });
});

describe('resolveTheme', () => {
  it('passes through explicit theme IDs', () => {
    for (const id of ALL_IDS) expect(resolveTheme(id)).toBe(id);
  });

  it('resolves auto using the current date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 9, 31)); // Halloween
    expect(resolveTheme('auto')).toBe('halloween');
    vi.useRealTimers();
  });
});
