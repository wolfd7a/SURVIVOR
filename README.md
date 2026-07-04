# Nightfall Swarm

A browser-based, Vampire Survivors-inspired arena game. Auto-firing weapons,
escalating hordes, and periodic bosses whose attacks require you to actually
read the arena and move to the right spot at the right time. Progress persists
across deaths: cores earned each run buy permanent upgrades for future runs.

No build step, no dependencies — plain HTML/CSS/JS.

## Play it

```
python3 -m http.server 8000
```

Then open `http://localhost:8000` in a browser (ES modules require serving
over `http://`, not `file://`).

**Controls:** WASD or arrow keys to move, or drag anywhere on screen with a
mouse/finger to use the virtual joystick (built for touch, works with mouse
too). Weapons fire automatically at the nearest enemy. `Esc` or the on-screen
pause button pauses.

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

## Core loop

- Survive an escalating horde. Enemies get faster, tankier, and more frequent
  the longer you last, and new enemy types (ranged shooters, tanky brutes)
  unlock over time.
- Kill enemies to drop XP orbs; level up and pick one of three random
  upgrades — a new weapon, a weapon upgrade, or a stat boost.
- Every 90+ seconds a **boss** spawns. Bosses telegraph their attacks:
  - **Slam** — a growing warning circle marks where damage lands; get out of it.
  - **Charge** — a warning lane shows the dash path; step off the line.
  - **Weak Point** — a glowing ring appears somewhere in the arena. Stand
    inside it for about a second before the window closes and the boss is
    stunned and takes a heavy damage tick. Miss the window and nothing
    happens — the pattern just moves on. This is the one attack you can't
    win by dodging; you have to commit to a position and time it.
- Die, and the run ends. Time survived, kills, and bosses defeated convert
  into **Cores**.
- Spend Cores in the **Upgrade Shop** (from the main menu) on permanent,
  run-independent bonuses — more max HP, move speed, damage, pickup radius,
  armor, attack speed. These persist across browser sessions (`localStorage`)
  and apply to every future run, so each death still moves you forward.
- Max out a weapon (level 8) and its next level-up choice becomes a
  guaranteed **Evolution** — Arcane Bolt becomes the piercing **Starfall
  Lance**, Void Orbs becomes the bigger/faster **Void Halo**, and Shock Nova
  becomes the huge-radius **Cataclysm**. Each evolution gets its own color
  and a real damage/behavior jump, not just bigger numbers.
- Starting ~45 seconds in, and roughly every 40-60 seconds after that, an
  **Elite** spawns — a buffed variant of a regular enemy type (4x HP, tougher
  hits, marked with a spinning gold ring and a gold health bar) that drops
  bonus Cores and XP. A minimap in the corner shows elites, regular enemies,
  and the boss even when they're off-screen in the (fairly large) arena.

## Sound

All audio is synthesized live with the Web Audio API (`js/audio.js`) — no
sound files. Hits, kills, level-ups, boss spawns/stuns/kills, and a low
ambient drone during runs are all generated from oscillators and a noise
buffer. There's a mute toggle on the main menu; the preference persists
across sessions. Sound only starts after your first click/tap, per browser
autoplay rules.

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
action games do.

## Project layout

```
index.html          canvas + all DOM overlays (menu/shop/story/level-up/game over) + joystick markup
css/style.css        visual styling for HUD, overlays, joystick, mobile controls
js/
  utils.js           math/random helpers
  save.js            localStorage persistence + permanent upgrade definitions
  weapons.js          weapon stat curves + evolved forms (Arcane Bolt / Void Orbs / Shock Nova)
  lore.js            backstory + per-boss lore text
  audio.js           Web Audio synthesized SFX + ambient drone (no audio files)
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
