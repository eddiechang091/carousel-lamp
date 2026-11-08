import { describe, it, expect } from 'vitest';
import { PHOTO_COUNT, initialCrop, cropRect } from '@/lib/photos';

describe('constants', () => {
  it('PHOTO_COUNT is 16', () => {
    expect(PHOTO_COUNT).toBe(16);
  });

  it('initialCrop has zoom=1 and centred position', () => {
    expect(initialCrop).toEqual({ zoom: 1, x: 0, y: 0 });
  });
});

describe('cropRect', () => {
  it('fills the full image when it already matches the target ratio', () => {
    // 440×520 image — exactly the target size, zoom 1, centred
    const r = cropRect(440, 520, { zoom: 1, x: 0, y: 0 });
    expect(r.w).toBeCloseTo(440);
    expect(r.h).toBeCloseTo(520);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(0);
  });

  it('zooms in when zoom > 1', () => {
    const base = cropRect(880, 1040, { zoom: 1, x: 0, y: 0 });
    const zoomed = cropRect(880, 1040, { zoom: 2, x: 0, y: 0 });
    // A higher zoom should produce a smaller crop window (we see less of the image)
    expect(zoomed.w).toBeLessThan(base.w);
    expect(zoomed.h).toBeLessThan(base.h);
  });

  it('clamps zoom to the range [1, 3]', () => {
    const atOne = cropRect(880, 1040, { zoom: 1, x: 0, y: 0 });
    const belowOne = cropRect(880, 1040, { zoom: 0.1, x: 0, y: 0 });
    // zoom below 1 is clamped → same result as zoom=1
    expect(belowOne.w).toBeCloseTo(atOne.w);
    expect(belowOne.h).toBeCloseTo(atOne.h);

    const atThree = cropRect(880, 1040, { zoom: 3, x: 0, y: 0 });
    const aboveThree = cropRect(880, 1040, { zoom: 10, x: 0, y: 0 });
    expect(aboveThree.w).toBeCloseTo(atThree.w);
  });

  it('offsets the crop window for non-centred positions', () => {
    // Use a wide image (2000×1040) so the height constrains scale and there
    // is room to pan horizontally. x=0 centres; x=1 shifts fully right.
    const centred = cropRect(2000, 1040, { zoom: 1, x: 0, y: 0 });
    const right = cropRect(2000, 1040, { zoom: 1, x: 1, y: 0 });
    expect(right.x).toBeGreaterThan(centred.x);
  });

  it('returns origin x=0, y=0 when there is nothing to offset', () => {
    // Image exactly matches target size → no room to pan, x/y stay 0
    const r = cropRect(440, 520, { zoom: 1, x: 1, y: 1 });
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(0);
  });
});
