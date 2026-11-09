import * as THREE from 'three';
import { gsap } from 'gsap';
import type { ThemeId } from './themes';

export type ThemeDecorations = {
  group: THREE.Group;
  /** GSAP staggered pop-in of every root decoration. */
  enter: (instant?: boolean) => void;
  /** GSAP shrink-out, resolves once every decoration is hidden. */
  leave: () => Promise<void>;
  /** Per-frame ambient animation (float, flap, sway, snow drift…). */
  update: (t: number, dt: number, reduced: boolean) => void;
  dispose: () => void;
};

type EntranceGroup = 'main' | 'flyer' | 'ambient';

type Floater = {
  obj: THREE.Object3D;
  baseY: number;
  phase: number;
  kind: 'bob' | 'sway' | 'orbit' | 'orbitCloud' | 'snow' | 'flap';
  extra?: Record<string, unknown>;
  /** Entrance staging: main pieces first, ambience next, flyers last. */
  group: EntranceGroup;
  /** Fly-out start position (x/z); the floater tweens to its final spot on enter. */
  flyFrom?: { x: number; z: number };
  /** Final x/z when flyFrom is set (position is parked at flyFrom until enter). */
  finalX?: number;
  finalZ?: number;
};

function pumpkin(faceVariant: number) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 24, 18),
    new THREE.MeshStandardMaterial({ color: '#f07818', roughness: 0.55, metalness: 0.05 }),
  );
  body.scale.set(1, 0.82, 1); g.add(body);
  // Two side-lobes for a rounder look
  for (const sx of [-0.1, 0.1]) {
    const lobe = new THREE.Mesh(
      new THREE.SphereGeometry(0.19, 16, 12),
      new THREE.MeshStandardMaterial({ color: '#e06810', roughness: 0.6 }),
    );
    lobe.position.set(sx, 0, 0); lobe.scale.set(1, 0.78, 0.9); g.add(lobe);
  }
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.05, 0.1, 8),
    new THREE.MeshStandardMaterial({ color: '#3f6b2a', roughness: 0.8 }),
  );
  stem.position.y = 0.2; g.add(stem);
  // Procedural face on canvas
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
  const c = cv.getContext('2d')!;
  c.clearRect(0, 0, 256, 256);
  c.fillStyle = 'rgba(255,140,38,0.0)';
  c.fillRect(0, 0, 256, 256);
  c.fillStyle = '#141414';
  if (faceVariant === 0) {
    c.beginPath(); c.moveTo(80,96); c.lineTo(60,128); c.lineTo(100,128); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(176,96); c.lineTo(156,128); c.lineTo(196,128); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(60,166); for (let i=0;i<=5;i++) c.lineTo(60+i*28,166+(i%2===0?26:-8)); c.fill();
  } else if (faceVariant === 1) {
    c.beginPath(); c.arc(85,110,20,0,Math.PI*2); c.fill();
    c.beginPath(); c.arc(171,110,20,0,Math.PI*2); c.fill();
    c.beginPath(); c.arc(128,165,38,0.1,Math.PI-0.1); c.closePath(); c.fill();
    c.fillStyle='#f07818';
    for (let i=0;i<5;i++) c.fillRect(94+i*14,152,10,18);
  } else {
    c.beginPath(); c.arc(85,110,20,Math.PI*1.1,Math.PI*1.9); c.closePath(); c.fill();
    c.beginPath(); c.arc(171,110,20,Math.PI*1.1,Math.PI*1.9); c.closePath(); c.fill();
    c.strokeStyle='#141414'; c.lineWidth=10; c.lineCap='round';
    c.beginPath(); c.moveTo(60,100); c.lineTo(100,115); c.stroke();
    c.beginPath(); c.moveTo(196,100); c.lineTo(156,115); c.stroke();
    c.fillStyle='#141414'; c.beginPath(); c.moveTo(60,170);
    for (let i=0;i<=8;i++) c.lineTo(60+i*17,170+(i%2===0?22:-8)); c.fill();
  }
  const faceTex = new THREE.CanvasTexture(cv);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 0.34),
    new THREE.MeshBasicMaterial({ map: faceTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }),
  );
  face.position.set(0, -0.01, 0.205); g.add(face);
  const glow = new THREE.PointLight('#ff8c26', 1.8, 1.8, 2);
  glow.position.y = 0.05; g.add(glow);
  return g;
}

