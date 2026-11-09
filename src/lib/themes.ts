// Holiday theme registry: color palettes that tint the whole scene,
// CSS background gradients for day / night, and the particle hue palette.
// 15 themes: the classic lamp + 14 festivals in calendar order.
export type ThemeId =
  | 'default'
  | 'new-year'
  | 'valentine'
  | 'spring-festival'
  | 'carnival'
  | 'st-patrick'
  | 'april-fools'
  | 'easter'
  | 'mothers-day'
  | 'dragon-boat'
  | 'mid-autumn'
  | 'halloween'
  | 'diwali'
  | 'thanksgiving'
  | 'christmas';
export type ThemeMode = 'auto' | ThemeId;
export const THEME_IDS: ThemeId[] = [
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
];

/**
 * Stored theme modes from before the `lunar` → `spring-festival` rename.
 * Old stored values map to the new id; anything unknown falls back to auto.
 */
export function normalizeThemeMode(saved: string): ThemeMode {
  if (saved === 'lunar') return 'spring-festival';
  if (saved === 'auto' || (THEME_IDS as string[]).includes(saved)) return saved as ThemeMode;
  return 'auto';
}

export type ThemePalette = {
  // Shared carousel materials (instant setColor target = hex color)
  mat: {
    cream: string; red: string; sky: string; green: string; yellow: string; gold: string;
  };
  roofA: string; roofB: string; fascia: string;
  shade: string; shadeEmissive: string; concealedEmissive: string;
  glow: string; beamTint: string;
  // Floating particle hues (5 colors cycled)
  hues: string[];
  // Page background radial gradients (CSS)
  bgDay: string; bgNight: string;
};

