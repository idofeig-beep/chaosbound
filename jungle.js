// =====================================================================
// CHAOSBOUND: The Verdant Ruins, Level 1 arena (The Overgrown Path)
// =====================================================================
import { THREE, G, V3, R, rand, clamp, lerp, smooth, fbm, TEX, rep, add, glowMat, glowSprite, blob, leafMat, barkMat, trunkGeo, makeGrass, makeMotes, makeSky, mergeGeometries, mergeVertices, vnoise3 } from './core.js';
import { World } from './physics.js';

export function buildJungle() {
  const scene = new THREE.Scene();
  const prevScene = G.scene; G.scene = scene;
  const ARENA = 44;
  const flatSpots = [[0, 0, 13], [0, -34, 6], [-18, 22, 9], [0, 41, 6]];
  function groundH(x, z) {
    const r = Math.hypot(x, z);
    let h = (fbm(x * 0.05 + 11, z * 0.05 + 3) - 0.45) * 2.4;
    for (const [fx, fz, fr] of flatSpots) h *= smooth(fr * 0.6, fr, Math.hypot(x - fx, z - fz));
    if (r > ARENA - 2) h += Math.pow((r - ARENA + 2) * 0.22, 1.6) * (0.8 + fbm(x * 0.03, z * 0.03) * 1.4);
    return h;
  }
  const world = new World(groundH);
  world.bounds = { type: 'circle', r: ARENA };
  const anim = [];

  // ---------- sky, fog, light ----------
  const sky = makeSky(scene, { zen: 0x3f86d6, hor: 0xd8e6b4, sunDir: V3(-0.5, 0.55, -0.45), sunCol: new THREE.Color(1, 0.88, 0.62), cloud: 0.55 });
  scene.fog = new THREE.FogExp2(0xa8c49a, 0.0105);
  scene.add(new THREE.HemisphereLight(0xd8f0c0, 0x3a4a20, 0.8));
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.7); sun.position.set(-30, 34, -26); sun.target.position.set(0, 0, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 140 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05; scene.add(sun, sun.target);

  // ---------- terrain ----------
  {
    const geo = new THREE.PlaneGeometry(240, 240, 220, 220); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, cols = [], c = new THREE.Color();
    const cA = new THREE.Color(0x2f6a22), cB = new THREE.Color(0x6a9a34), cM = new THREE.Color(0x3f5a2a), cD = new THREE.Color(0x7a5a3a), cR = new THREE.Color(0x5a6a5a);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), h = groundH(x, z), n = fbm(x * 0.08, z * 0.08);
      p.setY(i, h); c.copy(cA).lerp(cB, n); if (n < 0.35) c.lerp(cM, 0.5);
      if (Math.abs(x - Math.sin(z * 0.1) * 3) < 2 + n && z < -10) c.lerp(cD, 0.6);
      if (Math.hypot(x, z) < 11) c.lerp(cD, 0.35);
      if (h > 4) c.lerp(cR, clamp((h - 4) / 10, 0, 0.7));
      cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); geo.computeVertexNormals();
    const m = add(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map: rep(TEX.grass, 60, 60), roughness: 1 }), 0, 0, 0, scene, false);
  }
  const mossMat = new THREE.MeshStandardMaterial({ map: rep(TEX.moss, 2, 1), bumpMap: rep(TEX.moss, 2, 1), bumpScale: 3, roughness: 1 });
  const mossBox = (cx, y0, cz, sx, sy, sz, collide = true) => {
    const mat = mossMat.clone(); mat.map = rep(TEX.moss, Math.max(1, Math.round(Math.max(sx, sz) / 4)), Math.max(1, Math.round(sy / 4))); mat.bumpMap = mat.map;
    const m = add(new THREE.BoxGeometry(sx, sy, sz), mat, cx, y0 + sy / 2, cz, scene);
    if (collide) world.box(cx, y0, cz, sx, sy, sz);
    // moss cushions on top
    for (let k = 0; k < Math.max(1, (sx * sz) / 12 | 0) && k < 6; k++) { const b = add(blob(rand(0.3, 0.7), 1, k + cx, 0x2f5a1f, 0x6a9a3a), leafMat, cx + rand(-sx / 2.4, sx / 2.4), y0 + sy, cz + rand(-sz / 2.4, sz / 2.4), scene, false); b.scale.y = 0.4; }
    return m;
  };
  const stairsZ = (x, zEdge, dir, top, width) => { for (let k = 1; ; k++) { const h = top - 0.5 * k; if (h <= 0.05) break; mossBox(x, 0, zEdge + dir * (k * 0.6 - 0.3), width, h, 0.6); } };
  const stairsX = (xEdge, z, dir, top, width) => { for (let k = 1; ; k++) { const h = top - 0.5 * k; if (h <= 0.05) break; mossBox(xEdge + dir * (k * 0.6 - 0.3), 0, z, 0.6, h, width); } };

  // ---------- central ziggurat (every tier is a walkable step) ----------
  for (let i = 0; i < 6; i++) { const s = 18 - i * 2; mossBox(0, i * 0.5, 0, s, 0.5, s); }
  // broken pillars on top and around
  const pillar = (x, z, h, r = 0.55, base = 0) => {
    add(new THREE.CylinderGeometry(r, r * 1.1, h, 12), mossMat, x, base + h / 2, z, scene);
    add(new THREE.BoxGeometry(r * 2.4, 0.35, r * 2.4), mossMat, x, base + 0.17, z, scene);
    world.cyl(x, z, r, base - 1, base + h);
  };
  pillar(-3, -3, 2.2, 0.5, 3); pillar(3, 3, 1.4, 0.5, 3); pillar(3, -3, 3.4, 0.5, 3);
  for (const [x, z, h] of [[-12, -10, 5], [12, -12, 3], [-14, 8, 2], [16, 10, 6], [-6, -18, 4], [8, 18, 2.5]]) pillar(x, z, h, 0.7);
  // guardian statue on the summit
  {
    const g = new THREE.Group(); g.position.set(-1, 3, 1); scene.add(g);
    const stoneC = new THREE.MeshStandardMaterial({ color: 0x8a8a80, map: rep(TEX.moss, 1, 1), roughness: 1 });
    add(new THREE.BoxGeometry(1.4, 0.6, 1.4), stoneC, 0, 0.3, 0, g);
    add(new THREE.CapsuleGeometry(0.45, 0.9, 6, 12), stoneC, 0, 1.4, 0, g);
    add(new THREE.SphereGeometry(0.42, 16, 12), stoneC, 0, 2.4, 0, g);
    for (const s of [-1, 1]) { const ear = add(new THREE.ConeGeometry(0.14, 0.7, 8), stoneC, s * 0.45, 2.5, 0, g); ear.rotation.z = -s * 1.6; }
    add(new THREE.SphereGeometry(0.07, 8, 6), glowMat(0x7aff8a, 2.5), -0.15, 2.45, 0.38, g, false); add(new THREE.SphereGeometry(0.07, 8, 6), glowMat(0x7aff8a, 2.5), 0.15, 2.45, 0.38, g, false);
    for (let k = 0; k < 5; k++) { const b = add(blob(rand(0.2, 0.35), 1, k, 0x2f5a1f, 0x6a9a3a), leafMat, rand(-0.4, 0.4), rand(1, 2.6), rand(-0.4, 0.4), g, false); b.scale.y = 0.5; }
    world.cyl(-1, 1, 0.8, 2.5, 6);
  }

  // ---------- ruined walls (great for wall-running) ----------
  mossBox(-24, groundH(-24, 0) - 0.5, 0, 1.2, 5, 14);
  mossBox(22, groundH(22, -14) - 0.5, -14, 14, 4.5, 1.2);
  mossBox(10, groundH(10, 25) - 0.5, 25, 12, 5.5, 1.2);
  mossBox(-14, groundH(-14, -26) - 0.5, -26, 1.2, 4.5, 10);
  mossBox(29, groundH(29, 12) - 0.5, 12, 1.2, 5, 10);
  mossBox(-30, groundH(-30, -12) - 0.5, -12, 8, 3.5, 1.2);

  // ---------- raised platforms with a broken bridge ----------
  mossBox(-27, 0, 22, 8, 3, 8); stairsZ(-27, 18, -1, 3, 3.2); stairsX(-23, 25, 1, 3, 2.2);
  mossBox(-9, 0, 22, 7, 3, 7); stairsZ(-9, 18.5, -1, 3, 3);
  mossBox(-20.2, 2.4, 22, 5.5, 0.6, 2.6); mossBox(-13.6, 2.4, 22, 2.2, 0.6, 2.6);   // bridge with a ~2 m gap
  for (const x of [-22.8, -17.6, -14.6]) { add(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 6), new THREE.MeshStandardMaterial({ color: 0x5a3a20 }), x, 3.6, 23.2, scene); }

  // ---------- giant jungle trees ----------
  const vineMat = new THREE.MeshStandardMaterial({ color: 0x3a7a2a, roughness: 0.9 });
  const leafPlane = new THREE.MeshStandardMaterial({ color: 0x4a9a3a, roughness: 0.8, side: THREE.DoubleSide });
  const giants = [[-30, -22, 2.0], [33, -20, 2.3], [20, 32, 1.9], [-34, 6, 1.7], [36, 2, 1.8], [-6, 36, 1.6], [26, -32, 1.6]];
  for (const [x, z, r] of giants) {
    const gy = groundH(x, z) - 0.3, g = new THREE.Group(); g.position.set(x, gy, z); scene.add(g);
    add(trunkGeo(r * 1.15, r * 0.65, 26, 1.2, x, 1.7), barkMat, 0, 0, 0, g);
    for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28 + rand(-0.2, 0.2); const root = add(trunkGeo(r * 0.45, 0.1, 5, 0.6, k + x, 1), barkMat, Math.cos(a) * r * 0.9, -0.4, Math.sin(a) * r * 0.9, g); root.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); }
    const parts = [];
    for (let k = 0; k < 9; k++) { const b = blob(rand(3, 4.6), 2, k + z, 0x1f4a1a, 0x5a9a32); const a = k / 9 * 6.28, rr = k === 0 ? 0 : rand(3, 6); b.translate(Math.cos(a) * rr, 24 + rand(-1.5, 2), Math.sin(a) * rr); parts.push(b); }
    add(mergeGeometries(parts), leafMat, 0, 0, 0, g);
    for (let k = 0; k < 7; k++) {
      const a = rand(0, 6.28), rr = rand(2, 6), L = rand(8, 16), vx = Math.cos(a) * rr, vz = Math.sin(a) * rr;
      add(new THREE.CylinderGeometry(0.05, 0.07, L, 5), vineMat, vx, 23 - L / 2, vz, g, false);
      for (let j = 0; j < 4; j++) { const l = add(new THREE.PlaneGeometry(0.35, 0.5), leafPlane, vx + 0.15, 23 - L * (j + 1) / 5, vz, g, false); l.rotation.set(0.3, j * 1.7, 0.4); }
    }
    world.cyl(x, z, r * 1.05, -2, 30);
  }
  // perimeter jungle (dense trees outside the arena edge)
  const palm = (x, z, s) => {
    const gy = groundH(x, z) - 0.2, g = new THREE.Group(); g.position.set(x, gy, z); g.scale.setScalar(s); g.rotation.y = rand(0, 6); scene.add(g);
    add(trunkGeo(0.35, 0.2, 7, 1.2, x + z), barkMat, 0, 0, 0, g);
    const parts = []; for (let k = 0; k < 5; k++) { const b = blob(rand(1.4, 2.2), 2, k + x, 0x1f4a1a, 0x6aaa3a); const a = k / 5 * 6.28; b.translate(Math.cos(a) * 1.4 + 1.2, 7 + rand(-0.5, 0.8), Math.sin(a) * 1.4); parts.push(b); }
    add(mergeGeometries(parts), leafMat, 0, 0, 0, g);
  };
  for (let i = 0; i < 70; i++) { const a = i / 70 * 6.283 + rand(-0.04, 0.04), r = rand(ARENA + 1, ARENA + 14); if (Math.abs(a - Math.PI / 2) < 0.1) continue; palm(Math.cos(a) * r, Math.sin(a) * r, rand(1.1, 2)); }
  for (let i = 0; i < 18; i++) { const a = rand(0, 6.283), r = rand(14, ARENA - 4); const x = Math.cos(a) * r, z = Math.sin(a) * r; if (world.solid(V3(x, groundH(x, z) + 1, z))) continue; if (Math.hypot(x, z + 34) < 8) continue; palm(x, z, rand(0.7, 1.1)); world.cyl(x, z, 0.35, -2, 8); }

  // ---------- waterfall + pool (north) ----------
  const waterMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float time; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){ float s = n(vec2(vUv.x * 18.0, vUv.y * 4.0 + time * 3.0)) * 0.6 + n(vec2(vUv.x * 40.0, vUv.y * 9.0 + time * 5.0)) * 0.4;
        vec3 col = mix(vec3(0.35, 0.6, 0.75), vec3(0.95, 1.0, 1.0), smoothstep(0.45, 0.85, s));
        float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
        gl_FragColor = vec4(col * 1.1, 0.85 * edge); }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide
  });
  {
    const cliff = add(new THREE.BoxGeometry(34, 26, 8), new THREE.MeshStandardMaterial({ map: rep(TEX.moss, 6, 5), bumpMap: rep(TEX.moss, 6, 5), bumpScale: 4, roughness: 1 }), 0, 11, 51, scene);
    for (let k = 0; k < 14; k++) { const b = add(blob(rand(1.5, 3), 2, k, 0x1f4a1a, 0x5a9a32), leafMat, rand(-16, 16), rand(18, 25), rand(46, 48), scene, false); }
    const fall = add(new THREE.PlaneGeometry(7, 22), waterMat, 0, 11.5, 46.9, scene, false); fall.rotation.y = Math.PI;
    const pool = add(new THREE.CircleGeometry(6.5, 48), new THREE.MeshStandardMaterial({ color: 0x2a7a9a, roughness: 0.05, metalness: 0.2, emissive: 0x0a3040, emissiveIntensity: 0.5, transparent: true, opacity: 0.88 }), 0, groundH(0, 41) + 0.06, 41, scene, false);
    pool.rotation.x = -Math.PI / 2;
    for (let k = 0; k < 10; k++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.smoke, color: 0xffffff, transparent: true, depthWrite: false, opacity: 0 }));
      scene.add(sp); const ph = k / 10;
      anim.push(t => { const q = (t * 0.25 + ph) % 1; sp.position.set(Math.sin(k * 3 + t * 0.3) * 3, 0.5 + q * 3, 44 - q * 2); const s = 2 + q * 4; sp.scale.set(s, s, 1); sp.material.opacity = Math.sin(q * Math.PI) * 0.35; });
    }
  }

  // ---------- glowing plants, mushrooms, ferns, flowers ----------
  for (let i = 0; i < 40; i++) {
    const a = rand(0, 6.283), r = rand(8, ARENA - 2), x = Math.cos(a) * r, z = Math.sin(a) * r, y = groundH(x, z);
    if (world.solid(V3(x, y + 0.5, z))) continue;
    const col = [0x6affd8, 0xd86aff, 0xffd86a, 0x6aff8a][i % 4];
    if (i % 2) {
      const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(rand(0.7, 2)); scene.add(g);
      add(new THREE.CylinderGeometry(0.06, 0.1, 0.6, 8), new THREE.MeshStandardMaterial({ color: 0xe8e0d0 }), 0, 0.3, 0, g, false);
      const cap = add(new THREE.SphereGeometry(0.32, 16, 8, 0, 6.28, 0, Math.PI / 2), glowMat(col, 1.2), 0, 0.58, 0, g, false); cap.scale.y = 0.7;
    } else {
      for (let k = 0; k < 4; k++) { const st = add(new THREE.CylinderGeometry(0.02, 0.03, 0.9, 5), new THREE.MeshStandardMaterial({ color: 0x3a7a2a }), x + rand(-0.3, 0.3), y + 0.45, z + rand(-0.3, 0.3), scene, false); st.rotation.z = rand(-0.3, 0.3); add(new THREE.SphereGeometry(0.09, 10, 8), glowMat(col, 2.4), st.position.x, y + 0.92, st.position.z, scene, false); }
    }
  }
  // ferns (instanced crossed leaf planes)
  {
    const fernGeo = (() => { const parts = []; for (let k = 0; k < 6; k++) { const g = new THREE.PlaneGeometry(0.35, 1.2, 1, 3); g.translate(0, 0.6, 0); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, y * y * 0.35); p.setX(i, p.getX(i) * (1 - y / 1.4)); } g.rotateX(-0.5); g.rotateY(k / 6 * 6.283); parts.push(g); } const m = mergeGeometries(parts); m.computeVertexNormals(); return m; })();
    const N = 600, im = new THREE.InstancedMesh(fernGeo, new THREE.MeshStandardMaterial({ color: 0x4a8a2a, roughness: 0.85, side: THREE.DoubleSide }), N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(); let k = 0;
    for (let i = 0; i < N * 3 && k < N; i++) {
      const a = rand(0, 6.283), r = Math.pow(R(), 0.6) * (ARENA + 6), x = Math.cos(a) * r, z = Math.sin(a) * r, y = groundH(x, z);
      if (world.solid(V3(x, y + 0.3, z)) || Math.hypot(x, z) < 9.5) continue;
      q.setFromAxisAngle(V3(0, 1, 0), rand(0, 6)); const s = rand(0.6, 1.5) * (r > ARENA - 6 ? 1.6 : 1);
      m4.compose(V3(x, y, z), q, V3(s, s, s)); im.setMatrixAt(k, m4); col.setHSL(rand(0.24, 0.32), 0.55, rand(0.25, 0.4)); im.setColorAt(k, col); k++;
    }
    im.count = k; im.castShadow = true; im.receiveShadow = true; scene.add(im);
  }
  makeGrass(scene, {
    count: 45000, h: [0.22, 0.55], hue: [0.22, 0.32],
    sample: () => { const a = rand(0, 6.283), r = 4 + Math.pow(R(), 0.8) * (ARENA + 4), x = Math.cos(a) * r, z = Math.sin(a) * r, y = groundH(x, z); if (world.solid(V3(x, y + 0.2, z))) return null; return [x, y, z]; }
  });
  const spores = makeMotes(scene, 300, () => { const a = rand(0, 6.283), r = rand(0, ARENA); return [Math.cos(a) * r, rand(0.5, 9), Math.sin(a) * r]; }, new THREE.Color(1.6, 1.8, 0.6), 0.14);
  anim.push(t => spores.update(t * 0.35, 2));
  // light shafts through the canopy
  for (const [x, z] of [[-26, -18], [30, -16], [18, 28], [-30, 8]]) {
    const ray = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 5, 26, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.045, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    ray.position.set(x + 4, 11, z + 3); ray.rotation.z = 0.25; scene.add(ray);
  }

  // ---------- arrival portal (south) ----------
  const portalMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float time; varying vec2 vUv; void main(){ vec2 p = vUv - 0.5; float r = length(p) * 2.0; float a = atan(p.y, p.x);
      float s = sin(a * 5.0 + time * 3.0 - r * 12.0) * 0.5 + 0.5; vec3 col = mix(vec3(0.15, 0.9, 0.45), vec3(0.6, 0.2, 1.1), s) * (1.0 - r * 0.8) * (0.4 + s) * 0.8;
      gl_FragColor = vec4(max(col, 0.0) * step(r, 1.0), 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  {
    const g = new THREE.Group(); g.position.set(0, groundH(0, -38), -38); scene.add(g);
    add(new THREE.TorusGeometry(1.8, 0.3, 10, 32), mossMat, 0, 2.2, 0, g);
    add(new THREE.CircleGeometry(1.55, 40), portalMat, 0, 2.2, 0, g, false);
    world.cyl(0, -38, 1.2, -2, 5);
  }

  // enemy spawn points around the edge of the clearing
  const spawnPoints = [];
  for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283; const x = Math.cos(a) * 36, z = Math.sin(a) * 36; if (Math.hypot(x, z + 34) < 14) continue; if (!world.solid(V3(x, groundH(x, z) + 1, z))) spawnPoints.push(V3(x, 0, z)); }

  G.scene = prevScene;
  return {
    name: 'jungle', scene, world, spawn: V3(0, groundH(0, -34), -34), spawnYaw: Math.PI, spawnPoints, interactables: [], pois: [V3(0, 11, 47), V3(-1, 5.5, 1)],
    post: { bloom: 0.5, exposure: 1.05, tint: new THREE.Color(1.02, 1.0, 0.95) },
    update(dt, t) { sky.update(t); waterMat.uniforms.time.value = t; portalMat.uniforms.time.value = t; for (const f of anim) f(t); },
  };
}
