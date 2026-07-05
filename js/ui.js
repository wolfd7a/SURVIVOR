import { formatTime, clamp } from "./utils.js";
import {
  getSave,
  PERMANENT_UPGRADES,
  upgradeCost,
  buyUpgrade,
  isCharacterUnlocked,
  unlockCharacter,
  getSelectedCharacter,
  selectCharacter,
} from "./save.js";
import { CHARACTERS, CHARACTER_KEYS } from "./characters.js";
import { STORY_TITLE, STORY_PARAGRAPHS, BOSS_LORE, EPILOGUE_TITLE, EPILOGUE_PARAGRAPHS } from "./lore.js";
import { WEAPON_DEFS } from "./weapons.js";

const el = (id) => document.getElementById(id);

const overlays = {
  intro: el("overlay-intro"),
  menu: el("overlay-menu"),
  shop: el("overlay-shop"),
  story: el("overlay-story"),
  levelup: el("overlay-levelup"),
  gameover: el("overlay-gameover"),
  paused: el("overlay-paused"),
  epilogue: el("overlay-epilogue"),
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
  el("stat-bosses").textContent = s.totalBossesDefeated;
}

export function showEpilogue(onContinue) {
  hideAllOverlays();
  el("epilogue-title").textContent = EPILOGUE_TITLE;
  const text = el("epilogue-text");
  text.innerHTML = "";
  for (const para of EPILOGUE_PARAGRAPHS) {
    const p = document.createElement("p");
    p.textContent = para;
    text.appendChild(p);
  }
  overlays.epilogue.classList.remove("hidden");
  const btn = el("btn-epilogue-continue");
  const handler = () => {
    hideAllOverlays();
    btn.removeEventListener("click", handler);
    onContinue();
  };
  btn.addEventListener("click", handler);
}

function renderCharacterRow() {
  const row = el("character-row");
  row.innerHTML = "";
  const selected = getSelectedCharacter();
  for (const key of CHARACTER_KEYS) {
    const def = CHARACTERS[key];
    const unlocked = isCharacterUnlocked(key);
    const card = document.createElement("div");
    card.className =
      "char-card" + (key === selected ? " selected" : "") + (unlocked ? "" : " locked");
    const icon = document.createElement("div");
    icon.className = "icon";
    icon.textContent = def.icon;
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = def.name;
    const desc = document.createElement("div");
    desc.className = "desc";
    desc.textContent = def.desc;
    card.append(icon, name, desc);
    if (!unlocked) {
      const unlock = document.createElement("div");
      unlock.className = "unlock";
      unlock.textContent = `Unlock: ${def.cost} Cores`;
      card.appendChild(unlock);
    }
    card.addEventListener("click", () => {
      if (isCharacterUnlocked(key)) {
        selectCharacter(key);
      } else if (!unlockCharacter(key, def.cost)) {
        return; // not enough cores; leave the row as-is
      } else {
        selectCharacter(key);
      }
      refreshMenuStats();
      renderCharacterRow();
    });
    row.appendChild(card);
  }
}

export function showMenu() {
  hideAllOverlays();
  hud.classList.add("hidden");
  refreshMenuStats();
  renderCharacterRow();
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

export function showIntro() {
  hideAllOverlays();
  const text = el("intro-text");
  text.innerHTML = "";
  for (const para of STORY_PARAGRAPHS.slice(0, 2)) {
    const p = document.createElement("p");
    p.textContent = para;
    text.appendChild(p);
  }
  overlays.intro.classList.remove("hidden");
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

export function showPaused(game) {
  if (game?.player) renderPauseBuild(game.player);
  overlays.paused.classList.remove("hidden");
}

function weaponDisplayInfo(w) {
  const def = WEAPON_DEFS[w.key];
  const src = w.evolved ? def.evolved : def;
  return { icon: src.icon, name: src.name, desc: src.describe(w.level) };
}

function renderPauseBuild(player) {
  const box = el("pause-build");
  box.innerHTML = "";
  for (const w of player.weapons) {
    const info = weaponDisplayInfo(w);
    const row = document.createElement("div");
    row.className = "pb-weapon" + (w.evolved ? " evolved" : "");
    const icon = document.createElement("div");
    icon.className = "icon";
    icon.textContent = info.icon;
    const text = document.createElement("div");
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = `${info.name} — Lv ${w.level}${w.evolved ? " (Evolved)" : ""}`;
    const desc = document.createElement("div");
    desc.className = "desc";
    desc.textContent = info.desc;
    text.append(name, desc);
    row.append(icon, text);
    box.appendChild(row);
  }
  const stats = document.createElement("div");
  stats.className = "pb-stats";
  const entries = [
    [`⚔️ +${Math.round((player.damageMult - 1) * 100)}% dmg`],
    [`⏱️ +${Math.round((1 - player.cooldownMult) * 100)}% atk speed`],
    [`🛡️ ${Math.round(player.armor * 100)}% reduction`],
    [`💚 ${player.regen.toFixed(1)} regen/s`],
    [`🧲 ${Math.round(player.magnetRadius)} pickup`],
    [`👟 ${Math.round(player.baseSpeed)} speed`],
  ];
  for (const [label] of entries) {
    const s = document.createElement("span");
    s.textContent = label;
    stats.appendChild(s);
  }
  box.appendChild(stats);
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
const killsEl = el("hud-kills");
const coresEl = el("hud-cores-value");
const weaponsEl = el("hud-weapons");
const bossWrap = el("boss-bar-wrap");
const bossBar = el("boss-bar");
const bossName = el("boss-name");
const bossCallout = el("boss-callout");

let lastBuildSig = "";

function refreshWeaponChips(player) {
  const sig = player.weapons.map((w) => `${w.key}:${w.level}:${w.evolved ? 1 : 0}`).join("|");
  if (sig === lastBuildSig) return;
  lastBuildSig = sig;
  weaponsEl.innerHTML = "";
  for (const w of player.weapons) {
    const info = weaponDisplayInfo(w);
    const chip = document.createElement("div");
    chip.className = "weapon-chip" + (w.evolved ? " evolved" : "");
    const icon = document.createElement("div");
    icon.className = "icon";
    icon.textContent = info.icon;
    const lv = document.createElement("div");
    lv.className = "lv";
    lv.textContent = w.evolved ? "EVO" : `Lv${w.level}`;
    chip.append(icon, lv);
    weaponsEl.appendChild(chip);
  }
}

export function updateHud(game) {
  const p = game.player;
  hpBar.style.width = `${clamp((p.hp / p.maxHp) * 100, 0, 100)}%`;
  hpText.textContent = `${Math.max(0, Math.round(p.hp))} / ${Math.round(p.maxHp)}`;
  xpBar.style.width = `${clamp((p.xp / p.xpToNext) * 100, 0, 100)}%`;
  timerEl.textContent = formatTime(game.time);
  levelEl.textContent = `Lv ${p.level}`;
  killsEl.textContent = `${game.kills} slain`;
  coresEl.textContent = Math.round(
    game.time / 5 + game.kills * 0.25 + game.coresFromBosses + game.coresFromElites
  );
  refreshWeaponChips(p);

  if (game.boss) {
    bossWrap.classList.remove("hidden");
    bossName.textContent = game.boss.name;
    bossBar.style.width = `${clamp((game.boss.hp / game.boss.maxHp) * 100, 0, 100)}%`;
    bossCallout.textContent = game.boss.calloutTimer > 0 ? game.boss.callout : "";
  } else {
    bossWrap.classList.add("hidden");
  }
}
