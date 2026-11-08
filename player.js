// =====================================================================
// CHAOSBOUND: first-person player: fast movement, camera, sword, bow, Arc Pulse
// =====================================================================
import { THREE, G, V3, clamp, lerp, damp, angDiff, rand, camera, gradePass, sfx, TEX, rep, glowSprite } from './core.js';
import { burst, slash, impactRing, flash, dmgNumber, shake, hitStop, groundWave, streak } from './fx.js';
import { WEAPON_ITEMS, SPELLS } from './content.js';
import { damageEnemy } from './enemies.js';

// ---------------- tuning ----------------
const T = {
  run: 7.4, sprint: 11, accelGround: 75, accelAir: 26, gravity: 25, jumpV: 8.9, jumpCut: 0.5,
  coyote: 0.12, buffer: 0.15, dashSpeed: 25, dashTime: 0.16, dashCharges: 2, dashRegen: 1.1, dashExit: 12.5,
  slideBoost: 13, slideTime: 0.8, wallRunTime: 1.25, wallJumpOut: 8.5, wallJumpUp: 8.4,
  radius: 0.38, height: 1.75, eye: 1.62, slideEye: 0.95, baseFov: 78,
};
export const P = {
  pos: V3(), vel: V3(), vy: 0, yaw: 0, pitch: 0, onGround: true, coyote: 0, jumpBuf: 0, jumpHeld: false,
  hp: 100, maxHp: 100, dead: false, lastHurt: -99, iframe: 0, slowT: 0,
  dashCharges: T.dashCharges, dashRegen: 0, dashT: 0, dashDir: V3(), airDashes: 0, dashReq: false,
  sliding: false, slideT: 0, slideReq: false,
  wallRun: 0, wallN: V3(), wallTouch: false, wallTouchT: 0, wallLock: 0, wallDir: V3(), wallSide: 0,
  weapon: 'sword', switchT: 0, plunge: false,
  eyeH: T.eye, camY: 0, roll: 0, landDip: 0, bobPh: 0, fovPulse: 0, hurtA: 0,
  charging: false, charge: 0, bowCd: 0, spellCd: 0, holdT: 0, lmb: false, heavyDone: false,
  speedH: 0, combo: 0, comboT: 0, prompt: null,
};
export const keys = {};
export const shots = [];   // player projectiles (arrows, pulses) - also read by enemy dodge AI
let lookYaw = 0, lookPitch = 0, ignoreMouse = 0;

export const isLocked = () => !!document.pointerLockElement;
const playing = () => (G.mode === 'lab' || G.mode === 'combat') && !G.paused && !G.uiOpen && isLocked() && !P.dead;

// ---------------- input ----------------
addEventListener('keydown', e => {
  if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (!playing() || e.repeat) return;
  if (e.code === 'Space') { P.jumpBuf = T.buffer; P.jumpHeld = true; }
  if (e.code === 'KeyQ') P.dashReq = true;
  if (e.code === 'KeyC' || e.code === 'ControlLeft') P.slideReq = true;
  if (e.code === 'Digit1') switchWeapon('sword');
  if (e.code === 'Digit2') switchWeapon('bow');
  if (e.code === 'KeyE' && P.prompt) { sfx.click(); P.prompt.use(); }
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'Space') P.jumpHeld = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; P.lmb = false; P.charging = false; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousedown', e => {
  if (!playing()) return;
  if (e.button === 0) { P.lmb = true; P.holdT = 0; P.heavyDone = false; attackPress(); }
  if (e.button === 2) castSpell();
});
addEventListener('mouseup', e => { if (e.button === 0 && P.lmb) { P.lmb = false; attackRelease(); } });
addEventListener('wheel', e => { if (playing()) switchWeapon(P.weapon === 'sword' ? 'bow' : 'sword'); });
addEventListener('mousemove', e => {
  if (!isLocked() || G.paused || G.uiOpen || ignoreMouse > 0) return;
  const mx = e.movementX, my = e.movementY;
  if (Math.abs(mx) > 250 || Math.abs(my) > 250) return;   // browser pointer-lock spike: ignore
  const s = 0.0021 * G.settings.sens;
  lookYaw -= mx * s; lookPitch = clamp(lookPitch - my * s, -1.52, 1.52);
});
document.addEventListener('pointerlockchange', () => { if (isLocked()) ignoreMouse = 0.1; });

