// =====================================================================
// CHAOSBOUND: content definitions. Add new weapons, spells, pets, souls,
// enemies and campaigns here; the systems read from these tables.
// =====================================================================

export const RARITY = {
  common: { name: 'Common', color: '#c9c9c9', order: 0 },
  uncommon: { name: 'Uncommon', color: '#6fdc6f', order: 1 },
  rare: { name: 'Rare', color: '#5ab4ff', order: 2 },
  epic: { name: 'Epic', color: '#c47cff', order: 3 },
};

// Base weapon types. `implemented` = playable in this build.
export const BASE_WEAPONS = {
  sword: { name: 'Sword', implemented: true, desc: 'Fast melee attacks and fluid combo chains. Hold attack for a launcher; attack in the air and hold for a plunge.' },
  bow: { name: 'Bow', implemented: true, desc: 'Fast ranged combat, charged shots and aerial shots. Drawing in the air slows your fall.' },
  greatsword: { name: 'Greatsword', implemented: false, desc: 'Heavy stagger, sweeping strikes, powerful finishers.' },
  daggers: { name: 'Dual Daggers', implemented: false, desc: 'Extremely fast attacks, mobility and evasive combos.' },
  spear: { name: 'Spear', implemented: false, desc: 'Reach, precision, thrusting and aerial juggling.' },
  staff: { name: 'Magic Staff', implemented: false, desc: 'Spell amplification and ranged magical attacks.' },
  gauntlets: { name: 'Gauntlets', implemented: false, desc: 'Close-range combat, launchers and rapid combinations.' },
  vacuum: { name: 'Magic Vacuum', implemented: false, desc: 'Pull, capture, redirect and launch objects or enemies.' },
};

// Individual weapon items (loot). dmg/speed/reach/draw are multipliers; `special` changes mechanics.
export const WEAPON_ITEMS = {
  training_sword: { base: 'sword', name: 'Lab Training Sword', rarity: 'common', dmg: 1, speed: 1, reach: 1, color: 0xc8d0dc, glow: 0x7ab8ff, trait: 'Balanced and reliable.' },
  hunting_bow: { base: 'bow', name: 'Old Hunting Bow', rarity: 'common', dmg: 1, draw: 1, color: 0x8a5230, trait: 'A sturdy starter bow.' },
  rusty_scimitar: { base: 'sword', name: 'Rusty Curved Sword', rarity: 'common', dmg: 0.92, speed: 1.18, reach: 0.95, color: 0x9a6a4a, glow: 0xff9a4a, trait: 'Quicker swings, slightly shorter.' },
  vinewood_bow: { base: 'bow', name: 'Vinewood Shortbow', rarity: 'common', dmg: 0.9, draw: 1.35, color: 0x5a7a30, trait: 'Draws much faster.' },
  moss_edge: { base: 'sword', name: 'Moss-Edge Blade', rarity: 'uncommon', dmg: 1.15, speed: 0.95, reach: 1.15, color: 0x7aa070, glow: 0x7aff8a, trait: 'Longer reach, heavier hits.' },
  thornstring: { base: 'bow', name: 'Thornstring Bow', rarity: 'uncommon', dmg: 1.25, draw: 0.9, color: 0x4a6a2a, trait: 'Heavy arrows, slower draw.' },
  ruin_saber: { base: 'sword', name: 'Ruin Saber', rarity: 'rare', dmg: 1.1, speed: 1.08, reach: 1.05, color: 0xd8c890, glow: 0xffd24a, special: 'shockwave', trait: 'Combo finisher releases a short forward shockwave.' },
  canopy_longbow: { base: 'bow', name: 'Canopy Longbow', rarity: 'rare', dmg: 1.12, draw: 1.1, color: 0x8a6a3a, special: 'pierce', trait: 'Fully charged arrows pierce through enemies.' },
};

// Loot pools per campaign: [itemId, weight]
export const LOOT = {
  jungle: [['rusty_scimitar', 30], ['vinewood_bow', 30], ['moss_edge', 15], ['thornstring', 15], ['ruin_saber', 5], ['canopy_longbow', 5]],
};

export const SPELLS = {
  arc_pulse: { name: 'Arc Pulse', cost: 0, implemented: true, cd: 0.8, desc: 'Fast basic magic projectile. Hitting enemies grants Magic Mastery.' },
  ember_lance: { name: 'Ember Lance', cost: 40, desc: 'Piercing fire projectile.' },
  frost_bind: { name: 'Frost Bind', cost: 45, desc: 'Temporarily slows or restricts enemy movement.' },
  gravity_knot: { name: 'Gravity Knot', cost: 60, desc: 'Creates a short-lived pulling field.' },
  wind_burst: { name: 'Wind Burst', cost: 40, desc: 'Pushes enemies and can propel the player.' },
  chain_spark: { name: 'Chain Spark', cost: 55, desc: 'Electrical attack that jumps between nearby targets.' },
  mirror_veil: { name: 'Mirror Veil', cost: 70, desc: 'Briefly reflects certain projectiles.' },
  phantom_step: { name: 'Phantom Step', cost: 50, desc: 'Short magical repositioning movement.' },
  stone_breaker: { name: 'Stone Breaker', cost: 65, desc: 'Heavy ground-impact attack.' },
  void_needle: { name: 'Void Needle', cost: 75, desc: 'Precise projectile that penetrates weakened targets.' },
};
// Hybrid recipes (shown as mysteries until discovered)
export const SPELL_COMBOS = [
  { a: 'ember_lance', b: 'wind_burst', name: 'Inferno Spiral' },
  { a: 'gravity_knot', b: 'chain_spark', name: 'Storm Prison' },
  { a: 'phantom_step', b: 'mirror_veil', name: 'Reflection Dash' },
  { a: 'frost_bind', b: 'stone_breaker', name: 'Glacier Shatter' },
  { a: 'void_needle', b: 'gravity_knot', name: 'Singularity Spear' },
];

