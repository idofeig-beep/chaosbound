// =====================================================================
// CHAOSBOUND: enemies (models + combat AI), combat director, enemy projectiles,
// training dummies, and loot pickups.
// =====================================================================
import { THREE, G, V3, R, rand, clamp, lerp, damp, angDiff, smooth, TEX, rep, sfx, glowSprite, camera } from './core.js';
import { burst, flash, impactRing, groundWave, dmgNumber, teleCircle, teleLine, killFx, shake } from './fx.js';
import { ENEMIES } from './content.js';
import { P, shots, hurtPlayer, slowPlayer } from './player.js';

// ---------------- shared materials ----------------
const M = {
  skin: new THREE.MeshStandardMaterial({ color: 0x7cb342, roughness: 0.6 }),
  leather: new THREE.MeshStandardMaterial({ color: 0x6a4428, roughness: 0.85 }),
  cloth: new THREE.MeshStandardMaterial({ color: 0x3f6a2a, roughness: 0.95, side: THREE.DoubleSide }),
  rust: new THREE.MeshStandardMaterial({ color: 0x9a6a4a, metalness: 0.6, roughness: 0.55 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x2a1e14, roughness: 0.9 }),
  tooth: new THREE.MeshStandardMaterial({ color: 0xf5f0dc, roughness: 0.4 }),
  pink: new THREE.MeshStandardMaterial({ color: 0xd88a8a, roughness: 0.7 }),
  pupil: new THREE.MeshBasicMaterial({ color: 0x110800 }),
  bark: new THREE.MeshStandardMaterial({ color: 0x6a5238, map: rep(TEX.bark, 1, 2), roughness: 0.95 }),
  moss: new THREE.MeshStandardMaterial({ color: 0x4f8a2f, roughness: 1 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x5aa83a, roughness: 0.8, side: THREE.DoubleSide }),
  vine: new THREE.MeshStandardMaterial({ color: 0x3a7a2a, roughness: 0.9 }),
  straw: new THREE.MeshStandardMaterial({ color: 0xd8b86a, roughness: 1 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x7a5232, map: rep(TEX.plank, 0.5, 1), roughness: 0.9 }),
};
const hpBgGeo = new THREE.PlaneGeometry(1, 0.11), hpFgGeo = new THREE.PlaneGeometry(0.96, 0.07).translate(0.48, 0, 0);
const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.65, depthWrite: false });
const hpFgMat = new THREE.MeshBasicMaterial({ color: 0xff4a4a, depthWrite: false });
function add(geo, mat, x, y, z, parent) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; }