// ---------------- view models ----------------
const hand = new THREE.Group(); camera.add(hand);
let swordModel = null, bowModel = null, bowString = null, nockedArrow = null, swordGlow = null;
const leftGlow = glowSprite(0x9a7aff, 0.35, 0); leftGlow.position.set(-0.32, -0.26, -0.6); camera.add(leftGlow);
function itemFor(base) {
  const s = G.save; const uid = s.equipped[base]; const w = s.weapons.find(x => x.uid === uid);
  return WEAPON_ITEMS[w ? w.id : (base === 'sword' ? 'training_sword' : 'hunting_bow')];
}
export function refreshWeapons() {
  if (swordModel) hand.remove(swordModel); if (bowModel) hand.remove(bowModel);
  // ---- sword ----
  const si = itemFor('sword');
  swordModel = new THREE.Group();
  const bladeGeo = new THREE.BoxGeometry(0.07, 1.0, 0.014, 1, 8, 1); const bp = bladeGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) { const y = bp.getY(i); if (y > 0.3) bp.setX(i, bp.getX(i) * (1 - (y - 0.3) / 0.2 * 0.92));}
  if (si.name.includes('Curved')) for (let i = 0; i < bp.count; i++) { const y = bp.getY(i) + 0.5; bp.setX(i, bp.getX(i) + y * y * 0.12); }
  bladeGeo.computeVertexNormals(); bladeGeo.translate(0, 0.62, 0);
  const metal = new THREE.MeshStandardMaterial({ color: si.color, metalness: 0.55, roughness: 0.28 });
  swordModel.add(new THREE.Mesh(bladeGeo, metal));
  swordGlow = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.82, 0.018), new THREE.MeshBasicMaterial({ color: new THREE.Color(si.glow || 0x7ab8ff).multiplyScalar(1.6) }));
  swordGlow.position.y = 0.55; swordModel.add(swordGlow);
  const brass = new THREE.MeshStandardMaterial({ color: 0xd4a640, metalness: 0.8, roughness: 0.3 });
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.07), brass); guard.position.y = 0.1; swordModel.add(guard);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.22, 10), new THREE.MeshStandardMaterial({ color: 0x3a2014, roughness: 1 })); swordModel.add(grip);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), brass); pom.position.y = -0.12; swordModel.add(pom);
  swordModel.userData.item = si; swordModel.scale.setScalar(0.85);
  // ---- bow ----
  const bi = itemFor('bow');
  bowModel = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([V3(0, 0.48, -0.05), V3(0, 0.42, -0.16), V3(0, 0.28, -0.21), V3(0, 0.12, -0.25), V3(0, 0, -0.25), V3(0, -0.12, -0.25), V3(0, -0.28, -0.21), V3(0, -0.42, -0.16), V3(0, -0.48, -0.05)]);
  bowModel.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.017, 8), new THREE.MeshStandardMaterial({ color: bi.color, map: rep(TEX.bark, 1, 3), roughness: 0.5 })));
  const bg = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.16, 10), new THREE.MeshStandardMaterial({ color: 0x3a2014 })); bg.position.z = -0.25; bowModel.add(bg);
  const sg = new THREE.BufferGeometry().setFromPoints([V3(0, 0.48, -0.05), V3(0, 0, -0.05), V3(0, -0.48, -0.05)]);
  bowString = new THREE.Line(sg, new THREE.LineBasicMaterial({ color: 0xf2efe8 })); bowModel.add(bowString);
  nockedArrow = makeArrow(); nockedArrow.rotation.y = Math.PI; nockedArrow.scale.setScalar(0.9); bowModel.add(nockedArrow);
  bowModel.userData.item = bi;
  for (const m of [swordModel, bowModel]) m.traverse(o => { o.castShadow = false; o.frustumCulled = false; });
  hand.add(swordModel, bowModel);
  swordModel.rotation.order = 'YXZ';
}
function makeArrow() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.9, 6).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc9a46a })));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.13, 6).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xa0a8b4, metalness: 0.8, roughness: 0.3 })); tip.position.z = 0.5; g.add(tip);
  for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.045, 0.12).translate(0, 0.03, 0), new THREE.MeshStandardMaterial({ color: i ? 0xd8d0c0 : 0xd83a3a })); f.position.z = -0.37; f.rotation.z = i * 2.094; g.add(f); }
  return g;
}

// ---------------- sword combat ----------------
const REST = { ry: 0.3, rx: -0.55, rz: -0.45, x: 0.36, y: -0.5, z: -0.5 };
const SWINGS = [
  { from: { ry: -1.3, rx: -1.45, rz: 0.4, x: 0.3, y: -0.22, z: -0.35 }, to: { ry: 1.3, rx: -1.6, rz: 0.4, x: -0.25, y: -0.34, z: -0.4 }, dur: 0.34, act: [0.2, 0.55], dmg: 13, tilt: -0.3, dir: -1, arc: 80 },
  { from: { ry: 1.25, rx: -1.55, rz: -0.45, x: -0.2, y: -0.2, z: -0.38 }, to: { ry: -1.25, rx: -1.35, rz: -0.45, x: 0.3, y: -0.32, z: -0.4 }, dur: 0.34, act: [0.2, 0.55], dmg: 13, tilt: 0.35, dir: 1, arc: 80 },
  { from: { ry: 0.05, rx: -0.05, rz: 0.1, x: 0.12, y: -0.05, z: -0.3 }, to: { ry: 0, rx: -2.55, rz: 0.1, x: 0.05, y: -0.45, z: -0.45 }, dur: 0.46, act: [0.28, 0.6], dmg: 24, tilt: Math.PI / 2, dir: -1, arc: 50, finisher: true },
];
const LAUNCH = { from: { ry: 0, rx: -2.5, rz: 0, x: 0.1, y: -0.5, z: -0.4 }, to: { ry: 0, rx: -0.1, rz: 0, x: 0.05, y: -0.05, z: -0.4 }, dur: 0.42, act: [0.18, 0.5], dmg: 16, tilt: Math.PI / 2, dir: 1, arc: 55, launcher: true };
let swing = null, swingBuffer = 0;
const easeIO = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
function poseLerp(a, b, t) { const o = {}; for (const k in a) o[k] = lerp(a[k], b[k], t); return o; }

