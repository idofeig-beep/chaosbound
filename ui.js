// =====================================================================
// CHAOSBOUND: HUD + menus (inventory, campaign select, stations, results)
// =====================================================================
import { G, $ } from './core.js';
import { RARITY, BASE_WEAPONS, WEAPON_ITEMS, SPELLS, SPELL_COMBOS, PETS, SOULS, CAMPAIGNS, ENEMIES } from './content.js';
import { P, TUNING } from './player.js';

// ---------------- banner & toasts ----------------
let bannerT = 0;
export function banner(big, small = '', dur = 3.5) { $('bBig').textContent = big; $('bSmall').textContent = small; $('banner').classList.add('on'); bannerT = dur; }
const merged = {};
export function toast(text, rare = false, key = null) {
  if (key && merged[key] && merged[key].el.isConnected) {
    const m = merged[key]; m.n++; m.el.textContent = m.fmt(m.n); clearTimeout(m.to); m.to = setTimeout(() => m.el.remove(), 2600); return;
  }
  const el = document.createElement('div'); el.className = 'toast' + (rare ? ' rare' : ''); el.textContent = typeof text === 'function' ? text(1) : text;
  $('toasts').prepend(el); const to = setTimeout(() => el.remove(), rare ? 5000 : 2600);
  if (key) merged[key] = { el, n: 1, fmt: text, to };
  while ($('toasts').children.length > 6) $('toasts').lastChild.remove();
}

// ---------------- modal ----------------
let onCloseCb = null;
export function openModal(title, html, mount, onClose) {
  G.uiOpen = true; document.exitPointerLock && document.exitPointerLock();
  $('mTitle').textContent = title; $('mBody').innerHTML = html; $('modal').style.display = 'flex';
  onCloseCb = onClose || null; if (mount) mount($('mBody'));
}
export function closeModal(relock = true) {
  $('modal').style.display = 'none'; G.uiOpen = false;
  const cb = onCloseCb; onCloseCb = null; if (cb) cb(); else if (relock && G.lock) G.lock();
}
export const modalOpen = () => $('modal').style.display === 'flex';
$('mClose').addEventListener('click', () => closeModal(true));

// ---------------- HUD ----------------
export function setArea(name, sub) { $('areaName').textContent = name; $('areaSub').textContent = sub; }
export function showHUD(on) { $('hud').classList.toggle('hidden', !on); }
export function updateHUD(dt, info) {
  const s = G.save;
  $('rGems').textContent = s.gems; $('rEss').textContent = s.essence; $('rMast').textContent = s.mastery;
  $('hpFill').style.width = (P.hp / P.maxHp * 100) + '%'; $('hpTxt').textContent = Math.ceil(P.hp);
  for (let i = 0; i < 2; i++) $('d' + i).classList.toggle('on', P.dashCharges > i);
  $('slotSword').classList.toggle('on', P.weapon === 'sword'); $('slotBow').classList.toggle('on', P.weapon === 'bow');
  const eq = b => { const w = s.weapons.find(x => x.uid === s.equipped[b]); return w ? WEAPON_ITEMS[w.id].name : b; };
  $('nmSword').textContent = eq('sword'); $('nmBow').textContent = eq('bow');
  $('cdSpell').style.transform = `scaleY(${P.spellCd / SPELLS.arc_pulse.cd})`;
  $('slotPet').style.opacity = s.petReleased ? 1 : 0.35;
  // crosshair
  const ring = $('ring'); ring.style.opacity = P.charging ? 1 : 0;
  ring.style.background = `conic-gradient(${P.charge >= 1 ? '#ffd24a' : 'rgba(255,255,255,.85)'} ${P.charge * 360}deg, rgba(255,255,255,.12) 0)`;
  G.hitMarker = Math.max(0, (G.hitMarker || 0) - dt); $('hitmark').style.opacity = G.hitMarker > 0 ? 1 : 0;
  const c = $('combo'); if (G.combo.count >= 3) { c.style.opacity = 1; c.textContent = `x${G.combo.count}`; } else c.style.opacity = 0;
  // hurt direction
  const hd = $('hurtDir'); if (G.hurtDir) { hd.style.opacity = Math.min(1, G.hurtDir.t * 1.5); hd.style.transform = `rotate(${-G.hurtDir.a * 180 / Math.PI}deg)`; } else hd.style.opacity = 0;
  // prompt
  const pr = $('prompt');
  if (P.prompt && !G.uiOpen) { const l = typeof P.prompt.label === 'function' ? P.prompt.label() : P.prompt.label; pr.innerHTML = `Press <b>E</b> · ${l}`; pr.style.display = 'block'; } else pr.style.display = 'none';
  // wave box
  if (info.wave) { $('waveBox').style.display = 'block'; $('waveTitle').textContent = info.wave; $('waveLeft').textContent = info.left; } else $('waveBox').style.display = 'none';
  // training arena
  const tb = $('trainBox'), inA = G.mode === 'lab' && G.level.inArena && G.level.inArena(P.pos);
  tb.style.display = inA ? 'block' : 'none';
  if (inA) { const now = G.time; G.dmgLog = G.dmgLog.filter(d => now - d.t < 3); $('tCombo').textContent = G.combo.count; $('tDps').textContent = Math.round(G.dmgLog.reduce((a, d) => a + d.amt, 0) / 3); }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').classList.remove('on'); }
}