// ---------------- models ----------------
function buildRaider() {
  const skin = M.skin.clone(), g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const legs = [], arms = [];
  for (const sd of [-1, 1]) {
    const lp = new THREE.Group(); lp.position.set(sd * 0.14, 0.52, 0); body.add(lp);
    add(new THREE.CapsuleGeometry(0.085, 0.28, 4, 10), skin, 0, -0.22, 0, lp);
    add(new THREE.SphereGeometry(0.1, 12, 8), M.dark, 0, -0.47, 0.05, lp).scale.set(1, 0.6, 1.6);
    legs.push(lp);
  }
  add(new THREE.CapsuleGeometry(0.27, 0.3, 6, 14), M.leather, 0, 0.82, 0, body).scale.set(1, 1, 0.85);
  add(new THREE.TorusGeometry(0.26, 0.045, 8, 20), M.dark, 0, 0.66, 0, body).rotation.x = Math.PI / 2;
  const cloak = add(new THREE.ConeGeometry(0.42, 0.55, 10, 1, true), M.cloth, 0, 1.0, -0.04, body); cloak.rotation.x = 0.1;
  for (let i = 0; i < 6; i++) { const l = add(new THREE.PlaneGeometry(0.16, 0.26), M.leaf, Math.sin(i) * 0.3, 1.05 + (i % 2) * 0.05, -0.2 + Math.cos(i) * 0.12, body); l.rotation.set(0.6, i, 0.3); }
  const head = new THREE.Group(); head.position.set(0, 1.36, 0.02); body.add(head);
  add(new THREE.SphereGeometry(0.31, 20, 16), skin, 0, 0, 0, head).scale.set(1.08, 0.95, 1);
  add(new THREE.SphereGeometry(0.22, 16, 10, 0, 6.28, Math.PI / 2, Math.PI / 2), skin, 0, -0.08, 0.1, head).scale.set(1.1, 0.8, 1);
  add(new THREE.ConeGeometry(0.06, 0.24, 8).rotateX(Math.PI / 2), skin, 0, -0.02, 0.36, head);
  add(new THREE.BoxGeometry(0.36, 0.06, 0.1), skin, 0, 0.11, 0.25, head).rotation.x = -0.3;
  add(new THREE.TorusGeometry(0.29, 0.05, 6, 20), new THREE.MeshStandardMaterial({ color: 0xa82a2a, roughness: 0.9 }), 0, 0.14, 0, head).rotation.x = Math.PI / 2 - 0.2;
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffe14a, emissive: 0xffc020, emissiveIntensity: 1.6 });
  for (const sd of [-1, 1]) {
    add(new THREE.SphereGeometry(0.06, 12, 8), eyeMat, sd * 0.12, 0.05, 0.26, head);
    add(new THREE.SphereGeometry(0.025, 8, 6), M.pupil, sd * 0.12, 0.05, 0.315, head);
    const ear = new THREE.Group(); ear.position.set(sd * 0.3, 0.05, -0.02); ear.rotation.set(0, sd * 0.25, -sd * (Math.PI / 2 + 0.25)); head.add(ear);
    add(new THREE.ConeGeometry(0.1, 0.55, 10), skin, 0, 0.25, 0, ear).scale.z = 0.4;
    add(new THREE.ConeGeometry(0.06, 0.4, 8), M.pink, 0, 0.22, 0.03, ear).scale.z = 0.3;
    add(new THREE.ConeGeometry(0.022, 0.07, 5), M.tooth, sd * 0.07, -0.16, 0.24, head).rotation.x = Math.PI;
  }
  for (const sd of [-1, 1]) {
    const ap = new THREE.Group(); ap.position.set(sd * 0.36, 1.04, 0); body.add(ap);
    add(new THREE.CapsuleGeometry(0.07, 0.32, 4, 10), skin, 0, -0.2, 0, ap);
    add(new THREE.SphereGeometry(0.085, 10, 8), skin, 0, -0.42, 0, ap);
    arms.push(ap);
  }
  // rusty curved sword
  const wpn = new THREE.Group(); wpn.position.set(0, -0.44, 0.02); wpn.rotation.x = -1.35; arms[1].add(wpn);
  const blade = new THREE.BoxGeometry(0.08, 0.7, 0.02, 1, 8, 1); const bp = blade.attributes.position;
  for (let i = 0; i < bp.count; i++) { const y = bp.getY(i) + 0.35; bp.setZ(i, bp.getZ(i)); bp.setX(i, bp.getX(i) * (y > 0.6 ? (0.7 - y) * 10 : 1) + y * y * 0.18); }
  blade.computeVertexNormals();
  const glowMat = new THREE.MeshStandardMaterial({ color: 0x9a6a4a, metalness: 0.6, roughness: 0.5, emissive: 0xff3010, emissiveIntensity: 0 });
  add(blade, glowMat, 0, -0.42, 0, wpn);
  add(new THREE.BoxGeometry(0.2, 0.04, 0.05), M.dark, 0, -0.06, 0, wpn);
  add(new THREE.CylinderGeometry(0.022, 0.022, 0.14, 6), M.leather, 0, 0.02, 0, wpn);
  return { g, body, head, legs, arms, skin, weaponMat: glowMat, eyeMat };
}
function buildStalker() {
  const skin = M.bark.clone(), g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const legs = [], arms = [];
  for (const sd of [-1, 1]) {
    const lp = new THREE.Group(); lp.position.set(sd * 0.13, 0.62, 0); body.add(lp);
    add(new THREE.CapsuleGeometry(0.07, 0.42, 4, 8), skin, 0, -0.3, 0, lp);
    add(new THREE.ConeGeometry(0.09, 0.2, 6), M.dark, 0, -0.6, 0.06, lp).rotation.x = Math.PI / 2;
    legs.push(lp);
  }
  add(new THREE.CapsuleGeometry(0.2, 0.5, 6, 12), skin, 0, 1.0, 0, body).scale.set(1, 1, 0.75);
  for (let i = 0; i < 8; i++) { const m = add(new THREE.SphereGeometry(0.1, 8, 6), M.moss, Math.sin(i * 2) * 0.17, 0.8 + i * 0.07, Math.cos(i * 2) * 0.12, body); m.scale.y = 0.5; }
  const head = new THREE.Group(); head.position.set(0, 1.55, 0.03); body.add(head);
  add(new THREE.SphereGeometry(0.17, 16, 12), skin, 0, 0, 0, head).scale.set(0.9, 1.35, 1);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x9aff7a, emissive: 0x5aff3a, emissiveIntensity: 2 });
  for (const sd of [-1, 1]) add(new THREE.SphereGeometry(0.035, 8, 6), eyeMat, sd * 0.07, 0.04, 0.15, head).scale.set(1.4, 0.7, 1);
  for (let i = 0; i < 5; i++) { const l = add(new THREE.PlaneGeometry(0.12, 0.42), M.leaf, 0, 0.22, -0.05, head); l.rotation.set(-0.5 - i * 0.18, (i - 2) * 0.35, 0); l.position.set((i - 2) * 0.04, 0.2, -0.04); }
  for (const sd of [-1, 1]) {
    const ap = new THREE.Group(); ap.position.set(sd * 0.27, 1.25, 0); body.add(ap);
    add(new THREE.CapsuleGeometry(0.055, 0.5, 4, 8), skin, 0, -0.3, 0, ap);
    arms.push(ap);
  }
  // long vine spear held in both hands (attached to right arm)
  const wpn = new THREE.Group(); wpn.position.set(-0.12, -0.55, 0.05); wpn.rotation.x = -Math.PI / 2; arms[1].add(wpn);
  add(new THREE.CylinderGeometry(0.03, 0.035, 2.4, 8), M.wood, 0, 0.6, 0, wpn);
  for (let i = 0; i < 14; i++) { const t = add(new THREE.TorusGeometry(0.045, 0.012, 5, 10), M.vine, 0, -0.4 + i * 0.12, 0, wpn); t.rotation.set(Math.PI / 2 + 0.4, i, 0); }
  const glowMat = new THREE.MeshStandardMaterial({ color: 0x8aff6a, emissive: 0x3aff2a, emissiveIntensity: 0.2, roughness: 0.4 });
  const tip = add(new THREE.ConeGeometry(0.07, 0.4, 6), glowMat, 0, 1.98, 0, wpn); tip.scale.z = 0.35;
  g.scale.setScalar(1.35);
  return { g, body, head, legs, arms, skin, weaponMat: glowMat, eyeMat, spear: wpn };
}
function buildDummy(kind) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  add(new THREE.CylinderGeometry(0.07, 0.09, 1.2, 8), M.wood, 0, 0.6, 0, g);
  add(new THREE.CylinderGeometry(0.4, 0.5, 0.15, 12), M.wood, 0, 0.07, 0, g);
  add(new THREE.CapsuleGeometry(0.3, 0.55, 6, 12), M.straw, 0, 1.25, 0, body);
  add(new THREE.SphereGeometry(0.22, 14, 10), M.straw, 0, 1.92, 0, body);
  const t1 = add(new THREE.CircleGeometry(0.2, 24), new THREE.MeshStandardMaterial({ color: 0xffffff }), 0, 1.3, 0.31, body);
  add(new THREE.CircleGeometry(0.13, 24), new THREE.MeshStandardMaterial({ color: 0xd82a2a }), 0, 1.3, 0.315, body);
  add(new THREE.CircleGeometry(0.05, 16), new THREE.MeshStandardMaterial({ color: 0xffffff }), 0, 1.3, 0.32, body);
  add(new THREE.BoxGeometry(1.0, 0.07, 0.07), M.wood, 0, 1.55, 0, body);
  return { g, body, skin: M.straw.clone() };
}