function startSwing(def) {
  const item = itemFor('sword');
  swing = { def, t: 0, dur: def.dur / (item.speed || 1), hit: new Set(), fx: false, item };
  sfx.swing(def.finisher || def.launcher ? 0.7 : 1);
}
function attackPress() {
  if (P.switchT > 0) return;
  if (P.weapon === 'sword') {
    if (!swing) { P.combo = (performance.now() / 1000 - P.comboT < 0.6) ? (P.combo + 1) % 3 : 0; startSwing(SWINGS[P.combo]); }
    else swingBuffer = 0.3;
  } else if (P.weapon === 'bow') {
    if (P.bowCd <= 0) { P.charging = true; P.charge = 0; sfx.draw(); }
  }
}
function attackRelease() {
  if (P.weapon === 'bow' && P.charging) { P.charging = false; fireArrow(); }
}
function doHeavy() {
  P.heavyDone = true;
  if (P.weapon !== 'sword') return;
  if (!P.onGround) { P.plunge = true; swing = null; sfx.swingHeavy(); return; }
  startSwing(LAUNCH); sfx.swingHeavy();
}
function swordHitCheck(sw) {
  const def = sw.def, item = sw.item, reach = 2.9 * (item.reach || 1);
  const fwd = V3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
  const cos = Math.cos(def.arc * Math.PI / 180);
  for (const e of G.enemies) {
    if (e.dead || sw.hit.has(e)) continue;
    const c = e.center(), dx = c.x - camera.position.x, dz = c.z - camera.position.z, dh = Math.hypot(dx, dz) - e.r, dy = c.y - camera.position.y;
    if (dh > reach || dy < -2.4 || dy > 1.8) continue;
    const len = Math.hypot(dx, dz) || 1;
    if ((dx * fwd.x + dz * fwd.z) / len < cos && dh > 0.4) continue;
    sw.hit.add(e);
    const air = !P.onGround;
    const dmg = Math.round(def.dmg * (item.dmg || 1));
    damageEnemy(e, dmg, { dir: fwd, knock: def.finisher ? 7 : def.launcher ? 1 : 2.2, stagger: !!def.finisher, launch: def.launcher ? 9.5 : 0, juggle: air || e.airborne, src: 'sword', heavy: def.finisher || def.launcher });
    if (air) P.vy = Math.max(P.vy, 2.6);
    burst(c, 0xfff0c0, 6, 4, 0.35);
    if (def.finisher) { hitStop(0.07); shake(0.22); sfx.hitHeavy(); } else { hitStop(0.025); shake(0.07); sfx.hit(); }
  }
  if (def.finisher && item.special === 'shockwave' && !sw.shock) {
    sw.shock = true;
    const origin = V3(P.pos.x, P.pos.y, P.pos.z).addScaledVector(fwd, 1.5);
    groundWave(origin, 0xffd24a, 4, 0.4);
    for (const e of G.enemies) {
      if (e.dead || sw.hit.has(e)) continue;
      const d = e.pos.clone().sub(P.pos); d.y = 0; const L = d.length();
      if (L < 6 && d.normalize().dot(fwd) > 0.8) damageEnemy(e, Math.round(10 * item.dmg), { dir: fwd, knock: 5, src: 'sword' });
    }
  }
}
function doPlunge() {
  P.plunge = false;
  const item = itemFor('sword');
  groundWave(P.pos, 0x9ad8ff, 4.2, 0.45); flash(V3(P.pos.x, P.pos.y + 0.3, P.pos.z), 0x9ad8ff, 4);
  shake(0.45); hitStop(0.08); sfx.hitHeavy();
  for (const e of G.enemies) {
    if (e.dead) continue; const d = e.pos.clone().sub(P.pos); const L = Math.hypot(d.x, d.z);
    if (L < 4.2 && Math.abs(d.y) < 2.5) damageEnemy(e, Math.round(22 * (item.dmg || 1)), { dir: V3(d.x, 0, d.z).normalize(), knock: 6, launch: 4, stagger: true, src: 'sword', heavy: true });
  }
}
function updateSword(dt) {
  if (!swordModel) return;
  let pose = REST;
  if (P.plunge) pose = { ry: 0, rx: -2.7, rz: 0, x: 0.05, y: -0.3, z: -0.45 };
  if (swing) {
    swing.t += dt / swing.dur;
    const t = swing.t, d = swing.def;
    if (t < 0.18) pose = poseLerp(REST, d.from, easeIO(t / 0.18));
    else if (t < 0.6) pose = poseLerp(d.from, d.to, easeIO((t - 0.18) / 0.42));
    else pose = poseLerp(d.to, REST, easeIO(Math.min(1, (t - 0.6) / 0.4)));
    if (t >= d.act[0] && !swing.fx) { swing.fx = true; slash((swing.item.glow || 0x9ad8ff), d.tilt, d.dir, d.finisher ? 1.15 : 1, d.dur * 0.6); }
    if (t >= d.act[0] && t <= d.act[1]) swordHitCheck(swing);
    if (d.launcher && t >= d.act[0] && !swing.hop) { swing.hop = true; if (swing.hit.size) { P.vy = 7.6; P.onGround = false; } }
    if (t >= 0.62 && swingBuffer > 0 && !d.launcher) { swingBuffer = 0; P.combo = (P.combo + 1) % 3; startSwing(SWINGS[P.combo]); }
    else if (t >= 1) { swing = null; P.comboT = performance.now() / 1000; }
  }
  swingBuffer = Math.max(0, swingBuffer - dt);
  const sm = swordModel;
  const sw = Math.sin(P.bobPh) * 0.012 * Math.min(1, P.speedH / 8);
  sm.position.set(pose.x + sw, pose.y + Math.abs(Math.cos(P.bobPh)) * 0.01 * Math.min(1, P.speedH / 8), pose.z);
  sm.rotation.set(pose.rx, pose.ry, pose.rz);
}