function ghost() {
  const g = new THREE.Group();
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI * 0.52;
    pts.push(new THREE.Vector2(Math.sin(a) * 0.18, Math.cos(a) * 0.2 + 0.1));
  }
  pts.push(new THREE.Vector2(0.16, 0.02));
  for (let i = 1; i <= 8; i++) {
    const f = i / 8;
    pts.push(new THREE.Vector2(0.16 + Math.sin(f * Math.PI * 4) * 0.03 * (1 - f), 0.02 - f * 0.18));
  }
  const bodyMat = new THREE.MeshStandardMaterial({
    color: '#ddeeff', transparent: true, opacity: 0.62,
    roughness: 0.2, emissive: '#99ccff', emissiveIntensity: 0.55, side: THREE.DoubleSide,
  });
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), bodyMat);
  g.add(body);
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#1a0a2e' });
  for (const x of [-0.06, 0.06]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), eyeMat);
    eye.position.set(x, 0.17, 0.14); g.add(eye);
    // glowing pupils
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), new THREE.MeshBasicMaterial({ color: '#66aaff' }));
    pupil.position.set(x, 0.17, 0.155); g.add(pupil);
  }
  // inner glow point light
  const inner = new THREE.PointLight('#88ccff', 0.9, 1.2, 2);
  inner.position.set(0, 0.1, 0); g.add(inner);
  return g;
}

function bat() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#17111f', roughness: 0.8 });
  const wingMat = new THREE.MeshStandardMaterial({ color: '#241a33', roughness: 0.75, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), bodyMat);
  body.scale.set(1, 0.8, 1.3);
  g.add(body);
  const wings: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(side * 0.16, 0.05);
    shape.quadraticCurveTo(side * 0.1, -0.02, side * 0.07, 0);
    shape.quadraticCurveTo(side * 0.05, -0.03, side * 0.02, -0.005);
    shape.lineTo(0, 0);
    const wing = new THREE.Mesh(new THREE.ShapeGeometry(shape), wingMat);
    const pivot = new THREE.Group();
    pivot.add(wing);
    g.add(pivot);
    wings.push(pivot);
  }
  g.userData.wings = wings;
  return g;
}

function spiderWeb(radius: number) {
  const g = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color: '#c8c8ff', transparent: true, opacity: 0.55 });
  const spokeCount = 8;
  for (let i = 0; i < spokeCount; i++) {
    const a = (i / spokeCount) * Math.PI * 2;
    const pts = [new THREE.Vector3(0,0,0), new THREE.Vector3(Math.cos(a)*radius, 0, Math.sin(a)*radius)];
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
  }
  for (let ring = 1; ring <= 5; ring++) {
    const r = (ring / 5) * radius;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= spokeCount; i++) {
      const a = (i / spokeCount) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a)*r, 0, Math.sin(a)*r));
    }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
  }
  return g;
}

function spider3d() {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: '#1a0a2e', roughness: 0.7, emissive: '#330088', emissiveIntensity: 0.4 });
  const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), dark);
  abdomen.position.set(0, 0.06, 0); g.add(abdomen);
  const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), dark);
  thorax.position.set(0, 0, 0); g.add(thorax);
  // 8 legs
  for (let i = 0; i < 4; i++) {
    for (const side of [-1, 1]) {
      const legGroup = new THREE.Group();
      const seg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.08, 6), dark);
      seg1.position.set(side * 0.04, 0, 0); seg1.rotation.z = side * 0.8;
      legGroup.add(seg1);
      legGroup.position.y = 0;
      g.add(legGroup);
    }
  }
  // red eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#ff0000' });
  for (let i = 0; i < 4; i++) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), eyeMat);
    eye.position.set((-1.5 + i) * 0.012, 0.004, 0.034);
    g.add(eye);
  }
  return g;
}

