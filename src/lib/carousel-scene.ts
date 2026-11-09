import * as THREE from 'three';
import { readSavedView, saveView, type SavedView } from './view-storage';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createCarouselMotion } from './carousel-motion';
import { createMemoryProjections } from './memory-projections';
import { createHorse, addGarden, addPole } from './carousel-ornaments';
import { PHOTO_COUNT, loadPhoto, HAND_FONT, drawCaption } from './photos';
import { translate } from '@/i18n';
import { gsap } from 'gsap';
import { THEMES, type ThemeId } from './themes';
import { createThemeDecorations, type ThemeDecorations } from './theme-decorations';
import { selectIntroMode, type CameraRig } from './intro-timeline';

export type CarouselAPI = {
  ready: Promise<void>;
  focus: (index: number) => void;
  reset: () => void;
  wind: () => void;
  rotate: (on: boolean) => void;
  light: (on: boolean) => void;
  selectMode: (on: boolean) => void;
  setPhoto: (index: number, src: string | null) => Promise<void>;
  setCaption: (index: number, caption: string) => Promise<void>;
  swapPhotos: (from: number, to: number) => void;
  setTheme: (theme: ThemeId, instant?: boolean) => void;
  dispose: () => void;
};
export function createCarousel(
  el: HTMLDivElement,
  onSelect: (index: number) => void,
  onError: (message: string) => void,
  onSwap: (from: number, to: number) => Promise<void>,
  onViewSave: (saved: boolean) => void = () => {},
): CarouselAPI {
  const savedView = readSavedView();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.88;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 70);
  const home = new THREE.Vector3(5.95, 5.55, 10.8),
    homeTarget = new THREE.Vector3(0, 3.0, 0);
  camera.position.copy(home);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(homeTarget);
  if (savedView) {
    camera.position.fromArray(savedView.position);
    controls.target.fromArray(savedView.target);
    controls.update();
  }
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 4;
  controls.maxDistance = 20;
  controls.minPolarAngle = Math.PI * .22;
  controls.maxPolarAngle = Math.PI * 0.445;
  const pmrem = new THREE.PMREMGenerator(renderer),
    room = new RoomEnvironment(),
    env = pmrem.fromScene(room, 0.04);
  scene.environment = env.texture;
  room.dispose();
  const hemi = new THREE.HemisphereLight('#eef3ff', '#939dad', 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe0ae', 1.5);
  // Preallocated: the per-frame sun colour lerp below used to `new` one.
  const daySunColor = new THREE.Color('#fff0dc');
  sun.position.set(-6, 7.5, 4);
  sun.target.position.set(0, 3, 0);
  scene.add(sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 8, bottom: -5 });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = .012;
  sun.shadow.radius = 2;
  scene.add(sun);
  const blue = new THREE.DirectionalLight('#a7c3ef', 0.55);
  blue.position.set(4, 3, -4);
  scene.add(blue);
  // Low side-window light reaches the horses below the overhanging canopy.
  const daylight = new THREE.SpotLight('#ffdfad', 0, 24, .55, .8, 2);
  daylight.position.set(-5.5, 5.8, 5.5);
  daylight.target.position.set(0, 2.1, 0);
  daylight.castShadow = true;
  daylight.shadow.mapSize.set(1024, 1024);
  daylight.shadow.bias = -.0002;
  daylight.shadow.normalBias = .015;
  scene.add(daylight, daylight.target);
  const daylightRim = new THREE.DirectionalLight('#fff1d6', 0);
  daylightRim.position.set(-4, 5, -5);
  daylightRim.target.position.set(0, 3, 0);
  scene.add(daylightRim, daylightRim.target);
  const bulbs: THREE.PointLight[] = [],
    spots: THREE.SpotLight[] = [];
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3 + 0.4,
      x = Math.sin(angle) * 0.75,
      z = Math.cos(angle) * 0.75;
    const light = new THREE.PointLight('#ffbb68', 0, 8, 2);
    light.position.set(x, 5.26, z);
    scene.add(light);
    bulbs.push(light);
    const beam = new THREE.SpotLight('#ffc17a', 0, 7, 0.56, 0.92, 1.5);
    beam.position.set(x, 5.22, z);
    beam.target.position.set(x * 1.35, 0.75, z * 1.35);
    beam.castShadow = i === 0;
    beam.shadow.mapSize.set(1024, 1024);
    beam.shadow.bias = -0.001;
    scene.add(beam, beam.target);
    spots.push(beam);
  }
  const root = new THREE.Group();
  scene.add(root);
  const textures = new Set<THREE.Texture>();
  const material = (color: string, roughness = 0.65) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.03 });
  const cream = material('#faf3e0'),
    red = material('#e0796e'),
    sky = material('#a8d4e6'),
    green = material('#7fb8c9'),
    yellow = material('#e8b84a');
  const gold = new THREE.MeshStandardMaterial({
    color: '#d4ad62',
    roughness: 0.34,
    metalness: 0.68,
  });
  const trimColors = [red, sky, yellow, cream];
  function mesh(
    geometry: THREE.BufferGeometry,
    mat: THREE.Material,
    parent: THREE.Object3D = root,
    x = 0,
    y = 0,
    z = 0,
    shadow: 'none' | 'cast' | 'both' = 'none',
  ) {
    const m = new THREE.Mesh(geometry, mat);
    m.position.set(x, y, z);
    // Only large pieces cast/receive shadows (base, roof, column, frames):
    // small trim used to render into the shadow map too, for nothing.
    m.castShadow = shadow !== 'none';
    m.receiveShadow = shadow === 'both';
    parent.add(m);
    return m;
  }
  function ring(
    radius: number,
    y: number,
    tube = 0.025,
    mat: THREE.Material = gold,
  ) {
    const m = mesh(
      new THREE.TorusGeometry(radius, tube, 8, 64),
      mat,
      root,
      0,
      y,
    );
    m.rotation.x = Math.PI / 2;
    return m;
  }
  // Warm the handwriting font so captions render correctly on first draw.
  if (typeof document !== 'undefined' && 'fonts' in document) {
    void document.fonts.load(`34px ${HAND_FONT}`).catch(() => {});
  }
  let alive = true,
    raf = 0,
    active = -1,
    selecting = false,
    gust = 0,
    night = savedView?.night ? 1 : 0,
    nightTarget = savedView?.night ? 1 : 0,
    rotating = savedView?.spinning ?? false,
    transition = false,
    // Intro lifecycle: while the intro timeline owns the camera and the
    // decorations, input and view persistence stay off.
    introPlaying = false,
    introPlayed = false,
    introTl: gsap.core.Timeline | null = null;
  // ---- Procedural textures for the clock-themed carousel ----
  function candyTexture() {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 512;
    const c = cv.getContext('2d')!;
    c.fillStyle = '#faf3e0';
    c.fillRect(0, 0, 256, 512);
    c.strokeStyle = '#e0796e';
    c.lineWidth = 30;
    for (let i = -512; i < 320; i += 64) {
      c.beginPath();
      c.moveTo(i, 512);
      c.lineTo(i + 512, 0);
      c.stroke();
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 3);
    t.colorSpace = THREE.SRGBColorSpace;
    textures.add(t);
    return t;
  }
  function clockBandTexture() {
    const cv = document.createElement('canvas');
    cv.width = 1024;
    cv.height = 128;
    const c = cv.getContext('2d')!;
    c.fillStyle = '#a8d4e6';
    c.fillRect(0, 0, 1024, 128);
    c.fillStyle = '#e0796e';
    for (let n = 0; n < 12; n++) {
      const x = n * (1024 / 12);
      c.fillRect(x - 2, 10, 4, 22);
      c.fillRect(x - 2, 96, 4, 22);
    }
    c.fillStyle = '#33506b';
    c.font = 'bold 62px Georgia, serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (let n = 1; n <= 12; n++) {
      c.fillText(String(n), (n - 0.5) * (1024 / 12), 66);
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(1, 1);
    t.colorSpace = THREE.SRGBColorSpace;
    textures.add(t);
    return t;
  }
  const candyMat = new THREE.MeshStandardMaterial({
    map: candyTexture(),
    roughness: 0.55,
    metalness: 0.04,
  });
  const clockMat = new THREE.MeshStandardMaterial({
    map: clockBandTexture(),
    roughness: 0.6,
    metalness: 0.03,
  });
  // ---- Clock-themed tiered base ----
  mesh(new THREE.CylinderGeometry(1.5, 1.44, 0.18, 64), cream, root, 0, 0.13, 0, 'both');
  mesh(new THREE.CylinderGeometry(1.46, 1.46, 0.5, 64), clockMat, root, 0, 0.46, 0, 'both');
  mesh(new THREE.CylinderGeometry(1.52, 1.48, 0.1, 64), red, root, 0, 0.76, 0, 'both');
  mesh(new THREE.CylinderGeometry(1.42, 1.48, 0.08, 64), sky, root, 0, 0.84, 0, 'both');
  ring(1.47, 0.22, 0.025, gold);
  ring(1.49, 0.71, 0.03, gold);
  ring(1.45, 0.88, 0.022, gold);
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3;
    const foot = mesh(
      new THREE.SphereGeometry(0.13, 16, 12),
      sky,
      root,
      Math.sin(a) * 1.08,
      0.045,
      Math.cos(a) * 1.08,
    );
    foot.scale.set(1, 0.48, 1);
  }
  // ---- Candy-cane central column ----
  mesh(new THREE.CylinderGeometry(0.3, 0.34, 4.14, 48), candyMat, root, 0, 2.95, 0, 'cast');
  ring(0.35, 1.0, 0.03, gold);
  ring(0.31, 4.9, 0.03, gold);
  mesh(new THREE.CylinderGeometry(0.5, 0.32, 0.42, 48), cream, root, 0, 5.2, 0, 'cast');
  ring(0.52, 5.41, 0.03, gold);
  const concealedLight = new THREE.MeshStandardMaterial({
    color: '#e0bd75',
    emissive: '#ffae4b',
    emissiveIntensity: 0,
    roughness: 0.45,
  });
  ring(0.72, 5.26, 0.042, concealedLight);
  // ---- Striped scalloped canopy ----
  const roofProfile = [
    new THREE.Vector2(0.06, 6.35),
    new THREE.Vector2(0.2, 6.15),
    new THREE.Vector2(0.6, 5.85),
    new THREE.Vector2(1.2, 5.55),
    new THREE.Vector2(1.85, 5.4),
    new THREE.Vector2(2.2, 5.35),
  ];
  const roofMaterials = [material('#e0796e'), material('#a8d4e6')];
  for (let i = 0; i < 20; i++) {
    const m = mesh(
      new THREE.LatheGeometry(
        roofProfile,
        8,
        (i * Math.PI) / 10,
        Math.PI / 10 + 0.001,
      ),
      roofMaterials[i % 2],
      root,
      0,
      0,
      0,
      'cast',
    );
    m.material.side = THREE.DoubleSide;
  }
  const shadeMat = new THREE.MeshStandardMaterial({
    color: '#fff0ca',
    emissive: '#ffc276',
    emissiveIntensity: 0.15,
    roughness: 0.85,
    side: THREE.DoubleSide,
  });
  // Roof lining: no shadow (it hangs under the canopy).
  mesh(
    new THREE.LatheGeometry(
      roofProfile.map((p) => new THREE.Vector2(p.x * 0.985, p.y - 0.028)),
      96,
    ),
    shadeMat,
    root,
  );
  // Scalloped fascia hanging from the canopy rim.
  const fascia = new THREE.CylinderGeometry(2.2, 2.2, 0.42, 64, 1, true);
  const positions = fascia.attributes.position;
  for (let i = 0; i <= 64; i++) {
    const fraction = ((i / 64) * 16) % 1;
    positions.setY(i, 0.21 + Math.sin(fraction * Math.PI) * 0.13);
  }
  positions.needsUpdate = true;
  fascia.computeVertexNormals();
  const fasciaMaterial = new THREE.MeshStandardMaterial({
    color: '#e0796e',
    roughness: 0.6,
    side: THREE.DoubleSide,
  });
  mesh(fascia, fasciaMaterial, root, 0, 5.16, 0, 'cast');
  ring(2.2, 4.97, 0.03, gold);
  // Fringe tassels along the scalloped edge.
  for (let i = 0; i < 32; i++) {
    const a = (i * Math.PI * 2) / 32;
    mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.26, 6),
      i % 2 ? gold : red,
      root,
      Math.sin(a) * 2.18,
      4.86,
      Math.cos(a) * 2.18,
    );
    mesh(
      new THREE.SphereGeometry(0.022, 8, 6),
      gold,
      root,
      Math.sin(a) * 2.18,
      4.72,
      Math.cos(a) * 2.18,
    );
  }
  // ---- Heart finial with flowing ribbon ----
  mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.34, 8), gold, root, 0, 6.44);
  ring(0.12, 6.3, 0.02, gold);
  const heartShape = new THREE.Shape();
  heartShape.moveTo(0, 0.1);
  heartShape.bezierCurveTo(0, 0.18, -0.16, 0.22, -0.16, 0.1);
  heartShape.bezierCurveTo(-0.16, 0.0, 0, -0.04, 0, -0.16);
  heartShape.bezierCurveTo(0, -0.04, 0.16, 0.0, 0.16, 0.1);
  heartShape.bezierCurveTo(0.16, 0.22, 0, 0.18, 0, 0.1);
  const heart = mesh(
    new THREE.ExtrudeGeometry(heartShape, {
      depth: 0.05,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.012,
      bevelThickness: 0.012,
    }),
    red,
    root,
    0,
    6.62,
  );
  heart.rotation.x = Math.PI;
  const ribbonCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 6.66, 0),
    new THREE.Vector3(0.45, 6.5, 0.25),
    new THREE.Vector3(0.95, 6.05, -0.15),
    new THREE.Vector3(1.35, 5.55, 0.35),
  ]);
  mesh(new THREE.TubeGeometry(ribbonCurve, 32, 0.03, 8), red, root);
  ring(0.18, 6.18, 0.03, gold);
  // Intentionally no floor plane, contact-shadow decal, or ground glow.
  function glowTexture() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const c = cv.getContext('2d')!;
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,213,149,.7)');
    g.addColorStop(0.4, 'rgba(255,186,110,.2)');
    g.addColorStop(1, 'rgba(255,178,105,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(cv);
    textures.add(t);
    return t;
  }
  const glowMap = glowTexture();
  const haloMat = new THREE.SpriteMaterial({
    map: glowMap,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.Sprite(haloMat);
  halo.position.set(0, 5.26, 0);
  halo.scale.set(2.5, 1.3, 1);
  root.add(halo);
  // Local halation along the lit rim keeps the rest of the object crisp.
  const rimGlowMaterial = new THREE.SpriteMaterial({
    map: glowMap, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false,
  });
  for (let i = 0; i < 16; i++) {
    const angle = i * Math.PI * 2 / 16;
    const glint = new THREE.Sprite(rimGlowMaterial);
    glint.position.set(Math.sin(angle) * 2.1, 5.1, Math.cos(angle) * 2.1);
    glint.scale.set(0.65, 0.3, 1);
    root.add(glint);
  }
  // Soft shafts are real transparent volumes in the scene, with view-dependent edges.
  const volumeMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      strength: { value: 0 },
      tint: { value: new THREE.Color('#ffd098') },
    },
    vertexShader: `varying vec2 beamUV;varying vec3 viewNormal;varying vec3 viewPosition;
      void main(){beamUV=uv;viewNormal=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.0);viewPosition=-p.xyz;gl_Position=projectionMatrix*p;}`,
    fragmentShader: `uniform float strength;uniform vec3 tint;varying vec2 beamUV;varying vec3 viewNormal;varying vec3 viewPosition;
      void main(){float facing=pow(abs(dot(normalize(viewNormal),normalize(viewPosition))),1.4);
      float ends=smoothstep(0.0,0.26,beamUV.y)*(1.0-smoothstep(0.85,1.0,beamUV.y));
      float taper=mix(0.12,0.75,beamUV.y);gl_FragColor=vec4(tint,strength*ends*taper*facing);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3 + 0.4;
    const volume = mesh(
      new THREE.CylinderGeometry(0.18, 0.88, 3.7, 48, 1, true),
      volumeMaterial,
      root,
      Math.sin(angle) * 0.86,
      3.3,
      Math.cos(angle) * 0.86,
    );
    volume.renderOrder = 2;
  }
  const horses: THREE.Group[] = [];
  const rotatingStage = new THREE.Group();
  rotatingStage.name = 'rotating-carousel-assembly';
  root.add(rotatingStage);
  const motion = createCarouselMotion();
  motion.restore(savedView?.angle ?? 0);
  motion.play(rotating);
  ring(0.96, 5.7, 0.014, gold);
  ring(0.96, 0.765, 0.012, gold);
  for (let i = 0; i < 3; i++) {
    const angle = 0.3 + (i * Math.PI * 2) / 3,
      x = Math.sin(angle) * 0.96,
      z = Math.cos(angle) * 0.96;
    const horse = createHorse(i);
    horse.position.set(x, 1.4, z);
    horse.rotation.y = angle;
    horse.scale.setScalar(1.05);
    rotatingStage.add(horse);
    horses.push(horse);
    addPole(rotatingStage, x, z, 5.7);
  }
  addGarden(root);
  const pivots: THREE.Group[] = [],
    faces: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>[] = [],
    hits: THREE.Object3D[] = [],
    revisions = Array(PHOTO_COUNT).fill(0);
  const captions = Array(PHOTO_COUNT).fill('');
  const faceImages: (HTMLImageElement | undefined)[] = Array(PHOTO_COUNT).fill(undefined);
  const neutral = material('#fff9e8');
  const faceFrames: THREE.Mesh[] = [];
  function labelFrame(c: CanvasRenderingContext2D, index: number, caption = '') {
    c.fillStyle = '#fff9ed';
    c.fillRect(0, 550, 512, 90);
    c.textBaseline = 'middle';
    c.fillStyle = '#b6a084';
    c.font = '18px sans-serif';
    c.textAlign = 'left';
    c.fillText(String(index + 1).padStart(2, '0'), 22, 596);
    const text = caption.trim();
    if (text) {
      c.fillStyle = '#463c33';
      c.textAlign = 'center';
      drawCaption(c, text, 262, 598, 404);
    } else {
      c.fillStyle = '#856d5a';
      c.font = '22px sans-serif';
      c.textAlign = 'center';
      c.fillText('dear memory', 262, 598);
    }
  }
  function frameTexture(index: number, image?: HTMLImageElement, caption = '') {
    // 410x512 canvas (0.8x of 512x640): same card layout, 36% less texture
    // memory across 16 frames. All drawing below is in 512x640 space and
    // scaled by the transform, so coordinates stay untouched.
    const cv = document.createElement('canvas');
    cv.width = 410;
    cv.height = 512;
    const c = cv.getContext('2d')!;
    c.scale(0.8, 0.8);
    c.fillStyle = '#fff9ed';
    c.fillRect(0, 0, 512, 640);
    if (image) {
      const s = Math.max(440 / image.width, 520 / image.height);
      c.save();
      c.beginPath();
      c.rect(36, 30, 440, 520);
      c.clip();
      c.drawImage(
        image,
        36 + (440 - image.width * s) / 2,
        30 + (520 - image.height * s) / 2,
        image.width * s,
        image.height * s,
      );
      c.restore();
    } else {
      c.fillStyle = '#e7dfd2';
      c.fillRect(36, 30, 440, 520);
    }
    labelFrame(c, index, caption);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    textures.add(t);
    return t;
  }
  function line(parent: THREE.Object3D, length: number) {
    mesh(
      new THREE.CylinderGeometry(0.008, 0.008, length, 6),
      gold,
      parent,
      0,
      -length / 2,
    );
  }
  // 4 gem colours share 4 materials (was one MeshPhysicalMaterial with
  // transmission per gem — transmission forces an extra scene render pass).
  // MeshStandardMaterial + emissive reads as a gem at this size.
  const GEM_COLORS = ['#b5cbdf', '#e6b5ae', '#e5d3a3', '#b7caab'];
  const gemMaterials = GEM_COLORS.map(
    (color) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.16,
        metalness: 0.1,
        transparent: true,
        opacity: 0.9,
        emissive: color,
        emissiveIntensity: 0.35,
      }),
  );
  const gemGeometries = new Map<number, THREE.IcosahedronGeometry>();
  function gem(parent: THREE.Object3D, y: number, index: number, size = 0.046) {
    let geo = gemGeometries.get(size);
    if (!geo) {
      geo = new THREE.IcosahedronGeometry(size, 1);
      gemGeometries.set(size, geo);
    }
    mesh(geo, gemMaterials[index % 4], parent, 0, y);
  }
  const charmShape = new THREE.Shape();
  for (let point = 0; point < 10; point++) {
    const angle = (point * Math.PI) / 5 + Math.PI / 2,
      radius = point % 2 ? 0.045 : 0.1;
    const x = Math.cos(angle) * radius,
      y = Math.sin(angle) * radius;
    if (point === 0) charmShape.moveTo(x, y);
    else charmShape.lineTo(x, y);
  }
  charmShape.closePath();
  const charmGeometry = new THREE.ExtrudeGeometry(charmShape, {
    depth: 0.018,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.006,
    bevelThickness: 0.006,
  });
  const charmMaterial = new THREE.MeshPhysicalMaterial({
    color: '#e8d7b4',
    roughness: 0.2,
    metalness: 0.25,
    iridescence: 1,
    clearcoat: 1,
    transparent: true,
    opacity: 0.88,
  });
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI * 2) / 12 + 0.15,
      p = new THREE.Group();
    p.position.set(Math.sin(a) * 2.04, 5.12, Math.cos(a) * 2.04);
    p.rotation.y = a;
    p.userData.phase = i * 1.37;
    p.userData.sway = { x: 0, z: 0, vx: 0, vz: 0 };
    rotatingStage.add(p);
    pivots.push(p);
    const len = 0.8 + (i % 4) * 0.31,
      double = [1, 4, 7, 10].includes(i),
      total = len + 0.87 + (double ? 1.1 : 0);
    line(p, total);
    gem(p, -0.24, i);
    gem(p, -0.52, i + 1, 0.032);
    for (let j = 0; j < (double ? 2 : 1); j++) {
      const index = faces.length,
        group = new THREE.Group();
      group.position.y = -len - 0.42 - j * 1.1;
      group.rotation.z = Math.sin(i * 4.1 + j) * 0.07;
      p.add(group);
      const frame = mesh(
        new THREE.BoxGeometry(0.63, 0.8, 0.027),
        neutral.clone(),
        group,
        0,
        0,
        0,
        'cast',
      );
      frame.userData.photo = index;
      hits.push(frame);
      faceFrames.push(frame);
      const face = mesh(
        new THREE.PlaneGeometry(0.62, 0.79),
        new THREE.MeshStandardMaterial({
          map: frameTexture(index),
          roughness: 0.83,
          side: THREE.DoubleSide,
        }),
        group,
        0,
        0,
        0.017,
      ) as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
      face.userData.photo = index;
      faces.push(face);
      hits.push(face);
      const back = mesh(
        new THREE.PlaneGeometry(0.62, 0.79),
        face.material,
        group,
        0,
        0,
        -0.017,
      );
      back.rotation.y = Math.PI;
      back.userData.photo = index;
      hits.push(back);
      mesh(
        new THREE.BoxGeometry(0.048, 0.14, 0.07),
        trimColors[index % 4],
        group,
        0,
        0.42,
        0.04,
      );
    }
    if (i % 3 === 1) mesh(charmGeometry, charmMaterial, p, 0, -total - 0.12);
    gem(p, -total, i + 2, 0.075);
    gem(p, -total + 0.18, i + 1, 0.035);
    if (i % 3 === 0) {
      const bell = mesh(
        new THREE.ConeGeometry(0.07, 0.1, 16, 1, true),
        gold,
        p,
        0,
        -total - 0.14,
      );
      bell.rotation.z = Math.PI;
    }
  }
  const projections = createMemoryProjections(scene, renderer.getPixelRatio());
  const photoPresent = Array(PHOTO_COUNT).fill(false);
  const targetPos = new THREE.Vector3(),
    targetLook = new THREE.Vector3();
  const overviewPosition = camera.position.clone(), overviewTarget = controls.target.clone();
  let persistedView = '', lastViewWrite = 0, viewSaveFailed = false;
  function persistView() {
    // Photo close-ups are temporary; reopening returns to the last whole-lamp view.
    // The intro camera is not a view worth saving either.
    if (active < 0 && !transition && !introPlaying) {
      overviewPosition.copy(camera.position);
      overviewTarget.copy(controls.target);
    }
    const view: SavedView = {
      night: nightTarget === 1, spinning: rotating,
      position: overviewPosition.toArray() as SavedView['position'],
      target: overviewTarget.toArray() as SavedView['target'],
      angle: rotatingStage.rotation.y,
    };
    const serialized = JSON.stringify(view);
    if (serialized === persistedView) return;
    try {
      saveView(view);
      persistedView = serialized;
      viewSaveFailed = false;
      onViewSave(true);
    } catch {
      onViewSave(false);
      if (!viewSaveFailed) onError(translate('error.viewSave'));
      viewSaveFailed = true;
    }
  }
  const saveOnHide = () => { if (document.visibilityState === 'hidden') persistView(); };
  controls.addEventListener('end', persistView);
  window.addEventListener('pagehide', persistView);
  document.addEventListener('visibilitychange', saveOnHide);

  function focus(index: number) {
    if (!Number.isInteger(index) || index < 0 || index >= faces.length) return;
    persistView();
    active = index;
    onSelect(index);
    const face = faces[index];
    face.updateWorldMatrix(true, false);
    face.getWorldPosition(targetLook);
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(
      face.matrixWorld,
    );
    targetPos.copy(targetLook).addScaledVector(normal, 2.15);
    targetPos.y += 0.04;
    transition = true;
    controls.enabled = false;
    highlight();
  }
  function reset() {
    overviewPosition.copy(home);
    overviewTarget.copy(homeTarget);
    active = -1;
    onSelect(-1);
    targetLook.copy(homeTarget);
    targetPos.copy(home);
    transition = true;
    controls.enabled = false;
    highlight();
  }
  function highlight() {
    faceFrames.forEach((frame, i) => {
      const m = frame.material as THREE.MeshStandardMaterial;
      m.color.set(i === active ? '#f5c665' : selecting ? '#9bc8e7' : '#fff9e8');
      m.emissive.set(selecting || i === active ? '#568bb7' : '#000');
      m.emissiveIntensity = selecting ? 0.28 : 0.08;
    });
  }
  async function setPhoto(index: number, src: string | null) {
    const version = ++revisions[index];
    const img = src ? await loadPhoto(src) : undefined;
    if (!alive || version !== revisions[index]) return;
    faceImages[index] = img;
    const m = faces[index].material,
      previous = m.map;
    m.map = frameTexture(index, img, captions[index]);
    m.emissiveMap = m.map;
    m.emissive.set('#fff5e4');
    photoPresent[index] = Boolean(img);

    m.needsUpdate = true;
    if (previous) {
      textures.delete(previous);
      previous.dispose();
    }
  }
  async function setCaption(index: number, caption: string) {
    if (!Number.isInteger(index) || index < 0 || index >= faces.length) return;
    const text = (caption || '').slice(0, 40);
    captions[index] = text;
    try { await document.fonts.load(`34px ${HAND_FONT}`); } catch { /* fallback font */ }
    const m = faces[index].material,
      previous = m.map;
    m.map = frameTexture(index, faceImages[index], text);
    m.emissiveMap = m.map;
    m.needsUpdate = true;
    if (previous) {
      textures.delete(previous);
      previous.dispose();
    }
  }
  const ray = new THREE.Raycaster(),
    pointer = new THREE.Vector2();
  let downX = 0, downY = 0;
  let held: { id: number; slot: number; timer: ReturnType<typeof setTimeout> | null } | null = null;
  let dragging = false, dropTarget = -1, swapping = false, consumed = false;
  const ghost = document.createElement('div');
  ghost.className = 'photo-drag-ghost';
  ghost.hidden = true;
  const thumbnail = document.createElement('canvas');
  thumbnail.width = 440; thumbnail.height = 560;
  const dragLabel = document.createElement('span');
  dragLabel.setAttribute('role', 'status');
  ghost.appendChild(thumbnail);
  ghost.appendChild(dragLabel);
  document.body.appendChild(ghost);
  const outline = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-.34, -.425, .03), new THREE.Vector3(.34, -.425, .03),
      new THREE.Vector3(.34, .425, .03), new THREE.Vector3(-.34, .425, .03),
    ]), new THREE.LineBasicMaterial({ color: '#fff1b9' }),
  );
  outline.matrixAutoUpdate = false;
  (outline.material as THREE.LineBasicMaterial).depthTest = false;
  outline.renderOrder = 1000;
  outline.visible = false;
  scene.add(outline);
  function hitAt(e: Pick<PointerEvent, 'clientX' | 'clientY'>) {
    const r = renderer.domElement.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, (-(e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(pointer, camera);
    return ray.intersectObjects(hits, false)[0];
  }
  function clearHeld() {
    if (held?.timer) clearTimeout(held.timer);
    held = null;
    dragging = false;
    dropTarget = -1;
    ghost.hidden = true;
    outline.visible = false;
    controls.enabled = active < 0 && !transition && !swapping;
    renderer.domElement.style.cursor = 'grab';
  }
  function positionGhost(x: number, y: number) {
    ghost.style.left = `${x}px`; ghost.style.top = `${y}px`;
  }
  const down = (e: PointerEvent) => {
    if (held) { consumed = true; clearHeld(); return; } // A second finger remains a camera gesture.
    if (!e.isPrimary || e.button !== 0 || swapping) return;
    consumed = false;
    downX = e.clientX; downY = e.clientY;
    const hit = hitAt(e);
    if (!hit || active >= 0 || transition || introPlaying) return;
    const slot = hit.object.userData.photo as number;
    if (!photoPresent[slot]) return;
    held = { id: e.pointerId, slot, timer: null };
    held.timer = setTimeout(() => {
      if (!held || !alive) return;
      dragging = true;
      consumed = true;
      controls.enabled = false;
      const img = faces[slot].material.map?.image as CanvasImageSource | undefined;
      const ctx = thumbnail.getContext('2d');
      ctx?.clearRect(0, 0, thumbnail.width, thumbnail.height);
      if (img) ctx?.drawImage(img, 0, 0, thumbnail.width, thumbnail.height);
      dragLabel.textContent = translate('drag.hint');
      positionGhost(downX, downY);
      ghost.hidden = false;
      renderer.domElement.style.cursor = 'grabbing';
    }, 450);
  };
  const move = (e: PointerEvent) => {
    if (held && e.pointerId !== held.id) return;
    if (held && !dragging && Math.hypot(e.clientX - downX, e.clientY - downY) > 8) clearHeld();
    if (dragging && held) {
      positionGhost(e.clientX, e.clientY);
      const hit = hitAt(e);
      dropTarget = hit ? hit.object.userData.photo : -1;
      if (dropTarget === held.slot) dropTarget = -1;
      outline.visible = dropTarget >= 0;
      if (dropTarget >= 0) outline.matrix.copy(faceFrames[dropTarget].matrixWorld);
      dragLabel.textContent = dropTarget >= 0 ? translate('drag.releaseTo', { number: String(dropTarget + 1).padStart(2, '0') }) : translate('drag.hint');
      return;
    }
    renderer.domElement.style.cursor = hitAt(e) ? 'pointer' : 'grab';
  };
  const up = (e: PointerEvent) => {
    if (held && held.id !== e.pointerId) return;
    if (dragging && held) {
      const from = held.slot;
      const hit = hitAt(e);
      const to = hit ? hit.object.userData.photo as number : -1;
      swapping = to >= 0 && to !== from;
      clearHeld();
      if (swapping) void onSwap(from, to).catch(err => {
        if (alive) onError(err instanceof Error ? err.message : translate('error.swapFailed'));
      }).finally(() => {
        swapping = false;
        if (alive) controls.enabled = active < 0 && !transition;
      });
      return;
    }
    clearHeld();
    if (consumed || !e.isPrimary || e.button !== 0 || swapping || Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
    const hit = hitAt(e);
    if (hit) focus(hit.object.userData.photo);
  };
  const cancel = () => clearHeld();
  const escapeDrag = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && held) {
      consumed = true;
      e.preventDefault();
      clearHeld();
    }
  };
  renderer.domElement.addEventListener('pointerdown', down);
  renderer.domElement.addEventListener('pointerup', up);
  renderer.domElement.addEventListener('pointermove', move);
  renderer.domElement.addEventListener('pointercancel', cancel);
  renderer.domElement.addEventListener('lostpointercapture', cancel);
  window.addEventListener('blur', cancel);
  window.addEventListener('keydown', escapeDrag);
  const resize = () => {
    const w = el.clientWidth,
      h = el.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(36) / 2) * Math.max(1, .85 / (w / h))));
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(el);
  resize();
  const clock = new THREE.Timer(),
    reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  clock.connect(document);
  function animate() {
    raf = requestAnimationFrame(animate);
    clock.update();
    const dt = Math.min(clock.getDelta(), 0.04),
      t = clock.getElapsed();
    gust = Math.max(0, gust - dt * 0.15);
    night = THREE.MathUtils.lerp(
      night,
      nightTarget,
      reduced ? 1 : 1 - Math.exp(-dt * 3),
    );
    bulbs.forEach((light) => {
      light.intensity = night * 3.6;
    });
    spots.forEach((light) => {
      light.intensity = night * 9;
    });
    concealedLight.emissiveIntensity = night * 2.9;
    shadeMat.emissiveIntensity = night * 1.1;
    hemi.intensity = 0.42 - night * 0.22;
    sun.intensity = 3.1 - night * 3.08;
    sun.color.setRGB(1, .745, .423).lerp(daySunColor, night);
    daylight.intensity = 108 * (1 - night);
    daylightRim.intensity = .92 * (1 - night);
    blue.intensity = 0.55 - night * 0.22;
    haloMat.opacity = night * 0.72;
    rimGlowMaterial.opacity = night * 1.55;
    volumeMaterial.uniforms.strength.value = night * 0.42;
    renderer.toneMappingExposure = 0.94 + night * 0.14;
    scene.environmentIntensity = 0.28 - night * 0.12;
    const movement = motion.update(dt, active >= 0 || selecting || held !== null || swapping, reduced);
    // Each suspended chain has its own damped response to rotation and wind.
    pivots.forEach((p, i) => {
      if (active >= 0 || selecting || held || swapping) return;
      const sway = p.userData.sway;
      const spin = movement.speed / (Math.PI * 2 / 28);
      const amount = reduced ? 0 : 0.012 + gust * 0.11;
      const targetX = reduced ? 0 : -0.045 * spin * spin
        + Math.sin(t * (1.1 + i * 0.017) + i) * (amount * 0.55 + Math.abs(spin) * 0.026);
      const targetZ = reduced ? 0 : -spin * 0.04
        + Math.sin(t * (1.35 + i * 0.023) + i * 1.7) * (amount + Math.abs(spin) * 0.04);
      const stiffness = 7 + (i % 4) * 1.1;
      sway.vx += ((targetX - sway.x) * stiffness - sway.vx * 2.2) * dt;
      sway.vz += ((targetZ - sway.z) * stiffness - sway.vz * 2.2) * dt;
      sway.x += sway.vx * dt;
      sway.z += sway.vz * dt;
      p.rotation.x = sway.x;
      p.rotation.z = sway.z;
    });
    rotatingStage.rotation.y = movement.angle;
    horses.forEach((horse, index) => {
      horse.position.y = movement.heights[index];
    });
    if (transition) {
      const alpha = reduced ? 1 : 1 - Math.exp(-dt * 4);
      camera.position.lerp(targetPos, alpha);
      controls.target.lerp(targetLook, alpha);
      if (camera.position.distanceTo(targetPos) < 0.008) {
        transition = false;
        controls.enabled = active < 0;
      }
    }
    faces.forEach((face, index) => {
      face.material.emissiveIntensity = photoPresent[index] ? night * 0.33 : 0;
    });
    projections.update(night, t, reduced, gust, movement.angle);
    decorations?.update(t, dt, reduced);
    if (!dragging && !swapping) controls.update();
    renderer.render(scene, camera);
    if (t - lastViewWrite >= .3) { persistView(); lastViewWrite = t; }
  }
  // ---- Holiday theme system: tweenable material palette + 3D decoration layer ----
  // NOTE: these declarations must precede the first animate() call (TDZ).
  let currentTheme: ThemeId = 'default';
  let decorations: ThemeDecorations | null = null;
  const tintTargets: { mat: THREE.MeshStandardMaterial; key: keyof typeof THEMES.default.mat }[] = [];
  tintTargets.push(
    { mat: cream, key: 'cream' }, { mat: red, key: 'red' }, { mat: sky, key: 'sky' },
    { mat: green, key: 'green' }, { mat: yellow, key: 'yellow' }, { mat: gold, key: 'gold' },
  );
  function tweenColor(target: THREE.Color, hex: string, instant: boolean) {
    const c = new THREE.Color(hex);
    if (instant || reduced) {
      target.copy(c);
      return;
    }
    gsap.to(target, { r: c.r, g: c.g, b: c.b, duration: 1.15, ease: 'sine.inOut', overwrite: 'auto' });
  }
  function setTheme(id: ThemeId, instant = false) {
    if (id === currentTheme && decorations?.group.name.endsWith(id)) return;
    currentTheme = id;
    const p = THEMES[id];
    tintTargets.forEach(({ mat, key }) => tweenColor(mat.color, p.mat[key], instant));
    tweenColor(roofMaterials[0].color, p.roofA, instant);
    tweenColor(roofMaterials[1].color, p.roofB, instant);
    tweenColor(fasciaMaterial.color, p.fascia, instant);
    tweenColor(shadeMat.color, p.shade, instant);
    tweenColor(shadeMat.emissive, p.shadeEmissive, instant);
    tweenColor(concealedLight.emissive, p.concealedEmissive, instant);
    tweenColor(haloMat.color, p.glow, instant);
    tweenColor(rimGlowMaterial.color, p.glow, instant);
    tweenColor(volumeMaterial.uniforms.tint.value, p.beamTint, instant);
    bulbs.forEach((b) => tweenColor(b.color, p.beamTint, instant));
    spots.forEach((s) => tweenColor(s.color, p.beamTint, instant));
    projections.setPalette(p.hues);
    const previous = decorations;
    if (previous) {
      previous.leave().then(() => {
        // Guard: a newer setTheme may have replaced the layer while this
        // one was leaving — only dispose it if it is no longer live,
        // otherwise a rapid switch strands (or kills) the current layer.
        if (decorations !== previous) previous.dispose();
      });
    }
    decorations = createThemeDecorations(id);
    root.add(decorations.group);
    // Intro mode: full on first load (no saved view), short on every theme
    // switch and on first load with a saved view, instant for reduced motion.
    const isFirst = !introPlayed;
    introPlayed = true;
    const mode = selectIntroMode({
      reduced,
      hasSavedView: Boolean(savedView),
      isFirstTheme: isFirst,
      forceInstant: instant,
    });
    // Camera rig: the timeline drives a proxy (distance along the current
    // view ray + target height); apply() writes it into camera/controls.
    // Skipped on first load with a saved view — the camera stays where the
    // user left it. On a switch the micro-push starts from the current ray,
    // never snaps back to home.
    const cameraEnabled = mode !== 'instant' && !(isFirst && savedView);
    let rig: CameraRig | null = null;
    if (cameraEnabled) {
      const dir = camera.position.clone().sub(controls.target).normalize();
      const baseLen = home.distanceTo(homeTarget);
      const camState = {
        dist: camera.position.distanceTo(controls.target) / baseLen,
        targetY: controls.target.y,
      };
      rig = {
        state: camState,
        apply: () => {
          controls.target.y = camState.targetY;
          camera.position.copy(controls.target).addScaledVector(dir, baseLen * camState.dist);
        },
        crown: heart,
      };
    }
    // Kill a previous intro before starting a new one (rapid theme switch).
    if (introTl) {
      introTl.kill();
      introTl = null;
    }
    introPlaying = mode !== 'instant';
    controls.enabled = !introPlaying && active < 0;
    // The dolly starts beyond the orbit clamp (22.7 > maxDistance 20):
    // widen it for the intro, restore on hand-off.
    if (introPlaying) controls.maxDistance = 30;
    const tl = decorations.enter(mode, rig);
    introTl = tl;
    if (tl) {
      // Debug/seek handle for verification (screenshots per beat).
      (window as unknown as { __introTimeline?: gsap.core.Timeline }).__introTimeline = tl;
      tl.then(() => {
        if (introTl !== tl) return; // superseded by a newer intro
        introTl = null;
        endIntro();
      });
    } else {
      endIntro();
    }
  }
  function endIntro() {
    introPlaying = false;
    controls.enabled = active < 0;
    controls.maxDistance = 20;
  }
  // First visit: pre-pose the camera 1.8x out along the view ray so the
  // intro timeline's dolly starts exactly here (no one-frame pop when Home
  // calls setTheme right after creation). Saved views and reduced motion
  // skip the intro dolly.
  if (!savedView && !reduced) {
    camera.position.copy(homeTarget).addScaledVector(home.clone().sub(homeTarget), 1.8);
  }
  animate();
  const keyboard = (e: KeyboardEvent) => {
    if (e.defaultPrevented) return;
    if (introPlaying) return;
    const target = e.target as HTMLElement;
    if (target.closest('input,button,[role="dialog"]')) return;
    if (e.key === 'Escape') reset();
    if (active >= 0 && e.key === 'ArrowRight')
      focus((active + 1) % PHOTO_COUNT);
    if (active >= 0 && e.key === 'ArrowLeft')
      focus((active + PHOTO_COUNT - 1) % PHOTO_COUNT);
  };
  window.addEventListener('keydown', keyboard);
  const contextLost = (event: Event) => {
    event.preventDefault();
    onError(translate('error.sceneInterrupted'));
  };
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  return {
    ready: Promise.resolve(),
    focus,
    reset,
    rotate(on) {
      rotating = on;
      motion.play(on);
      persistView();
    },
    wind() {
      gust = 1;
    },
    light(on) {
      nightTarget = on ? 1 : 0;
      persistView();
    },
    selectMode(on) {
      selecting = on;
      highlight();
    },
    setPhoto,
    setCaption,
    swapPhotos(from, to) {
      revisions[from]++; revisions[to]++;
      const a = faces[from].material, b = faces[to].material;
      [a.map, b.map] = [b.map, a.map];
      a.emissiveMap = a.map; b.emissiveMap = b.map;
      [captions[from], captions[to]] = [captions[to], captions[from]];
      [faceImages[from], faceImages[to]] = [faceImages[to], faceImages[from]];
      // The printed slot number and caption belong to the frame position.
      for (const [material, slot] of [[a, from], [b, to]] as const) {
        const texture = material.map;
        const canvas = texture?.image as HTMLCanvasElement | undefined;
        if (texture && canvas) {
          labelFrame(canvas.getContext('2d')!, slot, captions[slot]);
          texture.needsUpdate = true;
        }
      }
      a.needsUpdate = b.needsUpdate = true;
      [photoPresent[from], photoPresent[to]] = [photoPresent[to], photoPresent[from]];
    },
    setTheme(theme: ThemeId, instant = false) {
      setTheme(theme, instant);
    },
    dispose() {
      persistView();
      controls.removeEventListener('end', persistView);
      window.removeEventListener('pagehide', persistView);
      document.removeEventListener('visibilitychange', saveOnHide);
      alive = false;
      if (introTl) {
        introTl.kill();
        introTl = null;
      }
      clearHeld();
      ghost.remove();
      scene.remove(outline);
      outline.geometry.dispose();
      (outline.material as THREE.Material).dispose();
      renderer.domElement.removeEventListener('pointercancel', cancel);
      renderer.domElement.removeEventListener('lostpointercapture', cancel);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', escapeDrag);
      decorations?.leave();
      decorations?.dispose();
      clock.dispose();
      cancelAnimationFrame(raf);
      observer.disconnect();
      controls.dispose();
      window.removeEventListener('keydown', keyboard);
      renderer.domElement.removeEventListener('pointerdown', down);
      renderer.domElement.removeEventListener('pointerup', up);
      renderer.domElement.removeEventListener('pointermove', move);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      projections.dispose();
      daylight.shadow.dispose();
      sun.shadow.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            m.dispose(),
          );
        }
      });
      textures.forEach((t) => t.dispose());
      haloMat.dispose();
      rimGlowMaterial.dispose();
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
