import * as THREE from 'three';
import type { ThemeId } from './themes';

export type ThemeDecorations = {
  group: THREE.Group;
  /** Per-frame ambient animation (float, flap, sway, snow drift…). */
  update: (t: number, dt: number, reduced: boolean) => void;
  dispose: () => void;
};

type Floater = {
  obj: THREE.Object3D;
  baseY: number;
  phase: number;
  kind: 'bob' | 'sway' | 'orbit' | 'orbitCloud' | 'snow' | 'flap';
  extra?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Shared resources: repeated decoration parts reuse one geometry / material /
// texture instead of allocating one per instance (Halloween alone built 162
// meshes with a fresh geometry + material each). Anything registered here
// lives in SHARED and dispose() must never free it — the next theme's
// layer reuses the same instances.
// ---------------------------------------------------------------------------
const geoCache = new Map<string, THREE.BufferGeometry>();
const matCache = new Map<string, THREE.Material>();
const texCache = new Map<string, THREE.CanvasTexture>();
const SHARED = new WeakSet<object>();

function sharedGeo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  const hit = geoCache.get(key) as T | undefined;
  if (hit) return hit;
  const g = make();
  geoCache.set(key, g);
  SHARED.add(g);
  return g;
}

function sharedMat<T extends THREE.Material>(key: string, make: () => T): T {
  const hit = matCache.get(key) as T | undefined;
  if (hit) return hit;
  const m = make();
  matCache.set(key, m);
  SHARED.add(m);
  return m;
}

function sharedTex(key: string, make: () => THREE.CanvasTexture): THREE.CanvasTexture {
  const hit = texCache.get(key);
  if (hit) return hit;
  const t = make();
  texCache.set(key, t);
  SHARED.add(t);
  return t;
}

// Procedural pumpkin face — one shared 256px texture per variant (was 6).
function pumpkinFaceTexture(faceVariant: number): THREE.CanvasTexture {
  return sharedTex(`pumpkin-face-${faceVariant % 3}`, () => {
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
    return faceTex;
  });
}

function pumpkin(faceVariant: number) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    sharedGeo('pumpkin-body', () => new THREE.SphereGeometry(0.22, 16, 12)),
    sharedMat('pumpkin-body', () => new THREE.MeshStandardMaterial({ color: '#f07818', roughness: 0.55, metalness: 0.05 })),
  );
  body.scale.set(1, 0.82, 1); g.add(body);
  // Two side-lobes for a rounder look
  for (const sx of [-0.1, 0.1]) {
    const lobe = new THREE.Mesh(
      sharedGeo('pumpkin-lobe', () => new THREE.SphereGeometry(0.19, 16, 12)),
      sharedMat('pumpkin-lobe', () => new THREE.MeshStandardMaterial({ color: '#e06810', roughness: 0.6 })),
    );
    lobe.position.set(sx, 0, 0); lobe.scale.set(1, 0.78, 0.9); g.add(lobe);
  }
  const stem = new THREE.Mesh(
    sharedGeo('pumpkin-stem', () => new THREE.CylinderGeometry(0.03, 0.05, 0.1, 8)),
    sharedMat('pumpkin-stem', () => new THREE.MeshStandardMaterial({ color: '#3f6b2a', roughness: 0.8 })),
  );
  stem.position.y = 0.2; g.add(stem);
  const face = new THREE.Mesh(
    sharedGeo('pumpkin-face-plane', () => new THREE.PlaneGeometry(0.34, 0.34)),
    sharedMat(`pumpkin-face-mat-${faceVariant % 3}`, () => new THREE.MeshBasicMaterial({ map: pumpkinFaceTexture(faceVariant), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false })),
  );
  face.position.set(0, -0.01, 0.205); g.add(face);
  const glow = new THREE.PointLight('#ff8c26', 1.8, 1.8, 2);
  glow.position.y = 0.05; g.add(glow);
  return g;
}

function ghost() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(sharedGeo('ghost-body', () => {
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
    return new THREE.LatheGeometry(pts, 24);
  }), sharedMat('ghost-body', () => new THREE.MeshStandardMaterial({
    color: '#ddeeff', transparent: true, opacity: 0.62,
    roughness: 0.2, emissive: '#99ccff', emissiveIntensity: 0.55, side: THREE.DoubleSide,
  })));
  g.add(body);
  const eyeMat = sharedMat('ghost-eye', () => new THREE.MeshBasicMaterial({ color: '#1a0a2e' }));
  const pupilMat = sharedMat('ghost-pupil', () => new THREE.MeshBasicMaterial({ color: '#66aaff' }));
  for (const x of [-0.06, 0.06]) {
    const eye = new THREE.Mesh(sharedGeo('ghost-eye', () => new THREE.SphereGeometry(0.025, 8, 8)), eyeMat);
    eye.position.set(x, 0.17, 0.14); g.add(eye);
    // glowing pupils
    const pupil = new THREE.Mesh(sharedGeo('ghost-pupil', () => new THREE.SphereGeometry(0.012, 6, 6)), pupilMat);
    pupil.position.set(x, 0.17, 0.155); g.add(pupil);
  }
  // inner glow point light
  const inner = new THREE.PointLight('#88ccff', 0.9, 1.2, 2);
  inner.position.set(0, 0.1, 0); g.add(inner);
  return g;
}

function bat() {
  const g = new THREE.Group();
  const bodyMat = sharedMat('bat-body', () => new THREE.MeshStandardMaterial({ color: '#17111f', roughness: 0.8 }));
  const wingMat = sharedMat('bat-wing', () => new THREE.MeshStandardMaterial({ color: '#241a33', roughness: 0.75, side: THREE.DoubleSide }));
  const body = new THREE.Mesh(sharedGeo('bat-body', () => new THREE.SphereGeometry(0.035, 8, 8)), bodyMat);
  body.scale.set(1, 0.8, 1.3);
  g.add(body);
  const wings: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(sharedGeo(`bat-wing-${side}`, () => {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(side * 0.16, 0.05);
      shape.quadraticCurveTo(side * 0.1, -0.02, side * 0.07, 0);
      shape.quadraticCurveTo(side * 0.05, -0.03, side * 0.02, -0.005);
      shape.lineTo(0, 0);
      return new THREE.ShapeGeometry(shape);
    }), wingMat);
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
  const mat = sharedMat('spiderweb', () => new THREE.LineBasicMaterial({ color: '#c8c8ff', transparent: true, opacity: 0.55 }));
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
  const dark = sharedMat('spider-dark', () => new THREE.MeshStandardMaterial({ color: '#1a0a2e', roughness: 0.7, emissive: '#330088', emissiveIntensity: 0.4 }));
  const abdomen = new THREE.Mesh(sharedGeo('spider-abdomen', () => new THREE.SphereGeometry(0.05, 10, 8)), dark);
  abdomen.position.set(0, 0.06, 0); g.add(abdomen);
  const thorax = new THREE.Mesh(sharedGeo('spider-thorax', () => new THREE.SphereGeometry(0.035, 10, 8)), dark);
  thorax.position.set(0, 0, 0); g.add(thorax);
  // 8 legs
  for (let i = 0; i < 4; i++) {
    for (const side of [-1, 1]) {
      const legGroup = new THREE.Group();
      const seg1 = new THREE.Mesh(sharedGeo('spider-leg', () => new THREE.CylinderGeometry(0.006, 0.006, 0.08, 6)), dark);
      seg1.position.set(side * 0.04, 0, 0); seg1.rotation.z = side * 0.8;
      legGroup.add(seg1);
      legGroup.position.y = 0;
      g.add(legGroup);
    }
  }
  // red eyes
  const eyeMat = sharedMat('spider-eye', () => new THREE.MeshBasicMaterial({ color: '#ff0000' }));
  for (let i = 0; i < 4; i++) {
    const eye = new THREE.Mesh(sharedGeo('spider-eye', () => new THREE.SphereGeometry(0.008, 6, 6)), eyeMat);
    eye.position.set((-1.5 + i) * 0.012, 0.004, 0.034);
    g.add(eye);
  }
  return g;
}

function treatsBucket() {
  const g = new THREE.Group();
  const orangeMat = sharedMat('bucket-orange', () => new THREE.MeshStandardMaterial({ color: '#f07818', roughness: 0.6 }));
  const body = new THREE.Mesh(sharedGeo('bucket-body', () => new THREE.CylinderGeometry(0.14, 0.11, 0.2, 20)), orangeMat);
  body.position.y = 0.1; g.add(body);
  // pumpkin face cutout — use emissive plane
  const faceMat = sharedMat('bucket-face', () => new THREE.MeshStandardMaterial({ color: '#141414', emissive: '#ff6600', emissiveIntensity: 0.9 }));
  const faceDecal = new THREE.Mesh(sharedGeo('bucket-face', () => new THREE.PlaneGeometry(0.12, 0.1)), faceMat);
  faceDecal.position.set(0, 0.11, 0.142); g.add(faceDecal);
  // handle
  const handleMat = sharedMat('bucket-handle', () => new THREE.MeshStandardMaterial({ color: '#5c3a1e', roughness: 0.8 }));
  const handle = new THREE.Mesh(sharedGeo('bucket-handle', () => new THREE.TorusGeometry(0.1, 0.008, 6, 20, Math.PI)), handleMat);
  handle.position.y = 0.21; handle.rotation.x = Math.PI / 2; g.add(handle);
  // candy spills
  const candyColors = ['#ff4466', '#44ffaa', '#ffdd22', '#aa44ff'];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const candy = new THREE.Mesh(sharedGeo('bucket-candy', () => new THREE.SphereGeometry(0.025, 8, 6)),
      sharedMat(`bucket-candy-${candyColors[i]}`, () => new THREE.MeshStandardMaterial({ color: candyColors[i], roughness: 0.3, emissive: candyColors[i], emissiveIntensity: 0.3 })));
    candy.position.set(Math.cos(a) * 0.08, 0.22, Math.sin(a) * 0.08);
    g.add(candy);
  }
  return g;
}

function skeleton3d() {
  const g = new THREE.Group();
  const bone = sharedMat('skeleton-bone', () => new THREE.MeshStandardMaterial({ color: '#d8d8d8', roughness: 0.5, emissive: '#99ffaa', emissiveIntensity: 0.12 }));
  // skull
  const skull = new THREE.Mesh(sharedGeo('skeleton-skull', () => new THREE.SphereGeometry(0.1, 16, 12)), bone);
  skull.position.y = 0.9; g.add(skull);
  // jaw
  const jaw = new THREE.Mesh(sharedGeo('skeleton-jaw', () => new THREE.BoxGeometry(0.12, 0.04, 0.09)), bone);
  jaw.position.set(0, 0.78, 0.02); g.add(jaw);
  // spine
  const spine = new THREE.Mesh(sharedGeo('skeleton-spine', () => new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8)), bone);
  spine.position.y = 0.52; g.add(spine);
  // ribs (3 pairs)
  for (let i = 0; i < 3; i++) {
    const ry = 0.72 - i * 0.1;
    for (const side of [-1, 1]) {
      const rib = new THREE.Mesh(sharedGeo('skeleton-rib', () => new THREE.TorusGeometry(0.1, 0.012, 6, 16, Math.PI)), bone);
      rib.position.set(side * 0.04, ry, 0); rib.rotation.y = side * Math.PI / 2;
      g.add(rib);
    }
  }
  // pelvis
  const pelvis = new THREE.Mesh(sharedGeo('skeleton-pelvis', () => new THREE.TorusGeometry(0.1, 0.02, 6, 20, Math.PI * 2)), bone);
  pelvis.position.y = 0.32; pelvis.rotation.x = Math.PI / 2; g.add(pelvis);
  // arms
  for (const side of [-1, 1]) {
    const upper = new THREE.Mesh(sharedGeo('skeleton-arm-upper', () => new THREE.CylinderGeometry(0.018, 0.018, 0.22, 8)), bone);
    upper.position.set(side * 0.22, 0.6, 0); upper.rotation.z = side * 0.4; g.add(upper);
    const lower = new THREE.Mesh(sharedGeo('skeleton-arm-lower', () => new THREE.CylinderGeometry(0.015, 0.015, 0.22, 8)), bone);
    lower.position.set(side * 0.3, 0.42, 0); lower.rotation.z = side * 0.8; g.add(lower);
  }
  // legs
  for (const side of [-1, 1]) {
    const upper = new THREE.Mesh(sharedGeo('skeleton-leg-upper', () => new THREE.CylinderGeometry(0.025, 0.025, 0.28, 8)), bone);
    upper.position.set(side * 0.07, 0.17, 0); g.add(upper);
    const lower = new THREE.Mesh(sharedGeo('skeleton-leg-lower', () => new THREE.CylinderGeometry(0.02, 0.02, 0.28, 8)), bone);
    lower.position.set(side * 0.07, -0.12, 0); g.add(lower);
  }
  return g;
}

function giftBox(i: number) {
  const wrapColors = ['#d23a2e', '#1f7a4d', '#2a5f9e', '#f0c24b'];
  const g = new THREE.Group();
  const boxMat = sharedMat(`giftbox-wrap-${i % wrapColors.length}`, () => new THREE.MeshStandardMaterial({ color: wrapColors[i % wrapColors.length], roughness: 0.5 }));
  const ribbonMat = sharedMat('giftbox-ribbon', () => new THREE.MeshStandardMaterial({ color: '#f0c24b', roughness: 0.35, metalness: 0.5 }));
  g.add(new THREE.Mesh(sharedGeo('giftbox-box', () => new THREE.BoxGeometry(0.14, 0.12, 0.14)), boxMat));
  const band = new THREE.Mesh(sharedGeo('giftbox-band', () => new THREE.BoxGeometry(0.145, 0.125, 0.035)), ribbonMat);
  g.add(band);
  const band2 = new THREE.Mesh(sharedGeo('giftbox-band2', () => new THREE.BoxGeometry(0.035, 0.125, 0.145)), ribbonMat);
  g.add(band2);
  const bow = new THREE.Mesh(sharedGeo('giftbox-bow', () => new THREE.SphereGeometry(0.03, 8, 8)), ribbonMat);
  bow.position.y = 0.075;
  g.add(bow);
  return g;
}