// ---------------- director (attack tokens) ----------------
const tokens = new Set();
let maxTokens = 2;
function tryToken(e) { if (tokens.has(e)) return true; if (tokens.size < maxTokens) { tokens.add(e); return true; } return false; }
function releaseToken(e) { tokens.delete(e); }
export const eproj = [];
export const pickups = [];

// ---------------- enemy class ----------------
let uid = 0;
export class Enemy {
  constructor(type, pos, opts = {}) {
    this.id = ++uid; this.type = type; this.def = ENEMIES[type] || {};
    this.isDummy = ['dummy', 'dummy_move', 'target_air', 'turret'].includes(type);
    this.practice = !!opts.practice; this.home = pos.clone(); this.opts = opts;
    let parts;
    if (type === 'raider') { parts = buildRaider(); this.r = 0.42; this.h = 1.7; this.headOff = 0.52; this.headR = 0.3; }
    else if (type === 'vine_stalker') { parts = buildStalker(); this.r = 0.5; this.h = 2.65; this.headOff = 0.85; this.headR = 0.3; }
    else if (type === 'target_air') {
      const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
      const disc = add(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 28), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x3a8aff, emissiveIntensity: 0.6 }), 0, 0, 0, body); disc.rotation.x = Math.PI / 2;
      add(new THREE.CylinderGeometry(0.3, 0.3, 0.09, 24), new THREE.MeshStandardMaterial({ color: 0xd82a2a }), 0, 0, 0, body).rotation.x = Math.PI / 2;
      body.add(glowSprite(0x6ab0ff, 1.8, 0.5));
      parts = { g, body, skin: new THREE.MeshStandardMaterial() }; this.r = 0.5; this.h = 1.0; this.headOff = 0; this.headR = 0.25;
    } else if (type === 'turret') {
      const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
      add(new THREE.CylinderGeometry(0.5, 0.65, 1.1, 10), new THREE.MeshStandardMaterial({ map: rep(TEX.stone, 1, 1), roughness: 1 }), 0, 0.55, 0, g);
      const cr = add(new THREE.OctahedronGeometry(0.32, 0), new THREE.MeshStandardMaterial({ color: 0xff6a6a, emissive: 0xff3030, emissiveIntensity: 1.6 }), 0, 1.6, 0, body); cr.scale.y = 1.5;
      this.crystal = cr; parts = { g, body, skin: new THREE.MeshStandardMaterial() }; this.r = 0.6; this.h = 2; this.headOff = 0.6; this.headR = 0.3;
    } else { parts = buildDummy(type); this.r = 0.45; this.h = 2.1; this.headOff = 0.85; this.headR = 0.25; }
    Object.assign(this, parts);
    this.pos = this.g.position; this.pos.copy(pos); G.scene.add(this.g);
    this.vel = V3(); this.vy = 0; this.knock = V3(); this.airborne = false;
    this.maxHp = this.def.hp || 1e9; this.hp = this.maxHp; this.dead = false; this.deathT = 0;
    this.state = this.isDummy ? 'idle' : 'spawn'; this.stT = this.isDummy ? 0 : 0.9;
    this.atkCd = rand(0.6, 1.6); this.leapCd = rand(2.5, 4.5); this.dodgeCd = rand(1, 3); this.snareCd = rand(3, 6);
    this.side = R() < 0.5 ? -1 : 1; this.sideT = rand(2, 4); this.phase = rand(0, 6); this.flash = 0; this.flinch = 0; this.wobble = 0; this.wobbleV = 0;
    this.yaw = Math.atan2(P.pos.x - pos.x, P.pos.z - pos.z); this.g.rotation.y = this.yaw;
    if (!this.isDummy) {
      this.bar = new THREE.Group(); this.bar.add(new THREE.Mesh(hpBgGeo, hpBgMat));
      this.fg = new THREE.Mesh(hpFgGeo, hpFgMat); this.fg.position.set(-0.48, 0, 0.001); this.bar.add(this.fg); this.bar.visible = false; G.scene.add(this.bar);
      if (!this.practice) { this.pos.y = G.world.groundAt(pos.x, pos.z) - this.h * 0.8; burst(V3(pos.x, G.world.groundAt(pos.x, pos.z) + 0.3, pos.z), 0x5a9a3a, 14, 4, 0.8); }
      else this.state = 'chase';
    }
    if (type === 'turret') this.fireT = 2;
    if (type === 'target_air') { this.baseY = pos.y; this.downT = 0; }
    if (type === 'dummy_move') { this.railA = opts.a; this.railB = opts.b; this.railT = 0; }
    G.enemies.push(this);
  }
  center() { return V3(this.pos.x, this.pos.y + this.h * 0.5, this.pos.z); }
  setState(s, t = 0) {
    if (this.tele && s !== 'windup' && s !== 'thrustPrep' && s !== 'leapPrep') { killFx(this.tele); this.tele = null; }
    this.state = s; this.stT = t; this.didHit = false;
  }
  remove() { this.g.parent && this.g.parent.remove(this.g); if (this.bar) this.bar.parent && this.bar.parent.remove(this.bar); if (this.tele) killFx(this.tele); releaseToken(this); }
}
export function spawnEnemy(type, pos, opts) { return new Enemy(type, pos, opts); }
export function clearEnemies() {
  for (const e of G.enemies) e.remove(); G.enemies.length = 0; tokens.clear();
  for (const p of eproj) p.m.parent && p.m.parent.remove(p.m); eproj.length = 0;
  for (const p of pickups) p.m.parent && p.m.parent.remove(p.m); pickups.length = 0;
}
export function setMaxTokens(n) { maxTokens = n; }

