import { gsap } from 'gsap';
import type * as THREE from 'three';
import type { ThemeId } from './themes';

// ---------------------------------------------------------------------------
// Intro timeline factory — the huashu-design animation language, translated
// to GSAP for the carousel lamp.
//
// Storyboard (full version, ~5s). One mirror, one motion per beat:
//   s1_trigger  0.0-0.8  bare carousel, camera starts its dolly-in
//   s2_surprise 0.8-1.8  signature fly-in (sleigh / dragon / ghost burst)
//   s3_process  1.8-3.5  decorations arrive in waves along arcs (30ms stagger)
//   s4_boom     3.5-4.3  camera pulls out to full view + crown pop + light flash
//   s5_hold     4.3-5.0  everything settled, hands off to idle animation
// Short version (~2s, theme switch / saved view): no signature, waves only,
// camera micro-push. Reduced motion: no timeline at all (instant final pose).
//
// Rules enforced here (gsap-recipes / camera-language):
// - main easing expo.out, landings back.out, exits power1.in — never linear
// - entrances are fromTo (never from) — seek-safe, both ends explicit
// - camera lives on its own proxy; it never shares a transform with elements
// - zoom durations follow the log formula: 0.55 * |log2(z2/z1)|, clamped
//   [0.30, 0.94]; push-ins are >= 1.25x (the 1.06x establishing micro-push
//   is the only exception)
// ---------------------------------------------------------------------------

export type IntroMode = 'full' | 'short' | 'instant';
export type EntranceGroup = 'main' | 'ambient' | 'flyer';

export type Vec3 = { x: number; y: number; z: number };

export function selectIntroMode(opts: {
  reduced: boolean;
  hasSavedView: boolean;
  isFirstTheme: boolean;
  forceInstant?: boolean;
}): IntroMode {
  if (opts.forceInstant || opts.reduced) return 'instant';
  if (opts.isFirstTheme && !opts.hasSavedView) return 'full';
  return 'short';
}

/** Log-scaled zoom duration (camera-language §4.2): 1→2x is exactly 0.55s. */
export function zoomDur(z1: number, z2: number): number {
  return gsap.utils.clamp(0.3, 0.94, (0.55 * Math.abs(Math.log(z2 / z1))) / Math.LN2);
}

export function quadraticBezier(p0: Vec3, p1: Vec3, p2: Vec3, t: number): Vec3 {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    z: u * u * p0.z + 2 * u * t * p1.z + t * t * p2.z,
  };
}

// ---------------------------------------------------------------------------
// Off-stage starts. The whole point of the rewrite: at t=0 every decoration
// sits at an explicit off-stage position (above / below / far side / behind
// the frames) — never at its final spot. `flavor` picks the item-specific
// variant inside the flyer group.
// ---------------------------------------------------------------------------

export type OffstageFlavor = 'ghost' | 'bat' | 'orb' | 'gift-drop' | undefined;

export function offstageFor(
  theme: ThemeId,
  group: EntranceGroup,
  to: Vec3,
  index: number,
  flavor: OffstageFlavor = undefined,
): { from: Vec3; ctrl?: Vec3 } {
  const radial = (r: number): Vec3 => {
    const len = Math.hypot(to.x, to.z) || 1;
    return { x: (to.x / len) * r, y: to.y, z: (to.z / len) * r };
  };
  const mid = (a: Vec3, b: Vec3): Vec3 => ({
    x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2,
  });
  const outward = (a: Vec3, b: Vec3, k: number): Vec3 => {
    const m = mid(a, b);
    const len = Math.hypot(m.x, m.z) || 1;
    return { x: m.x + (m.x / len) * k, y: m.y, z: m.z + (m.z / len) * k };
  };
  if (flavor === 'gift-drop') {
    // Dropped by the passing sleigh: falls from the flight path, not from a side.
    const from = { x: 0.5, y: 5.0, z: 4.0 };
    return { from, ctrl: { x: 0.5, y: 3.0, z: 3.6 } };
  }
  if (group === 'main') {
    if (theme === 'lunar') return { from: { x: to.x, y: 7.6, z: to.z } };
    if (theme === 'halloween') return { from: { x: to.x, y: -1.4, z: to.z } };
    return { from: radial(5.6) };
  }
  if (group === 'ambient') {
    if (theme === 'lunar') return { from: radial(7.2) };
    return { from: { x: to.x, y: 7.2, z: to.z } };
  }
  // flyer
  if (flavor === 'ghost') {
    const from = { x: to.x * 0.12, y: to.y, z: to.z * 0.12 };
    const ctrl = outward(from, to, 2.2);
    ctrl.y = mid(from, to).y + 1.6;
    return { from, ctrl };
  }
  if (flavor === 'bat') {
    const side = index % 2 === 0 ? -1 : 1;
    const from = { x: side * 7.5, y: to.y + 1.5, z: -side * 3 };
    const ctrl = mid(from, to);
    ctrl.y += 1.2;
    return { from, ctrl };
  }
  if (flavor === 'orb') {
    const from = { x: 0, y: 6.8, z: 0 };
    const ctrl = outward(from, to, 1.2);
    ctrl.y = mid(from, to).y + 0.5;
    return { from, ctrl };
  }
  return { from: radial(7) };
}

