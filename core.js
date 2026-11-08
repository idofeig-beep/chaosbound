// =====================================================================
// CHAOSBOUND: core engine (renderer, post-processing, textures, sky, sound, helpers)
// =====================================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
export { THREE, mergeGeometries, mergeVertices };

// ---------------- helpers ----------------
export const $ = id => document.getElementById(id);
export const R = Math.random;
export const rand = (a, b) => a + R() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const damp = (k, dt) => 1 - Math.exp(-k * dt);
export const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const pick = a => a[Math.floor(R() * a.length)];
export const distXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
export function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return lerp(lerp(hash(xi, zi), hash(xi + 1, zi), u), lerp(hash(xi, zi + 1), hash(xi + 1, zi + 1), u), v);
}
export const fbm = (x, z) => vnoise(x, z) * 0.5 + vnoise(x * 2.03, z * 2.03) * 0.25 + vnoise(x * 4.1, z * 4.1) * 0.125;
function hash3(x, y, z) { const s = Math.sin(x * 127.1 + y * 269.5 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
export function vnoise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const a = lerp(lerp(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), lerp(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v);
  const b = lerp(lerp(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), lerp(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v);
  return lerp(a, b, w);
}

// ---------------- global state (shared by all modules) ----------------
export const G = {
  scene: null, world: null, level: null, mode: 'title', time: 0, timeScale: 1, hitStop: 0, shake: 0,
  paused: false, uiOpen: false, enemies: [], save: null,
  settings: { sens: 1, shake: 1, fovFx: true, motion: true },
  onKill: null, onPlayerDeath: null,
};

// ---------------- renderer & post ----------------
export const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);

export const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.05, 900);
camera.rotation.order = 'YXZ';

const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 });
export const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(renderer.getPixelRatio());
const renderPass = new RenderPass(new THREE.Scene(), camera);
composer.addPass(renderPass);
export const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.55, 0.85);
composer.addPass(bloom);
composer.addPass(new OutputPass());
export const gradePass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, sat: { value: 1.12 }, vig: { value: 1.15 }, tint: { value: new THREE.Color(1, 1, 1) }, hurt: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float sat, vig, hurt; uniform vec3 tint; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(.299,.587,.114));
      c.rgb = mix(vec3(l), c.rgb, sat) * tint; vec2 d = vUv - 0.5; float r = dot(d, d);
      c.rgb *= 1.0 - r * vig; c.rgb = mix(c.rgb, vec3(0.75, 0.05, 0.08), clamp(hurt * r * 2.2, 0.0, 0.8));
      gl_FragColor = vec4(max(c.rgb, 0.0), c.a); }`
});
composer.addPass(gradePass);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});
export function setScene(level) {
  G.level = level; G.scene = level.scene; G.world = level.world;
  renderPass.scene = level.scene; level.scene.add(camera);
  if (level.post) { bloom.strength = level.post.bloom; renderer.toneMappingExposure = level.post.exposure; gradePass.uniforms.tint.value.copy(level.post.tint); }
}
export function render() { composer.render(); }

// ---------------- procedural textures ----------------
export function canvasTex(size, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export const rep = (tex, x, y) => { const t = tex.clone(); t.repeat.set(x, y); t.needsUpdate = true; return t; };
export const TEX = {};
TEX.grass = canvasTex(512, (g, s) => {
  g.fillStyle = 'rgb(196,206,186)'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 9000; i++) {
    const l = 150 + R() * 100 | 0; g.strokeStyle = `rgba(${l - 20},${l},${l - 40},${0.25 + R() * 0.4})`; g.lineWidth = 1 + R() * 1.5;
    const x = R() * s, y = R() * s, a = -Math.PI / 2 + (R() - 0.5) * 0.9, L = 3 + R() * 9;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
  }
});
TEX.bark = canvasTex(256, (g, s) => {
  g.fillStyle = '#6a4a33'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 140; i++) {
    const x = R() * s; g.strokeStyle = R() < 0.5 ? 'rgba(40,25,15,.55)' : 'rgba(140,105,75,.35)'; g.lineWidth = 1 + R() * 4;
    g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= s; y += 16) g.lineTo(x + Math.sin(y * 0.05 + i) * 4, y); g.stroke();
  }
});
TEX.plank = canvasTex(512, (g, s) => {
  const h = s / 8;
  for (let i = 0; i < 8; i++) {
    const b = 120 + R() * 40 | 0; g.fillStyle = `rgb(${b + 40},${b},${b * 0.62 | 0})`; g.fillRect(0, i * h, s, h);
    for (let k = 0; k < 30; k++) { g.strokeStyle = `rgba(60,35,20,${0.08 + R() * 0.15})`; g.lineWidth = 1; const y = i * h + R() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(s * .3, y + R() * 6 - 3, s * .6, y + R() * 6 - 3, s, y); g.stroke(); }
    g.fillStyle = 'rgba(30,18,10,.8)'; g.fillRect(0, i * h, s, 3); g.fillRect(R() * s, i * h, 3, h);
  }
});
TEX.stone = canvasTex(512, (g, s) => {
  g.fillStyle = '#6a6a6e'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 70; i++) {
    const x = R() * s, y = R() * s, w = 30 + R() * 45, h = 22 + R() * 30, l = 150 + R() * 60 | 0;
    g.fillStyle = `rgb(${l},${l - 4},${l - 10})`; g.beginPath(); g.ellipse(x, y, w / 2, h / 2, R() * 3, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 3; g.stroke();
  }
});
TEX.tiles = canvasTex(512, (g, s) => {
  const n = 4, w = s / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const l = 120 + R() * 50 | 0; g.fillStyle = `rgb(${l},${l - 6},${l - 2})`; g.fillRect(i * w, j * w, w, w);
    for (let k = 0; k < 200; k++) { g.fillStyle = `rgba(0,0,0,${R() * 0.08})`; g.fillRect(i * w + R() * w, j * w + R() * w, 3, 3); }
    g.strokeStyle = 'rgba(20,18,22,.85)'; g.lineWidth = 6; g.strokeRect(i * w, j * w, w, w);
  }
});
TEX.moss = canvasTex(512, (g, s) => {
  g.fillStyle = '#5c6058'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 40; i++) { const l = 110 + R() * 50 | 0; g.fillStyle = `rgb(${l},${l},${l - 8})`; g.fillRect(R() * s, R() * s, 60 + R() * 120, 30 + R() * 50); }
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${60 + R() * 40 | 0},${120 + R() * 60 | 0},${40 + R() * 30 | 0},${0.3 + R() * 0.5})`; const r = 2 + R() * 8; g.beginPath(); g.arc(R() * s, R() * s, r, 0, 7); g.fill(); }
  for (let i = 0; i < 30; i++) { g.strokeStyle = 'rgba(20,20,20,.5)'; g.lineWidth = 3; g.beginPath(); const y = R() * s; g.moveTo(0, y); g.lineTo(s, y + R() * 20 - 10); g.stroke(); }
});
TEX.plaster = canvasTex(512, (g, s) => {
  g.fillStyle = '#ddd0ea'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 6000; i++) { const l = R() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${l},${l},${l},${R() * 0.06})`; g.fillRect(R() * s, R() * s, 2 + R() * 6, 2 + R() * 6); }
});
TEX.metal = canvasTex(256, (g, s) => {
  g.fillStyle = '#8a8c92'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 400; i++) { g.strokeStyle = `rgba(255,255,255,${R() * 0.08})`; g.beginPath(); const y = R() * s; g.moveTo(0, y); g.lineTo(s, y); g.stroke(); }
});
TEX.rug = canvasTex(512, (g, s) => {
  const cols = ['#5a1f4a', '#c9973a', '#2a3d7a', '#8a2a5a', '#e0c68a'];
  for (let i = 12; i > 0; i--) { g.fillStyle = cols[i % cols.length]; g.beginPath(); g.arc(s / 2, s / 2, i * s / 24, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(255,230,180,.5)'; g.lineWidth = 3;
  for (let a = 0; a < 16; a++) { g.beginPath(); g.moveTo(s / 2, s / 2); g.lineTo(s / 2 + Math.cos(a / 16 * 6.283) * s * .45, s / 2 + Math.sin(a / 16 * 6.283) * s * .45); g.stroke(); }
});
TEX.glow = canvasTex(128, (g, s) => {
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,.65)'); gr.addColorStop(0.5, 'rgba(255,255,255,.15)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
}, false);
TEX.smoke = canvasTex(128, (g, s) => {
  for (let i = 0; i < 14; i++) {
    const x = s / 2 + (R() - .5) * s * .4, y = s / 2 + (R() - .5) * s * .4, r = s * (.15 + R() * .2);
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }
}, false);
TEX.ring = canvasTex(128, (g, s) => {
  g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 10; g.beginPath(); g.arc(s / 2, s / 2, s * 0.4, 0, 7); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 22; g.beginPath(); g.arc(s / 2, s / 2, s * 0.4, 0, 7); g.stroke();
}, false);

// ---------------- mesh helpers ----------------
export function add(geo, mat, x = 0, y = 0, z = 0, parent, cast = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true;
  (parent || G.scene).add(m); return m;
}
export const glowMat = (color, intensity = 1.5, extra = {}) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4, ...extra });
export const basic = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
export function glowSprite(color, size, opacity = 0.7) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity }));
  s.scale.set(size, size, 1); return s;
}
export function blob(radius, detail, seed, c1, c2, rough = 0.45) {
  let g = new THREE.IcosahedronGeometry(radius, detail); g.deleteAttribute('uv'); g.deleteAttribute('normal'); g = mergeVertices(g);
  const p = g.attributes.position, v = V3(), cols = [], ca = new THREE.Color(c1), cb = new THREE.Color(c2), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = vnoise3(v.x * 1.6 + seed, v.y * 1.6 + seed * 2, v.z * 1.6) * 0.6 + vnoise3(v.x * 4 + seed, v.y * 4, v.z * 4) * 0.4;
    v.multiplyScalar(1 + (n - 0.5) * rough); p.setXYZ(i, v.x, v.y, v.z);
    const t = clamp(v.y / radius * 0.5 + 0.5, 0, 1); c.copy(ca).lerp(cb, t * 0.85 + n * 0.25); cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals(); return g;
}
export function trunkGeo(r0, r1, h, bend, seed, flare = 1.35) {
  const g = new THREE.CylinderGeometry(r1, r0, h, 12, 10); g.translate(0, h / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), t = y / h, n = 1 + (vnoise3(p.getX(i) * 3 + seed, y * 2, p.getZ(i) * 3) - 0.5) * 0.25;
    p.setX(i, p.getX(i) * n + Math.sin(t * 2.2 + seed) * bend * t); p.setZ(i, p.getZ(i) * n + Math.cos(t * 1.7 + seed) * bend * 0.5 * t);
    if (t < 0.08) { p.setX(i, p.getX(i) * flare); p.setZ(i, p.getZ(i) * flare); }
  }
  g.computeVertexNormals(); return g;
}
export const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
export const barkMat = new THREE.MeshStandardMaterial({ map: rep(TEX.bark, 2, 2), bumpMap: rep(TEX.bark, 2, 2), bumpScale: 2, roughness: 0.95 });

// wind-swaying instanced grass
export const windU = { value: 0 };
export function makeGrass(scene, { count, sample, h = [0.3, 0.7], hue = [0.2, 0.3], light = [0.3, 0.46] }) {
  const geo = new THREE.PlaneGeometry(0.08, 1, 1, 4); geo.translate(0, 0.5, 0);
  const p = geo.attributes.position, cols = [], nrm = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 - y * 0.92)); cols.push(lerp(0.35, 1.15, y), lerp(0.45, 1.1, y), lerp(0.3, 0.8, y)); nrm.setXYZ(i, 0, 1, 0); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = windU;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 wp0 = instanceMatrix * vec4(0.0,0.0,0.0,1.0); float k = position.y * position.y;
      float w = sin(uTime*1.6 + wp0.x*0.31 + wp0.z*0.23) * 0.6 + sin(uTime*2.7 + wp0.x*0.9 + wp0.z*0.5) * 0.25;
      transformed.x += w * k * 0.28; transformed.z += w * k * 0.12;`);
  };
  const im = new THREE.InstancedMesh(geo, mat, count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = V3(), pos = V3(), col = new THREE.Color(), e = new THREE.Euler();
  let k = 0, tries = 0;
  while (k < count && tries < count * 4) {
    tries++; const pt = sample(); if (!pt) continue;
    e.set(rand(-0.2, 0.2), rand(0, 6.28), rand(-0.2, 0.2)); q.setFromEuler(e);
    s.set(rand(0.8, 1.4), rand(h[0], h[1]), 1); pos.set(pt[0], pt[1] - 0.02, pt[2]);
    m4.compose(pos, q, s); im.setMatrixAt(k, m4); col.setHSL(rand(hue[0], hue[1]), rand(0.45, 0.65), rand(light[0], light[1])); im.setColorAt(k, col); k++;
  }
  im.count = k; im.receiveShadow = true; im.frustumCulled = false; scene.add(im); return im;
}
export function makeMotes(scene, N, sample, color, size) {
  const geo = new THREE.BufferGeometry(), base = [], p = [];
  for (let i = 0; i < N; i++) { const [x, y, z] = sample(); base.push({ x, y, z, ph: rand(0, 6), sp: rand(0.3, 0.9) }); p.push(x, y, z); }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const mat = new THREE.PointsMaterial({ color, size, map: TEX.glow, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  return { geo, base, mat, update(t, amp) { const pa = geo.attributes.position; for (let i = 0; i < base.length; i++) { const b = base[i]; pa.setXYZ(i, b.x + Math.sin(t * b.sp + b.ph) * amp, b.y + Math.sin(t * b.sp * 1.7 + b.ph) * amp * 0.35, b.z + Math.cos(t * b.sp * 0.8 + b.ph) * amp); } pa.needsUpdate = true; } };
}

// ---------------- sky ----------------
export function makeSky(scene, { zen, hor, sunDir, sunCol = new THREE.Color(1, 0.9, 0.7), cloud = 0.6, night = 0 }) {
  const u = { sunDir: { value: sunDir.clone().normalize() }, time: { value: 0 }, zen: { value: new THREE.Color(zen) }, hor: { value: new THREE.Color(hor) }, sunCol: { value: sunCol }, cloud: { value: cloud }, night: { value: night } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 48, 24), new THREE.ShaderMaterial({
    uniforms: u, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 sunDir, zen, hor, sunCol; uniform float time, cloud, night; varying vec3 vDir;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h2(i),h2(i+vec2(1,0)),f.x), mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*n2(p); p*=2.03; a*=.5; } return v; }
      void main(){ vec3 d = normalize(vDir); float h = d.y;
        vec3 col = mix(hor, zen, pow(clamp(h,0.,1.), 0.55)); col = mix(col, hor * 0.6, smoothstep(0.0, -0.25, h));
        float sd = max(dot(d, sunDir), 0.0);
        col += sunCol * (pow(sd, 6.0) * 0.35 + pow(sd, 60.0) * 0.6) * (1.0 - night);
        col += sunCol * smoothstep(0.9993, 0.9997, sd) * 16.0 * (1.0 - night);
        if (h > 0.0) {
          vec3 sp = floor(d * 260.0); float s = h3(sp);
          col += vec3(1.0) * step(0.9975, s) * (0.6 + 0.4 * sin(time * 3.0 + s * 60.0)) * night * 1.4;
          vec2 uv = d.xz / (h + 0.12) * 1.2 + vec2(time * 0.006, time * 0.002);
          float c = fbm(uv * 1.3); float cl = smoothstep(1.0 - cloud * 0.5, 1.12 - cloud * 0.3, c) * smoothstep(0.0, 0.18, h);
          vec3 cc = mix(vec3(0.95), sunCol, 0.25) * (0.9 + 0.2 * (1.0 - smoothstep(0.6, 0.95, c))) * (1.0 - night * 0.85);
          cc += sunCol * pow(sd, 8.0) * 0.5; col = mix(col, cc, cl * 0.9);
        }
        gl_FragColor = vec4(max(col, 0.0), 1.0); }`
  }));
  sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
  return { mesh: sky, u, update(t) { u.time.value = t; sky.position.copy(camera.position); } };
}

// ---------------- sound (procedural, Web Audio) ----------------
let actx = null, master = null;
export function initAudio() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  try { actx = new (window.AudioContext || window.webkitAudioContext)(); master = actx.createGain(); master.gain.value = 0.75; master.connect(actx.destination); } catch (e) {}
}
export function tone(f, dur, type = 'sine', vol = 0.1, f2 = null, delay = 0, filter = 0) {
  if (!actx) return;
  const t0 = actx.currentTime + delay, o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let node = o; if (filter) { const bq = actx.createBiquadFilter(); bq.type = 'lowpass'; bq.frequency.value = filter; o.connect(bq); node = bq; }
  node.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
}
export function noise(dur, vol = 0.1, freq = 1200, delay = 0, q = 0.8) {
  if (!actx) return;
  const t0 = actx.currentTime + delay, n = Math.max(1, actx.sampleRate * dur | 0), b = actx.createBuffer(1, n, actx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (R() * 2 - 1) * (1 - i / n);
  const s = actx.createBufferSource(); s.buffer = b; const bq = actx.createBiquadFilter(); bq.type = 'bandpass'; bq.frequency.value = freq; bq.Q.value = q;
  const g = actx.createGain(); g.gain.value = vol; s.connect(bq).connect(g).connect(master); s.start(t0);
}
export const sfx = {
  swing: (p = 1) => { noise(0.16, 0.09, 1800 * p, 0, 1.2); tone(320 * p, 0.12, 'sine', 0.03, 140); },
  swingHeavy: () => { noise(0.28, 0.13, 900, 0, 1); tone(140, 0.25, 'sawtooth', 0.04, 60, 0, 600); },
  hit: () => { noise(0.08, 0.14, 700); tone(160, 0.1, 'square', 0.05, 70, 0, 900); },
  hitHeavy: () => { noise(0.18, 0.2, 400); tone(90, 0.22, 'square', 0.08, 40, 0, 600); },
  draw: () => noise(0.25, 0.04, 900),
  bow: p => { tone(180 + p * 90, 0.22, 'triangle', 0.15, 70); noise(0.12, 0.07, 2500); },
  thunk: () => { tone(140, 0.12, 'square', 0.05, 60, 0, 900); noise(0.08, 0.07, 600); },
  pulse: () => { tone(880, 0.18, 'sine', 0.07, 1760); tone(440, 0.2, 'triangle', 0.04, 220); },
  pulseHit: () => { tone(1320, 0.12, 'sine', 0.06, 660); noise(0.1, 0.05, 3000); },
  dash: () => { noise(0.22, 0.1, 1400, 0, 0.6); tone(500, 0.18, 'sine', 0.04, 1200); },
  slide: () => noise(0.4, 0.07, 500, 0, 0.5),
  jump: () => tone(260, 0.12, 'sine', 0.04, 420),
  land: v => noise(0.1, Math.min(0.15, v * 0.012), 300),
  wallrun: () => noise(0.3, 0.05, 900, 0, 0.6),
  windup: () => { tone(500, 0.3, 'sawtooth', 0.04, 1100, 0, 1500); },
  growl: () => tone(rand(110, 150), 0.35, 'sawtooth', 0.05, 70, 0, 600),
  leap: () => { tone(200, 0.4, 'sawtooth', 0.05, 90, 0, 900); noise(0.3, 0.05, 700); },
  snare: () => { noise(0.4, 0.07, 400, 0, 2); tone(300, 0.3, 'triangle', 0.04, 150); },
  hurt: () => { tone(150, 0.25, 'sawtooth', 0.1, 60, 0, 800); noise(0.15, 0.06, 400); },
  die: () => { tone(260, 0.35, 'triangle', 0.06, 50); noise(0.3, 0.06, 500); },
  ring: () => tone(520, 0.16, 'sine', 0.05, 980),
  ringHit: () => { tone(780, 0.2, 'sine', 0.06, 390); noise(0.12, 0.04, 2400); },
  gem: () => { tone(1046, 0.12, 'sine', 0.05, 1568); tone(1568, 0.14, 'sine', 0.04, 2093, 0.06); },
  essence: () => tone(660, 0.15, 'sine', 0.04, 990),
  soul: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, 'triangle', 0.07, null, i * 0.1)),
  wave: () => { tone(110, 1.4, 'sawtooth', 0.07, 98, 0, 900); tone(165, 1.4, 'sawtooth', 0.05, 147, 0, 900); },
  cleared: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.07, null, i * 0.1)),
  pop: () => { tone(300, 0.35, 'sine', 0.12, 1200); noise(0.2, 0.05, 3000); },
  click: () => tone(900, 0.05, 'square', 0.03, 600, 0, 3000),
  portal: () => { tone(90, 1.2, 'sine', 0.12, 45); tone(180, 1.2, 'triangle', 0.04, 90, 0, 600); },
  chime: () => { tone(1568, 0.3, 'sine', 0.05, 1568); tone(2093, 0.3, 'sine', 0.03, 2093, 0.05); },
  step: () => noise(0.05, 0.025, 250 + R() * 150),
};