export const THEMES: Record<ThemeId, ThemePalette> = {
  default: {
    mat: {
      cream: '#faf3e0', red: '#e0796e', sky: '#a8d4e6',
      green: '#7fb8c9', yellow: '#e8b84a', gold: '#d4ad62',
    },
    roofA: '#e0796e', roofB: '#a8d4e6', fascia: '#e0796e',
    shade: '#fff0ca', shadeEmissive: '#ffc276', concealedEmissive: '#ffae4b',
    glow: '#ffffff', beamTint: '#ffd098',
    hues: ['#ffbc69', '#73acff', '#f57ed3', '#b19aff', '#65e3dd'],
    bgDay: 'radial-gradient(ellipse at 50% 42%, #fbf6e8 0%, #f1e7cf 55%, #e2d2ac 100%)',
    bgNight: 'radial-gradient(ellipse at 50% 42%, #3a4a6b 0%, #2a3550 55%, #171e30 100%)',
  },
  'new-year': {
    // Champagne gold / obsidian black / silver. Dark backdrop, neon flare.
    mat: {
      cream: '#f7ecd0', red: '#d4af37', sky: '#1a1a1a',
      green: '#e0e0e0', yellow: '#f5e6a8', gold: '#d4af37',
    },
    roofA: '#d4af37', roofB: '#1a1a1a', fascia: '#d4af37',
    shade: '#fff3c4', shadeEmissive: '#ffd700', concealedEmissive: '#e6c34a',
    glow: '#ffe9a8', beamTint: '#ffd76a',
    hues: ['#d4af37', '#e0e0e0', '#fff3c4', '#ff6ec7', '#7df9ff'],
    bgDay: 'radial-gradient(ellipse at 50% 42%, #33302a 0%, #1d1c19 55%, #0e0d0c 100%)',
    bgNight: 'radial-gradient(ellipse at 50% 42%, #23211f 0%, #141312 55%, #080808 100%)',
  },
  valentine: {
    // Soft pink / deep rose red / pearl white / warm gold.
    mat: {
      cream: '#fdf5e6', red: '#c71585', sky: '#ffb6c1',
      green: '#f7c8d8', yellow: '#e8c05a', gold: '#d4a24a',
    },
    roofA: '#c71585', roofB: '#ffb6c1', fascia: '#c71585',
    shade: '#ffe9f0', shadeEmissive: '#ff9ec4', concealedEmissive: '#ff7eb0',
    glow: '#ffd6e2', beamTint: '#ffb6c1',
    hues: ['#ffb6c1', '#c71585', '#fdf5e6', '#ffd700', '#ff8fb8'],
    bgDay: 'radial-gradient(ellipse at 50% 42%, #fff0f4 0%, #fbe0e8 55%, #eec3d2 100%)',
    bgNight: 'radial-gradient(ellipse at 50% 42%, #5e2438 0%, #3d1524 55%, #1c0a12 100%)',
  },
  'spring-festival': {
    // China red / rich gold / ink black / glazed teal.
    mat: {
      cream: '#fff3df', red: '#de2910', sky: '#2e6b66',
      green: '#1f8a58', yellow: '#ffd700', gold: '#ffd700',
    },
    roofA: '#de2910', roofB: '#ffd700', fascia: '#de2910',
    shade: '#ffeecb', shadeEmissive: '#ffb84d', concealedEmissive: '#ff9f36',
    glow: '#fff1d0', beamTint: '#ffd27e',
    hues: ['#de2910', '#ffd700', '#ff5e4d', '#ffb03a', '#ffe29a'],
    bgDay: 'radial-gradient(ellipse at 50% 42%, #fff4e2 0%, #f7e2c0 55%, #eccf9e 100%)',
    bgNight: 'radial-gradient(ellipse at 50% 42%, #5e1b1b 0%, #3d1116 55%, #1c0708 100%)',
  },
  carnival: {
    // Electric purple / dazzling gold / peacock blue / hot magenta.
    mat: {
      cream: '#f6e8ff', red: '#ff007f', sky: '#00a4ef',
      green: '#2fd48a', yellow: '#ffd700', gold: '#ffd700',
    },
    roofA: '#8a2be2', roofB: '#ffd700', fascia: '#8a2be2',
    shade: '#f3e2ff', shadeEmissive: '#b46bff', concealedEmissive: '#9a4dff',
    glow: '#e9d5ff', beamTint: '#c77dff',
    hues: ['#8a2be2', '#ffd700', '#00a4ef', '#ff007f', '#ff5e78'],
    bgDay: 'radial-gradient(ellipse at 50% 42%, #f3e6ff 0%, #e2ccf7 55%, #c3a6e8 100%)',
    bgNight: 'radial-gradient(ellipse at 50% 42%, #3a1a5e 0%, #241040 55%, #100622 100%)',
  },
  'st-patrick': {
    // Emerald / Irish green / gold / rainbow.
    mat: {
      cream: '#eef7ea', red: '#d4af37', sky: '#50c878',
      green: '#009a49', yellow: '#ffd700', gold: '#ffd700',
    },
    roofA: '#009a49', roofB: '#50c878', fascia: '#009a49',
    shade: '#eafff0', shadeEmissive: '#7fe0a8', concealedEmissive: '#4cc47c',
    glow: '#d8ffe6', beamTint: '#8ff0b3',
    hues: ['#50c878', '#009a49', '#ffd700', '#ff6b35', '#1982c4'],
    bgDay: 'radial-gradient(ellipse at 50% 42%, #e8f7ec 0%, #cdeeda 55%, #a8dcc0 100%)',
    bgNight: 'radial-gradient(ellipse at 50% 42%, #143d24 0%, #0c2718 55%, #05130b 100%)',
  },
  'april-fools': {
    // Bright yellow / prank purple / bright orange-red / electric blue.
    mat: {
      cream: '#fffbe0', red: '#ff5722', sky: '#00b0ff',
      green: '#7ed321', yellow: '#ffeb3b', gold: '#ffb300',
    },
    roofA: '#9c27b0', roofB: '#ffeb3b', fascia: '#9c27b0',
    shade: '#fff8d0', shadeEmissive: '#ffe14d', concealedEmissive: '#ffcf3f',
    glow: '#fff3a0', beamTint: '#e8ff5e',
    hues: ['#ffeb3b', '#9c27b0', '#ff5722', '#00b0ff', '#7ed321'],
    bgDay: 'radial-gradient(ellipse at 50% 42%, #fffbe0 0%, #f7eeb8 55%, #e3d68f 100%)',
    bgNight: 'radial-gradient(ellipse at 50% 42%, #3d1a4d 0%, #27102f 55%, #120818 100%)',
  },
  easter: {
    // Mint green / soft sky blue / cream yellow / lilac.
    mat: {
      cream: '#fffdd0', red: '#ff9eb5', sky: '#b0e0e6',
      green: '#98ff98', yellow: '#fffdd0', gold: '#e8c05a',
    },
    roofA: '#98ff98', roofB: '#b0e0e6', fascia: '#7ec8e3',
    shade: '#fffbe8', shadeEmissive: '#ffe98a', concealedEmissive: '#ffd76a',
    glow: '#ffffff', beamTint: '#fff3b0',
    hues: ['#98ff98', '#b0e0e6', '#fffdd0', '#d8b4fe', '#ffb6c1'],
    bgDay: 'radial-gradient(ellipse at 50% 42%, #f2fbf0 0%, #dff3e4 55%, #bfe6cf 100%)',
    bgNight: 'radial-gradient(ellipse at 50% 42%, #3d4a6b 0%, #2a3550 55%, #171e30 100%)',
  },
  'mothers-day': {
    // Carnation pink / soft beige / warm gold / pale blue.
    mat: {
      cream: '#f5f5dc', red: '#ff69b4', sky: '#a8c8e8',
      green: '#8fbc8f', yellow: '#f0d060', gold: '#d4a24a',
    },
    roofA: '#ff69b4', roofB: '#f5f5dc', fascia: '#e85a9b',
    shade: '#fff6ea', shadeEmissive: '#ffc98a', concealedEmissive: '#ffb36b',
    glow: '#ffe9d0', beamTint: '#ffcf9e',
    hues: ['#ff69b4', '#f5f5dc', '#ffd700', '#a8c8e8', '#ffb6c1'],
    bgDay: 'radial-gradient(ellipse at 50% 42%, #fdf6e8 0%, #f5e8cd 55%, #e6d3a8 100%)',
    bgNight: 'radial-gradient(ellipse at 50% 42%, #5e3d24 0%, #3d2716 55%, #1c120a 100%)',
  },
  'dragon-boat': {
    // Bamboo green / vermilion / river blue / five-color silk.
    mat: {
      cream: '#eef4e6', red: '#b22222', sky: '#20b2aa',
      green: '#47885e', yellow: '#f0c24b', gold: '#d4a24a',
    },
    roofA: '#b22222', roofB: '#47885e', fascia: '#b22222',
    shade: '#e8f4ec', shadeEmissive: '#7fd0a8', concealedEmissive: '#5cb886',
    glow: '#d8f0e0', beamTint: '#8fd8c0',
    hues: ['#47885e', '#b22222', '#20b2aa', '#ffd700', '#ff6b6b'],
    bgDay: 'radial-gradient(ellipse at 50% 42%, #e8f4ec 0%, #cfe8d8 55%, #a8d4bc 100%)',
    bgNight: 'radial-gradient(ellipse at 50% 42%, #123f31 0%, #0b2a20 55%, #051410 100%)',
  },
  'mid-autumn': {
    // Moonlight silver / deep night blue / osmanthus yellow / warm gold.
    mat: {
      cream: '#f5f5f5', red: '#d4556a', sky: '#191970',
      green: '#7a9a6a', yellow: '#f8de7e', gold: '#d4a24a',
    },
    roofA: '#191970', roofB: '#f8de7e', fascia: '#2a2a72',
    shade: '#fdf6d8', shadeEmissive: '#ffe9a8', concealedEmissive: '#ffd76a',
    glow: '#fff8e0', beamTint: '#ffe9a8',
    hues: ['#f5f5f5', '#f8de7e', '#ffd700', '#c8b8ff', '#ffb6c1'],
    bgDay: 'radial-gradient(ellipse at 50% 42%, #f2f0f8 0%, #ddd8ec 55%, #b8b0d4 100%)',
    bgNight: 'radial-gradient(ellipse at 50% 42%, #232350 0%, #141433 55%, #08081c 100%)',
  },
  halloween: {
    mat: {
      cream: '#f2e6f7', red: '#ff7518', sky: '#7a4fd0',
      green: '#66d17a', yellow: '#ffbf3f', gold: '#c9902e',
    },
    roofA: '#7a3fd0', roofB: '#ff7518', fascia: '#7a3fd0',
    shade: '#ffe3b0', shadeEmissive: '#ff9432', concealedEmissive: '#ff8420',
    glow: '#ffd079', beamTint: '#ff9a3c',
    hues: ['#ff9a2e', '#8b5cf6', '#66e08a', '#ffd23c', '#c084fc'],
    bgDay: 'radial-gradient(ellipse at 50% 42%, #f3e6ff 0%, #e0d0f2 52%, #bfa8d8 100%)',
    bgNight: 'radial-gradient(ellipse at 50% 42%, #4b2a68 0%, #2e1a44 52%, #15092b 100%)',
  },
  diwali: {
    // Saffron / gold / sapphire blue / deep magenta.
    mat: {
      cream: '#fff6e0', red: '#ff9933', sky: '#0f52ba',
      green: '#2e8b57', yellow: '#ffd700', gold: '#ffd700',
    },
    roofA: '#ff9933', roofB: '#c71585', fascia: '#ff9933',
    shade: '#ffedbe', shadeEmissive: '#ffb84d', concealedEmissive: '#ff9f36',
    glow: '#ffe9a8', beamTint: '#ffc95e',
    hues: ['#ff9933', '#ffd700', '#0f52ba', '#c71585', '#ff6b35'],
    bgDay: 'radial-gradient(ellipse at 50% 42%, #fff3d6 0%, #f7dfae 55%, #e8c284 100%)',
    bgNight: 'radial-gradient(ellipse at 50% 42%, #4d2a10 0%, #331a08 55%, #180c03 100%)',
  },
  thanksgiving: {
    // Maple red / pumpkin orange / wheat gold / deep brown.
    mat: {
      cream: '#f7ead0', red: '#c41e3a', sky: '#7a8ba8',
      green: '#6b8e23', yellow: '#daa520', gold: '#c9962e',
    },
    roofA: '#c41e3a', roofB: '#d96b27', fascia: '#8b5a2b',
    shade: '#ffedbe', shadeEmissive: '#ffb84d', concealedEmissive: '#ff9f36',
    glow: '#ffe9a8', beamTint: '#ffc95e',
    hues: ['#c41e3a', '#d96b27', '#daa520', '#8b5a2b', '#ff8c42'],
    bgDay: 'radial-gradient(ellipse at 50% 42%, #fbf0d8 0%, #f2ddb0 55%, #e0bd82 100%)',
    bgNight: 'radial-gradient(ellipse at 50% 42%, #4d2f1a 0%, #331e10 55%, #180e06 100%)',
  },
  christmas: {
    mat: {
      cream: '#fff6e6', red: '#c41e3a', sky: '#cfe8ff',
      green: '#0b6623', yellow: '#f0c24b', gold: '#e3bd6a',
    },
    roofA: '#c41e3a', roofB: '#0b6623', fascia: '#c41e3a',
    shade: '#fff8d9', shadeEmissive: '#ffd27e', concealedEmissive: '#ffce6b',
    glow: '#ffffff', beamTint: '#ffe6b3',
    hues: ['#ffffff', '#ffd982', '#ff6b6b', '#88d8ff', '#b8ffcf'],
    bgDay: 'radial-gradient(ellipse at 50% 42%, #f4fbff 0%, #e2f0f5 55%, #c9dfeb 100%)',
    bgNight: 'radial-gradient(ellipse at 50% 42%, #27405e 0%, #18293f 55%, #0a1424 100%)',
  },
};

