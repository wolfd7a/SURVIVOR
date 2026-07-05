const KEY = "nightfallSwarm.save.v1";

export const PERMANENT_UPGRADES = {
  maxHp: { name: "Vitality", desc: "+15 max HP per rank", icon: "❤️", maxRank: 5, baseCost: 20, costGrowth: 1.6 },
  moveSpeed: { name: "Fleet Foot", desc: "+4% move speed per rank", icon: "👟", maxRank: 5, baseCost: 20, costGrowth: 1.6 },
  damage: { name: "Might", desc: "+6% weapon damage per rank", icon: "⚔️", maxRank: 5, baseCost: 25, costGrowth: 1.7 },
  magnet: { name: "Lodestone", desc: "+25 pickup radius per rank", icon: "🧲", maxRank: 5, baseCost: 15, costGrowth: 1.5 },
  armor: { name: "Hide", desc: "+3% damage reduction per rank", icon: "🛡️", maxRank: 5, baseCost: 25, costGrowth: 1.7 },
  cooldown: { name: "Haste", desc: "+3% attack speed per rank", icon: "⏱️", maxRank: 5, baseCost: 25, costGrowth: 1.7 },
};

function defaultSave() {
  return {
    cores: 0,
    totalRuns: 0,
    bestTime: 0,
    bestLevel: 0,
    totalBossesDefeated: 0,
    unlockedCharacters: ["cinder"],
    selectedCharacter: "cinder",
    ranks: { maxHp: 0, moveSpeed: 0, damage: 0, magnet: 0, armor: 0, cooldown: 0 },
  };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    return { ...defaultSave(), ...parsed, ranks: { ...defaultSave().ranks, ...(parsed.ranks || {}) } };
  } catch {
    return defaultSave();
  }
}

function persist() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function getSave() {
  return state;
}

export function upgradeCost(key) {
  const def = PERMANENT_UPGRADES[key];
  const rank = state.ranks[key];
  if (rank >= def.maxRank) return null;
  return Math.round(def.baseCost * Math.pow(def.costGrowth, rank));
}

export function buyUpgrade(key) {
  const cost = upgradeCost(key);
  if (cost === null || state.cores < cost) return false;
  state.cores -= cost;
  state.ranks[key] += 1;
  persist();
  return true;
}

export function recordRunResult({ timeSurvived, level, coresEarned }) {
  state.cores += coresEarned;
  state.totalRuns += 1;
  state.bestTime = Math.max(state.bestTime, timeSurvived);
  state.bestLevel = Math.max(state.bestLevel, level);
  persist();
}

export function recordBossDefeat() {
  state.totalBossesDefeated += 1;
  persist();
}

export function isCharacterUnlocked(key) {
  return state.unlockedCharacters.includes(key);
}

export function unlockCharacter(key, cost) {
  if (isCharacterUnlocked(key) || state.cores < cost) return false;
  state.cores -= cost;
  state.unlockedCharacters.push(key);
  persist();
  return true;
}

export function getSelectedCharacter() {
  return isCharacterUnlocked(state.selectedCharacter) ? state.selectedCharacter : "cinder";
}

export function selectCharacter(key) {
  if (!isCharacterUnlocked(key)) return false;
  state.selectedCharacter = key;
  persist();
  return true;
}

export function getPermanentBonuses() {
  const r = state.ranks;
  return {
    maxHpBonus: r.maxHp * 15,
    moveSpeedMult: 1 + r.moveSpeed * 0.04,
    damageMult: 1 + r.damage * 0.06,
    magnetBonus: r.magnet * 25,
    armorBonus: r.armor * 0.03,
    cooldownMult: 1 - r.cooldown * 0.03,
  };
}
