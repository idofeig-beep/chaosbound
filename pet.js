// =====================================================================
// CHAOSBOUND: Pip the baby black hole (first pet). Follows you, looks at
// interesting things, reacts to your actions, fires Orange Singularity Rings.
// =====================================================================
import { THREE, G, V3, R, rand, clamp, lerp, damp, angDiff, smooth, TEX, sfx, camera } from './core.js';
import { burst, impactRing, flash } from './fx.js';
import { P } from './player.js';
import { damageEnemy } from './enemies.js';

const bhTime = { value: 0 };
const diskMat = new THREE.ShaderMaterial({
  uniforms: { time: bhTime, boost: { value: 1 } },
  vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform float time, boost; varying vec2 vP;
    float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h2(i),h2(i+vec2(1,0)),f.x), mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x), f.y); }
    void main(){ float r = length(vP); float t = clamp((r - 0.36) / 0.64, 0.0, 1.0); float a = atan(vP.y, vP.x);
      float sw = a + time * 1.6 / (r * r + 0.2) - r * 6.0;
      float bands = n2(vec2(sw * 3.0, r * 14.0)) * 0.6 + n2(vec2(sw * 7.0, r * 30.0)) * 0.4;
      vec3 col = t < 0.35 ? mix(vec3(1.0,0.95,0.85), vec3(1.0,0.55,0.12), t / 0.35) : mix(vec3(1.0,0.55,0.12), vec3(0.7,0.15,0.25), (t - 0.35) / 0.65);
      float inten = pow(1.0 - t, 1.6) * (0.35 + bands * 1.1) * (0.65 + 0.55 * cos(a)) * 1.7 * boost * smoothstep(0.0, 0.06, r - 0.36);
      gl_FragColor = vec4(max(col * inten, 0.0), 1.0); }`,
  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
});
const rimMat = new THREE.ShaderMaterial({
  uniforms: { col: { value: new THREE.Color(1.0, 0.55, 0.15) }, boost: { value: 1 } },
  vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 col; uniform float boost; varying vec3 vN; varying vec3 vV;
    void main(){ float f = clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0); float ring = pow(f, 3.0) * 1.3 + pow(f, 12.0) * 3.2; gl_FragColor = vec4(col * ring * boost, 1.0); }`,
  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
});
function makeBlackHole() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 40, 20), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  const rim = new THREE.Mesh(new THREE.SphereGeometry(0.4, 40, 20), rimMat);
  const disk = new THREE.Mesh(new THREE.RingGeometry(0.36, 1.0, 96, 4), diskMat); disk.rotation.x = -Math.PI / 2 + 0.28;
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.62, 96, 2), diskMat);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xff8a3a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.3 })); glow.scale.set(2.6, 2.6, 1);
  const face = new THREE.Group(), eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.4, 1.4) }), eyes = [];
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 10), eyeMat); e.scale.set(1, 1.5, 0.45); e.position.set(s * 0.1, 0.05, 0.29); face.add(e); eyes.push(e); }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 12, Math.PI), eyeMat); mouth.position.set(0, -0.07, 0.295); mouth.rotation.z = Math.PI; face.add(mouth);
  const N = 70, pg = new THREE.BufferGeometry(), pd = [];
  for (let i = 0; i < N; i++) pd.push({ a: rand(0, 6.28), r: rand(0.4, 1.4), y: rand(-0.05, 0.05), sp: rand(1.5, 3.5) });
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  const swirl = new THREE.Points(pg, new THREE.PointsMaterial({ color: new THREE.Color(2.2, 1.1, 0.4), size: 0.07, map: TEX.glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  swirl.rotation.x = 0.28; swirl.frustumCulled = false;
  const light = new THREE.PointLight(0xff8a3a, 3, 7, 1.6);
  g.add(glow, core, rim, disk, halo, face, swirl, light);
  return { g, disk, halo, face, eyes, mouth, glow, swirl, pd, light };
}

export const pet = { state: 'hidden', m: null, yaw: 0, cd: 1.5, blinkT: 3, pulse: 0, spin: 0, hop: 0, rings: [], lookT: 0, lookAt: null, level: 1 };
const ringGeo = new THREE.TorusGeometry(0.24, 0.05, 8, 32);
export function initPet() { pet.m = makeBlackHole(); pet.m.g.scale.setScalar(0.5); }
export function attachPet(scene, pos, state) {
  scene.add(pet.m.g); pet.m.g.position.copy(pos); pet.state = state;
  for (const r of pet.rings) r.m.parent && r.m.parent.remove(r.m); pet.rings.length = 0;
}
export function releasePet() { pet.state = 'rising'; pet.riseT = 0; sfx.pop(); }
export function petReact(kind) { if (kind === 'happy') { pet.pulse = 1; pet.hop = 1; } if (kind === 'spin') pet.spin = 1; }

function nearestTarget(range) {
  let best = null, bd = range; const p = pet.m.g.position;
  for (const e of G.enemies) {
    if (e.dead || (e.practice && G.practiceMode !== 'fight' && false)) continue;
    const d = p.distanceTo(e.center()); if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function fireRing(target) {
  const p = pet.m.g.position;
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.2, 0.25) }));
  m.position.copy(p);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xff8a2a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 })); glow.scale.set(1.3, 1.3, 1); m.add(glow);
  G.scene.add(m);
  const v = target.center().sub(p).normalize().multiplyScalar(15);
  pet.rings.push({ m, v, target, life: 2.5, dmg: 9 });
  sfx.ring(); pet.pulse = Math.max(pet.pulse, 0.6);
}
function updateRings(dt) {
  for (let i = pet.rings.length - 1; i >= 0; i--) {
    const r = pet.rings[i]; r.life -= dt;
    if (r.target && !r.target.dead) r.v.lerp(r.target.center().sub(r.m.position).normalize().multiplyScalar(16), damp(5, dt));
    r.m.position.addScaledVector(r.v, dt); r.m.lookAt(r.m.position.clone().add(r.v));
    r.m.scale.setScalar(1 + (2.5 - r.life) * 0.4); r.m.rotateZ(dt * 8);
    let hit = null;
    for (const e of G.enemies) if (!e.dead && r.m.position.distanceTo(e.center()) < e.r + 0.35) { hit = e; break; }
    const blocked = G.world && G.world.solid(r.m.position);
    if (hit || blocked || r.life <= 0) {
      if (hit) {
        damageEnemy(hit, r.dmg, { dir: r.v.clone().normalize(), knock: 1.5, src: 'pet', juggle: hit.airborne });
        impactRing(r.m.position.clone(), 0xff8a2a, 2.4, 0.4); impactRing(r.m.position.clone(), 0xffd08a, 1.4, 0.25); flash(r.m.position, 0xff9a3a, 1.6);
        burst(r.m.position, 0xffa040, 8, 3, 0.4); sfx.ringHit();
      }
      r.m.parent && r.m.parent.remove(r.m); pet.rings.splice(i, 1);
    }
  }
}

