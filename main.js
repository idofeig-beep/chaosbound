// =====================================================================
// CHAOSBOUND: bootstrap + game flow (lab <-> campaign levels, waves, rewards, saving)
// =====================================================================
import { THREE, G, $, V3, R, rand, pick, camera, render, setScene, initAudio, sfx } from './core.js';
import { loadSave, writeSave, hasSave, wipeSave } from './save.js';
import { WEAPON_ITEMS, LOOT, CAMPAIGNS, ENEMIES, SOULS, SOUL_DROP_CHANCE, SOUL_PITY, WAVE_REWARD, RARITY } from './content.js';
import { updateFx, clearFx, burst } from './fx.js';
import { P, initPlayer, placePlayer, updatePlayer, refreshWeapons, clearShots, isLocked, setLook } from './player.js';
import { updateEnemies, clearEnemies, spawnEnemy, spawnPickup, aliveCount, setMaxTokens } from './enemies.js';
import { pet, initPet, attachPet, updatePet, releasePet, petReact } from './pet.js';
import { buildLab } from './lab.js';
import { buildJungle } from './jungle.js';
import * as UI from './ui.js';

// ---------------- state ----------------
G.save = loadSave(); G.settings = G.save.settings;
G.combo = { count: 0, t: 0 }; G.dmgLog = []; G.practiceMode = 'idle';
const save = () => writeSave(G.save);
G.lock = () => { const el = document.querySelector('canvas'); try { const p = el.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(() => el.requestPointerLock()); } catch (e) { el.requestPointerLock(); } };
const timers = []; const later = (t, fn) => timers.push({ t, fn });

// ---------------- levels ----------------
initPet();
const actions = {
  onTube: () => {
    if (G.save.petReleased) return;
    G.save.petReleased = true; save(); releasePet(); lidFly = { v: V3(rand(-1, 1), 6.5, rand(-1, 1)), spin: rand(5, 9) };
    UI.banner('A TINY BLACK HOLE!', 'It wiggles happily. Meet Pip, your first pet. It will follow you into battle.', 4.5);
    later(5.5, () => UI.banner('', 'Try the Training Arena (east), or step into the Campaign Portal (west).', 4.5));
  },
  onPortal: () => {
    if (!G.save.petReleased) { UI.banner('', 'Something in the glass tube wants to come with you. Open it first!', 3); return; }
    UI.campaignPanel(startLevel);
  },
  onForge: () => UI.forgePanel(),
  onArchive: () => UI.archivePanel(),
  onSanctuary: () => UI.sanctuaryPanel(),
  onRack: () => UI.inventoryPanel(() => { refreshWeapons(); save(); }),
  onLever: () => { G.practiceMode = G.practiceMode === 'fight' ? 'idle' : 'fight'; sfx.click(); UI.banner('', G.practiceMode === 'fight' ? 'The practice goblin is now fighting back (it cannot hurt you much).' : 'The practice goblin is now idle.', 2.5); },
};
G.scene = new THREE.Scene();
const lab = buildLab(actions);
let jungle = null;
let lidFly = null;
let run = null;

function enterLab(first = false) {
  clearEnemies(); clearFx(); clearShots();
  setScene(lab); G.mode = 'lab'; G.paused = false;
  lab.populate();
  if (first) placePlayer(lab.spawn.clone(), lab.spawnYaw); else placePlayer(lab.returnSpawn.clone(), lab.returnYaw);
  P.hp = P.maxHp;
  if (G.save.petReleased) { attachPet(lab.scene, V3(P.pos.x + 2, 2.5, P.pos.z + 2), 'follow'); lab.lid.position.set(lab.tubePos.x + 0.9, 0.06, lab.tubePos.z + 0.6); lab.lid.rotation.set(0, 0, 0.2); }
  else attachPet(lab.scene, lab.tubePos.clone(), 'tube');
  UI.setArea('The Laboratory', `Day ${G.save.day} · safe`);
  run = null; setMaxTokens(2);
  $('fade').style.opacity = 0;
  if (!G.save.petReleased) {
    later(0.8, () => UI.banner(`DAY ${G.save.day}`, 'You wake up in your strange laboratory...', 4));
    later(5.5, () => { if (!G.save.petReleased) UI.banner('', 'Something is glowing inside the glass tube.', 4); });
  }
}

