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

**Controls:** WASD or arrow keys to move. Weapons fire automatically at the
nearest enemy. `Esc` pauses.

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

## Project layout

```
index.html          canvas + all DOM overlays (menu/shop/level-up/game over)
css/style.css        visual styling for HUD + overlays
js/
  utils.js           math/random helpers
  save.js            localStorage persistence + permanent upgrade definitions
  weapons.js          weapon stat curves (Arcane Bolt / Void Orbs / Shock Nova)
  entities.js        Player, Enemy, Projectile, XPOrb, Particle
  boss.js            Boss state machine (slam / charge / weak-point patterns)
  upgrades.js        level-up card pool generation
  game.js            game state, spawner/difficulty curve, collision, render
  ui.js              DOM overlay + HUD rendering
  main.js            bootstraps canvas, input, game loop
```

## Notes

- `window.game` is exposed in `main.js` as a debug/QA hook (harmless — just a
  reference to the running `Game` instance for poking at from devtools).
- Nothing here is IP-sensitive; it's an original arena/weapon/upgrade set
  inspired by the genre, not a clone of any specific game's assets or code.
