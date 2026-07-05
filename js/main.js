import { Game } from "./game.js";
import * as ui from "./ui.js";
import { audio } from "./audio.js";
import * as settings from "./settings.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Render at native pixel density (capped — beyond ~2.5x the fill cost outweighs
// any visible sharpness gain). All game code draws in 960x600 logical units;
// the transform set each frame maps that onto the scaled backing store.
let dpr = 1;
function setupCanvasResolution() {
  dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  canvas.width = Math.round(960 * dpr);
  canvas.height = Math.round(600 * dpr);
}
setupCanvasResolution();
window.addEventListener("resize", setupCanvasResolution);

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen?.();
  }
}

const game = new Game({
  onLevelUp: (choices, onPick) => ui.showLevelUp(choices, onPick),
  onGameOver: (stats) => ui.showGameOver(stats),
  onBossStart: () => {},
  onBossEnd: () => {},
  onEpilogue: (onContinue) => ui.showEpilogue(onContinue),
});
window.game = game; // debug/QA hook, harmless in production

const KEY_MAP = {
  KeyW: "up", ArrowUp: "up",
  KeyS: "down", ArrowDown: "down",
  KeyA: "left", ArrowLeft: "left",
  KeyD: "right", ArrowRight: "right",
};

window.addEventListener("keydown", (e) => {
  const dir = KEY_MAP[e.code];
  if (dir) { game.input[dir] = true; e.preventDefault(); }
  if (e.code === "KeyF") toggleFullscreen();
  if (e.code === "Escape" && game.state === "playing") {
    game.state = "paused";
    ui.showPaused(game);
  } else if (e.code === "Escape" && game.state === "paused") {
    game.state = "playing";
    ui.hidePaused();
  }
});

window.addEventListener("keyup", (e) => {
  const dir = KEY_MAP[e.code];
  if (dir) { game.input[dir] = false; e.preventDefault(); }
});

window.addEventListener("blur", () => {
  if (game.state === "playing") {
    game.state = "paused";
    ui.showPaused(game);
  }
});

document.addEventListener(
  "pointerdown",
  () => {
    audio.ensureContext();
    audio.resume();
  },
  { once: true }
);
document.addEventListener("click", (e) => {
  if (e.target.classList?.contains("btn")) audio.uiClick();
});

const muteBtn = document.getElementById("btn-mute");
function refreshMuteLabel() {
  muteBtn.textContent = audio.isMuted() ? "Sound: Off" : "Sound: On";
}
refreshMuteLabel();
muteBtn.addEventListener("click", () => {
  audio.toggleMuted();
  refreshMuteLabel();
});

const volumeSlider = document.getElementById("volume-slider");
volumeSlider.value = Math.round(audio.getVolume() * 100);
volumeSlider.addEventListener("input", () => {
  audio.setVolume(volumeSlider.valueAsNumber / 100);
});

document.getElementById("btn-fullscreen").addEventListener("click", toggleFullscreen);

const reduceEffectsBox = document.getElementById("reduce-effects");
reduceEffectsBox.checked = settings.getReduceEffects();
reduceEffectsBox.addEventListener("change", () => {
  settings.setReduceEffects(reduceEffectsBox.checked);
});

document.getElementById("btn-start").addEventListener("click", () => {
  game.startRun();
  ui.hideAllOverlays();
  ui.showHud();
  audio.startDrone();
});

document.getElementById("btn-shop").addEventListener("click", () => ui.showShop());
document.getElementById("btn-shop-back").addEventListener("click", () => ui.showMenu());
document.getElementById("btn-story").addEventListener("click", () => ui.showStory());
document.getElementById("btn-story-back").addEventListener("click", () => ui.showMenu());

document.getElementById("btn-retry").addEventListener("click", () => {
  game.startRun();
  ui.hideAllOverlays();
  ui.showHud();
  audio.startDrone();
});

document.getElementById("btn-menu").addEventListener("click", () => ui.showMenu());

document.getElementById("btn-resume").addEventListener("click", () => {
  game.state = "playing";
  ui.hidePaused();
});

document.getElementById("btn-pause-mobile").addEventListener("click", () => {
  if (game.state === "playing") {
    game.state = "paused";
    ui.showPaused(game);
  } else if (game.state === "paused") {
    game.state = "playing";
    ui.hidePaused();
  }
});

// --- Virtual joystick (touch + mouse via Pointer Events) ---
const joystickZone = document.getElementById("joystick-zone");
const joystickBase = document.getElementById("joystick-base");
const joystickKnob = document.getElementById("joystick-knob");
const JOY_MAX_RADIUS = 46;
let joyPointerId = null;

function updateJoystick(clientX, clientY, rect) {
  const originX = parseFloat(joystickBase.dataset.originX);
  const originY = parseFloat(joystickBase.dataset.originY);
  const dx = clientX - rect.left - originX;
  const dy = clientY - rect.top - originY;
  const len = Math.hypot(dx, dy);
  const clampedLen = Math.min(len, JOY_MAX_RADIUS);
  const nx = len > 0 ? dx / len : 0;
  const ny = len > 0 ? dy / len : 0;
  joystickKnob.style.transform = `translate(calc(-50% + ${nx * clampedLen}px), calc(-50% + ${ny * clampedLen}px))`;
  game.touchVector.x = nx * (clampedLen / JOY_MAX_RADIUS);
  game.touchVector.y = ny * (clampedLen / JOY_MAX_RADIUS);
}

