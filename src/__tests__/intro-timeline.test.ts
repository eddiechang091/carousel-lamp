import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import {
  selectIntroMode,
  zoomDur,
  quadraticBezier,
  offstageFor,
  sleighDrivePose,
  dragonDrivePose,
  buildIntroTimeline,
  type IntroPlan,
  type CameraRig,
  type EntranceItem,
} from '@/lib/intro-timeline';

function mockRig(dist = 1.8): { rig: CameraRig; apply: ReturnType<typeof vi.fn> } {
  const apply = vi.fn();
  return {
    apply,
    rig: { state: { dist, targetY: 3 }, apply, crown: new THREE.Group() },
  };
}

function mockItem(group: EntranceItem['group'] = 'main'): EntranceItem {
  const obj = new THREE.Group();
  obj.position.set(1, 2, 3);
  return {
    obj,
    from: { x: 5, y: 6, z: 7 },
    to: { x: 1, y: 2, z: 3 },
    group,
  };
}

describe('selectIntroMode', () => {
  it('reduced motion always goes instant', () => {
    expect(selectIntroMode({ reduced: true, hasSavedView: false, isFirstTheme: true })).toBe('instant');
    expect(selectIntroMode({ reduced: true, hasSavedView: true, isFirstTheme: false })).toBe('instant');
  });

  it('first load without a saved view plays the full intro', () => {
    expect(selectIntroMode({ reduced: false, hasSavedView: false, isFirstTheme: true })).toBe('full');
  });

  it('first load with a saved view, and every theme switch, plays the short version', () => {
    expect(selectIntroMode({ reduced: false, hasSavedView: true, isFirstTheme: true })).toBe('short');
    expect(selectIntroMode({ reduced: false, hasSavedView: false, isFirstTheme: false })).toBe('short');
  });

  it('forceInstant overrides everything', () => {
    expect(selectIntroMode({ reduced: false, hasSavedView: false, isFirstTheme: true, forceInstant: true })).toBe('instant');
  });
});

describe('zoomDur', () => {
  it('1→2x is exactly 0.55s', () => {
    expect(zoomDur(1, 2)).toBeCloseTo(0.55, 2);
  });

  it('clamps small ratios to the 0.30s floor', () => {
    expect(zoomDur(1, 1.3)).toBeCloseTo(0.3, 2);
    expect(zoomDur(1, 1)).toBe(0.3);
  });

  it('is symmetric in direction', () => {
    expect(zoomDur(2, 1)).toBeCloseTo(zoomDur(1, 2), 5);
  });
});

describe('quadraticBezier', () => {
  it('passes through the midpoint of the control triangle at t=0.5', () => {
    expect(quadraticBezier({ x: 0, y: 0, z: 0 }, { x: 0, y: 2, z: 0 }, { x: 2, y: 0, z: 0 }, 0.5))
      .toEqual({ x: 0.5, y: 1, z: 0 });
  });

  it('hits the endpoints at t=0 and t=1', () => {
    const p0 = { x: -1, y: 2, z: 3 };
    const p2 = { x: 4, y: -2, z: 0 };
    expect(quadraticBezier(p0, { x: 0, y: 9, z: 0 }, p2, 0)).toEqual(p0);
    expect(quadraticBezier(p0, { x: 0, y: 9, z: 0 }, p2, 1)).toEqual(p2);
  });
});

describe('offstageFor', () => {
  it('lanterns start above their final spot', () => {
    const to = { x: 2, y: 4.35, z: 1 };
    const { from } = offstageFor('lunar', 'main', to, 0);
    expect(from.x).toBe(to.x);
    expect(from.z).toBe(to.z);
    expect(from.y).toBeGreaterThan(to.y + 2);
  });

  it('pumpkins start below their final spot', () => {
    const to = { x: 2, y: 1, z: 1 };
    const { from } = offstageFor('halloween', 'main', to, 0);
    expect(from.y).toBeLessThan(0);
  });

  it('ghosts start near the column, far from their final spot', () => {
    const to = { x: 3.1, y: 2, z: 0 };
    const { from, ctrl } = offstageFor('halloween', 'flyer', to, 0, 'ghost');
    expect(Math.hypot(from.x, from.z)).toBeLessThan(Math.hypot(to.x, to.z) * 0.5);
    expect(ctrl).toBeDefined();
    expect(ctrl!.y).toBeGreaterThan(to.y);
  });

  it('bats start off-screen with an arc', () => {
    const to = { x: 2.4, y: 3, z: 0 };
    const { from, ctrl } = offstageFor('halloween', 'flyer', to, 0, 'bat');
    expect(Math.abs(from.x)).toBeGreaterThan(5);
    expect(ctrl).toBeDefined();
  });

  it('the gift-drop starts on the sleigh flight path, above the scene', () => {
    const to = { x: 2.75, y: 0.62, z: 0 };
    const { from } = offstageFor('christmas', 'main', to, 0, 'gift-drop');
    expect(from.y).toBeGreaterThan(4);
    expect(from.z).toBeGreaterThan(3);
  });
});

