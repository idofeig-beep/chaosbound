# CHAOSBOUND: development notes (read me first, Claude!)

A first-person 3D fantasy action game for the browser (three.js r160, no build step).
Live: https://idofeig-beep.github.io/chaosbound/

Built from the CHAOSBOUND design document, adapted to **first-person** and **browser** (not Unity) at the owner's request.

## How we work
- Always start from the newest files in this repo and check again right before saving, so you never erase the other person's work.
- Keep the files flat in the repo root (GitHub Pages serves `index.html`).
- Be honest in this file about what is implemented, what was tested, and what is not.

## Files
| File | What it is |
|---|---|
| `index.html`, `style.css` | HUD + menus markup and styling |
| `main.js` | Bootstrap and game flow: title, lab, campaign levels, waves, rewards, results, saving, pause/settings |
| `core.js` | Renderer, post-processing (bloom, grading, MSAA), procedural textures, sky shader, grass, sound effects, helpers, global state `G` |
| `physics.js` | Collision world: axis-aligned boxes, vertical cylinders, terrain height, line of sight |
| `player.js` | First-person controller: run, sprint, dash charges (ground + air), slide, jump buffering + coyote time + variable height, wall-run + wall-jump, camera effects; sword (3-hit combo, launcher, aerial plunge), bow (charge, aerial slow-fall), Arc Pulse spell |
| `pet.js` | Pip the baby black hole: follow behaviour (keeps its own spot, doesn't copy your camera), looks at points of interest, reacts, Orange Singularity Ring attack |
| `enemies.js` | Enemy models + combat AI, attack-token director, enemy projectiles, training dummies, loot pickups |
| `fx.js` | Particles, slash arcs, impact rings, telegraph decals, damage numbers |
| `lab.js` | The Laboratory hub (safe) |
| `jungle.js` | The Verdant Ruins arena (Level 1) |
| `ui.js` | HUD updates, inventory/loadout, campaign select, station panels, results |
| `content.js` | **All content data**: weapons, loot pools, spells, spell combos, pets, souls, enemies, campaigns |
| `save.js` | Versioned localStorage save with merge-on-load migration |

## Implemented (Phases 1–3)
- **Laboratory**: wake up on Day 1, glass tube with Pip (E to release), Soul Forge, Spell Archive, Pet Sanctuary, weapon rack (inventory), Campaign Portal, Training Arena (stationary dummies, moving dummy, aerial targets, projectile turret, practice goblin with an idle/fight lever, combo + DPS readout, wall-run wall and platforms). Floating books, crystals, gears, candles, potions.
- **Movement**: run 7.4 m/s, sprint 11, accel-based ground movement, air steering, 2 dash charges (1.1 s regen, 1 air dash per airtime, short i-frames), slide (passes under the Vine Stalker's thrust), jump buffer 0.15 s, coyote 0.12 s, variable jump height, wall-run (hold W along a wall), wall-jump (also from plain wall contact), step-up onto 0.5 m ledges.
- **Camera**: mouse-spike filter, smoothed look, FOV kick on sprint/dash/slide, bow zoom, wall-run roll, landing dip, head-bob, configurable shake/FOV/motion/sensitivity in the pause menu.
- **Combat**: sword 3-hit combo with slash arcs, hit-stop, finisher stagger + knockback, hold for launcher (juggles small enemies, you hop up to follow), hold in air for plunge shockwave; bow with charged shots, headshots, sticking arrows; Arc Pulse spell (grants Magic Mastery only on real-enemy hits, so it can't be farmed on walls or dummies); damage numbers, combo counter, hit marker, hurt direction indicator.
- **Enemies**: Jungle Goblin Raider (flanks via orbit + separation, attack tokens, telegraphed two-hit combo with limited turn speed so you can dodge, leap slash to punish retreating with a landing marker, side-dodges incoming shots, staggerable windups). Vine Stalker (keeps medium range, telegraphed long thrust line, interception leap when you run away, led vine-snare projectile that slows you, sidesteps shots).
- **Level 1 (The Overgrown Path)**: 3 waves (3 R / 4 R + 1 VS / 3 R + 2 VS), wave rewards (guaranteed weapon from the jungle loot pool, mastery, essence), gem + essence drops, rare species souls (4% with hidden pity at 28 kills), defeat → results screen → back to lab, retreat option, progress saved.
- **Jungle arena**: stepped ziggurat, broken pillars, guardian statue, ruined walls for wall-running, two raised platforms with a broken bridge, giant trees with roots and vines, waterfall + pool, glowing plants, ferns, dense grass, spores, light shafts, arrival portal.

## Tested (automated, headless Chrome with software WebGL)
- Loads with no JavaScript errors; title, lab, arena, jungle and results screens render.
- Simulated: sword combo, launcher and spell hit the training dummy; bow charge and shot hit; running 7.2 m/s; dash 3.9 m in 0.2 s; sprint 11 m/s; slide; jump and landing; wall-run triggers along the arena wall; full level flow (3 waves → rewards → results); Raider AI states (chase, windup, strike, gap, recover); Vine Stalker states (thrust prep, thrust, snare, recover).
- **Not tested by a human with a mouse yet**: the feel of movement, camera and difficulty needs real playtesting and tuning.

## Not implemented yet (planned phases)
- Phase 4: Soul Forge enchanting (souls/pet abilities changing weapons, hybrid enchantments), unlocking spells with mastery, spell combinations, adopting pets with gems. (Panels already show the data.)
- Jungle levels 2–5 (Spore Alchemist, Canopy Hunter, Barkguard Brute, Thorn Sovereign boss), Ice campaign, other weapon types, saved multiple loadouts, dynamic music.

## How to add things
- **Enemy**: add stats to `ENEMIES` in `content.js`, build a model + an `aiXxx(e, dt)` function in `enemies.js`, dispatch it in `updateEnemies`, then use it in a level's `waves`.
- **Weapon item**: add to `WEAPON_ITEMS` (base `sword`/`bow` for now) and to a `LOOT` pool. `special` hooks live in `player.js` (`shockwave`, `pierce`).
- **Spell**: add to `SPELLS`; casting lives in `player.js` (`castSpell`).
- **Pet**: add to `PETS`; behaviour lives in `pet.js`.
- **Level / campaign**: add to `CAMPAIGNS`; environment builders return `{ scene, world, spawn, spawnPoints, update }` (see `jungle.js`).
