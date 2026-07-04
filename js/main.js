import { Game } from "./game.js";
import * as ui from "./ui.js";
import { audio } from "./audio.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const game = new Game({
  onLevelUp: (choices, onPick) => ui.showLevelUp(choices, onPick),
  onGameOver: (stats) => ui.showGameOver(stats),
  onBossStart: () => {},
  onBossEnd: () => {},
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
  if (e.code === "Escape" && game.state === "playing") {
    game.state = "paused";
    ui.showPaused();
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
    ui.showPaused();
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
    ui.showPaused();
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

let lastT = performance.now();
function loop(now) {
  let dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  if (game.hitStop > 0) {
    game.hitStop = Math.max(0, game.hitStop - dt);
    dt *= 0.06;
  }

  game.update(dt);

  joystickZone.classList.toggle("active", game.state === "playing");
  if (game.state !== "playing" && joyPointerId !== null) {
    joyPointerId = null;
    joystickBase.classList.remove("visible");
    game.touchVector.x = 0;
    game.touchVector.y = 0;
  }

  if (game.player) {
    game.render(ctx);
    if (game.state !== "menu" && game.state !== "shop") ui.updateHud(game);
  }

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