function treatsBucket() {
  const g = new THREE.Group();
  const orangeMat = new THREE.MeshStandardMaterial({ color: '#f07818', roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.2, 20), orangeMat);
  body.position.y = 0.1; g.add(body);
  // pumpkin face cutout — use emissive plane
  const faceMat = new THREE.MeshStandardMaterial({ color: '#141414', emissive: '#ff6600', emissiveIntensity: 0.9 });
  const faceDecal = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.1), faceMat);
  faceDecal.position.set(0, 0.11, 0.142); g.add(faceDecal);
  // handle
  const handleMat = new THREE.MeshStandardMaterial({ color: '#5c3a1e', roughness: 0.8 });
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 6, 20, Math.PI), handleMat);
  handle.position.y = 0.21; handle.rotation.x = Math.PI / 2; g.add(handle);
  // candy spills
  const candyColors = ['#ff4466', '#44ffaa', '#ffdd22', '#aa44ff'];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const candy = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6),
      new THREE.MeshStandardMaterial({ color: candyColors[i], roughness: 0.3, emissive: candyColors[i], emissiveIntensity: 0.3 }));
    candy.position.set(Math.cos(a) * 0.08, 0.22, Math.sin(a) * 0.08);
    g.add(candy);
  }
  return g;
}

function skeleton3d() {
  const g = new THREE.Group();
  const bone = new THREE.MeshStandardMaterial({ color: '#d8d8d8', roughness: 0.5, emissive: '#99ffaa', emissiveIntensity: 0.12 });
  // skull
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), bone);
  skull.position.y = 0.9; g.add(skull);
  // jaw
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.09), bone);
  jaw.position.set(0, 0.78, 0.02); g.add(jaw);
  // spine
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8), bone);
  spine.position.y = 0.52; g.add(spine);
  // ribs (3 pairs)
  for (let i = 0; i < 3; i++) {
    const ry = 0.72 - i * 0.1;
    for (const side of [-1, 1]) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 16, Math.PI), bone);
      rib.position.set(side * 0.04, ry, 0); rib.rotation.y = side * Math.PI / 2;
      g.add(rib);
    }
  }
  // pelvis
  const pelvis = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 20, Math.PI * 2), bone);
  pelvis.position.y = 0.32; pelvis.rotation.x = Math.PI / 2; g.add(pelvis);
  // arms
  for (const side of [-1, 1]) {
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 8), bone);
    upper.position.set(side * 0.22, 0.6, 0); upper.rotation.z = side * 0.4; g.add(upper);
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 8), bone);
    lower.position.set(side * 0.3, 0.42, 0); lower.rotation.z = side * 0.8; g.add(lower);
  }
  // legs
  for (const side of [-1, 1]) {
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.28, 8), bone);
    upper.position.set(side * 0.07, 0.17, 0); g.add(upper);
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 8), bone);
    lower.position.set(side * 0.07, -0.12, 0); g.add(lower);
  }
  return g;
}

function giftBox(i: number) {
  const wrapColors = ['#d23a2e', '#1f7a4d', '#2a5f9e', '#f0c24b'];
  const g = new THREE.Group();
  const boxMat = new THREE.MeshStandardMaterial({ color: wrapColors[i % wrapColors.length], roughness: 0.5 });
  const ribbonMat = new THREE.MeshStandardMaterial({ color: '#f0c24b', roughness: 0.35, metalness: 0.5 });
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.14), boxMat));
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.125, 0.035), ribbonMat);
  g.add(band);
  const band2 = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.125, 0.145), ribbonMat);
  g.add(band2);
  const bow = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), ribbonMat);
  bow.position.y = 0.075;
  g.add(bow);
  return g;
}

function christmasTree(size = 1) {
  const g = new THREE.Group();
  const green = new THREE.MeshStandardMaterial({ color: '#1a5c2a', roughness: 0.7 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.03*size, 0.04*size, 0.12*size, 8),
    new THREE.MeshStandardMaterial({ color: '#5c3a1e', roughness: 0.9 }));
  trunk.position.y = 0.06*size; g.add(trunk);
  for (let tier = 0; tier < 3; tier++) {
    const r = (0.22 - tier * 0.055) * size;
    const h = 0.18 * size;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 20), green);
    cone.position.y = (0.17 + tier * 0.14) * size; g.add(cone);
  }
  // baubles
  const bc = ['#d23a2e','#f0c24b','#2a7f5f','#88aaff'];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const tier = i % 3;
    const r2 = (0.14 - tier * 0.03) * size;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.025*size, 8, 6),
      new THREE.MeshStandardMaterial({ color: bc[i%4], roughness: 0.3, metalness: 0.5, emissive: bc[i%4], emissiveIntensity: 0.3 }));
    b.position.set(Math.cos(a)*r2, (0.2+tier*0.14)*size, Math.sin(a)*r2); g.add(b);
  }
  // star on top
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.04*size),
    new THREE.MeshStandardMaterial({ color: '#ffd700', emissive: '#ffd700', emissiveIntensity: 1.2, roughness: 0.1 }));
  star.position.y = 0.57*size; g.add(star);
  return g;
}

