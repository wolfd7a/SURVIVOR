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
  },
};

export const WEAPON_KEYS = Object.keys(WEAPON_DEFS);