// ---------------- bow ----------------
function fireArrow() {
  if (P.bowCd > 0) return;
  const item = itemFor('bow'), p = 0.15 + 0.85 * P.charge;
  const dir = V3(0, 0, -1).applyQuaternion(camera.quaternion);
  const start = camera.position.clone().addScaledVector(dir, 0.6).add(V3(0, -0.05, 0));
  const m = makeArrow(); m.position.copy(start); m.lookAt(start.clone().add(dir)); G.scene.add(m);
  const trail = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.012, 1.4, 5).rotateX(Math.PI / 2).translate(0, 0, -1.1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.add(trail);
  const full = P.charge >= 0.98;
  shots.push({ kind: 'arrow', m, trail, pos: m.position, vel: dir.multiplyScalar(26 + p * 46), dmg: Math.round((9 + p * 27) * (item.dmg || 1)), crit: full, pierce: full && item.special === 'pierce' ? 3 : 0, hit: new Set(), life: 4, stuck: 0 });
  sfx.bow(p); P.bowCd = 0.3; P.charge = 0; P.fovPulse = Math.max(P.fovPulse, -0.3);
}
function updateBow(dt) {
  if (!bowModel) return;
  const item = itemFor('bow');
  P.bowCd -= dt;
  if (P.charging) { P.charge = Math.min(1, P.charge + dt * 1.15 * (item.draw || 1)); if (!P.onGround) P.vy = Math.max(P.vy, -2.4); }
  const pull = P.charge * 0.3, sp = bowString.geometry.attributes.position; sp.setZ(1, -0.05 + pull); sp.needsUpdate = true;
  nockedArrow.visible = P.bowCd <= 0; nockedArrow.position.set(0, 0, -0.05 + pull - 0.37);
  const sw = Math.sin(P.bobPh) * 0.012 * Math.min(1, P.speedH / 8);
  bowModel.position.set(0.3 - P.charge * 0.12 + sw, -0.27 + P.charge * 0.06, -0.55);
  bowModel.rotation.set(0, 0, 0.22 - P.charge * 0.18);
}

// ---------------- Arc Pulse ----------------
const pulseGeo = new THREE.SphereGeometry(0.12, 14, 10);
function castSpell() {
  if (P.spellCd > 0 || P.switchT > 0) return;
  P.spellCd = SPELLS.arc_pulse.cd;
  const dir = V3(0, 0, -1).applyQuaternion(camera.quaternion);
  const right = V3(1, 0, 0).applyQuaternion(camera.quaternion);
  const start = camera.position.clone().addScaledVector(dir, 0.7).addScaledVector(right, -0.28).add(V3(0, -0.12, 0));
  const m = new THREE.Mesh(pulseGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.3, 3.2) }));
  m.add(glowSprite(0x8a7aff, 1.1, 0.9)); m.position.copy(start); G.scene.add(m);
  // aim correction so the pulse converges on the crosshair
  const aimPoint = camera.position.clone().addScaledVector(dir, 30);
  const vel = aimPoint.sub(start).normalize().multiplyScalar(46);
  shots.push({ kind: 'pulse', m, pos: m.position, vel, dmg: 12, hit: new Set(), life: 1.5 });
  leftGlow.material.opacity = 1; sfx.pulse();
}

