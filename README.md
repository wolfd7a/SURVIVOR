# Nightfall Swarm

A browser-based, Vampire Survivors-inspired arena game. Auto-firing weapons,
escalating hordes, and periodic bosses whose attacks require you to actually
read the arena and move to the right spot at the right time. Progress persists
across deaths: cores earned each run buy permanent upgrades, and unlock new
playable characters, for future runs.

No build step, no dependencies — plain HTML/CSS/JS. Plays with keyboard,
touch, or **gamepad**; renders at native pixel density (crisp on retina/4K);
installable as a PWA and works offline after the first load; ships to
desktop/Steam via the included Electron shell.

## Play it

```
python3 -m http.server 8000
```

Then open `http://localhost:8000` in a browser (ES modules require serving
over `http://`, not `file://`).

**Controls:** WASD/arrows, gamepad left stick or d-pad, or drag anywhere on
screen for the virtual joystick (touch or mouse). Weapons fire automatically.
`Esc`/Start pauses; on a pad, d-pad + A picks level-up cards and A confirms
menus. `F` or the menu button toggles fullscreen.

## Story

*How the Dark Won* — when the last sun went out, the world's cracks started
bleeding monsters. You died on the first night; an ember off the dying sky
stitched you back together wrong on purpose, cursed to return every time you
fall. Every kill feeds the ember; every ember buys you a little more staying
power. Four old Kings out in the dark still remember what the world was
before you (sorry — before *it*) burned. The opening beat plays automatically
the first time you ever load the game (tracked in `localStorage`, once only);
full text and boss lore are always available from the in-game **Story**
screen (`js/lore.js`).

The first time you fell the fourth King, Warden of the Pit, the run pauses
for a one-time **epilogue** beat closing out the four-boss arc — then hands
control right back, because the dark doesn't actually end and neither does
the run. Bosses keep spawning (and scaling up) past that point for however
long you can last.

## Characters

Three playable characters, each with its own palette, stat spread, and
starting weapon — unlocked with Cores from the main menu:

- **The Cinderborn** (free) — balanced; starts with Arcane Bolt.
- **The Shade** (150 Cores) — +22% speed, +8% damage, but 72 max HP; starts
  with Ember Trail. The kiting character.
- **The Bulwark** (150 Cores) — 140 HP and 8% innate armor at -16% speed and
  -5% damage; starts with Void Orbs. The brawler.

## Core loop

- Survive an escalating horde. Enemies get faster, tankier, and more frequent
  the longer you last, and new enemy types (ranged shooters, tanky brutes)
  unlock over time.
- Kill enemies to drop XP orbs; level up and pick one of three random
  upgrades — a new weapon, a weapon upgrade, or a stat boost.
- Every 90+ seconds a **boss** spawns. All four share a core kit, plus each
  has one signature move of its own so the fights don't just feel like
  palette swaps:
  - **Slam** (all bosses) — a growing warning circle marks where damage
    lands; get out of it.
  - **Charge** (all bosses) — a warning lane shows the dash path; step off
    the line.
  - **Weak Point** (all bosses) — a glowing ring appears somewhere in the
    arena. Stand inside it for about a second before the window closes and
    the boss is stunned and takes a heavy damage tick. Miss the window and
    nothing happens. This is the one attack you can't win by dodging; you
    have to commit to a position and time it.
  - **Summon** (Matriarch of Ash, boss 2) — calls in extra regular enemies
    mid-fight, so you're managing a small swarm and the boss at once.
  - **Gaze** (The Unblinking, boss 3) — telegraphs a line, then sweeps a
    continuous damage beam across the arena; you have to move with the
    sweep, not just away from a point.
  - **Pits** (Warden of the Pit, boss 4+) — opens 2-3 simultaneous
    telegraphed zones instead of one, so you're threading a gap rather than
    running from a single circle.
- Die, and the run ends. Time survived, kills, and bosses defeated convert
  into **Cores**.
- Spend Cores in the **Upgrade Shop** (from the main menu) on permanent,
  run-independent bonuses — more max HP, move speed, damage, pickup radius,
  armor, attack speed. These persist across browser sessions (`localStorage`)
  and apply to every future run, so each death still moves you forward.
- Five weapons, carry up to four: **Arcane Bolt** (auto-aimed piercing
  shots), **Void Orbs** (orbiting melee shield), **Shock Nova** (periodic
  self-centered pulse), **Ember Trail** (burning ground left behind while
  you move), and **Stormbrand** (chain lightning arcing between packed
  enemies — the anti-swarm pick). Max any weapon out (level 8) and its next
  level-up becomes a guaranteed **Evolution** into a stronger,
  distinctly-colored form (Starfall Lance, Void Halo, Cataclysm, Wildfire
  Wake, Tempest) with a real behavior jump, not just bigger numbers.
- Starting ~45 seconds in, and roughly every 40-60 seconds after that, an
  **Elite** spawns — a buffed variant of a regular enemy type (4x HP, tougher
  hits, marked with a spinning gold ring and a gold health bar) that drops
  bonus Cores and XP. A minimap in the corner shows elites, regular enemies,
  and the boss even when they're off-screen in the (fairly large) arena.

## Sound & accessibility