function startLevel(campId, li) {
  const camp = CAMPAIGNS[campId], def = camp.levels[li];
  $('fade').style.opacity = 1; sfx.portal();
  setTimeout(() => {
    if (!jungle) jungle = buildJungle();
    clearEnemies(); clearFx(); clearShots();
    setScene(jungle); G.mode = 'combat'; G.paused = false;
    placePlayer(jungle.spawn.clone(), jungle.spawnYaw); P.hp = P.maxHp;
    attachPet(jungle.scene, V3(P.pos.x - 2, P.pos.y + 2.5, P.pos.z - 2), 'follow');
    run = { campId, li, def, wave: -1, kills: 0, wavesCleared: 0, rewards: [], drops: { gems: 0, essence: 0, souls: [] }, mastery: 0, queue: [], spawnT: 0, state: 'intro', over: false };
    UI.setArea(camp.name, `Level ${li + 1}: ${def.name}`);
    UI.banner(`LEVEL ${li + 1}`, def.name, 3);
    $('fade').style.opacity = 0;
    later(3, nextWave);
    G.lock();
  }, 650);
}
function nextWave() {
  if (!run || run.over) return;
  run.wave++;
  const w = run.def.waves[run.wave];
  run.queue = []; for (const [type, n] of Object.entries(w)) for (let i = 0; i < n; i++) run.queue.push(type);
  run.queue.sort(() => R() - 0.5); run.spawnT = 0.3; run.state = 'spawning';
  setMaxTokens(run.wave >= 2 ? 3 : 2);
  UI.banner(`WAVE ${run.wave + 1} / ${run.def.waves.length}`, run.wave === 0 ? 'Jungle Goblin Raiders burst from the undergrowth!' : run.wave === 1 ? 'A Vine Stalker joins the hunt. Watch for its thrust line.' : 'They are coming together now. Keep moving!', 3);
  sfx.wave();
}
function updateRun(dt) {
  if (!run || run.over) return;
  if (run.state === 'spawning') {
    run.spawnT -= dt;
    if (run.spawnT <= 0 && run.queue.length) {
      const pts = jungle.spawnPoints.filter(p => p.distanceTo(V3(P.pos.x, 0, P.pos.z)) > 18);
      const p = pick(pts.length ? pts : jungle.spawnPoints);
      spawnEnemy(run.queue.shift(), V3(p.x + rand(-2, 2), 0, p.z + rand(-2, 2)));
      run.spawnT = rand(0.5, 0.9);
    }
    if (!run.queue.length) run.state = 'fighting';
  } else if (run.state === 'fighting' && aliveCount() === 0) waveComplete();
}
function rollLoot(campId) {
  const pool = LOOT[campId], total = pool.reduce((a, [, w]) => a + w, 0); let r = R() * total;
  for (const [id, w] of pool) { r -= w; if (r <= 0) return id; } return pool[0][0];
}
function waveComplete() {
  run.state = 'between'; run.wavesCleared++;
  const s = G.save, pr = s.progress[run.campId];
  const id = rollLoot(run.campId), it = WEAPON_ITEMS[id];
  s.weapons.push({ uid: s.nextUid++, id }); if (!s.discovered.weapons.includes(id)) s.discovered.weapons.push(id);
  s.mastery += WAVE_REWARD.mastery; s.essence += WAVE_REWARD.essence; run.mastery += WAVE_REWARD.mastery; run.drops.essence += WAVE_REWARD.essence;
  const globalWave = run.li * 3 + run.wavesCleared; pr.bestWave = Math.max(pr.bestWave, globalWave);
  run.rewards.push({ title: `Wave ${run.wave + 1}: ${it.name}`, text: `${RARITY[it.rarity].name} ${it.base}. ${it.trait} (+${WAVE_REWARD.mastery} ✨, +${WAVE_REWARD.essence} 🟣)` });
  save(); sfx.cleared(); petReact('happy');
  UI.toast(`New weapon: ${it.name} (${RARITY[it.rarity].name})`, it.rarity === 'rare' || it.rarity === 'epic');
  UI.toast(`+${WAVE_REWARD.mastery} Magic Mastery · +${WAVE_REWARD.essence} Soul Essence`);
  if (run.wave >= run.def.waves.length - 1) {
    run.over = true; pr.cleared[run.li] = true; save();
    UI.banner('LEVEL CLEARED!', run.def.name, 4);
    later(3.5, () => UI.resultsPanel('victory', run, returnToLab));
  } else {
    UI.banner('WAVE CLEARED', `Reward: ${it.name}. Next wave in 6 seconds.`, 4);
    later(6, nextWave);
  }
}
function returnToLab() {
  $('fade').style.opacity = 1;
  setTimeout(() => { G.save.day++; save(); enterLab(false); G.lock(); }, 500);
}
G.onPlayerDeath = () => {
  if (!run || run.over) return;
  run.over = true; G.save.stats.deaths++; save();
  UI.banner('DEFEATED', '', 2.5);
  later(2.2, () => UI.resultsPanel('defeat', run, returnToLab));
};
G.onKill = e => {
  G.save.stats.kills++; if (run) run.kills++;
  petReact('happy');
  const def = ENEMIES[e.type]; const c = e.center();
  const ng = Math.round(rand(def.gems[0], def.gems[1])); for (let i = 0; i < ng; i++) spawnPickup('gem', c);
  spawnPickup('essence', c, { v: def.essence });
  // rare species soul with hidden bad-luck protection
  const s = G.save; s.pity[e.type] = (s.pity[e.type] || 0) + 1;
  if (R() < SOUL_DROP_CHANCE || s.pity[e.type] >= SOUL_PITY) { s.pity[e.type] = 0; const sid = def.soul; spawnPickup('soul', c, { id: sid, color: SOULS[sid].color }); }
  save();
};
G.onPickup = (kind, data) => {
  const s = G.save;
  if (kind === 'gem') { s.gems++; if (run) run.drops.gems++; sfx.gem(); UI.toast(n => `+${n} 💎`, false, 'gem'); }
  else if (kind === 'essence') { s.essence += data.v; if (run) run.drops.essence += data.v; sfx.essence(); UI.toast(n => `+${n * data.v} 🟣 Soul Essence`, false, 'ess'); }
  else if (kind === 'soul') {
    s.souls[data.id] = (s.souls[data.id] || 0) + 1; if (!s.discovered.souls.includes(data.id)) s.discovered.souls.push(data.id);
    if (run) run.drops.souls.push(data.id); sfx.soul(); burst(V3(P.pos.x, P.pos.y + 1, P.pos.z), 0xffd24a, 30, 6, 1.2, 2);
    UI.banner('RARE DROP!', `${SOULS[data.id].name}: ${SOULS[data.id].desc}`, 5); UI.toast(`✦ ${SOULS[data.id].name} obtained!`, true);
  }
  save();
};
G.addMastery = n => { if (G.mode !== 'combat') return; G.save.mastery += n; if (run) run.mastery += n; };