describe('signature drives', () => {
  it('the sleigh crosses the front of the scene and faces its travel direction', () => {
    const out = { pos: { x: 0, y: 0, z: 0 }, rotY: 0 };
    sleighDrivePose(0, out);
    expect(out.pos.x).toBeCloseTo(-7.5, 5);
    expect(out.pos.z).toBeGreaterThan(3);
    sleighDrivePose(0.5, out);
    expect(out.pos.x).toBeCloseTo(0, 5);
    expect(out.pos.y).toBeGreaterThan(6.5);
    expect(out.pos.z).toBeCloseTo(4.85, 2);
    sleighDrivePose(1, out);
    expect(out.pos.x).toBeCloseTo(7.5, 5);
  });

  it('the dragon spiral ends on its orbit circle at the given angle', () => {
    const endAngle = 1.2;
    const drive = dragonDrivePose(endAngle);
    const out = { pos: { x: 0, y: 0, z: 0 }, rotY: 0 };
    drive(1, out);
    expect(Math.hypot(out.pos.x, out.pos.z)).toBeCloseTo(3.4, 5);
    expect(out.pos.y).toBeCloseTo(4.4, 5);
    expect(Math.atan2(out.pos.x, out.pos.z)).toBeCloseTo(endAngle, 5);
    drive(0, out);
    expect(Math.hypot(out.pos.x, out.pos.z)).toBeCloseTo(6.5, 5);
    expect(out.pos.y).toBeCloseTo(7.6, 5);
  });
});

describe('buildIntroTimeline', () => {
  function fullPlan(): IntroPlan {
    return {
      items: [mockItem('main'), mockItem('ambient'), mockItem('flyer')],
      signature: { kind: 'none', group: new THREE.Group() },
      flash: { opacity: 0 },
      snow: { value: 0 },
    };
  }

  it('full mode lasts 5s, carries the five labels, and lands every item on its final spot', () => {
    const plan = fullPlan();
    const { rig } = mockRig();
    const tl = buildIntroTimeline(plan, rig, 'full', true);
    expect(tl).not.toBeNull();
    expect(tl!.duration()).toBeCloseTo(5, 2);
    for (const label of ['s1_trigger', 's2_surprise', 's3_process', 's4_boom', 's5_hold']) {
      expect(tl!.labels[label]).toBeDefined();
    }
    tl!.pause();
    tl!.time(0);
    // t=0: items parked off-stage, camera far out — never at the final pose.
    for (const item of plan.items) {
      expect(item.obj.position.x).toBeCloseTo(item.from.x, 5);
    }
    expect(rig.state.dist).toBeCloseTo(1.8, 5);
    tl!.time(2.0);
    // Early in the process wave (expo.out is fast — check before it lands):
    // items are travelling, not settled yet.
    const mid = plan.items[0].obj.position;
    expect(mid.x).not.toBeCloseTo(plan.items[0].to.x, 1);
    tl!.time(5);
    for (const item of plan.items) {
      expect(item.obj.position.x).toBeCloseTo(item.to.x, 5);
      expect(item.obj.position.y).toBeCloseTo(item.to.y, 5);
      expect(item.obj.scale.x).toBeCloseTo(1, 5);
    }
    expect(rig.state.dist).toBeCloseTo(1, 5);
    expect(rig.state.targetY).toBeCloseTo(3, 5);
    expect(plan.flash!.opacity).toBeCloseTo(0, 5);
    expect(plan.snow!.value).toBeCloseTo(0.92, 5);
  });

  it('fires onIntroEnd when the playhead reaches the end', () => {
    const plan = fullPlan();
    const onIntroEnd = vi.fn();
    plan.onIntroEnd = onIntroEnd;
    const { rig } = mockRig();
    const tl = buildIntroTimeline(plan, rig, 'full', true)!;
    tl.pause();
    tl.time(5);
    expect(onIntroEnd).toHaveBeenCalledTimes(1);
  });

  it('short mode lasts 2s and skips the signature flight', () => {
    const plan = fullPlan();
    const sleigh = new THREE.Group();
    plan.signature = { kind: 'sleigh', group: sleigh, drive: sleighDrivePose, hideAtEnd: true };
    const { rig } = mockRig(1);
    const tl = buildIntroTimeline(plan, rig, 'short', true)!;
    expect(tl.duration()).toBeCloseTo(2, 2);
    expect(tl.labels['s2_surprise']).toBeUndefined();
    tl.pause();
    tl.time(2);
    expect(sleigh.visible).toBe(true);
    for (const item of plan.items) {
      expect(item.obj.position.x).toBeCloseTo(item.to.x, 5);
    }
  });

  it('instant mode builds no timeline', () => {
    const { rig } = mockRig();
    expect(buildIntroTimeline(fullPlan(), rig, 'instant', true)).toBeNull();
  });

  it('with the camera disabled, no camera tween runs', () => {
    const plan = fullPlan();
    const { rig, apply } = mockRig();
    const tl = buildIntroTimeline(plan, rig, 'full', false)!;
    tl.pause();
    tl.time(2.5);
    expect(apply).not.toHaveBeenCalled();
    expect(rig.state.dist).toBeCloseTo(1.8, 5);
  });
});