All audio is synthesized live with the Web Audio API (`js/audio.js`) — no
sound files. Hits, kills, level-ups, boss spawns/stuns/kills, and a low
ambient drone during runs are all generated from oscillators and a noise
buffer. The main menu has a mute toggle and a volume slider, both persisted
across sessions. Sound only starts after your first click/tap, per browser
autoplay rules.

There's also a **Reduce screen shake & flash** checkbox (`js/settings.js`)
for players sensitive to the hit-stop/flash/shake feedback — it scales all
three down to a fraction rather than removing feedback entirely.

## Art & mobile

Everything here is drawn procedurally on canvas — no image/sprite assets —
styled as a dark, glowing vector-silhouette look:

- The player is an animated hooded figure (walk cycle, trailing cloak, a
  pulsing ember held in hand) rather than a plain circle.
- Each enemy type has its own silhouette and motion: the **Husk** is a
  hunched shambler dragging one arm, the **Wretch** is a low four-legged
  sprinter, the **Bonecrusher** is a spike-shouldered brute with a heavy
  stomp, and the **Weeper** is a floating eye that visibly charges before it
  fires.
- Bosses are a crystalline core with a rotating shard ring, visible cracks
  that spread as their HP drops, and a color/aura shift when stunned.
- The arena has a soft vignette, scattered environmental decoration (rocks,
  bones, dead bramble, cracks) generated procedurally per arena cell, and
  drifting ember particles for atmosphere.

Mobile/touch is a first-class input: dragging anywhere spawns a virtual
joystick under your finger (`js/main.js` + `#joystick-zone` in `index.html`),
touch targets are large, pinch-zoom/scroll are disabled during play, and
there's an on-screen pause button alongside the `Esc` key.

Big hits get a beat of **hit-stop** (a few frames of extreme slow-motion, not
a full freeze) plus a matching screen-color flash — on a boss weak-point
stun, a boss kill, and an elite kill — to sell impact the way most modern
action games do. Weapon hits also apply directional **knockback**: bolts
shove along their flight path, novas blast radially outward, orbs bat
enemies away. Elites resist most of it; bosses ignore it entirely so their
attack patterns stay authored, not physics-driven.

Your current build is always visible: a HUD chip row (bottom-left) shows
each owned weapon's level (gold-rimmed once evolved), a kill counter sits
under the timer, and pausing shows the full loadout — every weapon's live
stats plus your accumulated bonuses (damage, attack speed, armor, regen,
pickup radius, move speed).

## Platform & shipping

- **Gamepad**: standard-mapping pads work everywhere — stick/d-pad to move,
  Start to pause, A to confirm and pick level-up cards (d-pad to choose).
- **High-DPI**: the canvas backing store scales to `devicePixelRatio`
  (capped at 2.5x), so the game is pixel-crisp on retina and 4K displays.
- **Performance**: all high-count glow effects (projectiles, orbs, embers,
  fire patches, enemy eyes) render from pre-built gradient sprites instead
  of per-frame canvas `shadowBlur`, which is the classic canvas frame-rate
  killer at horde scale.
- **PWA**: `manifest.json` + a network-first service worker make the game
  installable (Add to Home Screen / desktop install) and fully playable
  offline after the first visit. Icons are generated, not stock.
- **Steam / desktop**: `electron/` contains a minimal shell that loads the
  same web build in a desktop window (`cd electron && npm install && npm
  start`). Package with electron-builder for Steam depots. The shell is
  standard boilerplate — verify locally before shipping; CI here only tests
  the browser build.

## Project layout

```
index.html          canvas + all DOM overlays (menu/shop/story/level-up/game over) + joystick markup
css/style.css        visual styling for HUD, overlays, joystick, mobile controls
js/
  utils.js           math/random helpers
  save.js            localStorage persistence + permanent upgrade definitions
  weapons.js          weapon stat curves + evolved forms (5 weapons)
  lore.js            backstory + per-boss lore text
  characters.js      playable character definitions (stats, palettes, unlocks)
  fx.js              cached glow-sprite renderer (perf)
  audio.js           Web Audio synthesized SFX + ambient drone (no audio files)
  settings.js        persisted accessibility settings (reduce effects)
  entities.js        Player, Enemy, Projectile, XPOrb, Particle + all procedural art
  boss.js            Boss state machine (slam / charge / weak-point patterns) + boss art
  upgrades.js        level-up card pool generation (incl. weapon evolutions)
  game.js            game state, spawner/difficulty curve, collision, render, environment art
  ui.js              DOM overlay + HUD rendering (incl. first-run intro, story screen)
  main.js            bootstraps canvas, input (keyboard + virtual joystick), audio unlock, game loop
```

## Notes

- `window.game` is exposed in `main.js` as a debug/QA hook (harmless — just a
  reference to the running `Game` instance for poking at from devtools).
- Nothing here is IP-sensitive; it's an original arena/weapon/upgrade set and
  original backstory inspired by the genre, not a clone of any specific
  game's assets, code, or story.
- All art is procedural canvas drawing — there's no image-generation step in
  this project's toolchain, so "art" here means vector shapes, animation, and
  lighting rather than sprite sheets. Swap in real sprites under `entities.js`
  / `boss.js`'s `draw()` methods if you have some.