// ---------------------------------------------------------------------------
// Signature flight paths (pure pose functions, progress 0..1 -> pose).
// The sleigh crosses the front of the scene on a bezier arc; the dragon
// spirals down from above and lands on its slow orbit circle.
// ---------------------------------------------------------------------------

export type DriveOut = { pos: Vec3; rotY: number };

export function sleighDrivePose(p: number, out: DriveOut): void {
  const p0 = { x: -7.5, y: 5.8, z: 3.5 };
  const p1 = { x: 0, y: 7.4, z: 6.2 };
  const p2 = { x: 7.5, y: 5.8, z: 3.5 };
  const pos = quadraticBezier(p0, p1, p2, p);
  const ahead = quadraticBezier(p0, p1, p2, Math.min(1, p + 0.02));
  out.pos = pos;
  out.rotY = Math.atan2(ahead.x - pos.x, ahead.z - pos.z);
}

/** Spiral: 1.25 turns, radius 6.5 -> 3.4, height 7.6 -> 4.4, ending at angle A. */
export function dragonDrivePose(endAngle: number): (p: number, out: DriveOut) => void {
  const turns = 1.25 * Math.PI * 2;
  const a0 = endAngle - turns;
  return (p: number, out: DriveOut) => {
    const a = a0 + p * turns;
    const r = 6.5 + (3.4 - 6.5) * p;
    const y = 7.6 + (4.4 - 7.6) * p;
    out.pos = { x: Math.sin(a) * r, y, z: Math.cos(a) * r };
    out.rotY = Math.PI / 2 + a;
  };
}

// ---------------------------------------------------------------------------
// Timeline inputs
// ---------------------------------------------------------------------------

export type EntranceItem = {
  obj: THREE.Object3D;
  from: Vec3;
  to: Vec3;
  ctrl?: Vec3;
  group: EntranceGroup;
  /** Start scale (default 0.55); ghosts burst in from 1.5. */
  scaleFrom?: number;
  /** rotation.y to settle at (orbit items arrive already facing travel). */
  finalRotY?: number;
};

export type SignatureActor = {
  kind: 'sleigh' | 'dragon' | 'none';
  group: THREE.Group;
  /** progress 0..1 -> pose; the timeline drives the group through it. */
  drive?: (p: number, out: DriveOut) => void;
  /** Hide after the fly-past (sleigh leaves; the dragon stays to orbit). */
  hideAtEnd?: boolean;
};

export type CameraRig = {
  /** dist is relative to the home distance (1 = home); targetY is world Y. */
  state: { dist: number; targetY: number };
  apply: () => void;
  /** Crown / heart finial, popped lightly at the boom. */
  crown: THREE.Object3D | null;
};

export type IntroPlan = {
  items: EntranceItem[];
  signature: SignatureActor;
  /** Per-layer flash sprite material (s4); tween its opacity. */
  flash: { opacity: number } | null;
  /** Snow shader uniform (christmas); tween its value. */
  snow: { value: number } | null;
  /** Fires when the timeline reaches its end (ungate idle motion). */
  onIntroEnd?: () => void;
};

const WAVE_START: Record<EntranceGroup, number> = { main: 0, ambient: 0.4, flyer: 0.8 };

function flyItem(tl: gsap.core.Timeline, item: EntranceItem, at: number, dur: number): void {
  const obj = item.obj;
  const scaleFrom = item.scaleFrom ?? 0.55;
  if (item.ctrl) {
    const proxy = { p: 0 };
    tl.fromTo(proxy, { p: 0 }, {
      p: 1, duration: dur, ease: 'expo.out',
      onUpdate: () => {
        const pos = quadraticBezier(item.from, item.ctrl!, item.to, proxy.p);
        obj.position.set(pos.x, pos.y, pos.z);
      },
    }, at);
  } else {
    tl.fromTo(obj.position,
      { x: item.from.x, y: item.from.y, z: item.from.z },
      { x: item.to.x, y: item.to.y, z: item.to.z, duration: dur, ease: 'expo.out' },
      at);
  }
  tl.fromTo(obj.scale,
    { x: scaleFrom, y: scaleFrom, z: scaleFrom },
    { x: 1, y: 1, z: 1, duration: dur, ease: 'back.out(1.7)' },
    at);
  if (item.finalRotY !== undefined) {
    tl.fromTo(obj.rotation,
      { y: obj.rotation.y },
      { y: item.finalRotY, duration: dur, ease: 'expo.out' },
      at);
  }
}

