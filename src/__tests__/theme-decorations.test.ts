import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createThemeDecorations } from '@/lib/theme-decorations';
import type { ThemeId } from '@/lib/themes';

// jsdom ships no real 2D canvas: stub getContext so the CanvasTexture
// builders (pumpkin faces, clock faces, painted eggs, …) don't throw.
function stubCanvas2d() {
  const gradient = { addColorStop() {} };
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 0, lineCap: '', font: '',
    textAlign: '', textBaseline: '',
    clearRect() {}, fillRect() {}, strokeRect() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
    quadraticCurveTo() {}, bezierCurveTo() {}, arc() {}, fill() {}, stroke() {},
    fillText() {}, createRadialGradient() { return gradient; },
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
}

beforeAll(() => { stubCanvas2d(); });

function countLights(group: THREE.Group) {
  let n = 0;
  group.traverse(o => { if ((o as THREE.Light).isLight) n++; });
  return n;
}

// Every theme with decorations must build, stay within the light budget,
// and survive a few update frames + dispose. Default builds an empty layer.
const DECORATED: ThemeId[] = [
  'halloween', 'christmas', 'spring-festival', 'new-year', 'valentine',
  'carnival', 'st-patrick', 'april-fools', 'easter', 'mothers-day', 'dragon-boat',
  'mid-autumn',
];
// Every decorated theme keeps to the ≤ 3 light budget (Halloween's old
// 11 lights — 6 pumpkins + 5 ghosts — were replaced with emissive +
// shared glow sprites in the batch-4 rework).
const LIGHT_BUDGET: ThemeId[] = DECORATED;

describe('createThemeDecorations', () => {
  it('builds an empty layer for default', () => {
    const d = createThemeDecorations('default');
    expect(d.group.children.length).toBe(0);
    expect(() => d.update(1, 0.016, false)).not.toThrow();
    expect(() => d.dispose()).not.toThrow();
  });

  it.each(DECORATED)('builds %s and survives update + dispose', (theme) => {
    const d = createThemeDecorations(theme);
    expect(d.group.children.length).toBeGreaterThan(0);
    expect(() => d.update(1.5, 0.016, false)).not.toThrow();
    expect(() => d.update(1.5, 0.016, true)).not.toThrow();
    expect(() => d.dispose()).not.toThrow();
  });

  it.each(LIGHT_BUDGET)('keeps %s within the 3-light budget', (theme) => {
    const d = createThemeDecorations(theme);
    expect(countLights(d.group)).toBeLessThanOrEqual(3);
    d.dispose();
  });
});
