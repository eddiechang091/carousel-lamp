import * as THREE from 'three';

const scatter = (n: number) => {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

/** Layered optical light only: sharp glints, colored halos, dust and airy bokeh. */
export function createMemoryProjections(scene: THREE.Scene, pixelRatio: number) {
  const group = new THREE.Group();
  group.name = 'night-prismatic-stars';
  scene.add(group);
  const hues = ['#ffbc69', '#73acff', '#f57ed3', '#b19aff', '#65e3dd'];
  const layers: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>[] = [];

  function layer(count: number, kind: number, sizeMin: number, sizeMax: number) {
    const positions: number[] = [], colors: number[] = [], phases: number[] = [], sizes: number[] = [];
    for (let i = 0; i < count; i++) {
      const seed = i + kind * 1000;
      const angle = scatter(seed + 300) * Math.PI * 2;
      const radius = 1.8 + scatter(seed + 600) * 2.15 + Math.sin(angle * 3) * 0.22;
      const height = kind === 3 ? 0.55 + scatter(seed + 41) * 6.2
        : kind === 2 ? 0.04 + scatter(seed + 42) * 0.2 : 0.025;
      // Airborne glints stay mainly outside the object's silhouette.
      const r = kind === 3 ? 2.35 + scatter(seed + 55) * 0.8 : radius;
      positions.push(Math.sin(angle) * r, height, Math.cos(angle) * r);
      const color = new THREE.Color(hues[i % hues.length]);
      colors.push(color.r, color.g, color.b);
      phases.push(scatter(seed + 22) * Math.PI * 2);
      sizes.push(sizeMin + scatter(seed + 90) ** 2 * (sizeMax - sizeMin));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('phase', new THREE.Float32BufferAttribute(phases, 1));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: {
        strength: { value: 0 }, time: { value: 0 },
        pixelRatio: { value: pixelRatio }, kind: { value: kind },
      },
      transparent: true, toneMapped: false, depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute vec3 color; attribute float phase; attribute float size;
        uniform float time; uniform float pixelRatio; uniform float kind;
        varying vec3 tint; varying float pulse;
        void main(){
          tint=color;
          pulse=(.35+.65*pow(.5+.5*sin(time*(.35+.12*sin(phase))+phase),2.0))*(.55+.45*fract(phase));
          vec3 local=position;
          if(kind>2.5){local.x+=sin(time*.18+phase)*.07;local.y+=sin(time*.24+phase)*.08;}
          vec4 p=modelViewMatrix*vec4(local,1.0);
          gl_Position=projectionMatrix*p;
          gl_PointSize=clamp(size*pixelRatio*12.0/max(1.0,-p.z),1.0,96.0*pixelRatio);
        }`,
      fragmentShader: `
        uniform float strength; uniform float kind;
        varying vec3 tint; varying float pulse;
        void main(){
          vec2 p=(gl_PointCoord-.5)*2.0;
          float r2=dot(p,p);
          float edge=1.0-smoothstep(.72,1.0,length(p));
          float core=exp(-r2*110.0);
          float halo=exp(-r2*5.5)*.22;
          float rays=exp(-abs(p.x)*65.0-abs(p.y)*5.0)+exp(-abs(p.y)*65.0-abs(p.x)*5.0);
          float shape;
          if(kind<.5){shape=exp(-r2*8.0);}
          else if(kind>1.5 && kind<2.5){shape=exp(-r2*3.8)*.2;core=0.0;}
          else{shape=core+halo+rays*.45;}
          vec3 light=tint*1.55+vec3(1.0,.88,.74)*core*.75;
          gl_FragColor=vec4(light,clamp(shape*edge*strength*pulse,0.0,1.0));
          #include <colorspace_fragment>
        }`,
    });
    const points = new THREE.Points(geometry, material);
    points.name = ['ground-fine-sparkles', 'ground-luminous-glints', 'soft-colored-bokeh', 'airborne-glints'][kind];
    group.add(points);
    layers.push(points);
  }
  layer(560, 0, 1.5, 4.5);
  layer(48, 1, 14, 30);
  layer(42, 2, 20, 48);
  layer(26, 3, 10, 23);

  // ---- Floating volumetric atmosphere that orbits the carousel ----
  // Star sparkles, soft bokeh discs and fine dust motes drift around the lamp
  // and are defocused by a per-particle depth-of-field term (focus distance).
  const FOCUS = 9;
  const floatGroup = new THREE.Group();
  floatGroup.name = 'floating-atmosphere';
  scene.add(floatGroup);
  const floatLayers: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>[] = [];

  function floatingLayer(opts: {
    count: number; kind: number; sizeMin: number; sizeMax: number;
    rMin: number; rMax: number; hMin: number; hMax: number;
    speed: number; bob: number;
  }) {
    const { count, kind, sizeMin, sizeMax, rMin, rMax, hMin, hMax, speed, bob } = opts;
    const positions: number[] = [], colors: number[] = [], phases: number[] = [];
    const sizes: number[] = [], orbits: number[] = [];
    for (let i = 0; i < count; i++) {
      const seed = i + kind * 733;
      const angle = scatter(seed + 11) * Math.PI * 2;
      const radius = rMin + scatter(seed + 22) * (rMax - rMin);
      const height = hMin + scatter(seed + 33) * (hMax - hMin);
      positions.push(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
      const color = new THREE.Color(hues[i % hues.length]);
      colors.push(color.r, color.g, color.b);
      phases.push(scatter(seed + 44) * Math.PI * 2);
      sizes.push(sizeMin + scatter(seed + 55) ** 2 * (sizeMax - sizeMin));
      orbits.push((scatter(seed + 66) - 0.5) * 2 * speed);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('phase', new THREE.Float32BufferAttribute(phases, 1));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    geometry.setAttribute('orbit', new THREE.Float32BufferAttribute(orbits, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: {
        strength: { value: 0 }, time: { value: 0 },
        pixelRatio: { value: pixelRatio }, kind: { value: kind },
        focus: { value: FOCUS }, bob: { value: bob },
      },
      transparent: true, toneMapped: false, depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute vec3 color; attribute float phase; attribute float size; attribute float orbit;
        uniform float time; uniform float pixelRatio; uniform float kind; uniform float focus; uniform float bob;
        varying vec3 tint; varying float pulse; varying float blur;
        void main(){
          tint=color;
          float ang=atan(position.z,position.x)+time*orbit;
          float rad=length(position.xz);
          vec3 local=vec3(sin(ang)*rad,position.y+sin(time*0.5+phase)*bob,cos(ang)*rad);
          pulse=0.35+0.65*pow(0.5+0.5*sin(time*(0.5+0.25*sin(phase))+phase),2.0);
          vec4 p=modelViewMatrix*vec4(local,1.0);
          float depth=max(1.0,-p.z);
          blur=clamp(abs(depth-focus)/focus,0.0,1.0);
          gl_Position=projectionMatrix*p;
          float base=size*pixelRatio*12.0/depth;
          gl_PointSize=clamp(base*(1.0+blur*3.0),1.0,180.0*pixelRatio);
        }`,
      fragmentShader: `
        uniform float strength; uniform float kind;
        varying vec3 tint; varying float pulse; varying float blur;
        void main(){
          vec2 p=(gl_PointCoord-0.5)*2.0;
          float r2=dot(p,p);
          float rad=length(p);
          float edge=1.0-smoothstep(0.7,1.0,rad);
          float shape; vec3 light;
          if(kind>4.5 && kind<5.5){
            float soft=exp(-r2*(5.0-blur*3.0));
            float rim=smoothstep(0.72,0.92,rad)*(1.0-smoothstep(0.92,1.0,rad));
            shape=soft*0.5+rim*0.35;
            light=tint*1.4;
          } else if(kind>5.5){
            shape=exp(-r2*(12.0-blur*7.0));
            light=tint*1.3+vec3(1.0,0.95,0.85)*shape*0.4;
          } else {
            float fk=1.0-blur*0.65;
            float core=exp(-r2*mix(110.0,14.0,blur));
            float halo=exp(-r2*5.0)*0.2;
            float rays=exp(-abs(p.x)*60.0*fk-abs(p.y)*4.5)+exp(-abs(p.y)*60.0*fk-abs(p.x)*4.5);
            shape=core+halo+rays*0.5;
            light=tint*1.55+vec3(1.0,0.9,0.76)*core*0.8;
          }
          float alpha=shape*edge*strength*pulse*(1.0-blur*0.3);
          gl_FragColor=vec4(light,clamp(alpha,0.0,1.0));
          #include <colorspace_fragment>
        }`,
    });
    const points = new THREE.Points(geometry, material);
    points.name = ['floating-star-sparkles', 'floating-bokeh-discs', 'floating-dust-motes'][kind - 4];
    points.renderOrder = 5;
    floatGroup.add(points);
    floatLayers.push(points);
  }
  floatingLayer({ count: 46, kind: 4, sizeMin: 9, sizeMax: 20, rMin: 2.5, rMax: 3.9, hMin: 0.6, hMax: 5.6, speed: 0.12, bob: 0.18 });
  floatingLayer({ count: 30, kind: 5, sizeMin: 26, sizeMax: 60, rMin: 2.3, rMax: 4.1, hMin: 0.5, hMax: 5.2, speed: 0.08, bob: 0.22 });
  floatingLayer({ count: 200, kind: 6, sizeMin: 1.5, sizeMax: 5, rMin: 1.9, rMax: 4.3, hMin: 0.3, hMax: 6.0, speed: 0.05, bob: 0.3 });

  return {
    update(night: number, time: number, reduced: boolean, wind = 0, rotation = 0) {
      group.visible = night > 0.01;
      const level = THREE.MathUtils.smoothstep(night, 0.15, 0.9);
      group.rotation.y = reduced ? 0 : Math.sin(time * 0.4) * wind * 0.015 + Math.sin(rotation) * 0.018;
      layers.forEach((points, i) => {
        points.material.uniforms.strength.value = level * [0.9, 1.4, 0.8, 0.95][i];
        points.material.uniforms.time.value = reduced ? 0 : time;
      });
      // Floating atmosphere is present in both day and night; brighter at night.
      const motion = reduced ? 0.55 : 1;
      floatGroup.rotation.y = reduced ? 0 : time * 0.01 + Math.sin(rotation) * 0.03;
      floatLayers.forEach((points, i) => {
        const base = [0.15 + night * 0.9, 0.28 + night * 0.6, 0.4 + night * 0.5][i];
        points.material.uniforms.strength.value = base * motion;
        points.material.uniforms.time.value = reduced ? 0 : time;
      });
    },
    dispose() {
      scene.remove(group);
      layers.forEach((points) => { points.geometry.dispose(); points.material.dispose(); });
      scene.remove(floatGroup);
      floatLayers.forEach((points) => { points.geometry.dispose(); points.material.dispose(); });
    },
    /** Recolour every particle layer to the given 5-hue holiday palette. */
    setPalette(paletteHues: string[]) {
      const targets = [...layers, ...floatLayers];
      targets.forEach((points) => {
        const attr = points.geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
        if (!attr) return;
        const arr = attr.array as Float32Array;
        const count = arr.length / 3;
        for (let i = 0; i < count; i++) {
          const c = new THREE.Color(paletteHues[i % paletteHues.length]);
          arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
        }
        attr.needsUpdate = true;
      });
    },
  };
}