function endJoystick(e) {
  if (e.pointerId !== joyPointerId) return;
  joyPointerId = null;
  joystickBase.classList.remove("visible");
  joystickKnob.style.transform = "translate(-50%, -50%)";
  game.touchVector.x = 0;
  game.touchVector.y = 0;
}

joystickZone.addEventListener("pointerdown", (e) => {
  if (game.state !== "playing" || joyPointerId !== null) return;
  joyPointerId = e.pointerId;
  const rect = joystickZone.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  joystickBase.style.left = `${x}px`;
  joystickBase.style.top = `${y}px`;
  joystickBase.dataset.originX = x;
  joystickBase.dataset.originY = y;
  joystickBase.classList.add("visible");
  updateJoystick(e.clientX, e.clientY, rect);
  joystickZone.setPointerCapture(e.pointerId);
});
joystickZone.addEventListener("pointermove", (e) => {
  if (e.pointerId !== joyPointerId) return;
  updateJoystick(e.clientX, e.clientY, joystickZone.getBoundingClientRect());
});
joystickZone.addEventListener("pointerup", endJoystick);
joystickZone.addEventListener("pointercancel", endJoystick);

const INTRO_SEEN_KEY = "nightfallSwarm.seenIntro";
document.getElementById("btn-intro-continue").addEventListener("click", () => {
  localStorage.setItem(INTRO_SEEN_KEY, "1");
  ui.showMenu();
});

if (localStorage.getItem(INTRO_SEEN_KEY)) {
  ui.showMenu();
} else {
  ui.showIntro();
}

// --- Gamepad (Steam-deck/controller play) ---
let padPrevButtons = [];
let padPrevStickX = 0;
let cardSel = 0;
let wasLevelup = false;

function overlayVisible(id) {
  return !document.getElementById(id).classList.contains("hidden");
}

function moveCardSelection(delta) {
  const cards = Array.from(document.querySelectorAll("#levelup-cards .card"));
  if (!cards.length) return;
  cardSel = (cardSel + delta + cards.length) % cards.length;
  cards.forEach((c, i) => c.classList.toggle("gp-selected", i === cardSel));
}

function pollGamepad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let pad = null;
  for (const p of pads) if (p && p.connected) { pad = p; break; }
  if (!pad) {
    game.gamepadVector.x = 0;
    game.gamepadVector.y = 0;
    return;
  }

  let x = pad.axes[0] || 0;
  let y = pad.axes[1] || 0;
  if (pad.buttons[14]?.pressed) x = -1;
  if (pad.buttons[15]?.pressed) x = 1;
  if (pad.buttons[12]?.pressed) y = -1;
  if (pad.buttons[13]?.pressed) y = 1;
  if (Math.hypot(x, y) < 0.18) { x = 0; y = 0; }
  game.gamepadVector.x = x;
  game.gamepadVector.y = y;

  const justPressed = (i) => !!pad.buttons[i]?.pressed && !padPrevButtons[i];

  if (justPressed(9)) { // Start
    if (game.state === "playing") {
      game.state = "paused";
      ui.showPaused(game);
    } else if (game.state === "paused") {
      game.state = "playing";
      ui.hidePaused();
    }
  }

  if (game.state === "levelup") {
    if (!wasLevelup) {
      cardSel = 0;
      moveCardSelection(0);
      wasLevelup = true;
    }
    const stickEdge = Math.abs(padPrevStickX) < 0.5 && Math.abs(x) >= 0.5;
    if (justPressed(15) || (stickEdge && x > 0)) moveCardSelection(1);
    if (justPressed(14) || (stickEdge && x < 0)) moveCardSelection(-1);
    if (justPressed(0)) {
      const cards = document.querySelectorAll("#levelup-cards .card");
      cards[cardSel]?.click();
    }
  } else {
    wasLevelup = false;
    if (justPressed(0)) { // A: context confirm
      if (game.state === "paused") document.getElementById("btn-resume").click();
      else if (overlayVisible("overlay-gameover")) document.getElementById("btn-retry").click();
      else if (overlayVisible("overlay-epilogue")) document.getElementById("btn-epilogue-continue").click();
      else if (overlayVisible("overlay-intro")) document.getElementById("btn-intro-continue").click();
      else if (overlayVisible("overlay-menu")) document.getElementById("btn-start").click();
    }
  }

  padPrevButtons = pad.buttons.map((b) => b.pressed);
  padPrevStickX = x;
}

let lastT = performance.now();
function loop(now) {
  let dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  if (game.hitStop > 0) {
    game.hitStop = Math.max(0, game.hitStop - dt);
    dt *= 0.06;
  }

  pollGamepad();
  game.update(dt);

  joystickZone.classList.toggle("active", game.state === "playing");
  if (game.state !== "playing" && joyPointerId !== null) {
    joyPointerId = null;
    joystickBase.classList.remove("visible");
    game.touchVector.x = 0;
    game.touchVector.y = 0;
  }

  if (game.player) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    game.render(ctx);
    if (game.state !== "menu" && game.state !== "shop") ui.updateHud(game);
  }

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