function christmasTree(size = 1) {
  const g = new THREE.Group();
  const green = sharedMat('tree-green', () => new THREE.MeshStandardMaterial({ color: '#1a5c2a', roughness: 0.7 }));
  const trunk = new THREE.Mesh(sharedGeo(`tree-trunk-${size}`, () => new THREE.CylinderGeometry(0.03*size, 0.04*size, 0.12*size, 8)),
    sharedMat('tree-trunk', () => new THREE.MeshStandardMaterial({ color: '#5c3a1e', roughness: 0.9 })));
  trunk.position.y = 0.06*size; g.add(trunk);
  for (let tier = 0; tier < 3; tier++) {
    const r = (0.22 - tier * 0.055) * size;
    const h = 0.18 * size;
    const cone = new THREE.Mesh(sharedGeo(`tree-cone-${tier}-${size}`, () => new THREE.ConeGeometry(r, h, 20)), green);
    cone.position.y = (0.17 + tier * 0.14) * size; g.add(cone);
  }
  // baubles
  const bc = ['#d23a2e','#f0c24b','#2a7f5f','#88aaff'];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const tier = i % 3;
    const r2 = (0.14 - tier * 0.03) * size;
    const b = new THREE.Mesh(sharedGeo(`tree-bauble-${size}`, () => new THREE.SphereGeometry(0.025*size, 8, 6)),
      sharedMat(`tree-bauble-${bc[i%4]}`, () => new THREE.MeshStandardMaterial({ color: bc[i%4], roughness: 0.3, metalness: 0.5, emissive: bc[i%4], emissiveIntensity: 0.3 })));
    b.position.set(Math.cos(a)*r2, (0.2+tier*0.14)*size, Math.sin(a)*r2); g.add(b);
  }
  // star on top
  const star = new THREE.Mesh(sharedGeo(`tree-star-${size}`, () => new THREE.OctahedronGeometry(0.04*size)),
    sharedMat('tree-star', () => new THREE.MeshStandardMaterial({ color: '#ffd700', emissive: '#ffd700', emissiveIntensity: 1.2, roughness: 0.1 })));
  star.position.y = 0.57*size; g.add(star);
  return g;
}

function candyCane() {
  const g = new THREE.Group();
  const mat = sharedMat('candycane-white', () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }));
  const stripeMat = sharedMat('candycane-red', () => new THREE.MeshStandardMaterial({ color: '#e82020', roughness: 0.4 }));
  const tube = new THREE.Mesh(sharedGeo('candycane-tube', () => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.3, 0),
      new THREE.Vector3(0.04, 0.38, 0), new THREE.Vector3(0.1, 0.4, 0),
    ]);
    return new THREE.TubeGeometry(curve, 24, 0.022, 10);
  }), mat);
  g.add(tube);
  // stripe segments
  for (let i = 0; i < 6; i++) {
    const stripe = new THREE.Mesh(sharedGeo('candycane-stripe', () => new THREE.TorusGeometry(0.022, 0.011, 6, 16)), stripeMat);
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
function getGlowTexture(): THREE.CanvasTexture {
  if (!glowTexture) {
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
    SHARED.add(glowTexture);
  }
  return glowTexture;
}
function getGlowMaterial(): THREE.SpriteMaterial {
  if (!glowMaterial) {
    glowMaterial = new THREE.SpriteMaterial({
      map: getGlowTexture(), blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, opacity: 0.85,
    });
    SHARED.add(glowMaterial);
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
    const orb = new THREE.Mesh(sharedGeo('firework-ball', () => new THREE.SphereGeometry(0.018, 6, 6)),
      sharedMat(`firework-ball-${col}`, () => new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.5, roughness: 0.1 })));
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
    sharedGeo('lantern-body', () => new THREE.SphereGeometry(0.14, 16, 12)),
    sharedMat('lantern-body', () => new THREE.MeshStandardMaterial({
      color: '#d2222d', roughness: 0.45,
      emissive: '#ff4d2e', emissiveIntensity: 0.55,
    })),
  );
  body.scale.set(1, 0.82, 1);
  g.add(body);
  const capMat = sharedMat('lantern-gold', () => new THREE.MeshStandardMaterial({ color: '#f0c75e', roughness: 0.35, metalness: 0.5 }));
  const cap = new THREE.Mesh(sharedGeo('lantern-cap', () => new THREE.CylinderGeometry(0.06, 0.075, 0.03, 16)), capMat);
  cap.position.y = 0.13;
  g.add(cap);
  const base = new THREE.Mesh(sharedGeo('lantern-base', () => new THREE.CylinderGeometry(0.05, 0.06, 0.025, 16)), capMat);
  base.position.y = -0.13;
  g.add(base);
  const cord = new THREE.Mesh(sharedGeo('lantern-cord', () => new THREE.CylinderGeometry(0.004, 0.004, 0.12, 6)), capMat);
  cord.position.y = -0.2;
  g.add(cord);
  const tassel = new THREE.Mesh(
    sharedGeo('lantern-tassel', () => new THREE.CylinderGeometry(0.012, 0.02, 0.07, 8)),
    sharedMat('lantern-tassel', () => new THREE.MeshStandardMaterial({ color: '#d2222d', roughness: 0.6 })),
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
  const mat = sharedMat('cloud', () => new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, roughness: 0.95 }));
  const parts: [number, number, number, number][] = [
    [0, 0, 0, 0.12], [-0.11, 0.01, 0.02, 0.08], [0.1, 0.015, -0.02, 0.085],
    [0.03, 0.07, 0, 0.07], [-0.05, 0.06, -0.01, 0.055],
  ];
  for (const [x, y, z, r] of parts) {
    const m = new THREE.Mesh(sharedGeo(`cloud-sphere-${r}`, () => new THREE.SphereGeometry(r, 16, 12)), mat);
    m.position.set(x, y, z);
    m.scale.z = 0.7;
    g.add(m);
  }
  return g;
}

const NY_CONFETTI_COLORS = ['#d4af37', '#ff6ec7', '#7df9ff', '#e0e0e0', '#ff5e78'];

// New Year: a single champagne flute — tapered glass bowl, gold liquid,
// bubbles, thin stem. No light; the liquid reads via emissive.
function champagneFlute() {
  const g = new THREE.Group();
  const glass = sharedMat('ny-glass', () => new THREE.MeshStandardMaterial({
    color: '#e8f4f8', transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.1,
  }));
  const gold = sharedMat('ny-gold-liquid', () => new THREE.MeshStandardMaterial({
    color: '#d4af37', roughness: 0.25, metalness: 0.7,
    emissive: '#ffd700', emissiveIntensity: 0.35,
  }));
  const bowl = new THREE.Mesh(
    sharedGeo('ny-flute-bowl', () => new THREE.CylinderGeometry(0.035, 0.02, 0.14, 12)),
    glass,
  );
  bowl.position.y = 0.17;
  g.add(bowl);
  const liquid = new THREE.Mesh(
    sharedGeo('ny-flute-liquid', () => new THREE.CylinderGeometry(0.03, 0.018, 0.08, 12)),
    gold,
  );
  liquid.position.y = 0.15;
  g.add(liquid);
  const bubbleMat = sharedMat('ny-bubble', () => new THREE.MeshBasicMaterial({ color: '#fff3c4' }));
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(sharedGeo('ny-bubble', () => new THREE.SphereGeometry(0.004, 6, 6)), bubbleMat);
    b.position.set((i - 1) * 0.012, 0.13 + i * 0.02, 0.01);
    g.add(b);
  }
  const stem = new THREE.Mesh(
    sharedGeo('ny-flute-stem', () => new THREE.CylinderGeometry(0.006, 0.006, 0.1, 8)),
    sharedMat('ny-flute-stem', () => new THREE.MeshStandardMaterial({ color: '#d4af37', roughness: 0.3, metalness: 0.8 })),
  );
  stem.position.y = 0.05;
  g.add(stem);
  const foot = new THREE.Mesh(
    sharedGeo('ny-flute-foot', () => new THREE.CylinderGeometry(0.03, 0.03, 0.008, 12)),
    sharedMat('ny-flute-foot', () => new THREE.MeshStandardMaterial({ color: '#d4af37', roughness: 0.3, metalness: 0.8 })),
  );
  foot.position.y = 0.004;
  g.add(foot);
  return g;
}

// New Year: champagne tower — 3 tiers of flutes (3 + 2 + 1) on gold trays.
function champagneTower() {
  const g = new THREE.Group();
  const trayMat = sharedMat('ny-tray', () => new THREE.MeshStandardMaterial({
    color: '#d4af37', roughness: 0.25, metalness: 0.85,
  }));
  const tiers: { count: number; y: number; r: number }[] = [
    { count: 3, y: 0.0, r: 0.11 },
    { count: 2, y: 0.24, r: 0.07 },
    { count: 1, y: 0.48, r: 0 },
  ];
  for (const tier of tiers) {
    const tray = new THREE.Mesh(
      sharedGeo(`ny-tray-${tier.count}`, () => new THREE.CylinderGeometry(tier.r + 0.06, tier.r + 0.06, 0.015, 20)),
      trayMat,
    );
    tray.position.y = tier.y + 0.008;
    g.add(tray);
    for (let i = 0; i < tier.count; i++) {
      const a = (i / tier.count) * Math.PI * 2;
      const flute = champagneFlute();
      flute.position.set(Math.sin(a) * tier.r, tier.y + 0.015, Math.cos(a) * tier.r);
      g.add(flute);
    }
  }
  return g;
}

// New Year: countdown clock — gold rim, canvas face, two hands, exposed gears.
function countdownClock() {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(
    sharedGeo('ny-clock-rim', () => new THREE.TorusGeometry(0.2, 0.025, 10, 28)),
    sharedMat('ny-clock-gold', () => new THREE.MeshStandardMaterial({
      color: '#d4af37', roughness: 0.25, metalness: 0.85,
    })),
  );
  g.add(rim);
  const faceTex = sharedTex('ny-clock-face', () => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
    const c = cv.getContext('2d')!;
    c.fillStyle = '#f7ecd0'; c.beginPath(); c.arc(128, 128, 126, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1a1a1a'; c.font = 'bold 44px sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('12', 128, 42); c.fillText('3', 214, 128);
    c.fillText('6', 128, 214); c.fillText('9', 42, 128);
    c.fillStyle = '#d4af37';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      c.beginPath(); c.arc(128 + Math.sin(a) * 108, 128 - Math.cos(a) * 108, 6, 0, Math.PI * 2); c.fill();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
  const face = new THREE.Mesh(
    sharedGeo('ny-clock-face', () => new THREE.CircleGeometry(0.2, 28)),
    sharedMat('ny-clock-face', () => new THREE.MeshBasicMaterial({ map: faceTex })),
  );
  face.position.z = 0.005;
  g.add(face);
  const handMat = sharedMat('ny-clock-hand', () => new THREE.MeshBasicMaterial({ color: '#1a1a1a' }));
  const hour = new THREE.Mesh(sharedGeo('ny-clock-hour', () => new THREE.BoxGeometry(0.015, 0.1, 0.005)), handMat);
  hour.position.set(-0.03, 0.04, 0.01); hour.rotation.z = 0.6;
  g.add(hour);
  const minute = new THREE.Mesh(sharedGeo('ny-clock-minute', () => new THREE.BoxGeometry(0.012, 0.16, 0.005)), handMat);
  minute.position.set(0.02, 0.07, 0.01); minute.rotation.z = -0.25;
  g.add(minute);
  // Two exposed gears below the face.
  const gearMat = sharedMat('ny-gear', () => new THREE.MeshStandardMaterial({
    color: '#e0e0e0', roughness: 0.3, metalness: 0.9,
  }));
  for (let i = 0; i < 2; i++) {
    const gear = new THREE.Group();
    const disc = new THREE.Mesh(
      sharedGeo('ny-gear-disc', () => new THREE.CylinderGeometry(0.06, 0.06, 0.015, 16)),
      gearMat,
    );
    disc.rotation.x = Math.PI / 2;
    gear.add(disc);
    for (let t = 0; t < 8; t++) {
      const a = (t / 8) * Math.PI * 2;
      const tooth = new THREE.Mesh(sharedGeo('ny-gear-tooth', () => new THREE.BoxGeometry(0.02, 0.02, 0.015)), gearMat);
      tooth.position.set(Math.sin(a) * 0.065, Math.cos(a) * 0.065, 0);
      gear.add(tooth);
    }
    gear.position.set(-0.09 + i * 0.18, -0.28, 0.01);
    gear.rotation.z = i * 0.4;
    g.add(gear);
  }
  return g;
}

// New Year: star balloon — extruded 5-point star, gold metallic, with string.
function starBalloon() {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 0.16 : 0.065;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const x = Math.sin(a) * r;
    const y = Math.cos(a) * r;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  const star = new THREE.Mesh(
    sharedGeo('ny-star', () => new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false })),
    sharedMat('ny-star', () => new THREE.MeshStandardMaterial({
      color: '#d4af37', roughness: 0.2, metalness: 0.85,
      emissive: '#ffd700', emissiveIntensity: 0.4,
    })),
  );
  g.add(star);
  const string = new THREE.Mesh(
    sharedGeo('ny-balloon-string', () => new THREE.CylinderGeometry(0.003, 0.003, 0.3, 6)),
    sharedMat('ny-balloon-string', () => new THREE.MeshStandardMaterial({ color: '#e0e0e0', roughness: 0.6 })),
  );
  string.position.set(0, -0.3, 0.01);
  g.add(string);
  return g;
}

// New Year: party confetti — a loose burst of tiny colored planes.
function partyConfetti() {
  const g = new THREE.Group();
  for (let i = 0; i < 14; i++) {
    const col = NY_CONFETTI_COLORS[i % NY_CONFETTI_COLORS.length];
    const piece = new THREE.Mesh(
      sharedGeo('ny-confetti', () => new THREE.PlaneGeometry(0.035, 0.05)),
      sharedMat(`ny-confetti-${col}`, () => new THREE.MeshStandardMaterial({
        color: col, side: THREE.DoubleSide, roughness: 0.4,
        emissive: col, emissiveIntensity: 0.25,
      })),
    );
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.16;
    piece.position.set(Math.sin(a) * r, (Math.random() - 0.5) * 0.2, Math.cos(a) * r);
    piece.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    g.add(piece);
  }
  return g;
}