// ---------------------------------------------------------------------------
// Auto theme by date. Fixed festivals use ±3 days around the day; the two
// long-standing windows (Halloween Oct 25–Nov 4, Christmas Dec 20–30) are
// kept as-is. Lunar festivals use date tables (2026–2032, verified against
// published tables); Easter uses the Gregorian computus; Carnival is
// Mardi Gras (Easter − 47 days); Mother's Day is the 2nd Sunday of May;
// Thanksgiving is the Canadian date (2nd Monday of October).
// Overlap priority (checked in this order): Oct 31 is always Halloween;
// Spring Festival outranks Valentine's (CNY 2026 falls Feb 17); Christmas
// outranks New Year (Dec 29–30 stay Christmas); Carnival outranks
// Valentine's; Easter outranks April Fools' (Apr 1, 2029 is Easter Sunday);
// Diwali outranks Halloween except on Oct 31 itself.
// ---------------------------------------------------------------------------

// Chinese New Year (Spring Festival) date table, [year, month, day].
const CNY: [number, number, number][] = [
  [2026, 2, 17], [2027, 2, 6], [2028, 1, 26], [2029, 2, 13],
  [2030, 2, 3], [2031, 1, 23], [2032, 2, 11],
];

// Dragon Boat Festival (lunar 5th day of 5th month), [year, month, day].
const DRAGON_BOAT: [number, number, number][] = [
  [2026, 6, 19], [2027, 6, 9], [2028, 5, 28], [2029, 6, 16],
  [2030, 6, 5], [2031, 6, 24], [2032, 6, 12],
];