// ---------------- projectiles ----------------
function enemyHit(s, e, hitHead) {
  const crit = hitHead || s.crit;
  const dmg = Math.round(s.dmg * (hitHead ? 1.6 : 1));
  damageEnemy(e, dmg, { dir: s.vel.clone().normalize(), knock: s.kind === 'pulse' ? 2.5 : 1.5, src: s.kind === 'pulse' ? 'spell' : 'bow', crit, stagger: crit && s.kind === 'arrow' && s.dmg > 25, juggle: e.airborne });
  G.hitMarker = 0.15;
}
function updateShots(dt) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    if (s.stuck > 0) { s.stuck -= dt; if (s.stuck <= 0) { s.m.parent && s.m.parent.remove(s.m); shots.splice(i, 1); } continue; }
    s.life -= dt; let done = s.life <= 0;
    const steps = 5, h = dt / steps;
    for (let k = 0; k < steps && !done; k++) {
      if (s.kind === 'arrow') s.vel.y -= 13 * h;
      const prev = s.pos.clone(); s.pos.addScaledVector(s.vel, h);
      for (const e of G.enemies) {
        if (e.dead || s.hit.has(e)) continue;
        const c = e.center(), head = c.clone(); head.y += e.headOff;
        const hitHead = s.pos.distanceTo(head) < e.headR;
        if (hitHead || s.pos.distanceTo(c) < e.r + 0.15 || (Math.hypot(s.pos.x - c.x, s.pos.z - c.z) < e.r && Math.abs(s.pos.y - c.y) < e.h * 0.5)) {
          s.hit.add(e); enemyHit(s, e, hitHead);
          if (s.kind === 'pulse') { burst(s.pos, 0xb0a0ff, 10, 4, 0.45); impactRing(s.pos.clone(), 0x9a8aff, 1.6, 0.3); sfx.pulseHit(); done = true; }
          else { sfx.thunk(); burst(s.pos, 0xfff0a0, 5, 2, 0.35); if (s.pierce > 0) s.pierce--; else { s.trail.visible = false; e.g.attach(s.m); s.stuck = 3; done = true; } }
          break;
        }
      }
      if (done) break;
      if (G.world.solid(s.pos)) {
        if (s.kind === 'arrow') { s.pos.copy(prev); s.trail.visible = false; s.stuck = 6; burst(prev, 0xb0a080, 4, 1.5, 0.3); }
        else { burst(prev, 0xb0a0ff, 8, 3, 0.4); impactRing(prev, 0x9a8aff, 1.2, 0.25); done = true; }
        done = true; break;
      }
    }
    if (s.stuck > 0) continue;
    if (done) { if (s.kind === 'pulse' || !s.stuck) { s.m.parent && s.m.parent.remove(s.m); shots.splice(i, 1); } continue; }
    if (s.kind === 'arrow') s.m.lookAt(s.pos.clone().add(s.vel));
  }
}
export function clearShots() { for (const s of shots) s.m.parent && s.m.parent.remove(s.m); shots.length = 0; }

// ---------------- weapons switching ----------------
export function switchWeapon(w) {
  if (w === P.weapon || P.switchT > 0) return;
  P.charging = false; swing = null; P.plunge = false;
  P.switchT = 0.28; P.nextWeapon = w; sfx.click();
}
function updateWeaponVisibility(dt) {
  if (P.switchT > 0) { P.switchT -= dt; if (P.switchT < 0.14 && P.nextWeapon) { P.weapon = P.nextWeapon; P.nextWeapon = null; G.save.activeWeapon = P.weapon; } }
  const dip = P.switchT > 0 ? Math.sin((1 - P.switchT / 0.28) * Math.PI) * 0.45 : 0;
  hand.position.y = -dip;
  if (swordModel) swordModel.visible = P.weapon === 'sword' && !P.dead;
  if (bowModel) bowModel.visible = P.weapon === 'bow' && !P.dead;
  leftGlow.material.opacity = Math.max(0, leftGlow.material.opacity - dt * 4);
}

// ---------------- damage ----------------
export function hurtPlayer(d, from) {
  if (P.dead || P.iframe > 0) return false;
  if (G.mode === 'lab') P.hp = Math.max(1, P.hp - d); else P.hp -= d;
  P.lastHurt = G.time; P.hurtA = 1; shake(0.18); sfx.hurt();
  if (from) { const a = Math.atan2(from.x - P.pos.x, from.z - P.pos.z); G.hurtDir = { a: angDiff(P.yaw + Math.PI, a), t: 0.8 }; }
  if (P.hp <= 0) { P.hp = 0; P.dead = true; P.charging = false; swing = null; if (G.onPlayerDeath) G.onPlayerDeath(); }
  return true;
}
export function slowPlayer(t) { P.slowT = Math.max(P.slowT, t); }