// ---------------- damage ----------------
export function damageEnemy(e, amt, o = {}) {
  if (e.dead) return;
  const c = e.center();
  if (e.isDummy) {
    e.wobbleV += (o.heavy ? 8 : 4) * (R() < 0.5 ? 1 : -1); e.flash = 0.1;
    dmgNumber(c.add(V3(0, e.h * 0.5, 0)), amt, o.crit ? '#ffd24a' : o.src === 'spell' ? '#c0b0ff' : '#ffffff', o.crit);
    G.combo.count++; G.combo.t = 1.6; G.dmgLog.push({ t: G.time, amt });
    if (e.type === 'target_air') { e.downT = 3; sfx.chime(); burst(e.pos, 0x6ab0ff, 14, 5, 0.6, 3); }
    return;
  }
  e.hp -= amt; e.flash = 0.12; e.flinch = 0.18;
  dmgNumber(c.clone().add(V3(0, e.h * 0.5, 0)), amt, o.crit ? '#ffd24a' : o.src === 'spell' ? '#c0b0ff' : '#ffffff', o.crit || o.heavy);
  G.combo.count++; G.combo.t = 1.6;
  if (o.dir && o.knock) e.knock.add(V3(o.dir.x, 0, o.dir.z).normalize().multiplyScalar(o.knock * (e.type === 'vine_stalker' ? 0.6 : 1)));
  if (o.launch) { e.vy = e.type === 'vine_stalker' ? o.launch * 0.6 : o.launch; e.airborne = true; e.setState('air', 0); e.juggleT = 0.7; releaseToken(e); }
  else if (o.juggle && e.airborne) { e.vy = Math.max(e.vy, 3.8); e.juggleT = 0.55; }
  else if (o.stagger || ((e.state === 'windup' || e.state === 'thrustPrep' || e.state === 'snarePrep') && (o.heavy || R() < 0.35))) { e.setState('stagger', o.stagger ? 0.75 : 0.4); releaseToken(e); }
  if (o.src === 'spell' && G.addMastery) G.addMastery(1);
  if (e.hp <= 0) killEnemy(e, o);
}
function killEnemy(e, o) {
  e.dead = true; e.deathT = 1.5; releaseToken(e); if (e.tele) { killFx(e.tele); e.tele = null; }
  if (e.bar) e.bar.visible = false;
  const c = e.center(); burst(c, e.type === 'vine_stalker' ? 0x6a9a3a : 0x7cb342, 16, 4.5, 0.8); flash(c, 0xffffff, 2, 0.1); sfx.die(); shake(0.08);
  if (e.practice) { setTimeout(() => { if (G.mode === 'lab' && G.level && G.level.respawnPractice) G.level.respawnPractice(); }, 3000); return; }
  if (G.onKill) G.onKill(e);
}

// ---------------- pickups ----------------
const gemGeo = new THREE.OctahedronGeometry(0.15, 0);
export function spawnPickup(kind, pos, data = {}) {
  let m;
  if (kind === 'gem') { m = new THREE.Mesh(gemGeo, new THREE.MeshStandardMaterial({ color: 0x7af0ff, emissive: 0x30b8ff, emissiveIntensity: 1.8, roughness: 0.15 })); m.scale.y = 1.6; m.add(glowSprite(0x60d0ff, 0.8, 0.8)); }
  else if (kind === 'essence') { m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.8, 2.4) })); m.add(glowSprite(0xb070ff, 0.9, 0.8)); }
  else { m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(data.color || '#ffffff').multiplyScalar(2) })); m.add(glowSprite(data.color || 0xffffff, 3, 0.9)); }
  m.position.copy(pos); G.scene.add(m);
  pickups.push({ kind, data, m, v: V3(rand(-2.5, 2.5), rand(4, 6), rand(-2.5, 2.5)), t: 0 });
}
function updatePickups(dt) {
  const pc = V3(P.pos.x, P.pos.y + 0.9, P.pos.z);
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i], m = p.m; p.t += dt; m.rotation.y += dt * 3;
    const to = pc.clone().sub(m.position), d = to.length();
    if (p.t > 0.6 && (d < 9 || p.t > 2.5) && !P.dead) {
      p.v.lerp(to.normalize().multiplyScalar(14 + p.t * 4), damp(5, dt)); m.position.addScaledVector(p.v, dt);
    } else {
      p.v.y -= 14 * dt; m.position.addScaledVector(p.v, dt);
      const gy = G.world.groundAt(m.position.x, m.position.z, m.position.y) + 0.3;
      if (m.position.y < gy) { m.position.y = gy; p.v.multiplyScalar(0.3); p.v.y = Math.abs(p.v.y) * 0.3; }
    }
    if (d < 0.8 && p.t > 0.6) { m.parent && m.parent.remove(m); pickups.splice(i, 1); if (G.onPickup) G.onPickup(p.kind, p.data); }
  }
}