// Mid-Autumn Festival (lunar 15th day of 8th month), [year, month, day].
const MID_AUTUMN: [number, number, number][] = [
  [2026, 9, 25], [2027, 9, 15], [2028, 10, 3], [2029, 9, 22],
  [2030, 9, 12], [2031, 10, 1], [2032, 9, 19],
];

// Diwali (Lakshmi Puja), [year, month, day].
const DIWALI: [number, number, number][] = [
  [2026, 11, 8], [2027, 10, 29], [2028, 10, 17], [2029, 11, 5],
  [2030, 10, 26], [2031, 11, 14], [2032, 11, 2],
];

/** Noon local time, so day-boundary comparisons never straddle midnight/DST. */
function atNoon(year: number, month0: number, day: number): Date {
  return new Date(year, month0, day, 12);
}

/** Whole calendar days from the anchor day to `t` (DST-safe via rounding). */
function dayDiff(t: number, anchorMs: number): number {
  const dayStart = (ms: number) => {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  return Math.round((dayStart(t) - dayStart(anchorMs)) / 864e5);
}

/** True when `t` is within `before` days before to `after` days after the anchor day. */
function withinDays(t: number, anchorMs: number, before: number, after: number): boolean {
  const d = dayDiff(t, anchorMs);
  return d >= -before && d <= after;
}

function inSpread(t: number, anchorMs: number, spreadDays: number): boolean {
  return withinDays(t, anchorMs, spreadDays, spreadDays);
}

/** Easter Sunday (Anonymous Gregorian computus), noon local time. */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return atNoon(year, month - 1, day);
}