// ---------------- helpers ----------------
const rar = r => `<span class="tag" style="color:${RARITY[r].color}">${RARITY[r].name}</span>`;
function statLine(it) {
  if (it.base === 'sword') return `Damage ×${it.dmg} · Speed ×${it.speed} · Reach ×${it.reach}`;
  return `Damage ×${it.dmg} · Draw speed ×${it.draw}`;
}

// ---------------- inventory / loadout ----------------
export function inventoryPanel(onChange) {
  let filter = 'all', sort = 'rarity';
  const render = body => {
    const s = G.save;
    let items = s.weapons.map(w => ({ ...w, it: WEAPON_ITEMS[w.id] })).filter(x => x.it && (filter === 'all' || x.it.base === filter));
    items.sort((a, b) => sort === 'rarity' ? RARITY[b.it.rarity].order - RARITY[a.it.rarity].order || a.it.name.localeCompare(b.it.name) : a.it.name.localeCompare(b.it.name));
    const souls = Object.entries(s.souls).filter(([, n]) => n > 0);
    body.innerHTML = `
      <div class="row"><b>Current build:</b> <span class="tag">🗡️ ${WEAPON_ITEMS[s.weapons.find(w => w.uid === s.equipped.sword).id].name}</span>
        <span class="tag">🏹 ${WEAPON_ITEMS[s.weapons.find(w => w.uid === s.equipped.bow).id].name}</span><span class="tag">🔮 Arc Pulse</span><span class="tag">🌀 Pip</span></div>
      <div class="row">Filter <select id="fSel"><option value="all">All weapons</option><option value="sword">Swords</option><option value="bow">Bows</option></select>
        Sort <select id="sSel"><option value="rarity">Rarity</option><option value="name">Name</option></select>
        <span class="muted small">Other weapon types (greatsword, daggers, spear, staff, gauntlets, magic vacuum) arrive in later updates.</span></div>
      <div class="grid">${items.map(x => {
        const eqd = s.equipped[x.it.base] === x.uid;
        return `<div class="card ${eqd ? 'eq' : ''}"><h3>${x.it.base === 'sword' ? '🗡️' : '🏹'} ${x.it.name}</h3>${rar(x.it.rarity)}<p>${statLine(x.it)}</p><p><i>${x.it.trait}</i></p>
          ${eqd ? '<span class="tag" style="color:#ffb347">Equipped</span>' : `<div class="btn small" data-eq="${x.uid}">Equip</div>`}</div>`;
      }).join('')}</div>
      <h3 style="margin-top:18px">Materials</h3>
      <div class="row"><span class="tag">💎 Gems: ${s.gems}</span><span class="tag">🟣 Soul Essence: ${s.essence}</span><span class="tag">✨ Magic Mastery: ${s.mastery}</span></div>
      <div class="grid">${souls.length ? souls.map(([id, n]) => `<div class="card"><h3 style="color:${SOULS[id].color}">${SOULS[id].name} ×${n}</h3><p>${SOULS[id].desc}</p><p class="muted">Use it at the Soul Forge (next update).</p></div>`).join('') : '<p class="muted">No Monster Souls yet. They are rare drops from enemies in campaigns.</p>'}</div>`;
    body.querySelector('#fSel').value = filter; body.querySelector('#sSel').value = sort;
    body.querySelector('#fSel').onchange = e => { filter = e.target.value; render(body); };
    body.querySelector('#sSel').onchange = e => { sort = e.target.value; render(body); };
    body.querySelectorAll('[data-eq]').forEach(b => b.onclick = () => { const uid = +b.dataset.eq; const w = s.weapons.find(x => x.uid === uid); s.equipped[WEAPON_ITEMS[w.id].base] = uid; onChange(); render(body); });
  };
  openModal('Inventory & Loadout', '', render);
}