// Valentine's: heart shape shared by balloons and arrowheads.
function heartShape(scale = 1): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 0.06 * scale);
  s.bezierCurveTo(0, 0.12 * scale, -0.09 * scale, 0.12 * scale, -0.09 * scale, 0.05 * scale);
  s.bezierCurveTo(-0.09 * scale, -0.01 * scale, 0, -0.04 * scale, 0, -0.09 * scale);
  s.bezierCurveTo(0, -0.04 * scale, 0.09 * scale, -0.01 * scale, 0.09 * scale, 0.05 * scale);
  s.bezierCurveTo(0.09 * scale, 0.12 * scale, 0, 0.12 * scale, 0, 0.06 * scale);
  return s;
}

// Valentine's: floating heart balloon — extruded heart, rose pink, string.
function heartBalloon() {
  const g = new THREE.Group();
  const heart = new THREE.Mesh(
    sharedGeo('val-heart', () => new THREE.ExtrudeGeometry(heartShape(1.4), { depth: 0.03, bevelEnabled: false })),
    sharedMat('val-heart', () => new THREE.MeshStandardMaterial({
      color: '#ff69b4', roughness: 0.35,
      emissive: '#c71585', emissiveIntensity: 0.35,
    })),
  );
  g.add(heart);
  const string = new THREE.Mesh(
    sharedGeo('val-balloon-string', () => new THREE.CylinderGeometry(0.003, 0.003, 0.3, 6)),
    sharedMat('val-balloon-string', () => new THREE.MeshStandardMaterial({ color: '#fdf5e6', roughness: 0.6 })),
  );
  string.position.set(0, -0.28, 0.015);
  g.add(string);
  return g;
}

// Valentine's: a single rose petal — flattened, slightly cupped sphere.
function rosePetal() {
  const g = new THREE.Group();
  const petal = new THREE.Mesh(
    sharedGeo('val-petal', () => new THREE.SphereGeometry(0.05, 12, 8)),
    sharedMat('val-petal', () => new THREE.MeshStandardMaterial({
      color: '#ffb6c1', roughness: 0.5,
      emissive: '#ff8fb8', emissiveIntensity: 0.2, side: THREE.DoubleSide,
    })),
  );
  petal.scale.set(1, 0.18, 0.7);
  petal.rotation.x = -0.4;
  g.add(petal);
  return g;
}

// Valentine's: cupid's arrow — gold shaft, heart head, feather fletching.
function cupidsArrow() {
  const g = new THREE.Group();
  const gold = sharedMat('val-arrow-gold', () => new THREE.MeshStandardMaterial({
    color: '#d4a24a', roughness: 0.3, metalness: 0.8,
  }));
  const shaft = new THREE.Mesh(
    sharedGeo('val-arrow-shaft', () => new THREE.CylinderGeometry(0.012, 0.012, 0.7, 8)),
    gold,
  );
  shaft.rotation.z = Math.PI / 2;
  g.add(shaft);
  const head = new THREE.Mesh(
    sharedGeo('val-arrow-head', () => new THREE.ExtrudeGeometry(heartShape(0.9), { depth: 0.015, bevelEnabled: false })),
    sharedMat('val-arrow-head', () => new THREE.MeshStandardMaterial({
      color: '#c71585', roughness: 0.35, metalness: 0.4,
      emissive: '#c71585', emissiveIntensity: 0.4,
    })),
  );
  head.position.set(0.35, -0.08, 0);
  g.add(head);
  const feather = sharedMat('val-arrow-feather', () => new THREE.MeshStandardMaterial({
    color: '#fdf5e6', roughness: 0.7, side: THREE.DoubleSide,
  }));
  for (const sy of [-1, 1]) {
    const f = new THREE.Mesh(sharedGeo('val-arrow-feather', () => new THREE.PlaneGeometry(0.12, 0.05)), feather);
    f.position.set(-0.36, sy * 0.03, 0);
    f.rotation.z = sy * 0.4;
    g.add(f);
  }
  return g;
}

// Valentine's: gift box in rose pink with a pearl ribbon and heart on top.
function roseGiftBox() {
  const g = new THREE.Group();
  const box = new THREE.Mesh(
    sharedGeo('val-gift-box', () => new THREE.BoxGeometry(0.14, 0.12, 0.14)),
    sharedMat('val-gift-box', () => new THREE.MeshStandardMaterial({ color: '#ff69b4', roughness: 0.5 })),
  );
  g.add(box);
  const ribbon = sharedMat('val-gift-ribbon', () => new THREE.MeshStandardMaterial({
    color: '#fdf5e6', roughness: 0.35, metalness: 0.3,
  }));
  const band = new THREE.Mesh(sharedGeo('val-gift-band', () => new THREE.BoxGeometry(0.145, 0.125, 0.035)), ribbon);
  g.add(band);
  const band2 = new THREE.Mesh(sharedGeo('val-gift-band2', () => new THREE.BoxGeometry(0.035, 0.125, 0.145)), ribbon);
  g.add(band2);
  const heart = new THREE.Mesh(
    sharedGeo('val-gift-heart', () => new THREE.ExtrudeGeometry(heartShape(0.45), { depth: 0.012, bevelEnabled: false })),
    sharedMat('val-gift-heart', () => new THREE.MeshStandardMaterial({
      color: '#c71585', roughness: 0.35, emissive: '#c71585', emissiveIntensity: 0.4,
    })),
  );
  heart.position.set(0, 0.06, 0.01);
  g.add(heart);
  return g;
}

// Valentine's: glowing candle — pearl wax, emissive flame, shared glow
// sprite. No PointLight: the spec wants candlelight via emissive + halo.
function glowingCandle() {
  const g = new THREE.Group();
  const wax = new THREE.Mesh(
    sharedGeo('val-candle-wax', () => new THREE.CylinderGeometry(0.035, 0.04, 0.14, 12)),
    sharedMat('val-candle-wax', () => new THREE.MeshStandardMaterial({ color: '#fdf5e6', roughness: 0.5 })),
  );
  wax.position.y = 0.07;
  g.add(wax);
  const flame = new THREE.Mesh(
    sharedGeo('val-candle-flame', () => new THREE.SphereGeometry(0.02, 10, 8)),
    sharedMat('val-candle-flame', () => new THREE.MeshBasicMaterial({ color: '#ffb84d', toneMapped: false })),
  );
  flame.position.y = 0.17;
  flame.scale.set(1, 1.6, 1);
  g.add(flame);
  const glow = new THREE.Sprite(getGlowMaterial());
  glow.position.y = 0.17;
  glow.scale.setScalar(0.55);
  g.add(glow);
  return g;
}

// Spring Festival: Chinese knot — red ring, gold diamond center, tassel.
function chineseKnot() {
  const g = new THREE.Group();
  const red = sharedMat('sf-knot-red', () => new THREE.MeshStandardMaterial({
    color: '#de2910', roughness: 0.45, emissive: '#de2910', emissiveIntensity: 0.25,
  }));
  const gold = sharedMat('sf-knot-gold', () => new THREE.MeshStandardMaterial({
    color: '#ffd700', roughness: 0.3, metalness: 0.7,
  }));
  const ring = new THREE.Mesh(
    sharedGeo('sf-knot-ring', () => new THREE.TorusGeometry(0.14, 0.025, 8, 24)),
    red,
  );
  g.add(ring);
  const diamond = new THREE.Mesh(
    sharedGeo('sf-knot-diamond', () => new THREE.BoxGeometry(0.11, 0.11, 0.02)),
    gold,
  );
  diamond.rotation.z = Math.PI / 4;
  g.add(diamond);
  const cord = new THREE.Mesh(
    sharedGeo('sf-knot-cord', () => new THREE.CylinderGeometry(0.008, 0.008, 0.12, 6)),
    red,
  );
  cord.position.y = -0.2;
  g.add(cord);
  const tassel = new THREE.Mesh(
    sharedGeo('sf-knot-tassel', () => new THREE.CylinderGeometry(0.015, 0.035, 0.1, 8)),
    gold,
  );
  tassel.position.y = -0.3;
  g.add(tassel);
  return g;
}

// Spring Festival: 福 plaque — gold-rimmed red disc with a canvas 福.
function fuPlaque() {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(
    sharedGeo('sf-fu-rim', () => new THREE.TorusGeometry(0.22, 0.025, 10, 28)),
    sharedMat('sf-fu-gold', () => new THREE.MeshStandardMaterial({
      color: '#ffd700', roughness: 0.25, metalness: 0.8,
    })),
  );
  g.add(rim);
  const tex = sharedTex('sf-fu', () => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
    const c = cv.getContext('2d')!;
    c.fillStyle = '#de2910'; c.beginPath(); c.arc(128, 128, 126, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#ffd700'; c.lineWidth = 10;
    c.beginPath(); c.arc(128, 128, 118, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#ffd700'; c.font = 'bold 150px serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('福', 128, 134);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
  const face = new THREE.Mesh(
    sharedGeo('sf-fu-face', () => new THREE.CircleGeometry(0.22, 28)),
    sharedMat('sf-fu-face', () => new THREE.MeshBasicMaterial({ map: tex })),
  );
  face.position.z = 0.005;
  g.add(face);
  return g;
}

// Spring Festival: spring couplet banner — vertical red banner with gold
// characters drawn on canvas. `text` is written top to bottom.
function coupletBanner(text: string) {
  const g = new THREE.Group();
  const tex = sharedTex(`sf-couplet-${text}`, () => {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 512;
    const c = cv.getContext('2d')!;
    c.fillStyle = '#de2910'; c.fillRect(0, 0, 128, 512);
    c.strokeStyle = '#ffd700'; c.lineWidth = 6; c.strokeRect(6, 6, 116, 500);
    c.fillStyle = '#ffd700'; c.font = 'bold 84px serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const chars = [...text];
    chars.forEach((ch, i) => c.fillText(ch, 64, 80 + i * 110));
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
  const banner = new THREE.Mesh(
    sharedGeo('sf-couplet', () => new THREE.PlaneGeometry(0.16, 0.64)),
    sharedMat(`sf-couplet-${text}`, () => new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })),
  );
  g.add(banner);
  const rod = new THREE.Mesh(
    sharedGeo('sf-couplet-rod', () => new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8)),
    sharedMat('sf-couplet-gold', () => new THREE.MeshStandardMaterial({
      color: '#ffd700', roughness: 0.3, metalness: 0.7,
    })),
  );
  rod.rotation.z = Math.PI / 2;
  rod.position.y = 0.33;
  g.add(rod);
  return g;
}

// Spring Festival: firecracker string — red crackers with gold caps on a cord.
function firecrackerString() {
  const g = new THREE.Group();
  const cord = new THREE.Mesh(
    sharedGeo('sf-cracker-cord', () => new THREE.CylinderGeometry(0.006, 0.006, 0.55, 6)),
    sharedMat('sf-cracker-cord', () => new THREE.MeshStandardMaterial({ color: '#8b5a2b', roughness: 0.8 })),
  );
  g.add(cord);
  const red = sharedMat('sf-cracker-red', () => new THREE.MeshStandardMaterial({
    color: '#de2910', roughness: 0.5, emissive: '#de2910', emissiveIntensity: 0.2,
  }));
  const gold = sharedMat('sf-cracker-gold', () => new THREE.MeshStandardMaterial({
    color: '#ffd700', roughness: 0.3, metalness: 0.7,
  }));
  for (let i = 0; i < 8; i++) {
    const y = 0.22 - i * 0.06;
    const cracker = new THREE.Mesh(
      sharedGeo('sf-cracker', () => new THREE.CylinderGeometry(0.025, 0.025, 0.05, 10)),
      red,
    );
    cracker.position.y = y;
    g.add(cracker);
    const cap = new THREE.Mesh(sharedGeo('sf-cracker-cap', () => new THREE.CylinderGeometry(0.026, 0.026, 0.012, 10)), gold);
    cap.position.y = y + 0.028;
    g.add(cap);
  }
  return g;
}

// Spring Festival: zodiac mascot — a small stylized horse (2026 is the
// Year of the Horse), red body with gold mane, saddle and hooves.
function zodiacHorse() {
  const g = new THREE.Group();
  const red = sharedMat('sf-horse-red', () => new THREE.MeshStandardMaterial({
    color: '#de2910', roughness: 0.45, emissive: '#de2910', emissiveIntensity: 0.2,
  }));
  const gold = sharedMat('sf-horse-gold', () => new THREE.MeshStandardMaterial({
    color: '#ffd700', roughness: 0.3, metalness: 0.7,
  }));
  const body = new THREE.Mesh(
    sharedGeo('sf-horse-body', () => new THREE.SphereGeometry(0.13, 14, 10)),
    red,
  );
  body.scale.set(1, 0.85, 1.5);
  body.position.y = 0.22;
  g.add(body);
  const neck = new THREE.Mesh(
    sharedGeo('sf-horse-neck', () => new THREE.CylinderGeometry(0.05, 0.07, 0.16, 10)),
    red,
  );
  neck.position.set(0, 0.32, 0.16);
  neck.rotation.x = 0.5;
  g.add(neck);
  const head = new THREE.Mesh(
    sharedGeo('sf-horse-head', () => new THREE.SphereGeometry(0.06, 12, 10)),
    red,
  );
  head.position.set(0, 0.42, 0.24);
  head.scale.set(1, 1, 1.4);
  g.add(head);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(sharedGeo('sf-horse-ear', () => new THREE.ConeGeometry(0.02, 0.06, 8)), red);
    ear.position.set(side * 0.04, 0.48, 0.22);
    g.add(ear);
    const eye = new THREE.Mesh(
      sharedGeo('sf-horse-eye', () => new THREE.SphereGeometry(0.012, 6, 6)),
      sharedMat('sf-horse-eye', () => new THREE.MeshBasicMaterial({ color: '#1a1a1a' })),
    );
    eye.position.set(side * 0.05, 0.43, 0.29);
    g.add(eye);
  }
  const mane = new THREE.Mesh(
    sharedGeo('sf-horse-mane', () => new THREE.BoxGeometry(0.03, 0.18, 0.08)),
    gold,
  );
  mane.position.set(0, 0.36, 0.1);
  mane.rotation.x = 0.5;
  g.add(mane);
  const saddle = new THREE.Mesh(
    sharedGeo('sf-horse-saddle', () => new THREE.BoxGeometry(0.16, 0.03, 0.12)),
    gold,
  );
  saddle.position.set(0, 0.32, -0.02);
  g.add(saddle);
  for (const [lx, lz] of [[-0.07, 0.12], [0.07, 0.12], [-0.07, -0.12], [0.07, -0.12]] as const) {
    const leg = new THREE.Mesh(
      sharedGeo('sf-horse-leg', () => new THREE.CylinderGeometry(0.02, 0.02, 0.14, 8)),
      red,
    );
    leg.position.set(lx, 0.07, lz);
    g.add(leg);
    const hoof = new THREE.Mesh(sharedGeo('sf-horse-hoof', () => new THREE.CylinderGeometry(0.022, 0.022, 0.02, 8)), gold);
    hoof.position.set(lx, 0.01, lz);
    g.add(hoof);
  }
  const tail = new THREE.Mesh(
    sharedGeo('sf-horse-tail', () => new THREE.CylinderGeometry(0.015, 0.03, 0.14, 8)),
    gold,
  );
  tail.position.set(0, 0.2, -0.22);
  tail.rotation.x = 0.5;
  g.add(tail);
  return g;
}

// Spring Festival: plum branch — curved brown branch with pink blossoms.
function plumBranch() {
  const g = new THREE.Group();
  const branchMat = sharedMat('sf-plum-branch', () => new THREE.MeshStandardMaterial({
    color: '#5c3a1e', roughness: 0.85,
  }));
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.12, 0.3, 0.05),
    new THREE.Vector3(0.05, 0.55, -0.04),
    new THREE.Vector3(0.22, 0.8, 0.03),
  ]);
  const branch = new THREE.Mesh(
    sharedGeo('sf-plum-branch', () => new THREE.TubeGeometry(curve, 20, 0.018, 8)),
    branchMat,
  );
  g.add(branch);
  const petalMat = sharedMat('sf-plum-petal', () => new THREE.MeshStandardMaterial({
    color: '#ff8fb8', roughness: 0.5, emissive: '#ff6b9d', emissiveIntensity: 0.25,
  }));
  const centerMat = sharedMat('sf-plum-center', () => new THREE.MeshStandardMaterial({
    color: '#ffd700', roughness: 0.3, metalness: 0.6,
    emissive: '#ffd700', emissiveIntensity: 0.4,
  }));
  const spots: [number, number, number][] = [
    [0.12, 0.3, 0.05], [0.05, 0.55, -0.04], [0.22, 0.8, 0.03], [0.14, 0.62, 0.08],
  ];
  for (const [x, y, z] of spots) {
    const blossom = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const petal = new THREE.Mesh(sharedGeo('sf-plum-petal', () => new THREE.SphereGeometry(0.025, 8, 6)), petalMat);
      petal.position.set(Math.sin(a) * 0.03, Math.cos(a) * 0.03, 0);
      petal.scale.set(1, 1, 0.35);
      blossom.add(petal);
    }
    const center = new THREE.Mesh(sharedGeo('sf-plum-center', () => new THREE.SphereGeometry(0.012, 6, 6)), centerMat);
    center.position.z = 0.01;
    blossom.add(center);
    blossom.position.set(x, y, z);
    blossom.rotation.set(Math.random() * 0.6 - 0.3, Math.random() * Math.PI, 0);
    g.add(blossom);
  }
  return g;
}