// ---------------- placement ----------------
export function placePlayer(pos, yaw) {
  P.pos.copy(pos); P.vel.set(0, 0, 0); P.vy = 0; P.onGround = true; P.camY = pos.y;
  P.yaw = lookYaw = yaw; P.pitch = lookPitch = 0; P.dead = false; P.plunge = false; P.sliding = false; P.wallRun = 0; P.dashT = 0;
  swing = null; P.charging = false; P.slowT = 0;
}
export function setLook(yaw, pitch = 0) { P.yaw = lookYaw = yaw; P.pitch = lookPitch = pitch; }
export function initPlayer() { P.weapon = G.save.activeWeapon || 'sword'; refreshWeapons(); }

// ---------------- movement ----------------
const fwd = V3(), right = V3(), wish = V3();
function updateMovement(dt) {
  const w = G.world;
  fwd.set(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)); right.set(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
  let mx = 0, mz = 0;
  if (playing()) { if (keys.KeyW) mz += 1; if (keys.KeyS) mz -= 1; if (keys.KeyD) mx += 1; if (keys.KeyA) mx -= 1; }
  wish.set(0, 0, 0).addScaledVector(fwd, mz).addScaledVector(right, mx); if (wish.lengthSq() > 0) wish.normalize();
  const slow = P.slowT > 0 ? 0.5 : 1; P.slowT -= dt;
  const sprinting = keys.ShiftLeft && mz > 0 && !P.charging;
  const speed = (sprinting ? T.sprint : T.run) * slow * (P.charging ? 0.6 : 1);
  const hs = Math.hypot(P.vel.x, P.vel.z);

  // dash charges
  if (P.dashCharges < T.dashCharges) { P.dashRegen += dt; if (P.dashRegen >= T.dashRegen) { P.dashRegen = 0; P.dashCharges++; } }
  if (P.dashReq) {
    P.dashReq = false;
    if (P.dashCharges > 0 && P.dashT <= 0 && (P.onGround || P.airDashes < 1)) {
      P.dashCharges--; P.dashRegen = 0; P.dashT = T.dashTime; P.iframe = 0.2;
      P.dashDir.copy(wish.lengthSq() ? wish : fwd); if (!P.onGround) { P.airDashes++; P.vy = Math.max(P.vy * 0.2, 1.2); }
      P.sliding = false; P.wallRun = 0; swing = null; P.plunge = false;
      P.fovPulse = 1; shake(0.06); sfx.dash();
      for (let i = 0; i < 6; i++) burst(V3(P.pos.x, P.pos.y + 0.9, P.pos.z), 0xcfe8ff, 1, 3, 0.3, 0, 0.8);
    }
  }
  if (P.dashT > 0) {
    P.dashT -= dt;
    P.vel.x = P.dashDir.x * T.dashSpeed * slow; P.vel.z = P.dashDir.z * T.dashSpeed * slow;
    if (P.dashT <= 0) { const keep = Math.max(T.dashExit, speed); P.vel.x = P.dashDir.x * keep; P.vel.z = P.dashDir.z * keep; }
  }
  // slide
  if (P.slideReq) {
    P.slideReq = false;
    if (P.onGround && P.dashT <= 0 && hs > 5 && !P.sliding) {
      P.sliding = true; P.slideT = T.slideTime; const b = Math.max(hs * 1.15, T.slideBoost);
      P.vel.x = P.vel.x / hs * b; P.vel.z = P.vel.z / hs * b; sfx.slide(); P.fovPulse = Math.max(P.fovPulse, 0.5);
    }
  }
  if (P.sliding) {
    P.slideT -= dt;
    const k = Math.exp(-1.5 * dt); P.vel.x *= k; P.vel.z *= k;
    if (wish.lengthSq()) { const v = Math.hypot(P.vel.x, P.vel.z); const dir = V3(P.vel.x, 0, P.vel.z).normalize().lerp(wish, damp(2.5, dt)).normalize(); P.vel.x = dir.x * v; P.vel.z = dir.z * v; }
    if (P.slideT <= 0 || Math.hypot(P.vel.x, P.vel.z) < 4 || !P.onGround) P.sliding = false;
  } else if (P.dashT <= 0 && P.wallRun <= 0) {
    const tx = wish.x * speed, tz = wish.z * speed;
    if (P.onGround) {
      const dx = tx - P.vel.x, dz = tz - P.vel.z, dl = Math.hypot(dx, dz), a = T.accelGround * dt;
      if (dl <= a) { P.vel.x = tx; P.vel.z = tz; } else { P.vel.x += dx / dl * a; P.vel.z += dz / dl * a; }
    } else if (wish.lengthSq()) {
      // air steering: add acceleration but don't exceed max(current speed, run speed)
      const cap = Math.max(hs, speed);
      P.vel.x += wish.x * T.accelAir * dt; P.vel.z += wish.z * T.accelAir * dt;
      const nh = Math.hypot(P.vel.x, P.vel.z); if (nh > cap) { P.vel.x *= cap / nh; P.vel.z *= cap / nh; }
    }
  }
  // jumping (buffer + coyote + wall jump)
  P.coyote = P.onGround ? T.coyote : P.coyote - dt; P.jumpBuf -= dt;
  if (P.jumpBuf > 0) {
    if (P.onGround || P.coyote > 0) {
      P.vy = T.jumpV; P.onGround = false; P.coyote = 0; P.jumpBuf = 0; P.cutDone = false;
      if (P.sliding) { P.sliding = false; P.vel.x *= 1.06; P.vel.z *= 1.06; }
      sfx.jump();
    } else if (P.wallRun > 0 || P.wallTouchT > 0) {
      const n = P.wallN;
      P.vel.x = n.x * T.wallJumpOut + P.vel.x * 0.75; P.vel.z = n.z * T.wallJumpOut + P.vel.z * 0.75;
      P.vy = T.wallJumpUp; P.cutDone = false; P.wallRun = 0; P.wallLock = 0.3; P.jumpBuf = 0; P.airDashes = 0; P.wallTouchT = 0;
      sfx.jump(); shake(0.04); burst(V3(P.pos.x - n.x * 0.4, P.pos.y + 1, P.pos.z - n.z * 0.4), 0xcfcfcf, 6, 3, 0.4);
    }
  }
  if (!P.jumpHeld && P.vy > 0 && !P.cutDone && !P.onGround && P.wallRun <= 0) { P.vy *= T.jumpCut; P.cutDone = true; }
  if (P.onGround) P.cutDone = false;

  // wall run
  P.wallLock -= dt; P.wallTouchT -= dt;
  if (!P.onGround && P.wallTouch && P.wallRun <= 0 && P.wallLock <= 0 && keys.KeyW && hs > 4.5 && P.vy < 6 && Math.abs(fwd.dot(P.wallN)) < 0.8) {
    P.wallRun = T.wallRunTime; const n = P.wallN; const t = V3(-n.z, 0, n.x); if (t.dot(V3(P.vel.x, 0, P.vel.z)) < 0) t.negate();
    P.wallDir.copy(t); P.wallSide = n.dot(right) > 0 ? -1 : 1; P.vy = Math.max(P.vy, 1.5); P.airDashes = 0; sfx.wallrun();
  }
  if (P.wallRun > 0) {
    P.wallRun -= dt; const sp = Math.max(hs, 10);
    P.vel.x = P.wallDir.x * sp - P.wallN.x * 1.2; P.vel.z = P.wallDir.z * sp - P.wallN.z * 1.2;
    P.vy = lerp(P.vy, -0.5, damp(4, dt));
    if ((!P.wallTouch && P.wallTouchT <= 0) || !keys.KeyW || P.onGround) P.wallRun = 0;
  }
  // gravity
  let g = T.gravity;
  if (P.wallRun > 0) g = 3;
  if (P.dashT > 0 && !P.onGround) g = 0;
  if (P.plunge) P.vy = -30;
  P.vy -= g * dt;

  // integrate + collide
  const prevY = P.pos.y;
  P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt; P.pos.y += P.vy * dt;
  const wallN = w.collide(P.pos, T.radius, P.sliding ? 1.0 : T.height);
  P.wallTouch = !!wallN && !P.onGround;
  if (wallN) { P.wallN.copy(wallN); if (!P.onGround) P.wallTouchT = 0.14; const into = P.vel.x * wallN.x + P.vel.z * wallN.z; if (into < 0) { P.vel.x -= wallN.x * into; P.vel.z -= wallN.z * into; } }
  const gnd = w.groundAt(P.pos.x, P.pos.z, Math.max(prevY, P.pos.y));
  if (P.pos.y <= gnd + 0.001 && P.vy <= 0) {
    if (!P.onGround) {
      const impact = -P.vy; if (impact > 9) P.landDip = Math.min(0.22, impact * 0.011);
      sfx.land(impact); if (P.plunge) doPlunge();
    }
    P.pos.y = gnd; P.vy = 0; P.onGround = true; P.airDashes = 0; P.wallRun = 0;
  } else if (P.onGround && P.pos.y - gnd < 0.4 && P.vy <= 0) { P.pos.y = gnd; P.vy = 0; }
  else if (P.pos.y > gnd + 0.02) P.onGround = false;
  if (P.pos.y < -40 && G.level) { placePlayer(G.level.spawn.clone(), P.yaw); }
  P.speedH = Math.hypot(P.vel.x, P.vel.z);
  P.iframe -= dt;
  P.sprinting = sprinting && P.speedH > 9;
  return mx;
}

