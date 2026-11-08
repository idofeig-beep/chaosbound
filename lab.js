// =====================================================================
// CHAOSBOUND: the Laboratory (safe home hub)
// =====================================================================
import { THREE, G, V3, R, rand, TEX, rep, add, glowMat, glowSprite, blob, leafMat, barkMat, trunkGeo, makeMotes } from './core.js';
import { World } from './physics.js';
import { spawnEnemy } from './enemies.js';

export function buildLab(actions) {
  const scene = new THREE.Scene();
  const prevScene = G.scene; G.scene = scene;
  scene.background = new THREE.Color(0x07060c);
  scene.fog = new THREE.FogExp2(0x100c18, 0.012);
  const world = new World(() => 0);
  const X0 = -24, X1 = 24, Z0 = -16, Z1 = 16, H = 10;
  world.bounds = { type: 'rect', x0: X0 + 0.5, x1: X1 - 0.5, z0: Z0 + 0.5, z1: Z1 - 0.5 };
  const anim = [];   // per-frame animation callbacks
  const pois = [];   // points of interest for Pip to look at

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0xc8c0ff, 0x2a2018, 0.6));
  const sun = new THREE.DirectionalLight(0xffe8c8, 1.6); sun.position.set(-6, 22, 30); sun.target.position.set(0, 0, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 20, bottom: -20, near: 1, far: 80 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04; scene.add(sun, sun.target);
  const pl = (c, i, d, x, y, z) => { const l = new THREE.PointLight(c, i, d, 1.6); l.position.set(x, y, z); scene.add(l); return l; };
  const forgeLight = pl(0xb05aff, 30, 14, -6, 3, 0);
  pl(0x5ad8ff, 18, 12, -6, 4.5, 12);
  const portalLight = pl(0x6aff9a, 22, 14, -21.5, 3, 0);
  pl(0xffb070, 30, 22, 14, 8, 0);

  // ---------- room ----------
  const floor = add(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), new THREE.MeshStandardMaterial({ map: rep(TEX.tiles, 12, 8), bumpMap: rep(TEX.tiles, 12, 8), bumpScale: 1.2, roughness: 0.8 }), 0, 0, 0, scene, false);
  floor.rotation.x = -Math.PI / 2;
  const arenaFloor = add(new THREE.PlaneGeometry(15.5, 25.5), new THREE.MeshStandardMaterial({ map: rep(TEX.plank, 4, 6), roughness: 0.85, color: 0xc8b090 }), 14.25, 0.01, 0, scene, false);
  arenaFloor.rotation.x = -Math.PI / 2;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xcfc0e2, map: rep(TEX.plaster, 6, 2), bumpMap: rep(TEX.plaster, 6, 2), bumpScale: 1.5, roughness: 0.95 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3c26, map: rep(TEX.plank, 0.3, 1), roughness: 0.8 });
  const stone = new THREE.MeshStandardMaterial({ map: rep(TEX.stone, 2, 1), bumpMap: rep(TEX.stone, 2, 1), bumpScale: 3, roughness: 1 });
  // walls (visual + collision)
  const wall = (cx, cz, sx, sz) => { add(new THREE.BoxGeometry(sx, H, sz), wallMat, cx, H / 2, cz, scene); world.box(cx, 0, cz, sx, H, sz); };
  wall(0, Z1 + 0.5, X1 - X0 + 2, 1); wall(0, Z0 - 0.5, X1 - X0 + 2, 1); wall(X0 - 0.5, 0, 1, Z1 - Z0); wall(X1 + 0.5, 0, 1, Z1 - Z0);
  // ceiling + beams
  const ceil = add(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), new THREE.MeshStandardMaterial({ map: rep(TEX.plank, 8, 6), color: 0x7a5a40, side: THREE.DoubleSide }), 0, H, 0, scene, false); ceil.rotation.x = Math.PI / 2;
  for (let x = X0 + 4; x < X1; x += 6) add(new THREE.BoxGeometry(0.5, 0.6, Z1 - Z0), wood, x, H - 0.3, 0, scene);
  // timber pillars along walls
  for (let x = X0 + 2; x <= X1 - 2; x += 6) for (const z of [Z0 + 0.25, Z1 - 0.25]) add(new THREE.BoxGeometry(0.5, H, 0.5), wood, x, H / 2, z, scene);
  for (let z = Z0 + 4; z <= Z1 - 4; z += 6) for (const x of [X0 + 0.25, X1 - 0.25]) add(new THREE.BoxGeometry(0.5, H, 0.5), wood, x, H / 2, z, scene);
  // big arched windows on the north wall (bright sky)
  const paneMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.6, 1.9) });
  for (const x of [-15, -3, 9, 19]) {
    add(new THREE.PlaneGeometry(3.2, 4.6), paneMat, x, 5.2, Z1 - 0.01, scene, false).rotation.y = Math.PI;
    add(new THREE.CircleGeometry(1.6, 24, 0, Math.PI), paneMat, x, 7.5, Z1 - 0.01, scene, false).rotation.y = Math.PI;
    add(new THREE.BoxGeometry(0.12, 6.4, 0.15), wood, x, 5.4, Z1 - 0.08, scene); add(new THREE.BoxGeometry(3.3, 0.12, 0.15), wood, x, 5.2, Z1 - 0.08, scene);
    add(new THREE.BoxGeometry(3.6, 0.25, 0.6), wood, x, 2.8, Z1 - 0.3, scene);
    const ray = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 14), new THREE.MeshBasicMaterial({ color: 0xfff0d0, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    ray.position.set(x + 1, 4, Z1 - 5); ray.rotation.set(-0.95, 0, 0.15); scene.add(ray);
  }

  // ---------- glass tube & bed (where you wake up) ----------
  const tubePos = V3(-17, 1.95, -8.5);
  add(new THREE.CylinderGeometry(0.6, 0.72, 1.1, 18), stone, tubePos.x, 0.55, tubePos.z, scene);
  const brass = new THREE.MeshStandardMaterial({ color: 0xd4a640, metalness: 0.85, roughness: 0.28 });
  add(new THREE.TorusGeometry(0.5, 0.06, 8, 28), brass, tubePos.x, 1.12, tubePos.z, scene).rotation.x = Math.PI / 2;
  const glass = add(new THREE.CylinderGeometry(0.48, 0.48, 1.6, 32, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.18, roughness: 0.02, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }), tubePos.x, 1.92, tubePos.z, scene, false);
  const lid = add(new THREE.CylinderGeometry(0.54, 0.54, 0.1, 28), brass, tubePos.x, 2.75, tubePos.z, scene);
  world.cyl(tubePos.x, tubePos.z, 0.75, 0, 3);
  // bed
  add(new THREE.BoxGeometry(2.4, 0.5, 3.4), wood, -21.5, 0.3, -12.5, scene);
  add(new THREE.BoxGeometry(2.2, 0.32, 3.2), new THREE.MeshStandardMaterial({ color: 0xf2ebe0, roughness: 1 }), -21.5, 0.7, -12.5, scene);
  add(new THREE.BoxGeometry(2.26, 0.34, 2.1), new THREE.MeshStandardMaterial({ color: 0x4a4ab8, roughness: 1 }), -21.5, 0.74, -12.0, scene);
  add(new THREE.CapsuleGeometry(0.22, 1.0, 4, 10).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), -21.5, 0.98, -13.7, scene);
  world.box(-21.5, 0, -12.5, 2.4, 0.9, 3.4);

  // ---------- Campaign Portal (west wall) ----------
  const portalMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float time; varying vec2 vUv;
      void main(){ vec2 p = vUv - 0.5; float r = length(p) * 2.0; float a = atan(p.y, p.x);
        float s = sin(a * 5.0 + time * 3.0 - r * 12.0) * 0.5 + 0.5;
        vec3 col = mix(vec3(0.15, 0.9, 0.45), vec3(0.6, 0.2, 1.1), s) * (1.0 - r * 0.8) * (0.4 + s) * 0.9;
        col += vec3(0.5, 1.4, 0.8) * smoothstep(0.78, 0.96, r) * (1.0 - smoothstep(0.96, 1.0, r));
        gl_FragColor = vec4(max(col, 0.0) * step(r, 1.0), 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  {
    const g = new THREE.Group(); g.position.set(-23.2, 0, 0); g.rotation.y = Math.PI / 2; scene.add(g);
    add(new THREE.TorusGeometry(2.4, 0.38, 12, 40), stone, 0, 3.2, 0, g);
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; add(new THREE.OctahedronGeometry(0.2, 0), glowMat(0x6aff9a, 2), Math.cos(a) * 2.45, 3.2 + Math.sin(a) * 2.45, 0.35, g, false).scale.y = 1.8; }
    add(new THREE.CircleGeometry(2.1, 48), portalMat, 0, 3.2, 0.05, g, false);
    add(new THREE.BoxGeometry(6, 0.4, 2.4), stone, 0, 0.2, 0.6, g);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.9, 1.4, 1), stone, s * 2.6, 0.7, 0.3, g);
    world.box(-22.4, 0, 0, 2.4, 0.4, 6);
  }
  pois.push(V3(-23, 3, 0));

  // ---------- Soul Forge (center) ----------
  const forgePos = V3(-6, 0, 0);
  {
    add(new THREE.CircleGeometry(3.6, 48), new THREE.MeshStandardMaterial({ map: TEX.rug, roughness: 1 }), forgePos.x, 0.02, forgePos.z, scene, false).rotation.x = -Math.PI / 2;
    const rune = add(new THREE.RingGeometry(2.6, 2.8, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.5, 2), transparent: true, opacity: 0.8, side: THREE.DoubleSide }), forgePos.x, 0.04, forgePos.z, scene, false); rune.rotation.x = -Math.PI / 2;
    add(new THREE.BoxGeometry(3.4, 1.1, 2.2), stone, forgePos.x, 0.55, forgePos.z, scene);
    add(new THREE.BoxGeometry(1.6, 0.35, 0.7), new THREE.MeshStandardMaterial({ color: 0x3a3a42, metalness: 0.8, roughness: 0.4 }), forgePos.x + 0.4, 1.3, forgePos.z, scene);
    add(new THREE.BoxGeometry(0.7, 0.3, 0.5), new THREE.MeshStandardMaterial({ color: 0x3a3a42, metalness: 0.8, roughness: 0.4 }), forgePos.x + 0.4, 1.0, forgePos.z, scene);
    const brazier = add(new THREE.CylinderGeometry(0.55, 0.35, 0.5, 14), new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: 0.7, roughness: 0.4 }), forgePos.x - 1.1, 1.35, forgePos.z, scene);
    const flame = add(new THREE.ConeGeometry(0.42, 1.2, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.6, 2.6), transparent: true, opacity: 0.85 }), forgePos.x - 1.1, 2.15, forgePos.z, scene, false);
    const crystal = add(new THREE.OctahedronGeometry(0.5, 0), glowMat(0xc07aff, 2.2, { roughness: 0.1 }), forgePos.x, 3.8, forgePos.z, scene, false); crystal.scale.y = 1.7;
    crystal.add(glowSprite(0xb06aff, 3, 0.5));
    anim.push(t => { crystal.rotation.y = t * 0.8; crystal.position.y = 3.8 + Math.sin(t * 1.4) * 0.2; flame.scale.set(1 + Math.sin(t * 17) * 0.08, 1 + Math.sin(t * 11) * 0.15, 1); forgeLight.intensity = 28 + Math.sin(t * 13) * 4; rune.rotation.z = t * 0.2; });
    world.box(forgePos.x, 0, forgePos.z, 3.4, 2.4, 2.2);
  }
  pois.push(V3(-6, 3.8, 0));

  // ---------- Spell Archive (north) ----------
  const archivePos = V3(-6, 0, 11.5);
  {
    add(new THREE.CylinderGeometry(2.2, 2.4, 1.1, 32), wood, archivePos.x, 0.55, archivePos.z, scene);
    const top = add(new THREE.CircleGeometry(2.1, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.9, 1.4) }), archivePos.x, 1.11, archivePos.z, scene, false); top.rotation.x = -Math.PI / 2;
    const orbs = [];
    for (let i = 0; i < 10; i++) {
      const lit = i === 0;
      const o = add(new THREE.SphereGeometry(0.16, 14, 10), lit ? new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.3, 3) }) : new THREE.MeshStandardMaterial({ color: 0x404858, roughness: 0.3, metalness: 0.4 }), 0, 0, 0, scene, false);
      if (lit) o.add(glowSprite(0x8a7aff, 1, 0.8)); orbs.push(o);
    }
    const books = [];
    for (let i = 0; i < 7; i++) {
      const b = add(new THREE.BoxGeometry(0.42, 0.08, 0.3), new THREE.MeshStandardMaterial({ color: [0xc0392b, 0x2e86c1, 0xf1c40f, 0x27ae60, 0x8e44ad][i % 5] }), 0, 0, 0, scene); books.push(b);
    }
    anim.push(t => {
      orbs.forEach((o, i) => { const a = t * 0.4 + i / 10 * Math.PI * 2; o.position.set(archivePos.x + Math.cos(a) * 1.5, 1.7 + Math.sin(t * 1.5 + i) * 0.12, archivePos.z + Math.sin(a) * 1.5); });
      books.forEach((b, i) => { const a = -t * 0.25 + i / 7 * Math.PI * 2; b.position.set(archivePos.x + Math.cos(a) * 3, 2.6 + Math.sin(t + i) * 0.3, archivePos.z + Math.sin(a) * 2.4); b.rotation.set(Math.sin(t + i) * 0.3, a, Math.cos(t * 0.7 + i) * 0.2); });
    });
    world.cyl(archivePos.x, archivePos.z, 2.4, 0, 1.2);
    // shelves of books behind the archive
    for (const x of [-12, -1]) {
      add(new THREE.BoxGeometry(4, 4.4, 0.8), wood, x, 2.2, Z1 - 0.6, scene);
      for (let r = 0; r < 4; r++) for (let i = 0; i < 12; i++) { const h = rand(0.5, 0.85); add(new THREE.BoxGeometry(0.26, h, 0.5), new THREE.MeshStandardMaterial({ color: [0xc0392b, 0x2e86c1, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0x16a085][(r * 12 + i * 3) % 7], roughness: 0.7 }), x - 1.6 + i * 0.29, 0.5 + r * 1.05 + h / 2, Z1 - 0.95, scene, false); }
      world.box(x, 0, Z1 - 0.6, 4, 4.4, 0.8);
    }
  }
  pois.push(V3(-6, 2, 11.5));

  // ---------- Pet Sanctuary (north-west corner) ----------
  const sanctPos = V3(-19.5, 0, 11);
  {
    add(new THREE.CircleGeometry(4, 40), new THREE.MeshStandardMaterial({ color: 0x5c8a3a, map: rep(TEX.grass, 3, 3), roughness: 1 }), sanctPos.x, 0.02, sanctPos.z, scene, false).rotation.x = -Math.PI / 2;
    const pond = add(new THREE.CircleGeometry(1.3, 32), new THREE.MeshStandardMaterial({ color: 0x3a8ac8, roughness: 0.05, metalness: 0.3, emissive: 0x0a3050, emissiveIntensity: 0.6 }), sanctPos.x + 1.5, 0.04, sanctPos.z - 1, scene, false); pond.rotation.x = -Math.PI / 2;
    for (const [dx, dz, c] of [[-1.5, 1.5, 0xc86a8a], [0.5, 2.2, 0x6a8ac8], [-2.4, -0.8, 0xd8a84a]]) { const c2 = add(new THREE.SphereGeometry(0.75, 18, 10), new THREE.MeshStandardMaterial({ color: c, roughness: 1 }), sanctPos.x + dx, 0.25, sanctPos.z + dz, scene); c2.scale.y = 0.4; }
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; add(blob(rand(0.4, 0.7), 2, i * 3, 0x2f6a26, 0x8fc04a), leafMat, sanctPos.x + Math.cos(a) * 3.4, 0.4, sanctPos.z + Math.sin(a) * 3.4, scene); }
    const house = new THREE.Group(); house.position.set(sanctPos.x - 2.6, 0, sanctPos.z + 2.6); scene.add(house);
    add(new THREE.BoxGeometry(1.2, 0.9, 1.2), wood, 0, 0.45, 0, house); add(new THREE.ConeGeometry(1.0, 0.8, 4), new THREE.MeshStandardMaterial({ color: 0x2f6f7a }), 0, 1.3, 0, house).rotation.y = Math.PI / 4;
    for (let i = 0; i < 5; i++) { const p = add(new THREE.SphereGeometry(0.12, 10, 8), glowMat([0x7aff8a, 0xff8ad8, 0x8ad8ff][i % 3], 1.4), sanctPos.x + rand(-3, 3), rand(1.5, 3), sanctPos.z + rand(-3, 3), scene, false); const base = p.position.clone(); anim.push(t => p.position.set(base.x + Math.sin(t * 0.7 + i) * 0.5, base.y + Math.sin(t * 1.3 + i) * 0.3, base.z + Math.cos(t * 0.6 + i) * 0.5)); }
    world.cyl(sanctPos.x - 2.6, sanctPos.z + 2.6, 0.9, 0, 1.8);
  }
  pois.push(V3(-19.5, 1, 11));

  // ---------- Weapon racks (south wall) ----------
  const rackPos = V3(-6, 0, Z0 + 0.8);
  {
    add(new THREE.BoxGeometry(6, 3.2, 0.4), wood, rackPos.x, 1.9, Z0 + 0.3, scene);
    for (let i = 0; i < 5; i++) {
      const x = rackPos.x - 2.2 + i * 1.1;
      if (i % 2 === 0) { add(new THREE.BoxGeometry(0.07, 1.4, 0.02), new THREE.MeshStandardMaterial({ color: 0xc8d0dc, metalness: 0.6, roughness: 0.3 }), x, 2.2, Z0 + 0.55, scene); add(new THREE.BoxGeometry(0.3, 0.06, 0.06), brass, x, 1.45, Z0 + 0.55, scene); }
      else { const c = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.025, 6, 24, Math.PI * 0.8), new THREE.MeshStandardMaterial({ color: 0x8a5230 })); c.position.set(x, 2.1, Z0 + 0.55); c.rotation.z = Math.PI / 2 - Math.PI * 0.4; scene.add(c); }
    }
    world.box(rackPos.x, 0, Z0 + 0.3, 6, 3.4, 0.6);
  }
  // ---------- machinery: rotating gears + potion shelves ----------
  const gearMat = new THREE.MeshStandardMaterial({ color: 0xb08a4a, metalness: 0.8, roughness: 0.35 });
  function gear(r, teeth) {
    const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.2, 32).rotateX(Math.PI / 2), gearMat));
    for (let i = 0; i < teeth; i++) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.22, r * 0.25, 0.2), gearMat); const a = i / teeth * Math.PI * 2; t.position.set(Math.cos(a) * r, Math.sin(a) * r, 0); t.rotation.z = a + Math.PI / 2; g.add(t); }
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.25, r * 0.25, 0.3, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.8 })));
    return g;
  }
  const gears = [[2.0, 18, -16, 5.5, 1], [1.2, 11, -13, 7.6, -1.64], [1.4, 13, -12.2, 4.2, -1.43]];
  for (const [r, n, x, y, sp] of gears) { const g = gear(r, n); g.position.set(x, y, Z0 + 0.35); scene.add(g); anim.push(t => g.rotation.z = t * 0.5 * sp); }
  for (const x of [1.5, -14.5]) {
    if (x === -14.5) continue;
    add(new THREE.BoxGeometry(3.4, 0.12, 0.6), wood, x, 1.6, Z0 + 0.45, scene); add(new THREE.BoxGeometry(3.4, 0.12, 0.6), wood, x, 2.6, Z0 + 0.45, scene);
    for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) { const c = [0x5cff9a, 0xff5ca8, 0x5ab4ff, 0xffd24a, 0xb07aff][(i + r) % 5]; const b = add(new THREE.SphereGeometry(0.13, 12, 8), glowMat(c, 1.2, { transparent: true, opacity: 0.85 }), x - 1.3 + i * 0.52, 1.82 + r, Z0 + 0.45, scene, false); add(new THREE.CylinderGeometry(0.04, 0.05, 0.14, 6), new THREE.MeshStandardMaterial({ color: 0xbbe6dd }), b.position.x, b.position.y + 0.17, b.position.z, scene, false); }
  }
  // crystal clusters
  for (const [x, z, c] of [[-22.5, 6, 0x3ae0ff], [-1, -14.5, 0xb05aff], [4.5, 14.5, 0x3ae0ff], [-22.5, -5, 0xb05aff]]) {
    const cm = glowMat(c, 1.8, { roughness: 0.15 });
    for (let k = 0; k < 5; k++) { const cr = add(new THREE.OctahedronGeometry(rand(0.2, 0.45), 0), cm, x + rand(-0.5, 0.5), rand(0.3, 0.7), z + rand(-0.3, 0.3), scene, false); cr.scale.y = 2.4; cr.rotation.z = rand(-0.4, 0.4); }
    pois.push(V3(x, 0.6, z));
  }
  // floating crystal chandeliers
  for (const [x, z] of [[-14, 4], [0, -6], [-6, 6]]) {
    const g = new THREE.Group(); g.position.set(x, 7.5, z); scene.add(g);
    for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28; const cr = add(new THREE.OctahedronGeometry(0.18, 0), glowMat(0xffe0a0, 2.4), Math.cos(a) * 0.9, Math.sin(k * 2) * 0.2, Math.sin(a) * 0.9, g, false); cr.scale.y = 2; }
    g.add(glowSprite(0xffd08a, 4, 0.35));
    anim.push(t => { g.rotation.y = t * 0.3; g.position.y = 7.5 + Math.sin(t * 0.8 + x) * 0.2; });
  }
  // floating candles
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Group(); g.position.set(rand(-20, 4), rand(3.5, 5.5), rand(-13, 13)); scene.add(g);
    add(new THREE.CylinderGeometry(0.07, 0.07, rand(0.25, 0.45), 8), new THREE.MeshStandardMaterial({ color: 0xf5eedc }), 0, 0, 0, g, false);
    add(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.6, 0.5) }), 0, 0.27, 0, g, false).scale.y = 1.7;
    const by = g.position.y, ph = rand(0, 6); anim.push(t => g.position.y = by + Math.sin(t * 1.2 + ph) * 0.15);
  }
  const motes = makeMotes(scene, 160, () => [rand(-23, 4), rand(0.5, 8), rand(-15, 15)], new THREE.Color(1.2, 1.0, 0.7), 0.08);
  anim.push(t => motes.update(t * 0.3, 1.2));

  // ---------- Training Arena (east) ----------
  const AX0 = 6.5, AX1 = 23.5, AZ = 13;
  const inArena = p => p.x > AX0 && p.x < AX1 && Math.abs(p.z) < AZ;
  {
    // low stone railing with an entrance gap at z in [-2.5, 2.5]
    const rail = (cx, cz, sx, sz) => { add(new THREE.BoxGeometry(sx, 1, sz), stone, cx, 0.5, cz, scene); world.box(cx, 0, cz, sx, 1, sz); };
    rail(AX0 - 0.3, 7.75, 0.6, 10.5); rail(AX0 - 0.3, -7.75, 0.6, 10.5);
    rail(15, AZ + 0.3, 17, 0.6); rail(15, -AZ - 0.3, 17, 0.6);
    for (const z of [-2.8, 2.8]) { add(new THREE.CylinderGeometry(0.35, 0.4, 2.2, 10), stone, AX0 - 0.3, 1.1, z, scene); world.cyl(AX0 - 0.3, z, 0.4, 0, 2.2); add(new THREE.SphereGeometry(0.22, 12, 8), glowMat(0xffb060, 2), AX0 - 0.3, 2.35, z, scene, false); }
    // parkour: wall-run wall + platforms
    add(new THREE.BoxGeometry(0.8, 4.5, 8), stone, 10, 2.25, 8, scene); world.box(10, 0, 8, 0.8, 4.5, 8);
    for (const [x, z, h] of [[19.5, -2, 1.4], [21.5, 3, 2.8], [16, 10.5, 1.2]]) { add(new THREE.BoxGeometry(3, h, 3), stone, x, h / 2, z, scene); world.box(x, 0, z, 3, h, 3); }
    world.cyl(22.5, -12, 0.65, 0, 2.5); world.cyl(12, -8, 0.4, 0, 2); world.cyl(12, -4.5, 0.4, 0, 2);
    // lever for the practice enemy
    const lever = new THREE.Group(); lever.position.set(AX0 + 1.2, 0, 4.2); scene.add(lever);
    add(new THREE.BoxGeometry(0.6, 1, 0.6), stone, 0, 0.5, 0, lever);
    const handle = new THREE.Group(); handle.position.y = 1; lever.add(handle);
    add(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8), new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.8 }), 0, 0.4, 0, handle);
    const knob = add(new THREE.SphereGeometry(0.1, 12, 8), glowMat(0x6aff6a, 1.6), 0, 0.82, 0, handle, false);
    anim.push(() => { handle.rotation.x = G.practiceMode === 'fight' ? 0.7 : -0.7; knob.material.color.setHex(G.practiceMode === 'fight' ? 0xff4a4a : 0x6aff6a); knob.material.emissive.copy(knob.material.color); });
    world.box(AX0 + 1.2, 0, 4.2, 0.6, 1, 0.6);
  }
  const practiceHome = V3(14, 0, 7);
  const respawnPractice = () => { if (!G.enemies.some(e => e.practice && !e.dead)) spawnEnemy('raider', practiceHome, { practice: true }); };
  // dummies are (re)created every time you enter the lab
  const populate = () => {
    spawnEnemy('dummy', V3(12, 0, -8)); spawnEnemy('dummy', V3(12, 0, -4.5));
    spawnEnemy('dummy_move', V3(17, 0, -10), { a: V3(17, 0, -11), b: V3(17, 0, -4) });
    spawnEnemy('target_air', V3(20, 5, 7)); spawnEnemy('target_air', V3(15, 6.5, 4)); spawnEnemy('target_air', V3(21.5, 5.8, -8));
    spawnEnemy('turret', V3(22.5, 0, -12));
    respawnPractice();
  };

  // ---------- interactables ----------
  const interactables = [
    { pos: tubePos, r: 2.6, label: 'Open the glass tube', use: actions.onTube, enabled: () => !G.save.petReleased },
    { pos: V3(-21, 0, 0), r: 4.5, label: 'Campaign Portal', use: actions.onPortal },
    { pos: forgePos, r: 3.6, label: 'Soul Forge', use: actions.onForge },
    { pos: archivePos, r: 3.6, label: 'Spell Archive', use: actions.onArchive },
    { pos: sanctPos, r: 3.8, label: 'Pet Sanctuary', use: actions.onSanctuary },
    { pos: rackPos, r: 3.2, label: 'Weapon Rack (inventory & loadout)', use: actions.onRack },
    { pos: V3(AX0 + 1.2, 0, 4.2), r: 2.2, label: () => G.practiceMode === 'fight' ? 'Practice goblin: set to IDLE' : 'Practice goblin: set to FIGHT', use: actions.onLever },
  ];

  G.scene = prevScene;
  return {
    name: 'lab', scene, world, spawn: V3(-18.8, 0, -11.8), spawnYaw: Math.atan2(-(tubePos.x + 18.8), -(tubePos.z + 11.8)),
    returnSpawn: V3(-19, 0, 0), returnYaw: -Math.PI / 2,
    interactables, pois, tubePos, lid, inArena, respawnPractice, populate,
    post: { bloom: 0.6, exposure: 1.0, tint: new THREE.Color(1.0, 0.98, 1.03) },
    update(dt, t) { portalMat.uniforms.time.value = t; portalLight.intensity = 20 + Math.sin(t * 2) * 4; for (const f of anim) f(t); },
  };
}