// Carnival: Venetian mask — purple eye mask with eye holes, gold trim,
// feather plumes on top.
function venetianMask() {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-0.22, 0.06);
  shape.quadraticCurveTo(0, 0.16, 0.22, 0.06);
  shape.quadraticCurveTo(0.22, -0.06, 0.12, -0.08);
  shape.quadraticCurveTo(0.06, -0.02, 0, -0.07);
  shape.quadraticCurveTo(-0.06, -0.02, -0.12, -0.08);
  shape.quadraticCurveTo(-0.22, -0.06, -0.22, 0.06);
  for (const ex of [-0.11, 0.11]) {
    const hole = new THREE.Path();
    hole.absellipse(ex, 0.02, 0.045, 0.028, 0, Math.PI * 2);
    shape.holes.push(hole);
  }
  const trim = new THREE.Mesh(
    sharedGeo('carnival-mask-trim', () => new THREE.ExtrudeGeometry(shape, { depth: 0.015, bevelEnabled: false })),
    sharedMat('carnival-mask-gold', () => new THREE.MeshStandardMaterial({
      color: '#ffd700', roughness: 0.25, metalness: 0.85,
    })),
  );
  trim.scale.setScalar(1.07);
  trim.position.z = -0.012;
  g.add(trim);
  const face = new THREE.Mesh(
    sharedGeo('carnival-mask', () => new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false })),
    sharedMat('carnival-mask', () => new THREE.MeshStandardMaterial({
      color: '#8a2be2', roughness: 0.35, metalness: 0.4,
      emissive: '#8a2be2', emissiveIntensity: 0.3,
    })),
  );
  g.add(face);
  const featherColors = ['#ff007f', '#00a4ef', '#ffd700'];
  for (let i = 0; i < 3; i++) {
    const col = featherColors[i % 3]!;
    const feather = new THREE.Mesh(
      sharedGeo('carnival-mask-feather', () => new THREE.ConeGeometry(0.025, 0.16, 6)),
      sharedMat(`carnival-mask-feather-${col}`, () => new THREE.MeshStandardMaterial({ color: col, roughness: 0.5 })),
    );
    feather.position.set(-0.08 + i * 0.08, 0.2, 0);
    feather.scale.z = 0.25;
    feather.rotation.z = (i - 1) * -0.35;
    g.add(feather);
  }
  return g;
}

// Carnival: feather headdress — gold band with a fan of bright feathers.
function featherHeaddress() {
  const g = new THREE.Group();
  const band = new THREE.Mesh(
    sharedGeo('carnival-headdress-band', () => new THREE.TorusGeometry(0.16, 0.02, 8, 20, Math.PI)),
    sharedMat('carnival-headdress-gold', () => new THREE.MeshStandardMaterial({
      color: '#ffd700', roughness: 0.25, metalness: 0.85,
    })),
  );
  g.add(band);
  const featherColors = ['#8a2be2', '#ff007f', '#00a4ef', '#ffd700', '#ff5e78'];
  for (let i = 0; i < 7; i++) {
    const col = featherColors[i % 5]!;
    const feather = new THREE.Mesh(
      sharedGeo('carnival-headdress-feather', () => new THREE.ConeGeometry(0.03, 0.26, 6)),
      sharedMat(`carnival-headdress-feather-${col}`, () => new THREE.MeshStandardMaterial({ color: col, roughness: 0.5 })),
    );
    const a = (i / 6 - 0.5) * 1.6;
    feather.position.set(Math.sin(a) * 0.16, 0.14 + Math.cos(a) * 0.06, 0);
    feather.rotation.z = -a;
    feather.scale.z = 0.22;
    g.add(feather);
  }
  return g;
}

// Carnival: samba drum — purple body, cream skins, gold rims.
function sambaDrum() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    sharedGeo('carnival-drum-body', () => new THREE.CylinderGeometry(0.14, 0.14, 0.22, 16)),
    sharedMat('carnival-drum-body', () => new THREE.MeshStandardMaterial({
      color: '#8a2be2', roughness: 0.5, emissive: '#8a2be2', emissiveIntensity: 0.15,
    })),
  );
  g.add(body);
  const skin = sharedMat('carnival-drum-skin', () => new THREE.MeshStandardMaterial({
    color: '#fdf5e6', roughness: 0.7,
  }));
  for (const sy of [-1, 1]) {
    const disc = new THREE.Mesh(sharedGeo('carnival-drum-skin', () => new THREE.CylinderGeometry(0.14, 0.14, 0.012, 16)), skin);
    disc.position.y = sy * 0.11;
    g.add(disc);
    const rim = new THREE.Mesh(
      sharedGeo('carnival-drum-rim', () => new THREE.TorusGeometry(0.14, 0.012, 8, 20)),
      sharedMat('carnival-drum-rim', () => new THREE.MeshStandardMaterial({
        color: '#ffd700', roughness: 0.25, metalness: 0.85,
      })),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = sy * 0.11;
    g.add(rim);
  }
  return g;
}

// Carnival: tassel bead strand — sagging row of bright beads, gold tassel.
function tasselBeads() {
  const g = new THREE.Group();
  const beadColors = ['#8a2be2', '#ffd700', '#ff007f', '#00a4ef'];
  for (let i = 0; i < 9; i++) {
    const col = beadColors[i % 4]!;
    const bead = new THREE.Mesh(
      sharedGeo('carnival-bead', () => new THREE.SphereGeometry(0.022, 8, 6)),
      sharedMat(`carnival-bead-${col}`, () => new THREE.MeshStandardMaterial({
        color: col, roughness: 0.3, metalness: 0.4,
        emissive: col, emissiveIntensity: 0.3,
      })),
    );
    bead.position.set((i - 4) * 0.05, -Math.abs(i - 4) * 0.018, 0);
    g.add(bead);
  }
  const tassel = new THREE.Mesh(
    sharedGeo('carnival-tassel', () => new THREE.ConeGeometry(0.035, 0.12, 8)),
    sharedMat('carnival-tassel', () => new THREE.MeshStandardMaterial({
      color: '#ffd700', roughness: 0.3, metalness: 0.7,
    })),
  );
  tassel.position.set(0, -0.14, 0);
  tassel.rotation.x = Math.PI;
  g.add(tassel);
  return g;
}

// Carnival: streamer ribbon — wavy magenta tube with gold glitter dots.
function streamerRibbon() {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.4, 0, 0),
    new THREE.Vector3(-0.2, 0.12, 0.06),
    new THREE.Vector3(0, 0, -0.05),
    new THREE.Vector3(0.2, -0.12, 0.05),
    new THREE.Vector3(0.4, 0, 0),
  ]);
  const tube = new THREE.Mesh(
    sharedGeo('carnival-streamer', () => new THREE.TubeGeometry(curve, 24, 0.015, 6)),
    sharedMat('carnival-streamer', () => new THREE.MeshStandardMaterial({
      color: '#ff007f', roughness: 0.4,
      emissive: '#ff007f', emissiveIntensity: 0.5,
    })),
  );
  g.add(tube);
  const dotMat = sharedMat('carnival-streamer-dot', () => new THREE.MeshStandardMaterial({
    color: '#ffd700', emissive: '#ffd700', emissiveIntensity: 1.2, roughness: 0.2,
  }));
  for (let i = 0; i < 5; i++) {
    const p = curve.getPoint(i / 4);
    const dot = new THREE.Mesh(sharedGeo('carnival-streamer-dot', () => new THREE.SphereGeometry(0.012, 6, 6)), dotMat);
    dot.position.copy(p);
    g.add(dot);
  }
  return g;
}

// St. Patrick's: shamrock — 3 (or 4) heart-shaped leaves around a stem.
// Reuses the Valentine's heart shape: a shamrock leaf is heart-shaped.
function shamrock(leaves = 3) {
  const g = new THREE.Group();
  const leafMat = sharedMat('sp-leaf', () => new THREE.MeshStandardMaterial({
    color: '#50c878', roughness: 0.5, emissive: '#009a49', emissiveIntensity: 0.2,
    side: THREE.DoubleSide,
  }));
  for (let i = 0; i < leaves; i++) {
    const a = (i / leaves) * Math.PI * 2;
    const leaf = new THREE.Mesh(
      sharedGeo('sp-leaf', () => new THREE.ExtrudeGeometry(heartShape(0.7), { depth: 0.008, bevelEnabled: false })),
      leafMat,
    );
    leaf.position.set(Math.sin(a) * 0.055, Math.cos(a) * 0.055, 0);
    leaf.rotation.z = a + Math.PI;
    g.add(leaf);
  }
  const center = new THREE.Mesh(
    sharedGeo('sp-leaf-center', () => new THREE.SphereGeometry(0.02, 8, 6)),
    sharedMat('sp-leaf-center', () => new THREE.MeshStandardMaterial({ color: '#ffd700', roughness: 0.3, metalness: 0.7 })),
  );
  g.add(center);
  const stem = new THREE.Mesh(
    sharedGeo('sp-stem', () => new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6)),
    sharedMat('sp-stem', () => new THREE.MeshStandardMaterial({ color: '#009a49', roughness: 0.6 })),
  );
  stem.position.set(0.02, -0.14, 0);
  stem.rotation.z = 0.25;
  g.add(stem);
  return g;
}

// St. Patrick's: pot of gold — black cauldron, gold rim, coins spilling,
// shared glow sprite on top. No PointLight; the coins read via emissive.
function potOfGold() {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(
    sharedGeo('sp-pot', () => new THREE.CylinderGeometry(0.17, 0.11, 0.2, 18)),
    sharedMat('sp-pot', () => new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.35, metalness: 0.6 })),
  );
  pot.position.y = 0.1;
  g.add(pot);
  const rim = new THREE.Mesh(
    sharedGeo('sp-pot-rim', () => new THREE.TorusGeometry(0.17, 0.015, 8, 20)),
    sharedMat('sp-pot-gold', () => new THREE.MeshStandardMaterial({
      color: '#ffd700', roughness: 0.25, metalness: 0.85,
      emissive: '#ffd700', emissiveIntensity: 0.4,
    })),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.2;
  g.add(rim);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const coin = new THREE.Mesh(
      sharedGeo('sp-coin', () => new THREE.CylinderGeometry(0.035, 0.035, 0.012, 12)),
      sharedMat('sp-coin', () => new THREE.MeshStandardMaterial({
        color: '#ffd700', roughness: 0.25, metalness: 0.85,
        emissive: '#ffd700', emissiveIntensity: 0.5,
      })),
    );
    coin.position.set(Math.sin(a) * 0.07, 0.21 + (i % 2) * 0.015, Math.cos(a) * 0.07);
    coin.rotation.y = a;
    g.add(coin);
  }
  const glow = new THREE.Sprite(getGlowMaterial());
  glow.position.y = 0.3;
  glow.scale.setScalar(0.7);
  g.add(glow);
  return g;
}