// ---------------- enemy projectiles ----------------
function fireEnemyProj(kind, from, target, speed, opts = {}) {
  const dir = target.clone().sub(from).normalize();
  let m;
  if (kind === 'snare') {
    m = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.2, 0.5) }));
    m.add(core, glowSprite(0x6aff4a, 1.2, 0.8));
    for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 5, 12), M.vine); t.rotation.set(i, i * 2, 0); m.add(t); }
  } else {
    m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.6, 0.5) })); m.add(glowSprite(0xff5a4a, 1.4, 0.8));
  }
  m.position.copy(from); G.scene.add(m);
  eproj.push({ kind, m, vel: dir.multiplyScalar(speed), life: 3, ...opts });
}
function updateEnemyProj(dt) {
  const pc = V3(P.pos.x, P.pos.y + (P.sliding ? 0.5 : 0.9), P.pos.z);
  for (let i = eproj.length - 1; i >= 0; i--) {
    const p = eproj[i]; p.life -= dt; p.m.position.addScaledVector(p.vel, dt); p.m.rotation.x += dt * 6; p.m.rotation.y += dt * 4;
    let done = p.life <= 0;
    if (!done && p.m.position.distanceTo(pc) < 0.65 && !P.dead) {
      if (P.iframe <= 0) {
        if (p.kind === 'snare') { slowPlayer(1.6); hurtPlayer(4, p.m.position); G.snaredT = 1.6; sfx.snare(); burst(p.m.position, 0x5aff3a, 12, 3, 0.6); }
        else { hurtPlayer(p.dmg || 4, p.m.position); burst(p.m.position, 0xff5a4a, 10, 3, 0.5); }
      }
      done = true;
    }
    if (!done && G.world.solid(p.m.position)) { burst(p.m.position, p.kind === 'snare' ? 0x5aff3a : 0xff5a4a, 8, 2.5, 0.4); done = true; }
    if (done) { p.m.parent && p.m.parent.remove(p.m); eproj.splice(i, 1); }
  }
}

// ---------------- AI helpers ----------------
function toPlayer(e) { const v = V3(P.pos.x - e.pos.x, 0, P.pos.z - e.pos.z); const d = v.length(); return { v, d, dir: d > 0.001 ? v.clone().divideScalar(d) : V3(0, 0, 1) }; }
function faceToward(e, x, z, rate, dt) { const want = Math.atan2(x - e.pos.x, z - e.pos.z); e.yaw += clamp(angDiff(e.yaw, want), -rate * dt, rate * dt); }
function steer(e, goal, speed, dt) {
  const d = V3(goal.x - e.pos.x, 0, goal.z - e.pos.z), L = d.length();
  const want = L > 0.15 ? d.multiplyScalar(Math.min(speed, L * 4) / L) : V3();
  // separation from other enemies so they spread out (flanking emerges from this + orbit offsets)
  for (const o of G.enemies) {
    if (o === e || o.dead || o.isDummy) continue;
    const dx = e.pos.x - o.pos.x, dz = e.pos.z - o.pos.z, dd = Math.hypot(dx, dz), m = e.r + o.r + 0.9;
    if (dd < m && dd > 0.001) { want.x += dx / dd * (m - dd) * 6; want.z += dz / dd * (m - dd) * 6; }
  }
  if (e.blockedT > 0) { const t = V3(-want.z, 0, want.x).multiplyScalar(e.side); want.lerp(t, 0.7); }
  e.vel.x = lerp(e.vel.x, want.x, damp(10, dt)); e.vel.z = lerp(e.vel.z, want.z, damp(10, dt));
}
function retreating(dirToPlayer) { return P.vel.x * dirToPlayer.x + P.vel.z * dirToPlayer.z > 4.5; }
function threatenedByShot(e) {
  const c = e.center();
  for (const s of shots) {
    if (s.stuck > 0) continue;
    const v = s.vel.clone(), sp = v.length(); if (sp < 1) continue; v.divideScalar(sp);
    const rel = c.clone().sub(s.pos), along = rel.dot(v);
    if (along <= 0 || along > sp * 0.35) continue;
    if (rel.addScaledVector(v, -along).length() < 1.1) return v;
  }
  return null;
}
function predicted(t) { return V3(P.pos.x + P.vel.x * t, P.pos.y, P.pos.z + P.vel.z * t); }
function inCone(e, range, deg) {
  const tp = toPlayer(e); if (tp.d > range) return false;
  const f = V3(Math.sin(e.yaw), 0, Math.cos(e.yaw));
  return f.dot(tp.dir) > Math.cos(deg * Math.PI / 180) && Math.abs(P.pos.y - e.pos.y) < 2.2;
}
function startLeap(e, target, dur, prep) {
  const tp = V3(target.x - e.pos.x, 0, target.z - e.pos.z); const L = tp.length(); if (L > 12) tp.multiplyScalar(12 / L);
  e.leapFrom = e.pos.clone(); e.leapTo = e.pos.clone().add(tp); e.leapTo.y = G.world.groundAt(e.leapTo.x, e.leapTo.z, e.pos.y + 3);
  e.leapDur = dur; e.setState('leapPrep', prep); e.tele = teleCircle(e.leapTo, 1.9, prep + dur, 0xff4020);
}

