// =====================================================================
// CHAOSBOUND: visual effects (particles, slash arcs, impact rings, damage numbers, telegraphs)
// =====================================================================
import { THREE, G, V3, rand, clamp, TEX, camera } from './core.js';

const list = [];            // generic timed effects {obj, life, max, update}
const parts = [];
const partGeo = new THREE.IcosahedronGeometry(0.06, 0);
const partMats = {};
const pmat = c => partMats[c] || (partMats[c] = new THREE.MeshBasicMaterial({ color: c }));

export function burst(pos, color, n = 10, speed = 4, life = 0.7, grav = 9, size = 1) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(partGeo, pmat(color)); m.position.copy(pos); m.scale.setScalar(size); G.scene.add(m);
    parts.push({ m, v: V3(rand(-1, 1), rand(0.1, 1.4), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.4, 1)), life, max: life, grav, size });
  }
}
export function streak(from, to, color, life = 0.4) {
  const m = new THREE.Mesh(partGeo, pmat(color)); m.position.copy(from); G.scene.add(m);
  parts.push({ m, v: to.clone().sub(from).divideScalar(life), life, max: life, grav: 0, size: 1 });
}

// additive shader used for slashes/rings
const arcMat = (color, alpha = 1) => new THREE.ShaderMaterial({
  uniforms: { col: { value: new THREE.Color(color) }, t: { value: 0 }, alpha: { value: alpha }, flip: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform vec3 col; uniform float t, alpha, flip; varying vec2 vUv;
    void main(){ float along = mix(vUv.x, 1.0 - vUv.x, flip); float across = abs(vUv.y - 0.5) * 2.0;
      float head = smoothstep(t - 0.6, t, along) * (1.0 - smoothstep(t, t + 0.05, along));
      float edge = pow(1.0 - across, 2.0);
      float a = head * edge * alpha * (1.0 - t * 0.6);
      gl_FragColor = vec4(col * a * 2.2 + vec3(1.0) * pow(edge, 8.0) * head * 0.6 * alpha, 1.0); }`,
  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
});
// crescent-shaped strip geometry (u along arc, v across)
function crescent(r0, r1, a0, a1, seg = 40) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const u = i / seg, a = a0 + (a1 - a0) * u, w = Math.sin(u * Math.PI);  // thick in the middle
    const rm = (r0 + r1) / 2, hw = (r1 - r0) / 2 * (0.25 + 0.75 * w);
    pos.push(Math.cos(a) * (rm - hw), 0, Math.sin(a) * (rm - hw), Math.cos(a) * (rm + hw), 0, Math.sin(a) * (rm + hw));
    uv.push(u, 0, u, 1);
    if (i < seg) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}
const slashGeo = crescent(1.3, 2.1, -1.4, 1.4);
// spawn a slash in front of the camera. tilt rotates the arc (0 = horizontal), dir = +1 left->right, -1 right->left
export function slash(color, tilt, dir = 1, scale = 1, dur = 0.16) {
  const m = new THREE.Mesh(slashGeo, arcMat(color));
  const fwd = V3(0, 0, -1).applyQuaternion(camera.quaternion);
  m.position.copy(camera.position).addScaledVector(fwd, 0.35);
  m.quaternion.copy(camera.quaternion);
  m.rotateZ(tilt); m.rotateY(Math.PI / 2); m.scale.setScalar(scale);
  m.material.uniforms.flip.value = dir < 0 ? 1 : 0;
  G.scene.add(m);
  list.push({ obj: m, life: dur, max: dur, update(e, k) { e.obj.material.uniforms.t.value = k * 1.1; } });
}
// flat expanding ring (impact)
export function impactRing(pos, color, size = 2, dur = 0.35, faceCam = true) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.ring, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.position.copy(pos); G.scene.add(s);
  list.push({ obj: s, life: dur, max: dur, update(e, k) { const sc = size * (0.2 + k * 1.2); e.obj.scale.set(sc, sc, 1); e.obj.material.opacity = 1 - k; } });
}
export function flash(pos, color, size = 2, dur = 0.12) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.position.copy(pos); s.scale.set(size, size, 1); G.scene.add(s);
  list.push({ obj: s, life: dur, max: dur, update(e, k) { e.obj.material.opacity = 1 - k; } });
}
// ground ring (shockwave)
export function groundWave(pos, color, radius = 3.5, dur = 0.4) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.copy(pos); m.position.y += 0.08; G.scene.add(m);
  list.push({ obj: m, life: dur, max: dur, update(e, k) { const s = radius * (0.2 + k); e.obj.scale.set(s, s, s); e.obj.material.opacity = (1 - k); } });
}
// telegraphs: red ground circle / line that fills up over `dur`
export function teleCircle(pos, radius, dur, color = 0xff3030) {
  const g = new THREE.Group(); g.position.copy(pos); g.position.y += 0.06;
  const outer = new THREE.Mesh(new THREE.RingGeometry(radius - 0.08, radius, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
  const inner = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }));
  outer.rotation.x = inner.rotation.x = -Math.PI / 2; g.add(outer, inner); G.scene.add(g);
  const e = { obj: g, life: dur, max: dur, update(e, k) { inner.scale.setScalar(Math.max(0.01, k)); } };
  list.push(e); return e;
}
export function teleLine(from, dir, length, width, dur, color = 0xff3030) {
  const g = new THREE.Group(); g.position.copy(from); g.position.y += 0.06; g.rotation.y = Math.atan2(dir.x, dir.z);
  const bgM = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  const fgM = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
  const geo = new THREE.PlaneGeometry(width, length); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, length / 2);
  const bg = new THREE.Mesh(geo, bgM), fg = new THREE.Mesh(geo, fgM); g.add(bg, fg); G.scene.add(g);
  const e = { obj: g, life: dur, max: dur, update(e, k) { fg.scale.z = Math.max(0.01, k); } };
  list.push(e); return e;
}
export function killFx(e) { if (e) e.life = 0; }

// ---- floating damage numbers (pooled canvas sprites) ----
const nums = [];
let numIdx = 0;
function ensureNums() {
  if (nums.length) return;
  for (let i = 0; i < 28; i++) {
    const c = document.createElement('canvas'); c.width = 160; c.height = 64;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    sp.scale.set(1.0, 0.4, 1); sp.renderOrder = 30; sp.visible = false;
    nums.push({ sp, c, tex, life: 0, v: V3() });
  }
}
export function dmgNumber(pos, amt, color = '#ffffff', big = false) {
  ensureNums();
  const d = nums[numIdx++ % nums.length], g = d.c.getContext('2d');
  if (d.sp.parent !== G.scene) G.scene.add(d.sp);
  g.clearRect(0, 0, 160, 64); g.font = `900 ${big ? 50 : 40}px Nunito, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 7; g.strokeStyle = 'rgba(0,0,0,.8)'; g.strokeText(Math.round(amt), 80, 34); g.fillStyle = color; g.fillText(Math.round(amt), 80, 34);
  d.tex.needsUpdate = true; d.sp.position.copy(pos); d.sp.visible = true; d.life = 0.85; d.v.set(rand(-0.7, 0.7), 2.4, rand(-0.7, 0.7));
  const s = big ? 1.25 : 1; d.sp.scale.set(s, s * 0.4, 1);
}

export function updateFx(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt; p.v.y -= p.grav * dt; p.m.position.addScaledVector(p.v, dt);
    p.m.scale.setScalar(Math.max(0.01, p.life / p.max) * p.size);
    if (p.life <= 0) { p.m.parent && p.m.parent.remove(p.m); parts.splice(i, 1); }
  }
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i]; e.life -= dt; const k = clamp(1 - e.life / e.max, 0, 1);
    if (e.update) e.update(e, k);
    if (e.life <= 0) { e.obj.parent && e.obj.parent.remove(e.obj); e.obj.traverse(o => { if (o.material && o.material.dispose) o.material.dispose(); }); list.splice(i, 1); }
  }
  for (const d of nums) {
    if (d.life <= 0) continue;
    d.life -= dt; d.sp.position.addScaledVector(d.v, dt); d.v.y -= 3.5 * dt;
    d.sp.material.opacity = clamp(d.life * 2.2, 0, 1); if (d.life <= 0) d.sp.visible = false;
  }
}
export function clearFx() {
  for (const p of parts) p.m.parent && p.m.parent.remove(p.m); parts.length = 0;
  for (const e of list) e.obj.parent && e.obj.parent.remove(e.obj); list.length = 0;
  for (const d of nums) { d.life = 0; d.sp.visible = false; }
}
export function shake(amount) { G.shake = Math.max(G.shake, amount); }
export function hitStop(t) { G.hitStop = Math.max(G.hitStop, t); }