// ---------------- camera ----------------
function updateCamera(dt, mx) {
  ignoreMouse = Math.max(0, ignoreMouse - dt);
  P.yaw += angDiff(P.yaw, lookYaw) * damp(40, dt);
  P.pitch += (lookPitch - P.pitch) * damp(40, dt);
  const fx = G.settings.motion ? 1 : 0.25;
  P.eyeH = lerp(P.eyeH, P.sliding ? T.slideEye : T.eye, damp(14, dt));
  P.camY = P.onGround ? lerp(P.camY, P.pos.y, damp(22, dt)) : P.pos.y;
  if (Math.abs(P.camY - P.pos.y) > 1) P.camY = P.pos.y;
  let bob = 0;
  if (P.onGround && !P.sliding && P.speedH > 0.5) {
    const prev = Math.sin(P.bobPh * 2);
    P.bobPh += dt * (5 + P.speedH * 0.95);
    bob = Math.sin(P.bobPh * 2) * 0.032 * Math.min(1, P.speedH / 8) * fx;
    if (prev < 0 && Math.sin(P.bobPh * 2) >= 0) sfx.step();
  }
  P.landDip = Math.max(0, P.landDip - dt * 0.7);
  camera.position.set(P.pos.x, P.camY + P.eyeH + bob - P.landDip + (P.dead ? -1.2 : 0), P.pos.z);
  if (G.shake > 0) {
    const s = G.shake * G.settings.shake * 0.1;
    camera.position.x += rand(-1, 1) * s; camera.position.y += rand(-1, 1) * s;
    G.shake = Math.max(0, G.shake - dt * 1.8);
  }
  let rollT = -mx * 0.012 * fx;
  if (P.wallRun > 0) rollT = P.wallSide * 0.14 * fx;
  if (P.dashT > 0) rollT += -P.dashDir.dot(right) * 0.05 * fx;
  P.roll = lerp(P.roll, rollT, damp(9, dt));
  camera.rotation.set(P.pitch, P.yaw, P.roll);
  P.fovPulse = lerp(P.fovPulse, 0, damp(6, dt));
  let fov = T.baseFov;
  if (G.settings.fovFx) fov += (P.sprinting ? 6 : 0) + P.fovPulse * 9 + (P.sliding ? 4 : 0);
  if (P.charging) fov -= P.charge * 12;
  const cf = lerp(camera.fov, fov, damp(10, dt));
  if (Math.abs(cf - camera.fov) > 0.01) { camera.fov = cf; camera.updateProjectionMatrix(); }
  P.hurtA = Math.max(0, P.hurtA - dt * 1.4); gradePass.uniforms.hurt.value = P.hurtA * 0.65 + (P.hp < 30 && G.mode === 'combat' ? 0.25 + Math.sin(G.time * 5) * 0.1 : 0);
}