/** The nth `weekday` (0 = Sunday) of a month, noon local time. */
function nthWeekdayOfMonth(year: number, month0: number, weekday: number, n: number): Date {
  const first = new Date(year, month0, 1, 12);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month0, 1 + offset + (n - 1) * 7, 12);
}

function inTableWindow(
  t: number,
  year: number,
  table: [number, number, number][],
  beforeDays: number,
  afterDays: number,
): boolean {
  for (const [y, m, d] of table) {
    if (y !== year && y !== year + 1) continue;
    const anchor = atNoon(y, m - 1, d).getTime();
    if (withinDays(t, anchor, beforeDays, afterDays)) return true;
  }
  return false;
}

// Resolve the holiday theme automatically from the local date.
export function autoThemeForDate(now = new Date()): ThemeId {
  const md = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const t = now.getTime();
  const year = now.getFullYear();
  // Halloween day itself always wins, even when Diwali overlaps the window.
  if (md === '10-31') return 'halloween';
  // Long-standing Christmas window, kept as-is.
  if (md >= '12-20' && md <= '12-30') return 'christmas';
  // Spring Festival: 3 days before CNY through the 7th day of the new year.
  if (inTableWindow(t, year, CNY, 3, 7)) return 'spring-festival';
  // New Year: Jan 1 ± 3 days (check this year and next — Dec 29–31 belong
  // to the coming Jan 1).
  for (const y of [year, year + 1]) {
    if (inSpread(t, atNoon(y, 0, 1).getTime(), 3)) return 'new-year';
  }
  // Carnival: Mardi Gras (Easter − 47 days) ± 3 days.
  for (const y of [year, year + 1]) {
    const mardiGras = easterSunday(y).getTime() - 47 * 864e5;
    if (inSpread(t, mardiGras, 3)) return 'carnival';
  }
  // Fixed festivals, ± 3 days.
  if (inSpread(t, atNoon(year, 1, 14).getTime(), 3)) return 'valentine';
  if (inSpread(t, atNoon(year, 2, 17).getTime(), 3)) return 'st-patrick';
  // Easter ± 3 days (checked before April Fools': Apr 1, 2029 is Easter).
  for (const y of [year, year + 1]) {
    if (inSpread(t, easterSunday(y).getTime(), 3)) return 'easter';
  }
  if (inSpread(t, atNoon(year, 3, 1).getTime(), 3)) return 'april-fools';
  // Mother's Day: 2nd Sunday of May ± 3 days.
  if (inSpread(t, nthWeekdayOfMonth(year, 4, 0, 2).getTime(), 3)) return 'mothers-day';
  // Lunar festivals, ± 3 days. Diwali is checked before the Halloween
  // window so a Diwali that lands inside Oct 25–Nov 4 (e.g. Oct 29, 2027)
  // still shows — Oct 31 itself is already handled above.
  if (inTableWindow(t, year, DRAGON_BOAT, 3, 3)) return 'dragon-boat';
  if (inTableWindow(t, year, MID_AUTUMN, 3, 3)) return 'mid-autumn';
  if (inTableWindow(t, year, DIWALI, 3, 3)) return 'diwali';
  // Halloween window, kept as-is (Oct 25–Nov 4).
  if (md >= '10-25' && md <= '11-04') return 'halloween';
  // Thanksgiving (Canada): 2nd Monday of October ± 3 days.
  if (inSpread(t, nthWeekdayOfMonth(year, 9, 1, 2).getTime(), 3)) return 'thanksgiving';
  return 'default';
}

export function resolveTheme(mode: ThemeMode): ThemeId {
  return mode === 'auto' ? autoThemeForDate() : mode;
}