export function buildIntroTimeline(
  plan: IntroPlan,
  rig: CameraRig | null,
  mode: IntroMode,
  cameraEnabled: boolean,
): gsap.core.Timeline | null {
  if (mode === 'instant') return null;
  const full = mode === 'full';
  const s3 = full ? 1.8 : 0.3;
  const s4 = full ? 3.5 : 1.6;
  const s5 = full ? 4.3 : 1.9;
  const total = full ? 5.0 : 2.0;
  const waveDur = full ? 0.9 : 0.6;

  const tl = gsap.timeline({
    defaults: { ease: 'expo.out' },
  });

  // Labels first: the five-beat skeleton is the contract, tweens hang off it.
  tl.addLabel('s1_trigger', 0);
  if (full) tl.addLabel('s2_surprise', 0.8);
  tl.addLabel('s3_process', s3);
  tl.addLabel('s4_boom', s4);
  tl.addLabel('s5_hold', s5);

  // ---- Camera rig: one continuous dolly, then pull-out + settle ----
  if (rig && cameraEnabled) {
    if (full) {
      tl.fromTo(rig.state,
        { dist: rig.state.dist, targetY: rig.state.targetY },
        { dist: 1, duration: 3.5, ease: 'power3.inOut', onUpdate: rig.apply },
        0);
      // Follow the fly-past: look up while the signature crosses, then back.
      tl.to(rig.state, { targetY: rig.state.targetY + 0.8, duration: 0.7, ease: 'power2.inOut', onUpdate: rig.apply }, 0.8);
      tl.to(rig.state, { targetY: rig.state.targetY, duration: 1.1, ease: 'power2.inOut', onUpdate: rig.apply }, 1.5);
      tl.to(rig.state, { dist: 1.16, duration: 0.7, ease: 'power3.inOut', onUpdate: rig.apply }, 's4_boom');
      tl.to(rig.state, { dist: 1, duration: 0.4, ease: 'power2.out', onUpdate: rig.apply }, 4.2);
    } else {
      const home = rig.state.dist;
      tl.fromTo(rig.state, { dist: home }, { dist: home * 1.08, duration: 0.6, ease: 'power2.inOut', onUpdate: rig.apply }, 0);
      tl.to(rig.state, { dist: home, duration: 0.6, ease: 'power2.inOut', onUpdate: rig.apply }, 0.6);
    }
    // Crown pop at the boom — the one 120% moment; small, then back.
    if (rig.crown) {
      const pop = full ? 1.07 : 1.04;
      const popDur = full ? 0.25 : 0.2;
      tl.fromTo(rig.crown.scale,
        { x: 1, y: 1, z: 1 },
        { x: pop, y: pop, z: pop, duration: popDur, ease: 'back.out(2)', yoyo: true, repeat: 1 },
        's4_boom');
    }
  }

  // ---- Signature fly-in (full only) ----
  if (full && plan.signature.kind !== 'none' && plan.signature.drive) {
    const actor = plan.signature;
    const proxy = { p: 0 };
    const out: DriveOut = { pos: { x: 0, y: 0, z: 0 }, rotY: 0 };
    const dur = actor.kind === 'dragon' ? 1.6 : 1.0;
    tl.fromTo(proxy, { p: 0 }, {
      p: 1, duration: dur, ease: 'power1.inOut',
      onUpdate: () => {
        actor.drive!(proxy.p, out);
        actor.group.position.set(out.pos.x, out.pos.y, out.pos.z);
        actor.group.rotation.y = out.rotY;
      },
    }, 's2_surprise');
    if (actor.hideAtEnd) tl.set(actor.group, { visible: false }, 's2_surprise+=1.0');
  }

  // ---- Waves: main, then ambience, then flyers; 30ms stagger inside a wave ----
  const seen: Record<EntranceGroup, number> = { main: 0, ambient: 0, flyer: 0 };
  for (const item of plan.items) {
    const at = s3 + WAVE_START[item.group] + seen[item.group] * 0.03;
    seen[item.group]++;
    flyItem(tl, item, at, waveDur);
  }

  // ---- Snow fades in with the waves ----
  if (plan.snow) {
    tl.fromTo(plan.snow, { value: 0 }, { value: 0.92, duration: 1.4, ease: 'power2.out' }, s3);
  }

  // ---- Boom flash (theme-coloured glow, 0 -> peak -> 0) ----
  if (plan.flash) {
    const flashIn = full ? 0.18 : 0.12;
    const flashOut = full ? 0.55 : 0.28;
    tl.fromTo(plan.flash, { opacity: 0 }, { opacity: 0.55, duration: flashIn, ease: 'power2.in' }, 's4_boom');
    tl.to(plan.flash, { opacity: 0, duration: flashOut, ease: 'power2.out' }, `s4_boom+=${flashIn}`);
  }

  // ---- Hold: nothing moves after s5 — the settled frame IS the ending ----
  // Pad out to the nominal total so duration() reads 5.0 / 2.0 and the
  // hand-off to idle fires after a real hold, not mid-motion.
  const pad = total - tl.duration();
  if (pad > 0) tl.to({}, { duration: pad }, tl.duration());
  // tl.call (not onComplete): deterministic — fires on seek-to-end too.
  tl.call(() => plan.onIntroEnd?.(), [], total);
  return tl;
}
