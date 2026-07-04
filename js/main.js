import { Game } from "./game.js";
import * as ui from "./ui.js";

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

document.getElementById("btn-start").addEventListener("click", () => {
  game.startRun();
  ui.hideAllOverlays();
  ui.showHud();
});

document.getElementById("btn-shop").addEventListener("click", () => ui.showShop());
document.getElementById("btn-shop-back").addEventListener("click", () => ui.showMenu());

document.getElementById("btn-retry").addEventListener("click", () => {
  game.startRun();
  ui.hideAllOverlays();
  ui.showHud();
});

document.getElementById("btn-menu").addEventListener("click", () => ui.showMenu());

document.getElementById("btn-resume").addEventListener("click", () => {
  game.state = "playing";
  ui.hidePaused();
});

ui.showMenu();

let lastT = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  game.update(dt);

  if (game.player) {
    game.render(ctx);
    if (game.state !== "menu" && game.state !== "shop") ui.updateHud(game);
  }

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
