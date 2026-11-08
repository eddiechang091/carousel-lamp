// Holiday theme registry: color palettes that tween across the whole scene,
// CSS background gradients for day / night, and the particle hue palette.
export type ThemeId = 'default' | 'halloween' | 'christmas' | 'lunar';
export type ThemeMode = 'auto' | ThemeId;
export const THEME_IDS: ThemeId[] = ['default', 'halloween', 'christmas', 'lunar'];

export type ThemePalette = {
  // Shared carousel materials (tweened target = hex color)
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
  halloween: {
    mat: {
      cream: '#f2e6f7', red: '#e2681b', sky: '#7a4fd0',
      green: '#66d17a', yellow: '#ffbf3f', gold: '#c9902e',
    },
    roofA: '#7a3fd0', roofB: '#ff8c1a', fascia: '#7a3fd0',
    shade: '#ffe3b0', shadeEmissive: '#ff9432', concealedEmissive: '#ff8420',
    glow: '#ffd079', beamTint: '#ff9a3c',
    hues: ['#ff9a2e', '#8b5cf6', '#66e08a', '#ffd23c', '#c084fc'],
    bgDay: 'radial-gradient(ellipse at 50% 42%, #f3e6ff 0%, #e0d0f2 52%, #bfa8d8 100%)',
    bgNight: 'radial-gradient(ellipse at 50% 42%, #4b2a68 0%, #2e1a44 52%, #15092b 100%)',
  },
  christmas: {
    mat: {
      cream: '#fff6e6', red: '#d23a2e', sky: '#cfe8ff',
      green: '#1f7a4d', yellow: '#f0c24b', gold: '#e3bd6a',
    },
    roofA: '#c62f2f', roofB: '#16523a', fascia: '#c62f2f',
    shade: '#fff8d9', shadeEmissive: '#ffd27e', concealedEmissive: '#ffce6b',
    glow: '#ffffff', beamTint: '#ffe6b3',
    hues: ['#ffffff', '#ffd982', '#ff6b6b', '#88d8ff', '#b8ffcf'],
    bgDay: 'radial-gradient(ellipse at 50% 42%, #f4fbff 0%, #e2f0f5 55%, #c9dfeb 100%)',
    bgNight: 'radial-gradient(ellipse at 50% 42%, #27405e 0%, #18293f 55%, #0a1424 100%)',
  },
  lunar: {
    mat: {
      cream: '#fff3df', red: '#d2222d', sky: '#e9b949',
      green: '#1f8a58', yellow: '#f6c453', gold: '#f0c75e',
    },
    roofA: '#c81e2b', roofB: '#e9b949', fascia: '#c81e2b',
    shade: '#ffeecb', shadeEmissive: '#ffb84d', concealedEmissive: '#ff9f36',
    glow: '#fff1d0', beamTint: '#ffd27e',
    hues: ['#ffd052', '#ff5e4d', '#ffb03a', '#ff8352', '#ffe29a'],
    bgDay: 'radial-gradient(ellipse at 50% 42%, #fff4e2 0%, #f7e2c0 55%, #eccf9e 100%)',
    bgNight: 'radial-gradient(ellipse at 50% 42%, #5e1b1b 0%, #3d1116 55%, #1c0708 100%)',
  },
};

// Chinese New Year (Lunar New Year) date table for upcoming years, [year, month, day].
const CNY: [number, number, number][] = [
  [2026, 2, 17], [2027, 2, 6], [2028, 1, 26], [2029, 2, 13],
  [2030, 2, 3], [2031, 1, 23], [2032, 2, 11],
];

// Resolve the holiday theme automatically from the local date.
export function autoThemeForDate(now = new Date()): ThemeId {
  const md = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (md >= '10-25' && md <= '11-04') return 'halloween';
  if (md >= '12-20' && md <= '12-30') return 'christmas';
  const day = (m: number, d: number) => {
    const v = new Date(now.getFullYear(), 0, 1, 12);
    v.setMonth(0, 0); v.setMonth(m - 1, d);
    return v.getTime();
  };
  const t = now.getTime();
  for (const [y, m, d] of CNY) {
    if (y !== now.getFullYear() && y !== now.getFullYear() + 1) continue;
    const cny = new Date(y, m - 1, d, 12).getTime();
    // Window: 3 days before CNY through the 7th day of the new year (~11 days total)
    if (t >= cny - 3 * 864e5 && t <= cny + 7 * 864e5) return 'lunar';
  }
  void day;
  return 'default';
}

export function resolveTheme(mode: ThemeMode): ThemeId {
  return mode === 'auto' ? autoThemeForDate() : mode;
}