// ---------------- interaction ----------------
function updateInteract() {
  P.prompt = null;
  if (!G.level || !G.level.interactables || P.dead) return;
  let best = null, bd = 1e9;
  for (const it of G.level.interactables) {
    if (it.enabled && !it.enabled()) continue;
    const d = Math.hypot(it.pos.x - P.pos.x, it.pos.z - P.pos.z);
    if (d > it.r) continue;
    const dir = V3(it.pos.x - P.pos.x, 0, it.pos.z - P.pos.z).normalize();
    if (d > 1.2 && dir.dot(fwd) < 0.35) continue;
    if (d < bd) { bd = d; best = it; }
  }
  P.prompt = best;
}

// ---------------- main update ----------------
export function updatePlayer(dt) {
  let mx = 0;
  if (!P.dead) mx = updateMovement(dt); else { P.vel.multiplyScalar(0.9); }
  if (P.lmb && P.weapon === 'sword' && playing()) { P.holdT += dt; if (P.holdT > 0.32 && !P.heavyDone) doHeavy(); }
  P.spellCd = Math.max(0, P.spellCd - dt);
  updateWeaponVisibility(dt); updateSword(dt); updateBow(dt); updateShots(dt);
  updateCamera(dt, mx); updateInteract();
  // regen
  const regenDelay = G.mode === 'lab' ? 0.5 : 6, regenRate = G.mode === 'lab' ? 40 : 3;
  if (!P.dead && G.time - P.lastHurt > regenDelay) P.hp = Math.min(P.maxHp, P.hp + regenRate * dt);
  if (G.hurtDir) { G.hurtDir.t -= dt; if (G.hurtDir.t <= 0) G.hurtDir = null; }
}
export function viewUpdateOnly(dt) { updateCamera(dt, 0); }
export const TUNING = T;
