export const WEAPON_DEFS = {
  bolt: {
    name: "Arcane Bolt",
    icon: "✨",
    maxLevel: 8,
    stats(level) {
      return {
        cooldown: Math.max(0.32, 0.95 - level * 0.07),
        damage: 9 + level * 4,
        count: 1 + Math.floor(level / 3),
        pierce: Math.floor(level / 4),
        speed: 460,
      };
    },
    describe(level) {
      const s = this.stats(level);
      return `Auto-fires ${s.count} bolt(s) at the nearest foe for ${s.damage} dmg`;
    },
    evolved: {
      name: "Starfall Lance",
      icon: "\u{1F31F}",
      color: "#e0f2fe",
      stats(level) {
        return {
          cooldown: Math.max(0.24, 0.7 - level * 0.05),
          damage: (9 + level * 4) * 1.6,
          count: 3 + Math.floor(level / 3),
          pierce: 3 + Math.floor(level / 4),
          speed: 560,
        };
      },
      describe(level) {
        const s = this.stats(level);
        return `Evolved: ${s.count} piercing lances for ${Math.round(s.damage)} dmg each`;
      },
    },
  },
  orbit: {
    name: "Void Orbs",
    icon: "\u{1F52E}",
    maxLevel: 8,
    stats(level) {
      return {
        count: 1 + Math.floor(level / 2.2),
        damage: 5 + level * 2.5,
        radius: 55 + level * 4,
        angularSpeed: 2.4 + level * 0.15,
        hitCooldown: 0.45,
      };
    },
    describe(level) {
      const s = this.stats(level);
      return `${s.count} orb(s) orbit you, ${Math.round(s.damage)} dmg on contact`;
    },
    evolved: {
      name: "Void Halo",
      icon: "\u{1F300}",
      color: "#f0abfc",
      stats(level) {
        return {
          count: 3 + Math.floor(level / 2),
          damage: (5 + level * 2.5) * 1.6,
          radius: 70 + level * 5,
          angularSpeed: 3.4 + level * 0.18,
          hitCooldown: 0.3,
        };
      },
      describe(level) {
        const s = this.stats(level);
        return `Evolved: ${s.count} orbs, faster and ${Math.round(s.damage)} dmg on contact`;
      },
    },
  },
  nova: {
    name: "Shock Nova",
    icon: "\u{1F4A5}",
    maxLevel: 8,
    stats(level) {
      return {
        cooldown: Math.max(1.6, 3.6 - level * 0.22),
        damage: 14 + level * 5,
        radius: 90 + level * 8,
      };
    },
    describe(level) {
      const s = this.stats(level);
      return `Pulses for ${Math.round(s.damage)} dmg in a ${Math.round(s.radius)}px ring`;
    },
    evolved: {
      name: "Cataclysm",
      icon: "\u{1F30B}",
      color: "#fb7185",
      stats(level) {
        return {
          cooldown: Math.max(1.1, 2.6 - level * 0.16),
          damage: (14 + level * 5) * 1.7,
          radius: 120 + level * 9,
        };
      },
      describe(level) {
        const s = this.stats(level);
        return `Evolved: bigger, faster pulses for ${Math.round(s.damage)} dmg`;
      },
    },
  },
};

export const WEAPON_KEYS = Object.keys(WEAPON_DEFS);

export function weaponStats(key, level, evolved) {
  const def = WEAPON_DEFS[key];
  return evolved ? def.evolved.stats(level) : def.stats(level);
}