// ---------------- AI: Raider ----------------
function aiRaider(e, dt) {
  const tp = toPlayer(e), def = e.def, aggressive = !e.practice || G.practiceMode === 'fight';
  const dmg = e.practice ? 3 : def.dmg;
  switch (e.state) {
    case 'chase': {
      if (!aggressive) { steer(e, e.home, 2, dt); faceToward(e, P.pos.x, P.pos.z, 6, dt); break; }
      if (P.dead) { steer(e, e.pos, 0, dt); break; }
      let has = tokens.has(e);
      if (!has && tp.d < 5 && e.atkCd <= 0) has = tryToken(e);
      let goal;
      if (has) {
        goal = predicted(0.3);
        if (tp.d < 2.0) { e.setState('windup', 0.42); e.strikeN = 1; sfx.windup(); break; }
      } else {
        e.sideT -= dt; if (e.sideT <= 0) { e.sideT = rand(2, 4); if (R() < 0.4) e.side *= -1; }
        const ang = Math.atan2(e.pos.x - P.pos.x, e.pos.z - P.pos.z) + e.side * 0.55;
        const rr = tp.d > 7 ? 2.5 : 3.8;
        goal = V3(P.pos.x + Math.sin(ang) * rr, 0, P.pos.z + Math.cos(ang) * rr);
      }
      steer(e, goal, def.speed, dt);
      faceToward(e, P.pos.x, P.pos.z, 9, dt);
      if (e.leapCd <= 0 && tp.d > 5 && tp.d < 12 && (retreating(tp.dir) || R() < dt * 0.25)) { startLeap(e, predicted(0.55), 0.6, 0.38); sfx.growl(); break; }
      const threat = e.dodgeCd <= 0 && threatenedByShot(e);
      if (threat && R() < 0.4) { e.dodgeCd = 2.5; e.dodgeDir = V3(-threat.z, 0, threat.x).multiplyScalar(R() < 0.5 ? 1 : -1); e.setState('dodge', 0.28); }
      else if (threat) e.dodgeCd = 1.2;
      break;
    }
    case 'windup': faceToward(e, P.pos.x, P.pos.z, 10, dt); steer(e, e.pos, 0, dt); if (e.stT <= 0) e.setState('strike', 0.14); break;
    case 'strike': {
      const f = V3(Math.sin(e.yaw), 0, Math.cos(e.yaw)); e.vel.x = f.x * 3.5; e.vel.z = f.z * 3.5;
      if (!e.didHit) { e.didHit = true; if (inCone(e, 2.3, 75) && !P.dead) hurtPlayer(dmg, e.pos); sfx.swing(0.8); }
      if (e.stT <= 0) { if (e.strikeN === 1) { e.strikeN = 2; e.setState('gap', 0.22); } else e.setState('recover', 0.75); }
      break;
    }
    case 'gap': faceToward(e, P.pos.x, P.pos.z, 5, dt); steer(e, predicted(0.2), 3, dt); if (e.stT <= 0) e.setState('strike', 0.14); break;
    case 'recover': steer(e, e.pos, 0, dt); faceToward(e, P.pos.x, P.pos.z, 2, dt); if (e.stT <= 0) { releaseToken(e); e.atkCd = rand(1.0, 1.8); e.setState('chase'); } break;
    case 'leapPrep': steer(e, e.pos, 0, dt); faceToward(e, e.leapTo.x, e.leapTo.z, 10, dt); if (e.stT <= 0) { e.setState('leap', e.leapDur); sfx.leap(); } break;
    case 'leap': {
      const k = 1 - e.stT / e.leapDur;
      e.pos.x = lerp(e.leapFrom.x, e.leapTo.x, k); e.pos.z = lerp(e.leapFrom.z, e.leapTo.z, k);
      e.pos.y = lerp(e.leapFrom.y, e.leapTo.y, k) + Math.sin(Math.PI * k) * 2.6; e.vel.set(0, 0, 0);
      if (e.stT <= 0) {
        groundWave(e.pos, 0xff7040, 2, 0.3); shake(0.06);
        if (Math.hypot(P.pos.x - e.pos.x, P.pos.z - e.pos.z) < 1.9 && Math.abs(P.pos.y - e.pos.y) < 1.5) hurtPlayer(e.practice ? 4 : 11, e.pos);
        e.leapCd = rand(4.5, 6.5); e.setState('recover', 0.6);
      }
      break;
    }
    case 'dodge': e.vel.x = e.dodgeDir.x * 9; e.vel.z = e.dodgeDir.z * 9; if (e.stT <= 0) e.setState('chase'); break;
  }
}

// ---------------- AI: Vine Stalker ----------------
function segDist(p, a, b) { const ab = b.clone().sub(a), t = clamp(p.clone().sub(a).dot(ab) / Math.max(1e-6, ab.lengthSq()), 0, 1); return p.distanceTo(a.clone().addScaledVector(ab, t)); }
function aiStalker(e, dt) {
  const tp = toPlayer(e), def = e.def;
  switch (e.state) {
    case 'chase': {
      if (P.dead) { steer(e, e.pos, 0, dt); break; }
      e.sideT -= dt; if (e.sideT <= 0) { e.sideT = rand(1.5, 3); if (R() < 0.5) e.side *= -1; }
      const desired = tp.d < 3.4 ? 7 : 6;
      const ang = Math.atan2(e.pos.x - P.pos.x, e.pos.z - P.pos.z) + e.side * 0.35;
      steer(e, V3(P.pos.x + Math.sin(ang) * desired, 0, P.pos.z + Math.cos(ang) * desired), def.speed, dt);
      faceToward(e, P.pos.x, P.pos.z, 6, dt);
      // long thrust (needs an attack token)
      if (tp.d > 2.5 && tp.d < 7 && e.atkCd <= 0 && tryToken(e)) {
        const tgt = predicted(0.35); e.thrustDir = V3(tgt.x - e.pos.x, 0, tgt.z - e.pos.z).normalize();
        e.setState('thrustPrep', 0.6); e.tele = teleLine(e.pos, e.thrustDir, 7.5, 1.3, 0.6 + 0.22, 0xff4020); sfx.windup(); break;
      }
      // interception leap when the player runs away
      if (e.leapCd <= 0 && tp.d > 8 && P.speedH > 7 && retreating(tp.dir)) { startLeap(e, predicted(1.0), 0.55, 0.3); sfx.growl(); break; }
      // vine snare
      const eye = e.center(); eye.y += 0.5;
      if (e.snareCd <= 0 && tp.d > 5.5 && tp.d < 19 && G.world.los(eye, V3(P.pos.x, P.pos.y + 1, P.pos.z))) { e.setState('snarePrep', 0.55); sfx.windup(); break; }
      const threat = e.dodgeCd <= 0 && threatenedByShot(e);
      if (threat && R() < 0.5) { e.dodgeCd = 3; const side = V3(-threat.z, 0, threat.x).multiplyScalar(R() < 0.5 ? 3 : -3); startLeap(e, e.pos.clone().add(side), 0.4, 0.05); }
      else if (threat) e.dodgeCd = 1.5;
      break;
    }
    case 'thrustPrep': steer(e, e.pos, 0, dt); e.yaw += clamp(angDiff(e.yaw, Math.atan2(e.thrustDir.x, e.thrustDir.z)), -12 * dt, 12 * dt); if (e.stT <= 0) { e.thrustFrom = e.pos.clone(); e.setState('thrust', 0.22); sfx.swingHeavy(); } break;
    case 'thrust': {
      e.vel.x = e.thrustDir.x * 22; e.vel.z = e.thrustDir.z * 22;
      const tip = e.pos.clone().addScaledVector(e.thrustDir, 2.4); tip.y += 1.2;
      const pc = V3(P.pos.x, P.pos.y + 1.2, P.pos.z);
      if (!e.didHit && !P.sliding && segDist(pc, V3(e.thrustFrom.x, e.pos.y + 1.2, e.thrustFrom.z), tip) < 0.95) { e.didHit = true; if (hurtPlayer(e.def.dmg, e.pos)) { P.vel.addScaledVector(e.thrustDir, 6); } }
      if (e.stT <= 0) { e.vel.multiplyScalar(0.2); e.setState('recover', 0.85); }
      break;
    }
    case 'recover': steer(e, e.pos, 0, dt); if (e.stT <= 0) { releaseToken(e); e.atkCd = rand(1.4, 2.4); e.setState('chase'); } break;
    case 'snarePrep': {
      steer(e, e.pos, 0, dt); faceToward(e, P.pos.x, P.pos.z, 8, dt);
      if (e.stT <= 0) {
        const from = e.center(); from.y += 0.4;
        // lead the target: solve time to reach the predicted point
        let t = from.distanceTo(P.pos) / 17; const aim = predicted(t * 0.85); aim.y += 0.9;
        fireEnemyProj('snare', from, aim, 17); sfx.snare(); e.snareCd = rand(6, 8); e.setState('chase');
      }
      break;
    }
    case 'leapPrep': steer(e, e.pos, 0, dt); if (e.stT <= 0) { e.setState('leap', e.leapDur); sfx.leap(); } break;
    case 'leap': {
      const k = 1 - e.stT / e.leapDur;
      e.pos.x = lerp(e.leapFrom.x, e.leapTo.x, k); e.pos.z = lerp(e.leapFrom.z, e.leapTo.z, k);
      e.pos.y = lerp(e.leapFrom.y, e.leapTo.y, k) + Math.sin(Math.PI * k) * 2.2; e.vel.set(0, 0, 0);
      if (e.stT <= 0) { e.leapCd = rand(5, 7); e.setState('chase'); groundWave(e.pos, 0x7aff5a, 1.8, 0.3); }
      break;
    }
  }
}