function candyCane() {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.3, 0),
    new THREE.Vector3(0.04, 0.38, 0), new THREE.Vector3(0.1, 0.4, 0),
  ]);
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: '#e82020', roughness: 0.4 });
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.022, 10), mat);
  g.add(tube);
  // stripe segments
  for (let i = 0; i < 6; i++) {
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.011, 6, 16), stripeMat);
    stripe.position.y = i * 0.06;
    stripe.rotation.x = Math.PI / 2;
    g.add(stripe);
  }
  return g;
}

// One shared radial glow texture + sprite material for all firework orbs
// (replaces 80 per-ball PointLights — see lunarFireworkOrb). Lazily built
// so importing this module never touches the DOM (tests, SSR).
let glowTexture: THREE.CanvasTexture | null = null;
let glowMaterial: THREE.SpriteMaterial | null = null;
function getGlowMaterial(): THREE.SpriteMaterial {
  if (!glowMaterial) {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d')!;
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,220,150,0.55)');
    grad.addColorStop(1, 'rgba(255,180,80,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    glowTexture = new THREE.CanvasTexture(c);
    glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture, blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, opacity: 0.85,
    });
  }
  return glowMaterial;
}

function lunarFireworkOrb() {
  const g = new THREE.Group();
  const colors = ['#ff4400', '#ffd700', '#ff88cc', '#44ddff'];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const r = 0.18 + Math.sin(i * 2.3) * 0.06;
    const col = colors[i % 4];
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6),
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.5, roughness: 0.1 }));
    orb.position.set(Math.cos(a)*r, Math.sin(i*0.9)*0.08, Math.sin(a)*r); g.add(orb);
    // No PointLight per ball: 4 orbs x 20 balls was 80 lights. The emissive
    // balls plus one shared additive glow sprite below read the same.
  }
  const glow = new THREE.Sprite(getGlowMaterial());
  glow.scale.setScalar(0.9);
  g.add(glow);
  return g;
}

function lantern(withLight = false) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 24, 18),
    new THREE.MeshStandardMaterial({
      color: '#d2222d', roughness: 0.45,
      emissive: '#ff4d2e', emissiveIntensity: 0.55,
    }),
  );
  body.scale.set(1, 0.82, 1);
  g.add(body);
  const capMat = new THREE.MeshStandardMaterial({ color: '#f0c75e', roughness: 0.35, metalness: 0.5 });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.03, 16), capMat);
  cap.position.y = 0.13;
  g.add(cap);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.025, 16), capMat);
  base.position.y = -0.13;
  g.add(base);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.12, 6), capMat);
  cord.position.y = -0.2;
  g.add(cord);
  const tassel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.02, 0.07, 8),
    new THREE.MeshStandardMaterial({ color: '#d2222d', roughness: 0.6 }),
  );
  tassel.position.y = -0.29;
  g.add(tassel);
  // Only a few lanterns carry a real light (was 10); the rest read via
  // emissive. Keeps the Lunar total at 3 lantern lights + 0 orb lights.
  if (withLight) {
    const glow = new THREE.PointLight('#ff6a3c', 1.4, 1.4, 2);
    glow.position.y = -0.02;
    g.add(glow);
  }
  return g;
}

// 3D auspicious cloud: cluster of soft white spheres slow-drifting around the carousel.
function cloud() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, roughness: 0.95 });
  const parts: [number, number, number, number][] = [
    [0, 0, 0, 0.12], [-0.11, 0.01, 0.02, 0.08], [0.1, 0.015, -0.02, 0.085],
    [0.03, 0.07, 0, 0.07], [-0.05, 0.06, -0.01, 0.055],
  ];
  for (const [x, y, z, r] of parts) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
    m.position.set(x, y, z);
    m.scale.z = 0.7;
    g.add(m);
  }
  return g;
}