// ---------------- campaign select ----------------
export function campaignPanel(onStart) {
  const s = G.save;
  const card = (id) => {
    const c = CAMPAIGNS[id], pr = s.progress[id];
    const lv = c.levels.map((l, i) => {
      const done = pr.cleared[i], avail = c.unlocked && l.implemented && (i === 0 || pr.cleared[i - 1]);
      const st = done ? '✔ Cleared' : avail ? '▶ Play' : l.implemented === false && c.unlocked ? 'Coming in a later update' : '🔒 Locked';
      return `<div class="lvl ${avail ? 'go' : ''}" ${avail ? `data-go="${id}:${i}"` : ''}><span>${i + 1}. ${l.name}</span><span class="st">${st}</span></div>`;
    }).join('');
    return `<div class="campCard"><div class="art" style="background:${c.bg}">${c.name}</div><div class="body">
      <div class="row" style="margin:0 0 8px"><span class="tag">${c.subtitle}</span>${c.unlocked ? '' : '<span class="tag">🔒 Unlocks through Jungle progression</span>'}</div>
      ${lv}
      <p><b>Best wave:</b> ${pr.bestWave} · <b>Difficulty:</b> ${c.difficulty}</p>
      <p><b>Enemies:</b> ${c.enemies.join(', ')}</p><p><b>Rewards:</b> ${c.rewards}</p></div></div>`;
  };
  const eqName = b => WEAPON_ITEMS[s.weapons.find(w => w.uid === s.equipped[b]).id].name;
  openModal('Campaign Portal', `<div class="row"><b>Equipped build:</b><span class="tag">🗡️ ${eqName('sword')}</span><span class="tag">🏹 ${eqName('bow')}</span><span class="tag">🔮 Arc Pulse</span><span class="tag">🌀 Pip (Orange Singularity Ring)</span></div>
    <div class="camp">${card('jungle')}${card('ice')}</div>`, body => {
    body.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { const [id, i] = b.dataset.go.split(':'); closeModal(false); onStart(id, +i); });
  });
}