// St. Patrick's: leprechaun hat — green top hat, black band, gold buckle.
function leprechaunHat() {
  const g = new THREE.Group();
  const green = sharedMat('sp-hat-green', () => new THREE.MeshStandardMaterial({
    color: '#009a49', roughness: 0.55, emissive: '#009a49', emissiveIntensity: 0.15,
  }));
  const brim = new THREE.Mesh(
    sharedGeo('sp-hat-brim', () => new THREE.CylinderGeometry(0.17, 0.17, 0.02, 20)),
    green,
  );
  brim.position.y = 0.01;
  g.add(brim);
  const crown = new THREE.Mesh(
    sharedGeo('sp-hat-crown', () => new THREE.CylinderGeometry(0.095, 0.1, 0.17, 16)),
    green,
  );
  crown.position.y = 0.105;
  g.add(crown);
  const band = new THREE.Mesh(
    sharedGeo('sp-hat-band', () => new THREE.CylinderGeometry(0.102, 0.102, 0.04, 16)),
    sharedMat('sp-hat-band', () => new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.5 })),
  );
  band.position.y = 0.05;
  g.add(band);
  const buckle = new THREE.Mesh(
    sharedGeo('sp-hat-buckle', () => new THREE.BoxGeometry(0.05, 0.035, 0.012)),
    sharedMat('sp-hat-buckle', () => new THREE.MeshStandardMaterial({
      color: '#ffd700', roughness: 0.25, metalness: 0.85,
    })),
  );
  buckle.position.set(0, 0.05, 0.1);
  g.add(buckle);
  return g;
}

// St. Patrick's: rainbow — six concentric half-torus arcs.
function rainbow() {
  const g = new THREE.Group();
  const colors = ['#ff0000', '#ff7f00', '#ffeb3b', '#50c878', '#1982c4', '#9c27b0'];
  for (let i = 0; i < 6; i++) {
    const arc = new THREE.Mesh(
      sharedGeo(`sp-rainbow-${i}`, () => new THREE.TorusGeometry(0.55 + i * 0.06, 0.028, 8, 32, Math.PI)),
      sharedMat(`sp-rainbow-${colors[i]}`, () => new THREE.MeshStandardMaterial({
        color: colors[i], roughness: 0.5,
        emissive: colors[i], emissiveIntensity: 0.45,
      })),
    );
    g.add(arc);
  }
  return g;
}

// St. Patrick's: stout glass — dark stout with a cream foam head.
function stoutGlass() {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(
    sharedGeo('sp-stout-glass', () => new THREE.CylinderGeometry(0.05, 0.04, 0.2, 12)),
    sharedMat('sp-stout-glass', () => new THREE.MeshStandardMaterial({
      color: '#2a1508', transparent: true, opacity: 0.9, roughness: 0.25,
    })),
  );
  glass.position.y = 0.1;
  g.add(glass);
  const foam = new THREE.Mesh(
    sharedGeo('sp-stout-foam', () => new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12)),
    sharedMat('sp-stout-foam', () => new THREE.MeshStandardMaterial({ color: '#f5eeda', roughness: 0.9 })),
  );
  foam.position.y = 0.21;
  g.add(foam);
  const foot = new THREE.Mesh(
    sharedGeo('sp-stout-foot', () => new THREE.CylinderGeometry(0.045, 0.045, 0.01, 12)),
    sharedMat('sp-stout-foot', () => new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.4 })),
  );
  foot.position.y = 0.005;
  g.add(foot);
  return g;
}

// April Fools': clown hat — yellow cone, purple bands, pompom on top.
function clownHat() {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(
    sharedGeo('af-hat-cone', () => new THREE.ConeGeometry(0.12, 0.32, 16)),
    sharedMat('af-hat-yellow', () => new THREE.MeshStandardMaterial({
      color: '#ffeb3b', roughness: 0.5, emissive: '#ffeb3b', emissiveIntensity: 0.25,
    })),
  );
  cone.position.y = 0.16;
  g.add(cone);
  const bandMat = sharedMat('af-hat-purple', () => new THREE.MeshStandardMaterial({
    color: '#9c27b0', roughness: 0.5, emissive: '#9c27b0', emissiveIntensity: 0.25,
  }));
  for (let i = 0; i < 2; i++) {
    const band = new THREE.Mesh(
      sharedGeo('af-hat-band', () => new THREE.TorusGeometry(0.085 - i * 0.025, 0.014, 6, 16)),
      bandMat,
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.1 + i * 0.1;
    g.add(band);
  }
  const pompom = new THREE.Mesh(
    sharedGeo('af-hat-pompom', () => new THREE.SphereGeometry(0.035, 10, 8)),
    sharedMat('af-hat-pompom', () => new THREE.MeshStandardMaterial({
      color: '#ff007f', roughness: 0.6, emissive: '#ff007f', emissiveIntensity: 0.3,
    })),
  );
  pompom.position.y = 0.34;
  g.add(pompom);
  const brim = new THREE.Mesh(
    sharedGeo('af-hat-brim', () => new THREE.CylinderGeometry(0.14, 0.14, 0.015, 18)),
    bandMat,
  );
  brim.position.y = 0.008;
  g.add(brim);
  return g;
}

// April Fools': spring boxing glove — red glove on a coiled steel spring.
function springBoxingGlove() {
  const g = new THREE.Group();
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const a = t * Math.PI * 2 * 6;
    pts.push(new THREE.Vector3(Math.cos(a) * 0.045, t * 0.26, Math.sin(a) * 0.045));
  }
  const spring = new THREE.Mesh(
    sharedGeo('af-spring', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.012, 6)),
    sharedMat('af-spring', () => new THREE.MeshStandardMaterial({
      color: '#c0c0c0', roughness: 0.3, metalness: 0.9,
    })),
  );
  g.add(spring);
  const red = sharedMat('af-glove-red', () => new THREE.MeshStandardMaterial({
    color: '#e82020', roughness: 0.5, emissive: '#e82020', emissiveIntensity: 0.2,
  }));
  const glove = new THREE.Mesh(sharedGeo('af-glove', () => new THREE.SphereGeometry(0.075, 12, 10)), red);
  glove.position.y = 0.32;
  glove.scale.set(1, 0.85, 1.15);
  g.add(glove);
  const thumb = new THREE.Mesh(sharedGeo('af-glove-thumb', () => new THREE.SphereGeometry(0.03, 8, 8)), red);
  thumb.position.set(0.07, 0.3, 0.03);
  g.add(thumb);
  const cuff = new THREE.Mesh(
    sharedGeo('af-glove-cuff', () => new THREE.CylinderGeometry(0.055, 0.055, 0.05, 12)),
    sharedMat('af-glove-cuff', () => new THREE.MeshStandardMaterial({ color: '#fdf5e6', roughness: 0.6 })),
  );
  cuff.position.y = 0.25;
  g.add(cuff);
  return g;
}

// April Fools': question-mark sign — yellow disc, purple "?" on canvas.
function questionMarkSign() {
  const g = new THREE.Group();
  const tex = sharedTex('af-question', () => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
    const c = cv.getContext('2d')!;
    c.fillStyle = '#ffeb3b'; c.beginPath(); c.arc(128, 128, 126, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#9c27b0'; c.lineWidth = 10;
    c.beginPath(); c.arc(128, 128, 118, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#9c27b0'; c.font = 'bold 180px sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('?', 128, 138);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
  const sign = new THREE.Mesh(
    sharedGeo('af-question', () => new THREE.CircleGeometry(0.2, 28)),
    sharedMat('af-question', () => new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })),
  );
  g.add(sign);
  const pole = new THREE.Mesh(
    sharedGeo('af-question-pole', () => new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6)),
    sharedMat('af-question-pole', () => new THREE.MeshStandardMaterial({ color: '#5c3a1e', roughness: 0.8 })),
  );
  pole.position.y = -0.3;
  g.add(pole);
  return g;
}

// April Fools': gag candy — wrapped candy in a loud color.
function gagCandy(variant: number) {
  const g = new THREE.Group();
  const colors = ['#9c27b0', '#ff5722', '#00b0ff'];
  const col = colors[variant % 3]!;
  const mat = sharedMat(`af-candy-${col}`, () => new THREE.MeshStandardMaterial({
    color: col, roughness: 0.4, emissive: col, emissiveIntensity: 0.3,
  }));
  const center = new THREE.Mesh(
    sharedGeo('af-candy-center', () => new THREE.CylinderGeometry(0.045, 0.045, 0.1, 12)),
    mat,
  );
  center.rotation.z = Math.PI / 2;
  g.add(center);
  for (const side of [-1, 1]) {
    const wrap = new THREE.Mesh(
      sharedGeo('af-candy-wrap', () => new THREE.ConeGeometry(0.045, 0.09, 10)),
      mat,
    );
    wrap.rotation.z = side * Math.PI / 2;
    wrap.position.x = side * 0.09;
    g.add(wrap);
  }
  return g;
}

// April Fools': funny glasses — purple rings, bridge, groucho mustache.
function funnyGlasses() {
  const g = new THREE.Group();
  const purple = sharedMat('af-glasses', () => new THREE.MeshStandardMaterial({
    color: '#9c27b0', roughness: 0.4, emissive: '#9c27b0', emissiveIntensity: 0.3,
  }));
  for (const side of [-1, 1]) {
    const ring = new THREE.Mesh(
      sharedGeo('af-glasses-ring', () => new THREE.TorusGeometry(0.07, 0.013, 8, 20)),
      purple,
    );
    ring.position.x = side * 0.085;
    g.add(ring);
  }
  const bridge = new THREE.Mesh(
    sharedGeo('af-glasses-bridge', () => new THREE.CylinderGeometry(0.01, 0.01, 0.06, 6)),
    purple,
  );
  bridge.rotation.z = Math.PI / 2;
  bridge.position.y = 0.02;
  g.add(bridge);
  const mustache = sharedMat('af-mustache', () => new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.8 }));
  for (const side of [-1, 1]) {
    const m = new THREE.Mesh(sharedGeo('af-mustache', () => new THREE.SphereGeometry(0.045, 10, 8)), mustache);
    m.position.set(side * 0.05, -0.09, 0);
    m.scale.set(1.4, 0.45, 0.5);
    m.rotation.z = side * -0.3;
    g.add(m);
  }
  return g;
}

// April Fools': banana peel — three curved peels splayed from a stem.
function bananaPeel() {
  const g = new THREE.Group();
  const yellow = sharedMat('af-banana', () => new THREE.MeshStandardMaterial({
    color: '#ffeb3b', roughness: 0.5, emissive: '#ffeb3b', emissiveIntensity: 0.2,
    side: THREE.DoubleSide,
  }));
  const stem = new THREE.Mesh(
    sharedGeo('af-banana-stem', () => new THREE.CylinderGeometry(0.015, 0.02, 0.08, 8)),
    sharedMat('af-banana-stem', () => new THREE.MeshStandardMaterial({ color: '#7a5c1e', roughness: 0.8 })),
  );
  stem.position.y = 0.05;
  g.add(stem);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.06, 0),
      new THREE.Vector3(Math.sin(a) * 0.07, 0.02, Math.cos(a) * 0.07),
      new THREE.Vector3(Math.sin(a) * 0.14, -0.02, Math.cos(a) * 0.14),
      new THREE.Vector3(Math.sin(a) * 0.17, -0.06, Math.cos(a) * 0.17),
    ]);
    const peel = new THREE.Mesh(
      sharedGeo('af-banana-peel', () => new THREE.TubeGeometry(curve, 12, 0.022, 6)),
      yellow,
    );
    peel.scale.set(1, 1, 0.45);
    g.add(peel);
  }
  return g;
}

// Easter: painted egg — pastel canvas texture (stripes + dots), 3 variants.
function paintedEgg(variant: number) {
  const g = new THREE.Group();
  const bases = ['#98ff98', '#b0e0e6', '#d8b4fe'];
  const stripes = ['#ff9eb5', '#ffd76a', '#ffffff'];
  const base = bases[variant % 3]!;
  const stripe = stripes[variant % 3]!;
  const tex = sharedTex(`easter-egg-${variant % 3}`, () => {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256;
    const c = cv.getContext('2d')!;
    c.fillStyle = base; c.fillRect(0, 0, 128, 256);
    c.fillStyle = stripe;
    c.fillRect(0, 60, 128, 18); c.fillRect(0, 150, 128, 18);
    c.fillStyle = '#ffffff';
    for (let i = 0; i < 8; i++) {
      c.beginPath(); c.arc(16 + (i % 4) * 32, 105 + Math.floor(i / 4) * 90, 7, 0, Math.PI * 2); c.fill();
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
  const egg = new THREE.Mesh(
    sharedGeo('easter-egg', () => new THREE.SphereGeometry(0.12, 16, 12)),
    sharedMat(`easter-egg-${variant % 3}`, () => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 })),
  );
  egg.scale.y = 1.35;
  g.add(egg);
  return g;
}

// Easter: bunny — cream body, long ears with pink inners, puff tail.
function bunny() {
  const g = new THREE.Group();
  const fur = sharedMat('easter-bunny-fur', () => new THREE.MeshStandardMaterial({
    color: '#fdfdf5', roughness: 0.7,
  }));
  const pink = sharedMat('easter-bunny-pink', () => new THREE.MeshStandardMaterial({
    color: '#ffb6c1', roughness: 0.6,
  }));
  const body = new THREE.Mesh(sharedGeo('easter-bunny-body', () => new THREE.SphereGeometry(0.13, 14, 10)), fur);
  body.scale.set(1, 1.1, 0.9);
  body.position.y = 0.14;
  g.add(body);
  const head = new THREE.Mesh(sharedGeo('easter-bunny-head', () => new THREE.SphereGeometry(0.085, 14, 10)), fur);
  head.position.set(0, 0.32, 0.02);
  g.add(head);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(sharedGeo('easter-bunny-ear', () => new THREE.SphereGeometry(0.035, 10, 8)), fur);
    ear.position.set(side * 0.045, 0.46, 0);
    ear.scale.set(1, 2.6, 0.5);
    ear.rotation.z = side * -0.15;
    g.add(ear);
    const inner = new THREE.Mesh(sharedGeo('easter-bunny-inner-ear', () => new THREE.SphereGeometry(0.02, 8, 6)), pink);
    inner.position.set(side * 0.045, 0.46, 0.015);
    inner.scale.set(1, 2.2, 0.3);
    inner.rotation.z = side * -0.15;
    g.add(inner);
    const eye = new THREE.Mesh(
      sharedGeo('easter-bunny-eye', () => new THREE.SphereGeometry(0.01, 6, 6)),
      sharedMat('easter-bunny-eye', () => new THREE.MeshBasicMaterial({ color: '#1a1a1a' })),
    );
    eye.position.set(side * 0.04, 0.33, 0.09);
    g.add(eye);
    const foot = new THREE.Mesh(sharedGeo('easter-bunny-foot', () => new THREE.SphereGeometry(0.045, 8, 6)), fur);
    foot.position.set(side * 0.06, 0.03, 0.09);
    foot.scale.set(1, 0.5, 1.4);
    g.add(foot);
  }
  const nose = new THREE.Mesh(
    sharedGeo('easter-bunny-nose', () => new THREE.SphereGeometry(0.012, 6, 6)),
    pink,
  );
  nose.position.set(0, 0.31, 0.1);
  g.add(nose);
  const tail = new THREE.Mesh(sharedGeo('easter-bunny-tail', () => new THREE.SphereGeometry(0.045, 8, 8)), fur);
  tail.position.set(0, 0.16, -0.13);
  g.add(tail);
  return g;
}