export function updatePet(dt) {
  if (!pet.m) return;
  const g = pet.m.g, scale = 0.75;
  bhTime.value = G.time;
  updateLook(dt);
  if (pet.state === 'hidden') { g.visible = false; return; }
  g.visible = true;
  if (pet.state === 'tube') { const t = G.level.tubePos; g.position.set(t.x, t.y + Math.sin(G.time * 1.7) * 0.06, t.z); pet.yaw = Math.sin(G.time * 0.6) * 0.9; g.rotation.y = pet.yaw; return; }
  if (pet.state === 'rising') {
    pet.riseT += dt; const k = Math.min(1, pet.riseT / 1.7), t = G.level.tubePos;
    g.position.set(t.x, lerp(t.y, t.y + 1.7, smooth(0, 1, k)), t.z); g.scale.setScalar(lerp(0.5, scale, k)); pet.yaw += dt * 7; g.rotation.y = pet.yaw;
    if (k >= 1) { pet.state = 'follow'; burst(g.position, 0xffa040, 18, 4, 0.9, 2); }
    return;
  }
  // FOLLOW: keeps its own spot; only drifts after you when you walk away (you can turn and look at it)
  const pp = P.pos, flat = V3(g.position.x - pp.x, 0, g.position.z - pp.z), d = flat.length();
  let target = null;
  if (d > 6.5) { flat.normalize(); target = V3(pp.x + flat.x * 4.2, 0, pp.z + flat.z * 4.2); }
  else if (d < 2.4 && d > 0.01) { flat.normalize(); target = V3(pp.x + flat.x * 2.8, 0, pp.z + flat.z * 2.8); }
  if (target) { const k = damp(d > 12 ? 3 : 1.6, dt); g.position.x = lerp(g.position.x, target.x, k); g.position.z = lerp(g.position.z, target.z, k); }
  const floor = G.world.groundAt(g.position.x, g.position.z, g.position.y + 2);
  const wantY = Math.max(pp.y + 2.1, floor + 1.6) + Math.sin(G.time * 1.8) * 0.15 + pet.hop * 0.5;
  g.position.y = lerp(g.position.y, wantY, damp(3, dt));
  pet.hop = Math.max(0, pet.hop - dt * 2.5); pet.pulse = Math.max(0, pet.pulse - dt * 2.5);
  if (P.dashT > 0.12) pet.spin = 1;
  g.scale.setScalar(lerp(g.scale.x, scale * (1 + pet.pulse * 0.25), damp(8, dt)));
  // targeting & attack
  pet.cd -= dt;
  const tgt = nearestTarget(18);
  if (tgt && pet.cd <= 0 && !P.dead) { fireRing(tgt); pet.cd = 2.0; }
  // facing: target > interesting thing > you
  let lx = camera.position.x, lz = camera.position.z, rate = 2.5;
  if (tgt) { lx = tgt.pos.x; lz = tgt.pos.z; rate = 6; }
  else if (pet.lookAt) { lx = pet.lookAt.x; lz = pet.lookAt.z; rate = 3; }
  pet.yaw += angDiff(pet.yaw, Math.atan2(lx - g.position.x, lz - g.position.z)) * damp(rate, dt);
  pet.spin = Math.max(0, pet.spin - dt * 1.8);
  g.rotation.y = pet.yaw + (1 - pet.spin) * 0 + (pet.spin > 0 ? (1 - pet.spin) * Math.PI * 2 : 0);
}
function updateLook(dt) {
  if (!pet.m) return;
  const m = pet.m;
  m.disk.rotation.z += dt * 0.6;
  m.halo.lookAt(camera.position); m.halo.rotateZ(G.time * 0.3);
  diskMat.uniforms.boost.value = 1 + pet.pulse * 0.8;
  rimMat.uniforms.boost.value = 1 + pet.pulse * 0.6;
  m.glow.material.opacity = 0.3 + Math.sin(G.time * 3) * 0.05 + pet.pulse * 0.3;
  pet.blinkT -= dt; if (pet.blinkT < 0) pet.blinkT = rand(2, 5);
  const blink = pet.blinkT < 0.12 ? 0.12 : 1;
  for (const e of m.eyes) e.scale.y = 1.5 * blink * (1 + pet.pulse * 0.3);
  m.mouth.scale.setScalar(1 + pet.pulse * 0.6);
  const pa = m.swirl.geometry.attributes.position;
  for (let i = 0; i < m.pd.length; i++) { const q = m.pd[i]; q.a += dt * q.sp / q.r; q.r -= dt * 0.25; if (q.r < 0.38) q.r = rand(1.0, 1.5); pa.setXYZ(i, Math.cos(q.a) * q.r, q.y, Math.sin(q.a) * q.r); }
  pa.needsUpdate = true;
  // pick something interesting to look at every few seconds
  pet.lookT -= dt;
  if (pet.lookT <= 0 && G.level) {
    pet.lookT = rand(2.5, 5); pet.lookAt = null;
    const pois = G.level.pois || [];
    const near = pois.filter(p => p.distanceTo(m.g.position) < 9);
    if (near.length && R() < 0.6) pet.lookAt = near[Math.floor(R() * near.length)];
  }
  updateRings(dt);
}