// ---------------- title / pause / input ----------------
function showTitle() {
  G.mode = 'title'; UI.showHUD(false);
  $('title').style.display = 'flex'; $('btnPlay').textContent = hasSave() ? 'Continue' : 'Wake up';
  $('btnNew').style.display = hasSave() ? '' : 'none';
  $('titleNote').textContent = hasSave() ? `Day ${G.save.day} · ${G.save.stats.kills} enemies defeated` : '';
  setScene(lab); lab.populate();
  if (G.save.petReleased) attachPet(lab.scene, V3(-8, 3, 4), 'follow'); else attachPet(lab.scene, lab.tubePos.clone(), 'tube');
  $('fade').style.opacity = 0;
}
$('btnPlay').onclick = () => {
  initAudio(); $('title').style.display = 'none'; UI.showHUD(true);
  enterLab(!G.save.petReleased); initPlayer(); G.lock();
};
let newConfirm = false;
$('btnNew').onclick = () => {
  if (!newConfirm) { newConfirm = true; $('btnNew').textContent = 'Click again to erase your save'; return; }
  wipeSave(); G.save = loadSave(); G.settings = G.save.settings; newConfirm = false; $('btnNew').textContent = 'New game'; $('btnPlay').onclick();
};
function syncSettingsUI() {
  const st = G.settings;
  $('sSens').value = st.sens; $('vSens').textContent = (+st.sens).toFixed(2); $('sShake').value = st.shake; $('vShake').textContent = (+st.shake).toFixed(2);
  $('sFov').checked = st.fovFx; $('sMotion').checked = st.motion;
}
$('sSens').oninput = e => { G.settings.sens = +e.target.value; syncSettingsUI(); save(); };
$('sShake').oninput = e => { G.settings.shake = +e.target.value; syncSettingsUI(); save(); };
$('sFov').onchange = e => { G.settings.fovFx = e.target.checked; save(); };
$('sMotion').onchange = e => { G.settings.motion = e.target.checked; save(); };
$('btnResume').onclick = () => G.lock();
$('btnAbandon').onclick = () => {
  $('pause').style.display = 'none'; G.paused = false;
  if (G.mode === 'combat' && run && !run.over) { run.over = true; save(); UI.resultsPanel('retreat', run, returnToLab); }
  else G.lock();
};
document.addEventListener('pointerlockchange', () => {
  const playing = G.mode === 'lab' || G.mode === 'combat';
  if (!playing) return;
  if (isLocked()) { G.paused = false; $('pause').style.display = 'none'; }
  else if (!G.uiOpen) { G.paused = true; syncSettingsUI(); $('btnAbandon').textContent = G.mode === 'combat' ? 'Retreat to the Laboratory' : 'Back to the game'; $('pause').style.display = 'flex'; }
});
addEventListener('keydown', e => {
  if (e.code === 'Tab' && (G.mode === 'lab' || G.mode === 'combat')) {
    e.preventDefault();
    if (UI.modalOpen()) UI.closeModal(true); else if (!G.paused) UI.inventoryPanel(() => { refreshWeapons(); save(); });
  }
});
// clicking the canvas while playing (e.g. after closing a menu) re-captures the mouse
document.addEventListener('mousedown', e => { if ((G.mode === 'lab' || G.mode === 'combat') && !isLocked() && !G.uiOpen && !G.paused && e.target.tagName === 'CANVAS') G.lock(); });