// Easter: carrot — orange cone tip-down, green leaves on top.
function carrot() {
  const g = new THREE.Group();
  const root = new THREE.Mesh(
    sharedGeo('easter-carrot', () => new THREE.ConeGeometry(0.05, 0.2, 12)),
    sharedMat('easter-carrot', () => new THREE.MeshStandardMaterial({
      color: '#ff7f2a', roughness: 0.55, emissive: '#ff7f2a', emissiveIntensity: 0.15,
    })),
  );
  root.rotation.x = Math.PI;
  root.position.y = 0.1;
  g.add(root);
  const leafMat = sharedMat('easter-carrot-leaf', () => new THREE.MeshStandardMaterial({
    color: '#7ed321', roughness: 0.6,
  }));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leaf = new THREE.Mesh(
      sharedGeo('easter-carrot-leaf', () => new THREE.ConeGeometry(0.018, 0.1, 6)),
      leafMat,
    );
    leaf.position.set(Math.sin(a) * 0.02, 0.24, Math.cos(a) * 0.02);
    leaf.rotation.set(Math.cos(a) * 0.5, 0, Math.sin(a) * -0.5);
    g.add(leaf);
  }
  return g;
}

// Easter: daisy — white petals around a yellow center.
function daisy() {
  const g = new THREE.Group();
  const center = new THREE.Mesh(
    sharedGeo('easter-daisy-center', () => new THREE.SphereGeometry(0.03, 10, 8)),
    sharedMat('easter-daisy-center', () => new THREE.MeshStandardMaterial({
      color: '#ffd76a', roughness: 0.4, emissive: '#ffd76a', emissiveIntensity: 0.5,
    })),
  );
  center.position.y = 0.02;
  g.add(center);
  const petalMat = sharedMat('easter-daisy-petal', () => new THREE.MeshStandardMaterial({
    color: '#ffffff', roughness: 0.6, side: THREE.DoubleSide,
  }));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const petal = new THREE.Mesh(
      sharedGeo('easter-daisy-petal', () => new THREE.SphereGeometry(0.03, 8, 6)),
      petalMat,
    );
    petal.position.set(Math.sin(a) * 0.055, 0.015, Math.cos(a) * 0.055);
    petal.scale.set(1, 0.35, 1.6);
    petal.rotation.y = a;
    g.add(petal);
  }
  const stem = new THREE.Mesh(
    sharedGeo('easter-daisy-stem', () => new THREE.CylinderGeometry(0.008, 0.008, 0.08, 6)),
    sharedMat('easter-daisy-stem', () => new THREE.MeshStandardMaterial({ color: '#7ed321', roughness: 0.7 })),
  );
  stem.position.y = -0.03;
  g.add(stem);
  return g;
}

// Easter: grass tuft — five blades splayed outward.
function grassTuft() {
  const g = new THREE.Group();
  const mat = sharedMat('easter-grass', () => new THREE.MeshStandardMaterial({
    color: '#7ed321', roughness: 0.7,
  }));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    const blade = new THREE.Mesh(
      sharedGeo('easter-grass-blade', () => new THREE.ConeGeometry(0.012, 0.16 + (i % 3) * 0.03, 6)),
      mat,
    );
    blade.position.set(Math.sin(a) * 0.03, 0.08, Math.cos(a) * 0.03);
    blade.rotation.set(Math.cos(a) * 0.35, 0, Math.sin(a) * -0.35);
    g.add(blade);
  }
  return g;
}

// Easter: basket — brown basket with a handle, painted eggs tucked inside.
function easterBasket() {
  const g = new THREE.Group();
  const brown = sharedMat('easter-basket', () => new THREE.MeshStandardMaterial({
    color: '#8b5a2b', roughness: 0.8,
  }));
  const body = new THREE.Mesh(
    sharedGeo('easter-basket-body', () => new THREE.CylinderGeometry(0.16, 0.12, 0.12, 16)),
    brown,
  );
  body.position.y = 0.06;
  g.add(body);
  const rim = new THREE.Mesh(
    sharedGeo('easter-basket-rim', () => new THREE.TorusGeometry(0.16, 0.012, 8, 20)),
    brown,
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.12;
  g.add(rim);
  const handle = new THREE.Mesh(
    sharedGeo('easter-basket-handle', () => new THREE.TorusGeometry(0.14, 0.012, 6, 16, Math.PI)),
    brown,
  );
  handle.position.y = 0.12;
  g.add(handle);
  for (let i = 0; i < 3; i++) {
    const egg = paintedEgg(i);
    egg.scale.setScalar(0.55);
    egg.position.set((i - 1) * 0.07, 0.12, (i % 2) * 0.04 - 0.02);
    g.add(egg);
  }
  return g;
}

// Mother's Day: one carnation — ruffled pink head on a green stem.
function carnationHead() {
  const g = new THREE.Group();
  const pink = sharedMat('md-carnation', () => new THREE.MeshStandardMaterial({
    color: '#ff69b4', roughness: 0.55,
    emissive: '#c71585', emissiveIntensity: 0.25,
  }));
  const center = new THREE.Mesh(
    sharedGeo('md-carnation-center', () => new THREE.SphereGeometry(0.035, 10, 8)),
    sharedMat('md-carnation-center', () => new THREE.MeshStandardMaterial({
      color: '#e85a9b', roughness: 0.5,
    })),
  );
  center.scale.y = 0.7;
  g.add(center);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const petal = new THREE.Mesh(
      sharedGeo('md-carnation-petal', () => new THREE.SphereGeometry(0.032, 8, 6)),
      pink,
    );
    petal.position.set(Math.sin(a) * 0.045, 0.005, Math.cos(a) * 0.045);
    petal.scale.set(1, 0.35, 1.1);
    petal.rotation.y = a;
    g.add(petal);
  }
  return g;
}

// Mother's Day: bouquet of 5 carnations in a beige paper wrap.
function carnationBouquet() {
  const g = new THREE.Group();
  const stemMat = sharedMat('md-stem', () => new THREE.MeshStandardMaterial({
    color: '#8fbc8f', roughness: 0.7,
  }));
  const headOffsets = [
    [0, 0.42, 0, 0], [0.07, 0.36, 0.04, 0.5], [-0.07, 0.36, 0.03, -0.4],
    [0.03, 0.35, -0.07, 0.2], [-0.04, 0.35, -0.06, -0.2],
  ];
  for (const [x, y, z, tilt] of headOffsets) {
    const stem = new THREE.Mesh(
      sharedGeo('md-stem', () => new THREE.CylinderGeometry(0.008, 0.008, 0.3, 6)),
      stemMat,
    );
    stem.position.set(x * 0.4, 0.22, z * 0.4);
    stem.rotation.z = tilt * 0.3;
    g.add(stem);
    const head = carnationHead();
    head.position.set(x, y, z);
    head.rotation.x = tilt * 0.3;
    g.add(head);
  }
  const wrap = new THREE.Mesh(
    sharedGeo('md-wrap', () => new THREE.ConeGeometry(0.15, 0.26, 12, 1, true)),
    sharedMat('md-wrap', () => new THREE.MeshStandardMaterial({
      color: '#f5f5dc', roughness: 0.7, side: THREE.DoubleSide,
    })),
  );
  wrap.position.y = 0.13;
  g.add(wrap);
  const ribbon = new THREE.Mesh(
    sharedGeo('md-ribbon', () => new THREE.TorusGeometry(0.085, 0.01, 8, 16)),
    sharedMat('md-ribbon', () => new THREE.MeshStandardMaterial({
      color: '#ff69b4', roughness: 0.4, emissive: '#c71585', emissiveIntensity: 0.3,
    })),
  );
  ribbon.rotation.x = Math.PI / 2;
  ribbon.position.y = 0.2;
  g.add(ribbon);
  return g;
}

// Mother's Day: heart teacup — pearl cup, amber tea, heart emblem, saucer.
function heartTeacup() {
  const g = new THREE.Group();
  const pearl = sharedMat('md-cup', () => new THREE.MeshStandardMaterial({
    color: '#fdf5e6', roughness: 0.35,
  }));
  const saucer = new THREE.Mesh(
    sharedGeo('md-saucer', () => new THREE.CylinderGeometry(0.13, 0.1, 0.015, 16)),
    pearl,
  );
  saucer.position.y = 0.008;
  g.add(saucer);
  const cup = new THREE.Mesh(
    sharedGeo('md-cup', () => new THREE.CylinderGeometry(0.095, 0.07, 0.1, 16)),
    pearl,
  );
  cup.position.y = 0.065;
  g.add(cup);
  const tea = new THREE.Mesh(
    sharedGeo('md-tea', () => new THREE.CylinderGeometry(0.085, 0.085, 0.008, 16)),
    sharedMat('md-tea', () => new THREE.MeshStandardMaterial({
      color: '#d4a24a', roughness: 0.25, emissive: '#d4a24a', emissiveIntensity: 0.25,
    })),
  );
  tea.position.y = 0.11;
  g.add(tea);
  const handle = new THREE.Mesh(
    sharedGeo('md-cup-handle', () => new THREE.TorusGeometry(0.045, 0.008, 8, 14, Math.PI)),
    pearl,
  );
  handle.position.set(0.1, 0.065, 0);
  handle.rotation.z = -Math.PI / 2;
  g.add(handle);
  const heart = new THREE.Mesh(
    sharedGeo('md-cup-heart', () => new THREE.ExtrudeGeometry(heartShape(0.55), { depth: 0.012, bevelEnabled: false })),
    sharedMat('md-cup-heart', () => new THREE.MeshStandardMaterial({
      color: '#ff69b4', roughness: 0.35, emissive: '#c71585', emissiveIntensity: 0.4,
    })),
  );
  heart.position.set(0, 0.03, 0.085);
  g.add(heart);
  return g;
}

// Mother's Day: handwritten envelope — cream envelope, letter peeking out
// with a "Thank you, Mom" note, red wax seal.
function loveLetter() {
  const g = new THREE.Group();
  const tex = sharedTex('md-letter-note', () => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160;
    const c = cv.getContext('2d')!;
    c.fillStyle = '#fffdf5'; c.fillRect(0, 0, 256, 160);
    c.fillStyle = '#c71585';
    c.font = 'italic 30px cursive';
    c.textAlign = 'center';
    c.fillText('Thank you,', 128, 62);
    c.fillText('Mom ♥', 128, 105);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
  const note = new THREE.Mesh(
    sharedGeo('md-note', () => new THREE.PlaneGeometry(0.2, 0.125)),
    sharedMat('md-note', () => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide })),
  );
  note.position.set(0, 0.13, 0);
  note.rotation.x = -0.15;
  g.add(note);
  const env = new THREE.Mesh(
    sharedGeo('md-envelope', () => new THREE.BoxGeometry(0.24, 0.16, 0.012)),
    sharedMat('md-envelope', () => new THREE.MeshStandardMaterial({ color: '#f5f5dc', roughness: 0.7 })),
  );
  env.position.y = 0.08;
  g.add(env);
  const flapShape = new THREE.Shape();
  flapShape.moveTo(-0.12, 0.16);
  flapShape.lineTo(0.12, 0.16);
  flapShape.lineTo(0, 0.05);
  flapShape.closePath();
  const flap = new THREE.Mesh(
    sharedGeo('md-envelope-flap', () => new THREE.ExtrudeGeometry(flapShape, { depth: 0.004, bevelEnabled: false })),
    sharedMat('md-envelope-flap', () => new THREE.MeshStandardMaterial({ color: '#e8ddb8', roughness: 0.7 })),
  );
  flap.position.set(0, 0, 0.008);
  g.add(flap);
  const seal = new THREE.Mesh(
    sharedGeo('md-wax-seal', () => new THREE.CylinderGeometry(0.022, 0.022, 0.008, 12)),
    sharedMat('md-wax-seal', () => new THREE.MeshStandardMaterial({
      color: '#c71585', roughness: 0.4, emissive: '#c71585', emissiveIntensity: 0.3,
    })),
  );
  seal.rotation.x = Math.PI / 2;
  seal.position.set(0, 0.1, 0.01);
  g.add(seal);
  return g;
}