// ---------------- dummies ----------------
function updateDummy(e, dt) {
  e.wobbleV += -e.wobble * 60 * dt; e.wobbleV *= Math.exp(-5 * dt); e.wobble += e.wobbleV * dt;
  e.body.rotation.z = e.wobble * 0.05;
  if (e.type === 'dummy_move') {
    e.railT += dt * 0.35; const k = (Math.sin(e.railT * Math.PI) + 1) / 2;
    e.pos.lerpVectors(e.railA, e.railB, k);
  } else if (e.type === 'target_air') {
    if (e.downT > 0) { e.dead = true; e.downT -= dt; e.body.rotation.y += dt * 20; e.body.scale.setScalar(Math.max(0.01, 1 - (3 - e.downT) * 2)); if (e.downT <= 0) { e.body.scale.setScalar(1); e.body.rotation.y = 0; e.dead = false; } }
    e.pos.y = e.baseY + Math.sin(G.time * 1.3 + e.id) * 0.5; e.g.rotation.y = Math.atan2(P.pos.x - e.pos.x, P.pos.z - e.pos.z);
  } else if (e.type === 'turret') {
    e.crystal.rotation.y += dt * 2;
    const inArena = G.level && G.level.inArena && G.level.inArena(P.pos);
    if (inArena && !P.dead) {
      e.fireT -= dt;
      e.crystal.material.emissiveIntensity = 1.6 + (e.fireT < 0.6 ? (0.6 - e.fireT) * 5 : 0);
      if (e.fireT <= 0) { e.fireT = 2.6; const from = e.pos.clone(); from.y += 1.6; const aim = V3(P.pos.x, P.pos.y + 0.9, P.pos.z); fireEnemyProj('orb', from, aim, 9, { dmg: 4 }); sfx.ring(); }
    }
  } else e.g.rotation.y = lerp(e.g.rotation.y, Math.atan2(P.pos.x - e.pos.x, P.pos.z - e.pos.z), damp(1, dt));
  e.flash = Math.max(0, e.flash - dt);
}

// ---------------- animation ----------------
function animate(e, dt) {
  const sp = Math.hypot(e.vel.x, e.vel.z), moving = sp > 0.6 && !['leap', 'air'].includes(e.state);
  if (moving) e.phase += dt * sp * 2.6;
  const sw = moving ? Math.sin(e.phase) * Math.min(0.85, sp * 0.15) : 0;
  e.legs[0].rotation.x = sw; e.legs[1].rotation.x = -sw;
  e.body.position.y = moving ? Math.abs(Math.sin(e.phase)) * 0.06 : Math.sin(G.time * 2.2 + e.id) * 0.012;
  e.body.rotation.z = moving ? Math.sin(e.phase) * 0.05 : 0;
  e.flinch = Math.max(0, e.flinch - dt);
  let lean = -e.flinch * 1.4;
  let armR = sw * 0.6, armL = -sw * 0.7;
  const isR = e.type === 'raider';
  switch (e.state) {
    case 'windup': armR = lerp(e.arms[1].rotation.x, -2.6, damp(14, dt)); lean += 0.1; e.weaponMat.emissiveIntensity = lerp(e.weaponMat.emissiveIntensity, 2.5, damp(10, dt)); break;
    case 'strike': armR = -0.3; lean += 0.25; break;
    case 'gap': armR = -2.0; break;
    case 'leapPrep': lean += 0.4; armR = -2.2; e.body.position.y = -0.15; break;
    case 'leap': armR = -2.8; armL = -2.2; e.legs[0].rotation.x = -0.8; e.legs[1].rotation.x = 0.4; break;
    case 'thrustPrep': armR = 0.6; armL = 0.4; lean -= 0.15; e.weaponMat.emissiveIntensity = lerp(e.weaponMat.emissiveIntensity, 4, damp(10, dt)); break;
    case 'thrust': armR = -1.0; armL = -1.0; lean += 0.35; break;
    case 'snarePrep': armL = -2.4; e.eyeMat.emissiveIntensity = 5; break;
    case 'stagger': lean -= 0.35; armR = 0.5; armL = 0.5; break;
    case 'air': lean -= 0.6; armR = -2.5; armL = -2.5; break;
    case 'spawn': lean = 0.4; break;
  }
  if (!['windup', 'thrustPrep'].includes(e.state)) e.weaponMat.emissiveIntensity = lerp(e.weaponMat.emissiveIntensity, isR ? 0 : 0.2, damp(6, dt));
  if (e.state !== 'snarePrep') e.eyeMat.emissiveIntensity = lerp(e.eyeMat.emissiveIntensity, 1.8, damp(6, dt));
  if (e.type === 'vine_stalker' && !['thrustPrep', 'thrust'].includes(e.state)) { armR = Math.min(armR, -0.2); armL = Math.min(armL, -0.3); }
  e.arms[1].rotation.x = armR; e.arms[0].rotation.x = armL;
  e.body.rotation.x = lean;
  e.head.rotation.y = Math.sin(G.time * 0.9 + e.id) * 0.2;
  e.flash = Math.max(0, e.flash - dt);
  e.skin.emissive.setRGB(e.flash > 0 ? 0.9 : 0, e.flash > 0 ? 0.15 : 0, e.flash > 0 ? 0.1 : 0);
}

