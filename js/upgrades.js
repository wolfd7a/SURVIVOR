import { WEAPON_DEFS, WEAPON_KEYS } from "./weapons.js";
import { pickWeighted, clamp } from "./utils.js";

const STAT_UPGRADES = [
  {
    id: "maxHp",
    icon: "❤️",
    name: "Vigor",
    weight: 8,
    desc: "+20 max HP, heal 20",
    apply(p) {
      p.maxHp += 20;
      p.hp = Math.min(p.maxHp, p.hp + 20);
    },
  },
  {
    id: "speed",
    icon: "\u{1F45F}",
    name: "Swiftness",
    weight: 7,
    desc: "+8% move speed",
    apply(p) {
      p.baseSpeed *= 1.08;
    },
  },
  {
    id: "magnet",
    icon: "\u{1F9F2}",
    name: "Lodestone",
    weight: 6,
    desc: "+35 pickup radius",
    apply(p) {
      p.magnetRadius += 35;
    },
  },
  {
    id: "regen",
    icon: "\u{1F49A}",
    name: "Regeneration",
    weight: 6,
    desc: "+0.6 HP regen / sec",
    apply(p) {
      p.regen += 0.6;
    },
  },
  {
    id: "armor",
    icon: "\u{1F6E1}️",
    name: "Iron Skin",
    weight: 5,
    desc: "+5% damage reduction",
    apply(p) {
      p.armor = clamp(p.armor + 0.05, 0, 0.6);
    },
  },
  {
    id: "cooldown",
    icon: "⏱️",
    name: "Haste",
    weight: 6,
    desc: "+6% attack speed",
    apply(p) {
      p.cooldownMult = Math.max(0.4, p.cooldownMult * 0.94);
    },
  },
  {
    id: "damage",
    icon: "⚔️",
    name: "Might",
    weight: 7,
    desc: "+8% weapon damage",
    apply(p) {
      p.damageMult *= 1.08;
    },
  },
];

export function generateChoices(player) {
  const pool = [];

  for (const key of WEAPON_KEYS) {
    const def = WEAPON_DEFS[key];
    const level = player.weaponLevel(key);
    if (level === 0) {
      if (player.weapons.length >= 3) continue;
      pool.push({
        id: `weapon-new-${key}`,
        icon: def.icon,
        name: `${def.name} (New)`,
        weight: 9,
        desc: def.describe(1),
        apply: (p) => p.addWeapon(key),
      });
    } else if (level < def.maxLevel) {
      pool.push({
        id: `weapon-${key}`,
        icon: def.icon,
        name: `${def.name} Lv${level + 1}`,
        weight: 10,
        desc: def.describe(level + 1),
        apply: (p) => p.levelUpWeapon(key),
      });
    }
  }

  for (const s of STAT_UPGRADES) pool.push(s);

  return pickWeighted(pool, 3);
}
