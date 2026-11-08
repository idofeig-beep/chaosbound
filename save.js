// =====================================================================
// CHAOSBOUND: versioned save system (localStorage)
// =====================================================================
const KEY = 'chaosbound_save';
export const SAVE_VERSION = 1;

export function defaultSave() {
  return {
    version: SAVE_VERSION, day: 1, petReleased: false,
    mastery: 0, gems: 0, essence: 0,
    souls: {},            // soulId -> count
    pity: {},             // enemyType -> kills since last soul (hidden bad-luck protection)
    weapons: [{ uid: 1, id: 'training_sword' }, { uid: 2, id: 'hunting_bow' }],
    equipped: { sword: 1, bow: 2 }, activeWeapon: 'sword', nextUid: 3,
    spells: ['arc_pulse'], pets: ['black_hole'], activePet: 'black_hole',
    progress: { jungle: { cleared: [false, false, false, false, false], bestWave: 0 }, ice: { cleared: [false, false, false, false, false], bestWave: 0 } },
    discovered: { souls: [], weapons: ['training_sword', 'hunting_bow'] },
    stats: { kills: 0, deaths: 0 },
    settings: { sens: 1, shake: 1, fovFx: true, motion: true },
  };
}
function merge(base, data) {
  for (const k in base) {
    if (!(k in data)) data[k] = base[k];
    else if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) merge(base[k], data[k]);
  }
  return data;
}
export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw);
    // future migrations go here: if (data.version < 2) { ... }
    data.version = SAVE_VERSION;
    return merge(defaultSave(), data);
  } catch (e) { return defaultSave(); }
}
export function writeSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
export function hasSave() { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } }
export function wipeSave() { try { localStorage.removeItem(KEY); } catch (e) {} }