// ---------------- main loop ----------------
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  let real = Math.min((now - last) / 1000, 1 / 20); last = now;
  let dt = real;
  if (G.hitStop > 0) { G.hitStop -= real; dt = real * 0.06; }
  const active = (G.mode === 'lab' || G.mode === 'combat') && !G.paused && !G.uiOpen;
  if (active) {
    G.time += dt;
    for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= real; if (timers[i].t <= 0) { const f = timers[i].fn; timers.splice(i, 1); f(); } }
    updatePlayer(dt); updateEnemies(dt); updatePet(dt); updateRun(dt);
  } else if (G.mode === 'title') {
    G.time += real; const a = G.time * 0.06;
    camera.position.set(-6 + Math.sin(a) * 9, 4.2, 2 + Math.cos(a) * 7); camera.lookAt(-8, 2.2, 0);
    updatePet(real); updateEnemies(real);
  }
  if (lidFly) { lidFly.v.y -= 15 * real; lab.lid.position.addScaledVector(lidFly.v, real); lab.lid.rotation.x += lidFly.spin * real; if (lab.lid.position.y < 0.06) { lab.lid.position.y = 0.06; lab.lid.rotation.set(0, 0, 0.2); lidFly = null; } }
  updateFx(active ? dt : 0);
  if (G.level) G.level.update(real, G.time);
  if (G.mode !== 'title') UI.updateHUD(real, run && !run.over && run.wave >= 0 ? { wave: `Wave ${run.wave + 1} / ${run.def.waves.length}`, left: `${aliveCount() + run.queue.length} enemies remaining` } : {});
  render();
}
showTitle();
requestAnimationFrame(loop);
// test hook: run the simulation forward without rendering (used for automated testing)
function sim(sec) {
  const dt = 1 / 30;
  for (let k = 0; k < sec * 30; k++) {
    G.time += dt;
    for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { const f = timers[i].fn; timers.splice(i, 1); f(); } }
    updatePlayer(dt); updateEnemies(dt); updatePet(dt); updateRun(dt); updateFx(dt);
  }
}
window.__cb = { setLook, G, P, pet, startLevel, enterLab, spawnEnemy, actions, sim, getRun: () => run };
