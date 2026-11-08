import { describe, it, expect, vi } from 'vitest';
import { autoThemeForDate, resolveTheme, THEME_IDS } from '@/lib/themes';

describe('THEME_IDS', () => {
  it('contains all four theme identifiers', () => {
    expect(THEME_IDS).toEqual(['default', 'halloween', 'christmas', 'lunar']);
  });
});

describe('autoThemeForDate', () => {
  it('returns halloween during late October', () => {
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

  it('returns default outside the christmas window', () => {
    expect(autoThemeForDate(new Date(2024, 11, 19))).toBe('default'); // Dec 19
    expect(autoThemeForDate(new Date(2024, 11, 31))).toBe('default'); // Dec 31
  });

  it('returns lunar for Chinese New Year 2026 window', () => {
    // CNY 2026: Feb 17 at noon. Window: Feb 14 noon → Feb 24 noon.
    // Use Feb 15 (safely inside) and Feb 24 (last full day inside).
    expect(autoThemeForDate(new Date(2026, 1, 15))).toBe('lunar'); // Feb 15
    expect(autoThemeForDate(new Date(2026, 1, 17))).toBe('lunar'); // Feb 17 (CNY day)
    expect(autoThemeForDate(new Date(2026, 1, 23))).toBe('lunar'); // Feb 23
  });

  it('returns default for a regular summer date', () => {
    expect(autoThemeForDate(new Date(2024, 5, 15))).toBe('default'); // Jun 15
  });
});

describe('resolveTheme', () => {
  it('passes through explicit theme IDs', () => {
    expect(resolveTheme('default')).toBe('default');
    expect(resolveTheme('halloween')).toBe('halloween');
    expect(resolveTheme('christmas')).toBe('christmas');
    expect(resolveTheme('lunar')).toBe('lunar');
  });

  it('resolves auto using the current date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 9, 31)); // Halloween
    expect(resolveTheme('auto')).toBe('halloween');
    vi.useRealTimers();
  });
});
