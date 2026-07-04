const REDUCE_EFFECTS_KEY = "nightfallSwarm.reduceEffects";

export function getReduceEffects() {
  return localStorage.getItem(REDUCE_EFFECTS_KEY) === "1";
}

export function setReduceEffects(value) {
  localStorage.setItem(REDUCE_EFFECTS_KEY, value ? "1" : "0");
}