// Mother's Day: folded knit blanket — V-stitch canvas texture, yarn ball
// and knitting needles on top.
function knitFabric() {
  const g = new THREE.Group();
  const tex = sharedTex('md-knit', () => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 192;
    const c = cv.getContext('2d')!;
    c.fillStyle = '#f5f5dc'; c.fillRect(0, 0, 256, 192);
    const rows = ['#ff69b4', '#a8c8e8', '#f0d060'];
    c.lineWidth = 4; c.lineCap = 'round';
    for (let r = 0; r < 6; r++) {
      c.strokeStyle = rows[r % 3]!;
      for (let col = 0; col < 8; col++) {
        const x = 16 + col * 32, y = 16 + r * 32;
        c.beginPath();
        c.moveTo(x - 10, y - 8); c.lineTo(x, y + 8); c.lineTo(x + 10, y - 8);
        c.stroke();
      }
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
  const blanket = new THREE.Mesh(
    sharedGeo('md-blanket', () => new THREE.BoxGeometry(0.34, 0.09, 0.26)),
    sharedMat('md-blanket', () => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 })),
  );
  blanket.position.y = 0.045;
  g.add(blanket);
  const yarn = new THREE.Mesh(
    sharedGeo('md-yarn', () => new THREE.SphereGeometry(0.055, 12, 10)),
    sharedMat('md-yarn', () => new THREE.MeshStandardMaterial({
      color: '#ff69b4', roughness: 0.8, emissive: '#c71585', emissiveIntensity: 0.15,
    })),
  );
  yarn.position.set(0.08, 0.14, 0.05);
  g.add(yarn);
  const needleMat = sharedMat('md-needle', () => new THREE.MeshStandardMaterial({
    color: '#d4a24a', roughness: 0.3, metalness: 0.8,
  }));
  for (const [x, z, ry] of [[-0.08, 0.06, 0.5], [-0.05, 0.08, 0.35]] as const) {
    const needle = new THREE.Mesh(
      sharedGeo('md-needle', () => new THREE.CylinderGeometry(0.004, 0.004, 0.24, 6)),
      needleMat,
    );
    needle.position.set(x, 0.11, z);
    needle.rotation.set(Math.PI / 2 - 0.12, 0, ry);
    g.add(needle);
  }
  return g;
}

// Mother's Day: pearl necklace — pearls draped along a sagging curve with
// a gold heart pendant at the bottom.
function pearlNecklace() {
  const g = new THREE.Group();
  const pearlMat = sharedMat('md-pearl', () => new THREE.MeshStandardMaterial({
    color: '#fff8f0', roughness: 0.2, metalness: 0.15,
    emissive: '#ffe9d0', emissiveIntensity: 0.25,
  }));
  const pts = [
    new THREE.Vector3(-0.22, 0.16, 0), new THREE.Vector3(-0.18, 0.04, 0),
    new THREE.Vector3(-0.08, -0.02, 0), new THREE.Vector3(0, -0.04, 0),
    new THREE.Vector3(0.08, -0.02, 0), new THREE.Vector3(0.18, 0.04, 0),
    new THREE.Vector3(0.22, 0.16, 0),
  ];
  const curve = new THREE.CatmullRomCurve3(pts);
  for (let i = 0; i < 15; i++) {
    const p = curve.getPoint(i / 14);
    const pearl = new THREE.Mesh(
      sharedGeo('md-pearl', () => new THREE.SphereGeometry(0.024, 10, 8)),
      pearlMat,
    );
    pearl.position.copy(p);
    g.add(pearl);
  }
  const pendant = new THREE.Mesh(
    sharedGeo('md-pendant', () => new THREE.ExtrudeGeometry(heartShape(0.5), { depth: 0.01, bevelEnabled: false })),
    sharedMat('md-pendant', () => new THREE.MeshStandardMaterial({
      color: '#d4a24a', roughness: 0.3, metalness: 0.85,
    })),
  );
  pendant.position.set(0, -0.1, 0.01);
  g.add(pendant);
  return g;
}