// ---------------- main update ----------------
export function updateEnemies(dt) {
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    if (e.isDummy) { updateDummy(e, dt); continue; }
    if (e.dead) {
      e.deathT -= dt;
      e.body.rotation.x = lerp(e.body.rotation.x, -Math.PI / 2, damp(9, dt)); e.body.position.y = lerp(e.body.position.y, 0.15, damp(9, dt));
      if (e.deathT < 0.7) e.pos.y -= dt * 1.1;
      if (e.deathT <= 0) { e.remove(); G.enemies.splice(i, 1); }
      continue;
    }
    e.stT -= dt; e.atkCd -= dt; e.leapCd -= dt; e.dodgeCd -= dt; e.snareCd -= dt; e.blockedT = (e.blockedT || 0) - dt;
    // spawning: rise out of the ground
    if (e.state === 'spawn') {
      const gy = G.world.groundAt(e.pos.x, e.pos.z);
      e.pos.y = lerp(e.pos.y, gy, damp(5, dt)); faceToward(e, P.pos.x, P.pos.z, 4, dt);
      if (e.stT <= 0) { e.pos.y = gy; e.setState('chase'); sfx.growl(); }
      e.g.rotation.y = e.yaw; animate(e, dt); continue;
    }
    // airborne (launched / juggled)
    if (e.state === 'air') {
      e.juggleT -= dt; e.vy -= (e.juggleT > 0 ? 9 : 22) * dt; e.pos.y += e.vy * dt;
      e.pos.x += e.knock.x * dt; e.pos.z += e.knock.z * dt; e.knock.multiplyScalar(Math.exp(-3 * dt));
      G.world.collide(e.pos, e.r, e.h);
      const gy = G.world.groundAt(e.pos.x, e.pos.z, e.pos.y);
      if (e.pos.y <= gy && e.vy <= 0) { e.pos.y = gy; e.airborne = false; e.setState('stagger', 0.45); burst(e.pos, 0x8a7a5a, 6, 2, 0.4); }
      e.g.rotation.y = e.yaw; animate(e, dt); updateBar(e); continue;
    }
    if (e.state === 'stagger') { steer(e, e.pos, 0, dt); if (e.stT <= 0) e.setState('chase'); }
    else if (e.type === 'raider') aiRaider(e, dt);
    else if (e.type === 'vine_stalker') aiStalker(e, dt);
    // integrate (leap moves position directly)
    if (e.state !== 'leap') {
      const px = e.pos.x, pz = e.pos.z;
      e.pos.x += (e.vel.x + e.knock.x) * dt; e.pos.z += (e.vel.z + e.knock.z) * dt;
      e.knock.multiplyScalar(Math.exp(-7 * dt));
      // keep a little personal space from the player (no walking through you)
      { const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, dd = Math.hypot(dx, dz), m = e.r + 0.5; if (dd < m && dd > 0.001 && Math.abs(e.pos.y - P.pos.y) < 1.6) { e.pos.x = P.pos.x + dx / dd * m; e.pos.z = P.pos.z + dz / dd * m; } }
      const wall = G.world.collide(e.pos, e.r, e.h);
      if (wall && Math.hypot(e.vel.x, e.vel.z) > 1 && Math.hypot(e.pos.x - px, e.pos.z - pz) < Math.hypot(e.vel.x, e.vel.z) * dt * 0.4) e.blockedT = 0.6;
      const gy = G.world.groundAt(e.pos.x, e.pos.z, e.pos.y);
      if (e.pos.y > gy + 0.05) { e.vy -= 22 * dt; e.pos.y = Math.max(gy, e.pos.y + e.vy * dt); } else { e.pos.y = gy; e.vy = 0; }
    }
    e.g.rotation.y = e.yaw; animate(e, dt); updateBar(e);
  }
  updateEnemyProj(dt); updatePickups(dt);
  G.combo.t -= dt; if (G.combo.t <= 0) G.combo.count = 0;
}
function updateBar(e) {
  if (!e.bar) return;
  e.bar.visible = e.hp < e.maxHp && !e.dead;
  if (e.bar.visible) { e.bar.position.set(e.pos.x, e.pos.y + e.h + 0.35, e.pos.z); e.bar.quaternion.copy(camera.quaternion); e.fg.scale.x = Math.max(0.001, e.hp / e.maxHp); }
}

export function aliveCount() { return G.enemies.filter(e => !e.dead && !e.isDummy && !e.practice).length; }