export const PETS = {
  black_hole: { name: 'Baby Black Hole', nick: 'Pip', cost: 0, ability: 'Orange Singularity Ring', desc: 'Launches glowing orange rings at nearby threats.' },
  ember_imp: { name: 'Ember Imp', cost: 60, ability: 'Delayed Fireballs', desc: 'Launches fireballs that explode after a short delay.' },
  frost_sprite: { name: 'Frost Sprite', cost: 80, ability: 'Frost Fields', desc: 'Creates slowing frost fields.' },
  storm_fox: { name: 'Storm Fox', cost: 120, ability: 'Chain Lightning', desc: 'Produces chain-lightning attacks.' },
  thornling: { name: 'Thornling', cost: 100, ability: 'Binding Vines', desc: 'Creates temporary magical vines that restrain enemies.' },
  echo_wisp: { name: 'Echo Wisp', cost: 150, ability: 'Echo', desc: "Repeats part of the player's previous magical attack." },
};

export const SOULS = {
  ambush: { name: 'Ambush Soul', from: 'raider', color: '#ff9a4a', desc: 'Additional attacks or rapid follow-up strikes under specific conditions.' },
  binding: { name: 'Binding Soul', from: 'vine_stalker', color: '#7aff8a', desc: 'Creates temporary tethering or restraining effects.' },
  spore: { name: 'Spore Soul', from: 'spore_alchemist', color: '#d6ff5a', desc: 'Explosive growths or delayed secondary effects.' },
  hunter: { name: 'Hunter Soul', from: 'canopy_hunter', color: '#ffd24a', desc: 'Tracking or precision-triggered effects.' },
  bulwark: { name: 'Bulwark Soul', from: 'barkguard_brute', color: '#c08a5a', desc: 'Shockwaves, defensive impacts or heavy stagger.' },
};
export const SOUL_DROP_CHANCE = 0.04;  // per kill
export const SOUL_PITY = 28;           // guaranteed by this many kills of a species without a drop

export const ENEMIES = {
  raider: { name: 'Jungle Goblin Raider', hp: 46, speed: 6.3, dmg: 8, soul: 'ambush', gems: [1, 2], essence: 2, scale: 1 },
  vine_stalker: { name: 'Vine Stalker', hp: 82, speed: 5.0, dmg: 14, soul: 'binding', gems: [2, 3], essence: 4, scale: 1.35 },
};

export const CAMPAIGNS = {
  jungle: {
    name: 'The Verdant Ruins', subtitle: 'Jungle Campaign', unlocked: true, color: '#5adc7a', bg: 'linear-gradient(135deg,#0f3a1e,#2f6a2a 50%,#c8a24a)',
    difficulty: 'Starts manageable, grows dangerous',
    enemies: ['Jungle Goblin Raider', 'Vine Stalker', 'Spore Alchemist', 'Canopy Hunter', 'Barkguard Brute', 'The Thorn Sovereign (boss)'],
    rewards: 'Jungle weapons, Gems, Soul Essence, rare Monster Souls, Magic Mastery',
    levels: [
      { name: 'The Overgrown Path', implemented: true, waves: [{ raider: 3 }, { raider: 4, vine_stalker: 1 }, { raider: 3, vine_stalker: 2 }] },
      { name: 'Spore Hollow', implemented: false },
      { name: 'The Forgotten Canopy', implemented: false },
      { name: 'Temple of Roots', implemented: false },
      { name: "The Sovereign's Throne", implemented: false },
    ],
  },
  ice: {
    name: 'The Frozen Dominion', subtitle: 'Ice Campaign', unlocked: false, color: '#8ad8ff', bg: 'linear-gradient(135deg,#0a1a3a,#3a6a9a 50%,#d8f0ff)',
    difficulty: 'Hard. Unlocks through Jungle progression',
    enemies: ['Frost Skirmisher', 'Glacial Marksman', 'Icebinder Mage', 'Rime Sentinel', 'Snow Prowler', 'The Whiteout Empress (boss)'],
    rewards: 'Ice weapons, Gems, Soul Essence, rare Monster Souls, Magic Mastery',
    levels: [
      { name: 'Frozen Outskirts' }, { name: 'Crystal Caverns' }, { name: 'The Shattered Glacier' }, { name: 'The Frost Citadel' }, { name: 'Palace of the Whiteout' },
    ],
  },
};

export const WAVE_REWARD = { mastery: 6, essence: 3 };