/** Build the whole 3D decoration layer for a holiday theme. Default theme gets an empty layer. */
export function createThemeDecorations(
  theme: ThemeId,
): ThemeDecorations {
  const group = new THREE.Group();
  group.name = `theme-decorations-${theme}`;
  const floaters: Floater[] = [];
  const snowPoints: { points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>; material: THREE.ShaderMaterial }[] = [];

  const add = (
    obj: THREE.Object3D,
    kind: Floater['kind'],
    extra?: Floater['extra'],
  ) => {
    obj.userData.phase = Math.random() * Math.PI * 2;
    const floater: Floater = {
      obj, baseY: obj.position.y, phase: obj.userData.phase, kind, extra,
    };
    floaters.push(floater);
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
    // 5 vivid ghosts (3 expression variants) drifting in a sway.
    for (let i = 0; i < 5; i++) {
      const gh = ghost();
      const a = (i / 5) * Math.PI * 2 + 1;
      const fx = Math.sin(a) * 3.1, fz = Math.cos(a) * 3.1;
      gh.position.set(fx, 1.4 + i * 0.75, fz);
      add(gh, 'sway');
    }
    // 12 bats orbiting the carousel.
    for (let i = 0; i < 12; i++) {
      const b = bat();
      const a = (i / 12) * Math.PI * 2;
      add(b, 'orbit', { angle: a, radius: 2.4 + Math.random() * 1.2, speed: 0.25 + Math.random() * 0.4, y: 2 + Math.random() * 3.6, wobble: Math.random() });
    }
    // Spider webs + spiders at top of carousel (attached high up)
    for (let i = 0; i < 2; i++) {
      const webA = (i / 2) * Math.PI * 2 + 0.8;
      const webR = 2.1;
      const web = spiderWeb(0.4);
      web.position.set(Math.sin(webA) * webR, 5.1, Math.cos(webA) * webR);
      web.rotation.x = Math.PI / 2;
      add(web, 'bob');
      const sp = spider3d();
      sp.position.set(Math.sin(webA) * webR, 4.7 + i * 0.3, Math.cos(webA) * webR);
      add(sp, 'sway');
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
        sharedGeo('bauble-rim', () => new THREE.SphereGeometry(0.055, 12, 10)),
        sharedMat(`bauble-rim-${baubleColors[i % 4]}`, () => new THREE.MeshStandardMaterial({
          color: baubleColors[i % 4], roughness: 0.22, metalness: 0.65,
          emissive: baubleColors[i % 4], emissiveIntensity: 0.3,
        })),
      );
      b.position.set(Math.sin(a) * 2.28, 4.62, Math.cos(a) * 2.28);
      add(b, 'sway');
    }
    // Falling snow: points inside a cylinder around the carousel. Fall +
    // drift run in the vertex shader (update() only moves uniforms) — the
    // old code rewrote all 260x3 floats on the CPU every frame.
    const count = 260;
    const pos = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const phases = new Float32Array(count);
    const radii = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 2.0 + Math.random() * 2.8;
      pos.set([Math.sin(a) * r, Math.random() * 7, Math.cos(a) * r], i * 3);
      speeds[i] = 0.25 + Math.random() * 0.5;
      phases[i] = Math.random() * Math.PI * 2;
      radii[i] = r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aRadius', new THREE.BufferAttribute(radii, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uMotion: { value: 1 },
        uOpacity: { value: 0.92 },
        uPixelRatio: { value: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1 },
      },
      transparent: true, depthWrite: false, toneMapped: false,
      vertexShader: `
        attribute float aSpeed; attribute float aPhase; attribute float aRadius;
        uniform float uTime; uniform float uMotion; uniform float uPixelRatio;
        void main() {
          vec3 p = position;
          // Fall, wrapping over [-0.2, 7.2). The +0.2 keeps t=0 exact.
          p.y = mod(position.y + 0.2 - uTime * aSpeed * uMotion, 7.4) - 0.2;
          // Slow swirl around the column plus sideways drift.
          float a = atan(position.x, position.z) + uTime * 0.08 * uMotion;
          p.x = sin(a) * aRadius + sin(uTime * 0.6 + aPhase) * 0.12 * uMotion;
          p.z = cos(a) * aRadius;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(0.05 * uPixelRatio * 480.0 / max(1.0, -mv.z), 1.0, 64.0 * uPixelRatio);
        }`,
      fragmentShader: `
        uniform float uOpacity;
        void main() {
          vec2 p = (gl_PointCoord - 0.5) * 2.0;
          float alpha = (1.0 - smoothstep(0.7, 1.0, length(p))) * uOpacity;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
          #include <colorspace_fragment>
        }`,
    });
    const points = new THREE.Points(geo, mat);
    points.name = 'christmas-snowfall';
    group.add(points);
    snowPoints.push({ points, material: mat });
  }

  if (theme === 'spring-festival') {
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
      add(c, 'orbitCloud', { angle: a, radius: 3.6, y: 1.1 + i * 0.8, speed: 0.05 + (i % 3) * 0.02 });
    }
    // Firework-style orbs floating near the top
    for (let i = 0; i < 4; i++) {
      const fw = lunarFireworkOrb();
      const a = (i / 4) * Math.PI * 2 + 0.3;
      fw.position.set(Math.sin(a) * 2.8, 3.5 + i * 0.4, Math.cos(a) * 2.8);
      add(fw, 'orbit', { angle: a, radius: 2.8, speed: 0.18 + i * 0.04, y: 3.5 + i * 0.4, wobble: 0.4 });
    }
    // Chinese knots hanging from the canopy rim.
    for (let i = 0; i < 4; i++) {
      const k = chineseKnot();
      const a = (i / 4) * Math.PI * 2 + 0.85;
      k.position.set(Math.sin(a) * 2.35, 4.0, Math.cos(a) * 2.35);
      k.rotation.y = -a;
      add(k, 'sway');
    }
    // 福 plaque facing the front, flanked by spring couplets.
    const fu = fuPlaque();
    fu.position.set(0, 3.0, 2.85);
    add(fu, 'sway');
    const coupletTexts = ['迎春接福', '万事如意'] as const;
    for (let i = 0; i < 2; i++) {
      const banner = coupletBanner(coupletTexts[i]!);
      const a = (i === 0 ? -1 : 1) * 0.55;
      banner.position.set(Math.sin(a) * 2.2, 1.6, Math.cos(a) * 2.2);
      banner.rotation.y = -a;
      add(banner, 'sway');
    }
    // Firecracker strings hanging at mid height.
    for (let i = 0; i < 4; i++) {
      const fc = firecrackerString();
      const a = (i / 4) * Math.PI * 2 + 1.5;
      fc.position.set(Math.sin(a) * 2.2, 3.6, Math.cos(a) * 2.2);
      add(fc, 'sway');
    }
    // Zodiac horse mascots on the base.
    for (let i = 0; i < 2; i++) {
      const a = i * Math.PI + 1.9;
      const horse = zodiacHorse();
      horse.position.set(Math.sin(a) * 1.5, 0.0, Math.cos(a) * 1.5);
      horse.rotation.y = -a + Math.PI / 2;
      add(horse, 'bob');
    }
    // Plum branches in bloom around the base.
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.2;
      const branch = plumBranch();
      branch.position.set(Math.sin(a) * 2.0, 0.0, Math.cos(a) * 2.0);
      branch.rotation.y = -a;
      branch.rotation.z = -0.25;
      add(branch, 'sway');
    }
  }

  if (theme === 'new-year') {
    // Champagne tower on the base.
    const tower = champagneTower();
    tower.position.set(1.4, 0.0, -1.0);
    tower.rotation.y = 0.6;
    add(tower, 'bob');
    // Countdown clocks flanking the carousel at mid height.
    for (let i = 0; i < 2; i++) {
      const a = i * Math.PI + 0.7;
      const clock = countdownClock();
      clock.position.set(Math.sin(a) * 2.6, 3.1, Math.cos(a) * 2.6);
      clock.rotation.y = -a;
      add(clock, 'sway');
    }
    // Star balloons orbiting the carousel.
    for (let i = 0; i < 6; i++) {
      const b = starBalloon();
      const a = (i / 6) * Math.PI * 2;
      add(b, 'orbit', { angle: a, radius: 2.6 + (i % 3) * 0.4, speed: 0.2 + (i % 3) * 0.1, y: 2.2 + (i % 3) * 0.9, wobble: 0.3 });
    }
    // Party confetti bursts drifting mid-air.
    for (let i = 0; i < 3; i++) {
      const c = partyConfetti();
      const a = (i / 3) * Math.PI * 2 + 1.1;
      c.position.set(Math.sin(a) * 3.0, 1.6 + i * 1.1, Math.cos(a) * 3.0);
      add(c, 'bob');
    }
    // Champagne flutes standing on the base ring.
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.3;
      const flute = champagneFlute();
      flute.position.set(Math.sin(a) * 1.8, 0.0, Math.cos(a) * 1.8);
      add(flute, 'bob');
    }
    // Gold glow sprites over the tower and clocks (shared, no PointLight).
    for (const [x, y, z, s] of [[1.4, 0.7, -1.0, 1.1], [-2.6, 3.1, 0, 0.9], [2.6, 3.1, 0, 0.9]] as const) {
      const glow = new THREE.Sprite(getGlowMaterial());
      glow.position.set(x, y, z);
      glow.scale.setScalar(s);
      group.add(glow);
    }
  }

  if (theme === 'valentine') {
    // Floating heart balloons orbiting the carousel.
    for (let i = 0; i < 6; i++) {
      const b = heartBalloon();
      const a = (i / 6) * Math.PI * 2;
      add(b, 'orbit', { angle: a, radius: 2.6 + (i % 3) * 0.4, speed: 0.18 + (i % 3) * 0.08, y: 2.2 + (i % 3) * 0.9, wobble: 0.3 });
    }
    // Rose petals drifting around the scene.
    for (let i = 0; i < 12; i++) {
      const p = rosePetal();
      const a = (i / 12) * Math.PI * 2 + 0.2;
      const r = 2.0 + (i % 4) * 0.45;
      p.position.set(Math.sin(a) * r, 0.8 + (i % 5) * 0.75, Math.cos(a) * r);
      p.rotation.y = a;
      add(p, 'sway');
    }
    // Cupid's arrows crossing high above the carousel.
    for (let i = 0; i < 2; i++) {
      const arrow = cupidsArrow();
      const a = i * Math.PI + 0.4;
      arrow.position.set(Math.sin(a) * 1.6, 4.3, Math.cos(a) * 1.6);
      arrow.rotation.set(0, -a, i === 0 ? 0.5 : -0.5);
      add(arrow, 'bob');
    }
    // Rose gift boxes on the base ring.
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.5;
      const box = roseGiftBox();
      box.position.set(Math.sin(a) * 1.8, 0.06, Math.cos(a) * 1.8);
      box.rotation.y = a;
      add(box, 'bob');
    }
    // Glowing candles near the base (emissive + halo sprite, no light).
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 1.2;
      const candle = glowingCandle();
      candle.position.set(Math.sin(a) * 1.3, 0.0, Math.cos(a) * 1.3);
      add(candle, 'bob');
    }
  }

  if (theme === 'carnival') {
    // Venetian masks floating around the carousel.
    for (let i = 0; i < 4; i++) {
      const m = venetianMask();
      const a = (i / 4) * Math.PI * 2 + 0.5;
      m.position.set(Math.sin(a) * 2.4, 2.5 + (i % 2) * 1.2, Math.cos(a) * 2.4);
      m.rotation.y = -a;
      add(m, 'sway');
    }
    // Feather headdresses on the base.
    for (let i = 0; i < 2; i++) {
      const h = featherHeaddress();
      const a = i * Math.PI + 0.9;
      h.position.set(Math.sin(a) * 1.6, 0.15, Math.cos(a) * 1.6);
      h.rotation.y = -a;
      add(h, 'bob');
    }
    // Samba drums on the base ring.
    for (let i = 0; i < 3; i++) {
      const d = sambaDrum();
      const a = (i / 3) * Math.PI * 2 + 0.3;
      d.position.set(Math.sin(a) * 1.9, 0.11, Math.cos(a) * 1.9);
      add(d, 'bob');
    }
    // Tassel bead strands hanging from the canopy rim.
    for (let i = 0; i < 4; i++) {
      const t = tasselBeads();
      const a = (i / 4) * Math.PI * 2 + 1.2;
      t.position.set(Math.sin(a) * 2.3, 4.3, Math.cos(a) * 2.3);
      t.rotation.y = -a;
      add(t, 'sway');
    }
    // Streamer ribbons drifting mid-air.
    for (let i = 0; i < 3; i++) {
      const r = streamerRibbon();
      const a = (i / 3) * Math.PI * 2 + 0.8;
      r.position.set(Math.sin(a) * 2.8, 2.0 + i * 0.8, Math.cos(a) * 2.8);
      r.rotation.y = -a;
      add(r, 'bob');
    }
    // Glitter trail: colored points falling + swirling in the vertex
    // shader, same pattern as the Christmas snow (update() only moves
    // uniforms). Purple / gold / peacock blue / magenta.
    const count = 200;
    const pos = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const phases = new Float32Array(count);
    const radii = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const glitterPalette = [
      new THREE.Color('#8a2be2'), new THREE.Color('#ffd700'),
      new THREE.Color('#00a4ef'), new THREE.Color('#ff007f'),
    ];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 2.0 + Math.random() * 2.8;
      pos.set([Math.sin(a) * r, Math.random() * 7, Math.cos(a) * r], i * 3);
      speeds[i] = 0.2 + Math.random() * 0.45;
      phases[i] = Math.random() * Math.PI * 2;
      radii[i] = r;
      const col = glitterPalette[i % 4]!;
      colors.set([col.r, col.g, col.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aRadius', new THREE.BufferAttribute(radii, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uMotion: { value: 1 },
        uOpacity: { value: 0.95 },
        uPixelRatio: { value: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1 },
      },
      transparent: true, depthWrite: false, toneMapped: false,
      vertexShader: `
        attribute float aSpeed; attribute float aPhase; attribute float aRadius;
        attribute vec3 aColor; varying vec3 vColor;
        uniform float uTime; uniform float uMotion; uniform float uPixelRatio;
        void main() {
          vColor = aColor;
          vec3 p = position;
          p.y = mod(position.y + 0.2 - uTime * aSpeed * uMotion, 7.4) - 0.2;
          float a = atan(position.x, position.z) + uTime * 0.08 * uMotion;
          p.x = sin(a) * aRadius + sin(uTime * 0.6 + aPhase) * 0.12 * uMotion;
          p.z = cos(a) * aRadius;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(0.05 * uPixelRatio * 480.0 / max(1.0, -mv.z), 1.0, 64.0 * uPixelRatio);
        }`,
      fragmentShader: `
        varying vec3 vColor;
        uniform float uOpacity;
        void main() {
          vec2 p = (gl_PointCoord - 0.5) * 2.0;
          float alpha = (1.0 - smoothstep(0.7, 1.0, length(p))) * uOpacity;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(vColor, alpha);
          #include <colorspace_fragment>
        }`,
    });
    const points = new THREE.Points(geo, mat);
    points.name = 'carnival-glitter';
    group.add(points);
    snowPoints.push({ points, material: mat });
  }

  if (theme === 'st-patrick') {
    // Shamrocks drifting around the carousel.
    for (let i = 0; i < 6; i++) {
      const s = shamrock(3);
      const a = (i / 6) * Math.PI * 2 + 0.4;
      s.position.set(Math.sin(a) * 2.6, 1.4 + (i % 3) * 1.1, Math.cos(a) * 2.6);
      s.rotation.y = -a;
      add(s, 'sway');
    }
    // Lucky four-leaf clovers on the base.
    for (let i = 0; i < 2; i++) {
      const a = i * Math.PI + 1.1;
      const c = shamrock(4);
      c.position.set(Math.sin(a) * 1.5, 0.25, Math.cos(a) * 1.5);
      c.rotation.y = -a;
      c.scale.setScalar(1.2);
      add(c, 'bob');
    }
    // Pot of gold on the base.
    const pot = potOfGold();
    pot.position.set(1.2, 0.0, -1.2);
    pot.rotation.y = 0.5;
    add(pot, 'bob');
    // Leprechaun hats on the base ring.
    for (let i = 0; i < 2; i++) {
      const a = i * Math.PI + 2.4;
      const h = leprechaunHat();
      h.position.set(Math.sin(a) * 1.7, 0.0, Math.cos(a) * 1.7);
      h.rotation.y = -a;
      add(h, 'bob');
    }
    // Rainbow arcing high behind the carousel — it must crest above the
    // roof peak (y 6.35) or the canopy hides it entirely from the front.
    const rb = rainbow();
    rb.position.set(0, 6.0, -2.2);
    rb.scale.setScalar(1.8);
    add(rb, 'sway');
    // Stout glasses on the base ring.
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.7;
      const st = stoutGlass();
      st.position.set(Math.sin(a) * 1.9, 0.0, Math.cos(a) * 1.9);
      add(st, 'bob');
    }
  }

  if (theme === 'april-fools') {
    // Clown hats bobbing mid-air.
    for (let i = 0; i < 3; i++) {
      const h = clownHat();
      const a = (i / 3) * Math.PI * 2 + 0.6;
      h.position.set(Math.sin(a) * 2.6, 2.2 + i * 0.9, Math.cos(a) * 2.6);
      h.rotation.y = -a;
      add(h, 'sway');
    }
    // Spring boxing gloves on the base.
    for (let i = 0; i < 2; i++) {
      const a = i * Math.PI + 0.8;
      const glove = springBoxingGlove();
      glove.position.set(Math.sin(a) * 1.6, 0.0, Math.cos(a) * 1.6);
      glove.rotation.y = -a;
      add(glove, 'bob');
    }
    // Question-mark signs orbiting the carousel.
    for (let i = 0; i < 4; i++) {
      const q = questionMarkSign();
      const a = (i / 4) * Math.PI * 2;
      add(q, 'orbit', { angle: a, radius: 2.8, speed: 0.22 + (i % 2) * 0.1, y: 2.6 + (i % 2) * 0.9, wobble: 0.5 });
    }
    // Gag candies on the base ring.
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.3;
      const candy = gagCandy(i);
      candy.position.set(Math.sin(a) * 1.9, 0.1, Math.cos(a) * 1.9);
      candy.rotation.set(Math.random() * 0.5, a, Math.random() * 0.5);
      add(candy, 'bob');
    }
    // Funny glasses floating high.
    for (let i = 0; i < 2; i++) {
      const a = i * Math.PI + 1.4;
      const glasses = funnyGlasses();
      glasses.position.set(Math.sin(a) * 2.2, 4.2, Math.cos(a) * 2.2);
      glasses.rotation.y = -a;
      add(glasses, 'sway');
    }
    // Banana peels slipped on the base.
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 1.9;
      const peel = bananaPeel();
      peel.position.set(Math.sin(a) * 1.5, 0.08, Math.cos(a) * 1.5);
      peel.rotation.y = a;
      add(peel, 'bob');
    }
  }

  if (theme === 'easter') {
    // Painted eggs on the base ring.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.3;
      const egg = paintedEgg(i);
      egg.position.set(Math.sin(a) * 1.9, 0.14, Math.cos(a) * 1.9);
      egg.rotation.y = a;
      add(egg, 'bob');
    }
    // Bunnies on the base (scaled up so they read past the horses).
    for (let i = 0; i < 2; i++) {
      const a = i * Math.PI + 0.9;
      const b = bunny();
      b.position.set(Math.sin(a) * 1.4, 0.0, Math.cos(a) * 1.4);
      b.rotation.y = -a;
      b.scale.setScalar(1.25);
      add(b, 'bob');
    }
    // Carrots on the base ring.
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 1.1;
      const c = carrot();
      c.position.set(Math.sin(a) * 1.7, 0.0, Math.cos(a) * 1.7);
      c.rotation.y = a;
      add(c, 'bob');
    }
    // Daisies scattered around the base.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.2;
      const d = daisy();
      d.position.set(Math.sin(a) * 2.1, 0.08, Math.cos(a) * 2.1);
      d.rotation.y = a;
      add(d, 'sway');
    }
    // Grass tufts around the base.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.7;
      const tuft = grassTuft();
      tuft.position.set(Math.sin(a) * 2.2, 0.0, Math.cos(a) * 2.2);
      add(tuft, 'sway');
    }
    // Easter baskets on the base.
    for (let i = 0; i < 2; i++) {
      const a = i * Math.PI + 2.2;
      const basket = easterBasket();
      basket.position.set(Math.sin(a) * 1.2, 0.0, Math.cos(a) * 1.2);
      basket.rotation.y = -a;
      basket.scale.setScalar(1.15);
      add(basket, 'bob');
    }
  }

  if (theme === 'mothers-day') {
    // Carnation bouquets on the base ring (scaled up so they read past the horses).
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      const bq = carnationBouquet();
      bq.position.set(Math.sin(a) * 1.6, 0.0, Math.cos(a) * 1.6);
      bq.rotation.y = -a;
      bq.scale.setScalar(1.3);
      add(bq, 'bob');
    }
    // Heart teacups on the base.
    for (let i = 0; i < 2; i++) {
      const a = i * Math.PI + 1.6;
      const cup = heartTeacup();
      cup.position.set(Math.sin(a) * 1.4, 0.0, Math.cos(a) * 1.4);
      cup.rotation.y = -a;
      cup.scale.setScalar(1.25);
      add(cup, 'bob');
    }
    // Love letters — two on the base, two floating mid-air.
    for (let i = 0; i < 2; i++) {
      const a = i * Math.PI + 0.3;
      const letter = loveLetter();
      letter.position.set(Math.sin(a) * 1.9, 0.0, Math.cos(a) * 1.9);
      letter.rotation.y = -a;
      letter.scale.setScalar(1.3);
      add(letter, 'bob');
    }
    for (let i = 0; i < 2; i++) {
      const a = i * Math.PI + 2.4;
      const letter = loveLetter();
      letter.position.set(Math.sin(a) * 2.5, 2.3 + i * 0.8, Math.cos(a) * 2.5);
      letter.rotation.y = -a;
      letter.scale.setScalar(1.5);
      add(letter, 'sway');
    }
    // Folded knit blankets on the base.
    for (let i = 0; i < 2; i++) {
      const a = i * Math.PI + 2.9;
      const knit = knitFabric();
      knit.position.set(Math.sin(a) * 1.8, 0.0, Math.cos(a) * 1.8);
      knit.rotation.y = -a;
      knit.scale.setScalar(1.15);
      add(knit, 'bob');
    }
    // Pearl necklaces — one laid flat on the front base (pendant outward),
    // one hanging from the rim.
    const necklace = pearlNecklace();
    necklace.position.set(0, 0.06, 2.0);
    necklace.rotation.x = -Math.PI / 2;
    necklace.scale.setScalar(1.3);
    add(necklace, 'sway');
    const necklaceHigh = pearlNecklace();
    necklaceHigh.position.set(1.4, 4.2, 1.8);
    necklaceHigh.rotation.y = -0.6;
    necklaceHigh.scale.setScalar(1.2);
    add(necklaceHigh, 'sway');
  }

  // Collect per-layer disposables: geometries / materials / textures owned
  // by THIS layer only. Shared cached resources (SHARED) are skipped — the
  // next layer reuses them — and material.map textures are freed too (the
  // old code leaked every CanvasTexture, e.g. pumpkin faces).
  const disposables: { dispose(): void }[] = [];
  const seenDisposables = new Set<object>();
  const collect = (d: { dispose(): void }) => {
    if (!SHARED.has(d) && !seenDisposables.has(d)) {
      seenDisposables.add(d);
      disposables.push(d);
    }
  };
  group.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) collect(mesh.geometry);
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (mat) (Array.isArray(mat) ? mat : [mat]).forEach(m => {
      collect(m);
      const withMap = m as THREE.Material & { map?: THREE.Texture | null };
      if (withMap.map) collect(withMap.map);
    });
  });

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
    // Snow falls + drifts in the vertex shader; only the uniforms move.
    for (const s of snowPoints) {
      s.material.uniforms.uTime.value = t;
      s.material.uniforms.uMotion.value = k;
    }
  }

  function dispose() {
    disposables.forEach(d => d.dispose());
    group.removeFromParent();
  }

  return { group, update, dispose };
}