/** Build the whole 3D decoration layer for a holiday theme. Default theme gets an empty layer. */
export function createThemeDecorations(
  theme: ThemeId,
): ThemeDecorations {
  const group = new THREE.Group();
  group.name = `theme-decorations-${theme}`;
  const floaters: Floater[] = [];
  const roots: THREE.Object3D[] = [];
  const snowPoints: { points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>; speeds: Float32Array; bases: Float32Array }[] = [];

  const add = (
    obj: THREE.Object3D,
    kind: Floater['kind'],
    extra?: Floater['extra'],
    entranceGroup: EntranceGroup = 'main',
    flyFrom?: { x: number; z: number },
  ) => {
    obj.userData.phase = Math.random() * Math.PI * 2;
    const floater: Floater = { obj, baseY: obj.position.y, phase: obj.userData.phase, kind, extra, group: entranceGroup, flyFrom };
    if (flyFrom) {
      floater.finalX = obj.position.x;
      floater.finalZ = obj.position.z;
      obj.position.x = flyFrom.x;
      obj.position.z = flyFrom.z;
    }
    floaters.push(floater);
    roots.push(obj);
    group.add(obj);
  };

  if (theme === 'halloween') {
    // 6 pumpkins with 3 different face variants, alternating positions
    for (let i = 0; i < 6; i++) {
      const p = pumpkin(i % 3);
      const a = (i / 6) * Math.PI * 2 + 0.35;
      p.position.set(Math.sin(a) * 2.6, 0.55 + (i % 3) * 1.15, Math.cos(a) * 2.6);
      p.rotation.y = Math.random() * Math.PI * 2;
      add(p, 'bob');
    }
    // 5 vivid ghosts (3 expression variants) — fly out from behind the frames
    for (let i = 0; i < 5; i++) {
      const gh = ghost();
      const a = (i / 5) * Math.PI * 2 + 1;
      const fx = Math.sin(a) * 3.1, fz = Math.cos(a) * 3.1;
      gh.position.set(fx, 1.4 + i * 0.75, fz);
      add(gh, 'sway', undefined, 'flyer', { x: fx * 0.12, z: fz * 0.12 });
    }
    // 12 bats
    for (let i = 0; i < 12; i++) {
      const b = bat();
      const a = (i / 12) * Math.PI * 2;
      add(b, 'orbit', { angle: a, radius: 2.4 + Math.random() * 1.2, speed: 0.25 + Math.random() * 0.4, y: 2 + Math.random() * 3.6, wobble: Math.random() }, 'flyer');
    }
    // Spider webs + spiders at top of carousel (attached high up)
    for (let i = 0; i < 2; i++) {
      const webA = (i / 2) * Math.PI * 2 + 0.8;
      const webR = 2.1;
      const web = spiderWeb(0.4);
      web.position.set(Math.sin(webA) * webR, 5.1, Math.cos(webA) * webR);
      web.rotation.x = Math.PI / 2;
      add(web, 'bob', undefined, 'ambient');
      const sp = spider3d();
      sp.position.set(Math.sin(webA) * webR, 4.7 + i * 0.3, Math.cos(webA) * webR);
      add(sp, 'sway', undefined, 'ambient');
    }
    // Skeletons (2) near the base
    for (let i = 0; i < 2; i++) {
      const a = i * Math.PI + 0.5;
      const sk = skeleton3d();
      sk.position.set(Math.sin(a) * 2.0, 0.0, Math.cos(a) * 2.0);
      sk.rotation.y = -a;
      add(sk, 'sway');
    }
    // Treats bucket on the carousel base
    const bucket = treatsBucket();
    bucket.position.set(1.0, 0.22, 1.0);
    bucket.rotation.y = -0.5;
    add(bucket, 'bob');
  }

  if (theme === 'christmas') {
    // Christmas trees (2)
    for (let i = 0; i < 2; i++) {
      const tree = christmasTree(0.9);
      const a = (i / 2) * Math.PI * 2 + 0.9;
      tree.position.set(Math.sin(a) * 2.5, 0.0, Math.cos(a) * 2.5);
      tree.rotation.y = a;
      add(tree, 'bob');
    }
    // Candy canes (4) near base
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const cc = candyCane();
      cc.position.set(Math.sin(a) * 1.8, 0.0, Math.cos(a) * 1.8);
      cc.rotation.y = a;
      add(cc, 'bob');
    }
    for (let i = 0; i < 8; i++) {
      const g = giftBox(i);
      const a = (i / 8) * Math.PI * 2 + 0.2;
      g.position.set(Math.sin(a) * 2.75, 0.62 + (i % 4) * 1.05, Math.cos(a) * 2.75);
      g.rotation.y = a;
      add(g, 'bob');
    }
    // Baubles swaying from the canopy rim.
    const baubleColors = ['#d23a2e', '#f0c24b', '#2a7f5f', '#cfe8ff'];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.13;
      const b = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 12, 10),
        new THREE.MeshStandardMaterial({
          color: baubleColors[i % 4], roughness: 0.22, metalness: 0.65,
          emissive: baubleColors[i % 4], emissiveIntensity: 0.3,
        }),
      );
      b.position.set(Math.sin(a) * 2.28, 4.62, Math.cos(a) * 2.28);
      add(b, 'sway', undefined, 'ambient');
    }
    // Falling snow: points inside a cylinder around the carousel.
    const count = 260;
    const pos = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const bases = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 2.0 + Math.random() * 2.8;
      pos.set([Math.sin(a) * r, Math.random() * 7, Math.cos(a) * r], i * 3);
      speeds[i] = 0.25 + Math.random() * 0.5;
      bases[i * 2] = Math.random() * Math.PI * 2;
      bases[i * 2 + 1] = r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: '#ffffff', size: 0.05, transparent: true, opacity: 0.92, depthWrite: false, sizeAttenuation: true });
    const points = new THREE.Points(geo, mat);
    points.name = 'christmas-snowfall';
    group.add(points);
    snowPoints.push({ points, speeds, bases });
  }

  if (theme === 'lunar') {
    // 10 lanterns at two heights; only the first 3 carry a PointLight
    for (let i = 0; i < 10; i++) {
      const l = lantern(i < 3);
      const a = (i / 10) * Math.PI * 2 + 0.4;
      l.position.set(Math.sin(a) * 2.35, 4.35 + (i % 2) * 0.4, Math.cos(a) * 2.35);
      add(l, 'sway');
    }
    // Auspicious clouds drifting around
    for (let i = 0; i < 6; i++) {
      const c = cloud();
      const a = (i / 6) * Math.PI * 2 + 0.9;
      c.position.set(Math.sin(a) * 3.6, 1.1 + i * 0.8, Math.cos(a) * 3.6);
      c.scale.setScalar(0.9 + (i % 3) * 0.25);
      add(c, 'orbitCloud', { angle: a, radius: 3.6, y: 1.1 + i * 0.8, speed: 0.05 + (i % 3) * 0.02 }, 'ambient');
    }
    // Firework-style orbs floating near the top
    for (let i = 0; i < 4; i++) {
      const fw = lunarFireworkOrb();
      const a = (i / 4) * Math.PI * 2 + 0.3;
      fw.position.set(Math.sin(a) * 2.8, 3.5 + i * 0.4, Math.cos(a) * 2.8);
      add(fw, 'orbit', { angle: a, radius: 2.8, speed: 0.18 + i * 0.04, y: 3.5 + i * 0.4, wobble: 0.4 }, 'flyer');
    }
  }

  const disposables: { dispose(): void }[] = [];
  group.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) disposables.push(mesh.geometry);
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (mat) (Array.isArray(mat) ? mat : [mat]).forEach(m => disposables.push(m));
  });

  // Grouped entrance beats: main pieces pop in first, ambience follows,
  // flyers (bats, ghosts, firework orbs) arrive last. Flyers with a
  // flyFrom start near the column and glide out to their final spot.
  const GROUP_DELAY: Record<EntranceGroup, number> = { main: 0.1, ambient: 0.5, flyer: 0.9 };

  function enter(instant = false) {
    if (instant) {
      floaters.forEach(f => {
        if (f.flyFrom && f.finalX !== undefined && f.finalZ !== undefined) {
          f.obj.position.x = f.finalX;
          f.obj.position.z = f.finalZ;
        }
      });
      roots.forEach(r => r.scale.setScalar(1));
      return;
    }
    const seen: Record<EntranceGroup, number> = { main: 0, ambient: 0, flyer: 0 };
    roots.forEach((root, i) => {
      const floater = floaters[i];
      const groupDelay = GROUP_DELAY[floater.group] + seen[floater.group] * 0.05;
      seen[floater.group]++;
      root.scale.setScalar(0.001);
      gsap.to(root.scale, {
        x: 1, y: 1, z: 1,
        duration: 0.9,
        delay: groupDelay,
        ease: 'elastic.out(1, 0.6)',
        overwrite: true,
      });
      if (floater.flyFrom && floater.finalX !== undefined && floater.finalZ !== undefined) {
        const { finalX, finalZ } = floater;
        gsap.to(root.position, {
          x: finalX, z: finalZ,
          duration: 1.3,
          delay: groupDelay,
          ease: 'sine.out',
          overwrite: true,
        });
      }
    });
    for (const s of snowPoints) {
      s.points.material.opacity = 0;
      gsap.to(s.points.material, { opacity: 0.9, duration: 1.4, ease: 'power2.out', overwrite: true });
    }
  }

  function leave() {
    const jobs = roots.map((root, i) => new Promise<void>(resolve => {
      gsap.killTweensOf(root.position);
      gsap.to(root.scale, {
        x: 0.001, y: 0.001, z: 0.001,
        duration: 0.55,
        delay: i * 0.03,
        ease: 'power2.in',
        overwrite: true,
        onComplete: () => resolve(),
      });
    }));
    for (const s of snowPoints) {
      jobs.push(new Promise<void>(resolve => {
        gsap.to(s.points.material, { opacity: 0, duration: 0.5, ease: 'power2.in', overwrite: true, onComplete: () => resolve() });
      }));
    }
    return jobs.length ? Promise.all(jobs).then(() => undefined) : Promise.resolve();
  }

  function update(t: number, dt: number, reduced: boolean) {
    const k = reduced ? 0.25 : 1;
    for (const f of floaters) {
      const p = f.phase;
      if (f.kind === 'bob') {
        f.obj.position.y = f.baseY + Math.sin(t * 0.9 + p) * 0.09 * k;
        f.obj.rotation.y += dt * 0.3 * k;
      } else if (f.kind === 'sway') {
        f.obj.position.y = f.baseY + Math.sin(t * 0.7 + p) * 0.07 * k;
        f.obj.rotation.z = Math.sin(t * 0.8 + p) * 0.12 * k;
        f.obj.rotation.y = Math.sin(t * 0.3 + p) * 0.3 * k;
      } else if (f.kind === 'orbit') {
        const e = f.extra ?? {};
        const angle = Number(e.angle) + dt * (Number(e.speed) || 0.2) * k;
        e.angle = angle;
        const wob = Number(e.wobble) || 0;
        f.obj.position.set(
          Math.sin(angle) * Number(e.radius),
          Number(e.y) + Math.sin(t * (1.3 + wob) + p) * 0.28 * k,
          Math.cos(angle) * Number(e.radius),
        );
        f.obj.rotation.y = -angle + Math.PI / 2;
        const wings = f.obj.userData.wings as THREE.Object3D[] | undefined;
        if (wings) {
          const flap = Math.sin(t * (7 + wob * 4) + p) * 0.7;
          wings[0]!.rotation.z = -flap;
          wings[1]!.rotation.z = flap;
        }
      } else if (f.kind === 'orbitCloud') {
        const e = f.extra ?? {};
        const angle = Number(e.angle) + dt * (Number(e.speed) || 0.05) * k;
        e.angle = angle;
        f.obj.position.set(
          Math.sin(angle) * Number(e.radius),
          Number(e.y) + Math.sin(t * 0.5 + p) * 0.12 * k,
          Math.cos(angle) * Number(e.radius),
        );
      }
    }
    for (const { points, speeds, bases } of snowPoints) {
      const attr = points.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < speeds.length; i++) {
        let y = arr[i * 3 + 1] - speeds[i] * dt * k;
        if (y < -0.2) y = 7.2;
        const drift = Math.sin(t * 0.6 + bases[i * 2]) * 0.12 * k;
        const r = bases[i * 2 + 1];
        const a = Math.atan2(arr[i * 3], arr[i * 3 + 2]) + dt * 0.08;
        arr[i * 3] = Math.sin(a) * r + drift;
        arr[i * 3 + 1] = y;
        arr[i * 3 + 2] = Math.cos(a) * r;
      }
      attr.needsUpdate = true;
    }
  }

  function dispose() {
    disposables.forEach(d => d.dispose());
    group.removeFromParent();
  }

  return { group, enter, leave, update, dispose };
}
