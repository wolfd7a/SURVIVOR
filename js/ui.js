import { formatTime, clamp } from "./utils.js";
import { getSave, PERMANENT_UPGRADES, upgradeCost, buyUpgrade } from "./save.js";
import { STORY_TITLE, STORY_PARAGRAPHS, BOSS_LORE } from "./lore.js";

const el = (id) => document.getElementById(id);

const overlays = {
  menu: el("overlay-menu"),
  shop: el("overlay-shop"),
  story: el("overlay-story"),
  levelup: el("overlay-levelup"),
  gameover: el("overlay-gameover"),
  paused: el("overlay-paused"),
};
const hud = el("hud");

export function hideAllOverlays() {
  for (const o of Object.values(overlays)) o.classList.add("hidden");
}

export function refreshMenuStats() {
  const s = getSave();
  el("stat-best-time").textContent = formatTime(s.bestTime);
  el("stat-cores").textContent = s.cores;
  el("stat-runs").textContent = s.totalRuns;
}

export function showMenu() {
  hideAllOverlays();
  hud.classList.add("hidden");
  refreshMenuStats();
  overlays.menu.classList.remove("hidden");
}

export function showShop() {
  hideAllOverlays();
  renderShop();
  overlays.shop.classList.remove("hidden");
}

function renderShop() {
  const list = el("shop-list");
  list.innerHTML = "";
  const s = getSave();
  el("stat-cores") && refreshMenuStats();
  const coresLabel = document.createElement("div");
  coresLabel.style.textAlign = "center";
  coresLabel.style.marginBottom = "6px";
  coresLabel.style.color = "#fbbf24";
  coresLabel.style.fontWeight = "700";
  coresLabel.textContent = `Cores: ${s.cores}`;
  list.appendChild(coresLabel);

  for (const [key, def] of Object.entries(PERMANENT_UPGRADES)) {
    const rank = s.ranks[key];
    const cost = upgradeCost(key);
    const row = document.createElement("div");
    row.className = "shop-item";

    const info = document.createElement("div");
    info.className = "info";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = `${def.icon} ${def.name}`;
    const desc = document.createElement("div");
    desc.className = "desc";
    desc.textContent = def.desc;
    const pips = document.createElement("div");
    pips.className = "pips";
    for (let i = 0; i < def.maxRank; i++) {
      const pip = document.createElement("span");
      pip.className = "pip" + (i < rank ? " filled" : "");
      pips.appendChild(pip);
    }
    info.append(name, desc, pips);

    const btn = document.createElement("button");
    btn.className = "btn";
    if (cost === null) {
      btn.textContent = "MAXED";
      btn.disabled = true;
    } else {
      btn.textContent = `Buy (${cost})`;
      btn.disabled = s.cores < cost;
      btn.addEventListener("click", () => {
        if (buyUpgrade(key)) renderShop();
      });
    }

    row.append(info, btn);
    list.appendChild(row);
  }
}

export function showStory() {
  hideAllOverlays();
  el("story-title").textContent = STORY_TITLE;
  const text = el("story-text");
  text.innerHTML = "";
  for (const para of STORY_PARAGRAPHS) {
    const p = document.createElement("p");
    p.textContent = para;
    text.appendChild(p);
  }
  const bosses = el("story-bosses");
  bosses.innerHTML = "";
  for (const boss of BOSS_LORE) {
    const row = document.createElement("div");
    row.className = "story-boss";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = boss.name;
    const blurb = document.createElement("div");
    blurb.className = "blurb";
    blurb.textContent = boss.blurb;
    row.append(name, blurb);
    bosses.appendChild(row);
  }
  overlays.story.classList.remove("hidden");
}

export function showLevelUp(choices, onPick) {
  hideAllOverlays();
  const row = el("levelup-cards");
  row.innerHTML = "";
  for (const choice of choices) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="icon">${choice.icon}</div>
      <div class="name">${choice.name}</div>
      <div class="desc">${choice.desc}</div>
    `;
    card.addEventListener("click", () => {
      hideAllOverlays();
      onPick(choice);
    });
    row.appendChild(card);
  }
  overlays.levelup.classList.remove("hidden");
}

export function showGameOver(stats) {
  hideAllOverlays();
  const box = el("gameover-stats");
  box.innerHTML = "";
  const rows = [
    ["Time survived", formatTime(stats.timeSurvived)],
    ["Level reached", stats.level],
    ["Enemies slain", stats.kills],
    ["Bosses defeated", stats.bossesDefeated],
    ["Cores earned", `+${stats.coresEarned}`],
  ];
  for (const [label, value] of rows) {
    const l = document.createElement("div");
    l.className = "label";
    l.textContent = label;
    const v = document.createElement("div");
    v.className = "value";
    v.textContent = value;
    box.append(l, v);
  }
  overlays.gameover.classList.remove("hidden");
}

export function showPaused() {
  overlays.paused.classList.remove("hidden");
}

export function hidePaused() {
  overlays.paused.classList.add("hidden");
}

export function showHud() {
  hud.classList.remove("hidden");
}

const hpBar = el("hp-bar");
const hpText = el("hp-text");
const xpBar = el("xp-bar");
const timerEl = el("hud-timer");
const levelEl = el("hud-level");
const coresEl = el("hud-cores-value");
const bossWrap = el("boss-bar-wrap");
const bossBar = el("boss-bar");
const bossName = el("boss-name");
const bossCallout = el("boss-callout");

export function updateHud(game) {
  const p = game.player;
  hpBar.style.width = `${clamp((p.hp / p.maxHp) * 100, 0, 100)}%`;
  hpText.textContent = `${Math.max(0, Math.round(p.hp))} / ${Math.round(p.maxHp)}`;
  xpBar.style.width = `${clamp((p.xp / p.xpToNext) * 100, 0, 100)}%`;
  timerEl.textContent = formatTime(game.time);
  levelEl.textContent = `Lv ${p.level}`;
  coresEl.textContent = Math.round(game.time / 5 + game.kills * 0.25 + game.coresFromBosses);

  if (game.boss) {
    bossWrap.classList.remove("hidden");
    bossName.textContent = game.boss.name;
    bossBar.style.width = `${clamp((game.boss.hp / game.boss.maxHp) * 100, 0, 100)}%`;
    bossCallout.textContent = game.boss.calloutTimer > 0 ? game.boss.callout : "";
  } else {
    bossWrap.classList.add("hidden");
  }
}