// ---------------- stations ----------------
export function forgePanel() {
  const s = G.save, souls = Object.entries(s.souls).filter(([, n]) => n > 0);
  openModal('Soul Forge', `<p>The Soul Forge imprints a monster's soul (and optionally a pet ability) into a weapon, changing how it actually fights.
    <b>Enchanting arrives in the next update (Phase 4).</b> Your collected souls will be waiting.</p>
    <div class="row"><span class="tag">🟣 Soul Essence: ${s.essence}</span></div>
    <h3>Your Monster Souls</h3><div class="grid">${souls.length ? souls.map(([id, n]) => `<div class="card"><h3 style="color:${SOULS[id].color}">${SOULS[id].name} ×${n}</h3><p>${SOULS[id].desc}</p></div>`).join('') : '<p class="muted">None yet. Each enemy species has a rare soul (about 4% per kill, with hidden bad-luck protection).</p>'}</div>
    <h3>Known soul types</h3><div class="grid">${Object.entries(SOULS).map(([id, so]) => `<div class="card ${s.discovered.souls.includes(id) ? '' : 'locked'}"><h3 style="color:${so.color}">${s.discovered.souls.includes(id) ? so.name : '??? Soul'}</h3><p>From: ${ENEMIES[so.from] ? ENEMIES[so.from].name : 'an unknown jungle creature'}</p></div>`).join('')}</div>`);
}
export function archivePanel() {
  const s = G.save;
  openModal('Spell Archive', `<div class="row"><span class="tag">✨ Magic Mastery: ${s.mastery}</span><span class="muted small">Earn mastery by hitting real enemies with spells. Unlocking spells arrives in the next update.</span></div>
    <div class="grid">${Object.entries(SPELLS).map(([id, sp]) => { const has = s.spells.includes(id); return `<div class="card ${has ? 'eq' : 'locked'}"><h3>${has ? '🔮' : '🔒'} ${sp.name}</h3><p>${sp.desc}</p><p>${has ? '<span class="tag" style="color:#8f8">Unlocked</span>' : `<span class="tag">Cost: ${sp.cost} ✨</span>`}</p></div>`; }).join('')}</div>
    <h3 style="margin-top:16px">Hybrid spells</h3><div class="grid">${SPELL_COMBOS.map(() => `<div class="card locked"><h3>??? + ???</h3><p>An undiscovered combination. Unlock two compatible spells and experiment.</p></div>`).join('')}</div>`);
}
export function sanctuaryPanel() {
  const s = G.save;
  openModal('Pet Sanctuary', `<div class="row"><span class="tag">💎 Gems: ${s.gems}</span><span class="muted small">Save up gems from monster drops to adopt a specific pet. Adoption arrives in the next update.</span></div>
    <div class="grid">${Object.entries(PETS).map(([id, p]) => { const has = s.pets.includes(id); return `<div class="card ${has ? 'eq' : 'locked'}"><h3>${has ? '🌀' : '🔒'} ${p.name}${p.nick ? ` "${p.nick}"` : ''}</h3><p><b>${p.ability}:</b> ${p.desc}</p><p>${has ? '<span class="tag" style="color:#8f8">Your companion</span>' : `<span class="tag">${Math.min(s.gems, p.cost)} / ${p.cost} 💎</span>`}</p></div>`; }).join('')}</div>`);
}

// ---------------- results ----------------
export function resultsPanel(kind, run, onReturn) {
  const title = kind === 'victory' ? 'LEVEL CLEARED' : kind === 'retreat' ? 'RETREATED' : 'DEFEATED';
  const msg = kind === 'victory' ? 'The Overgrown Path is yours.' : kind === 'retreat' ? 'You slipped back through the portal.' : 'Pip drags you back through the portal. Try a new build and go again!';
  const rewards = run.rewards.length ? run.rewards.map(r => `<div class="card"><h3>${r.title}</h3><p>${r.text}</p></div>`).join('') : '<p class="muted">No waves completed this time, so no completion rewards. Everything you picked up is kept.</p>';
  openModal('Results', `<div class="big">${title}</div><p style="text-align:center">${msg}</p>
    <div class="stats"><div><b>${run.kills}</b>Enemies defeated</div><div><b>${run.wavesCleared} / 3</b>Waves cleared</div><div><b>${run.drops.gems}</b>Gems collected</div></div>
    <h3>Rewards kept</h3><div class="grid">${rewards}</div>
    ${run.drops.souls.length ? `<h3>New discoveries</h3><div class="grid">${run.drops.souls.map(id => `<div class="card"><h3 style="color:${SOULS[id].color}">${SOULS[id].name}</h3><p>${SOULS[id].desc}</p></div>`).join('')}</div>` : ''}
    <div class="row" style="justify-content:center;margin-top:18px"><span class="tag">🟣 +${run.drops.essence} Soul Essence</span><span class="tag">✨ +${run.mastery} Magic Mastery</span></div>
    <div class="btnrow"><div class="btn" id="resBtn">Return to the Laboratory</div></div>`,
    body => { body.querySelector('#resBtn').onclick = () => closeModal(false); }, () => onReturn());
}
