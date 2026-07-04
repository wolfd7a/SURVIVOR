import { clamp, dist, angleTo, circlesOverlap, randRange, randInt } from "./utils.js";
import { WEAPON_DEFS } from "./weapons.js";

let nextId = 1;

export class Player {
  constructor(bonuses) {
    this.id = nextId++;
    this.x = 0;
    this.y = 0;
    this.radius = 14;
    this.baseSpeed = 190 * bonuses.moveSpeedMult;
    this.maxHp = 100 + bonuses.maxHpBonus;
    this.hp = this.maxHp;
    this.level = 1;
    this.xp = 0;
    this.xpToNext = xpForLevel(1);
    this.magnetRadius = 70 + bonuses.magnetBonus;
    this.regen = 0;
    this.armor = clamp(bonuses.armorBonus, 0, 0.5);
    this.damageMult = bonuses.damageMult;
    this.cooldownMult = bonuses.cooldownMult;
    this.invulnTimer = 0;
    this.hitFlash = 0;
    this.weapons = [{ key: "bolt", level: 1 }];
    this.weaponTimers = { bolt: 0.3 };
    this.orbitAngle = 0;
    this.kills = 0;
    this.facing = 0;
  }

  hasWeapon(key) {
    return this.weapons.some((w) => w.key === key);
  }

  weaponLevel(key) {
    const w = this.weapons.find((w) => w.key === key);
    return w ? w.level : 0;
  }

  addWeapon(key) {
    if (this.hasWeapon(key)) return;
    this.weapons.push({ key, level: 1 });
    this.weaponTimers[key] = 0.2;
  }

  levelUpWeapon(key) {
    const w = this.weapons.find((w) => w.key === key);
    if (w) w.level = Math.min(WEAPON_DEFS[key].maxLevel, w.level + 1);
  }

  takeDamage(amount) {
    if (this.invulnTimer > 0) return 0;
    const reduced = amount * (1 - this.armor);
    this.hp -= reduced;
    this.invulnTimer = 0.6;
    this.hitFlash = 0.25;
    return reduced;
  }

  gainXp(amount, game) {
    this.xp += amount;
    let levels = 0;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level += 1;
      this.xpToNext = xpForLevel(this.level);
      levels++;
    }
    if (levels > 0) game.queueLevelUps(levels);
  }

  update(dt, game) {
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.regen > 0) this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);

    let mx = 0, my = 0;
    if (game.input.left) mx -= 1;
    if (game.input.right) mx += 1;
    if (game.input.up) my -= 1;
    if (game.input.down) my += 1;
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      mx /= len; my /= len;
      this.facing = Math.atan2(my, mx);
      this.x += mx * this.baseSpeed * dt;
      this.y += my * this.baseSpeed * dt;
    }
    const half = game.arenaSize / 2;
    this.x = clamp(this.x, -half + this.radius, half - this.radius);
    this.y = clamp(this.y, -half + this.radius, half - this.radius);

    this.orbitAngle += dt;
    this.updateWeapons(dt, game);
  }

  updateWeapons(dt, game) {
    for (const w of this.weapons) {
      const def = WEAPON_DEFS[w.key];
      const stats = def.stats(w.level);
      if (w.key === "bolt") {
        this.weaponTimers.bolt -= dt;
        if (this.weaponTimers.bolt <= 0) {
          this.weaponTimers.bolt = stats.cooldown * this.cooldownMult;
          fireBolts(this, stats, game);
        }
      } else if (w.key === "nova") {
        this.weaponTimers.nova = (this.weaponTimers.nova ?? stats.cooldown) - dt;
        if (this.weaponTimers.nova <= 0) {
          this.weaponTimers.nova = stats.cooldown * this.cooldownMult;
          fireNova(this, stats, game);
        }
      } else if (w.key === "orbit") {
        updateOrbits(this, stats, dt, game);
      }
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 20) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }
    ctx.shadowColor = "#8b5cf6";
    ctx.shadowBlur = 14;
    ctx.fillStyle = this.hitFlash > 0 ? "#fca5a5" : "#c4b5fd";
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#4c1d95";
    ctx.lineWidth = 2;
    ctx.stroke();
    // facing nub
    ctx.fillStyle = "#4c1d95";
    ctx.beginPath();
    ctx.arc(Math.cos(this.facing) * this.radius * 0.8, Math.sin(this.facing) * this.radius * 0.8, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (this.hasWeapon("orbit")) {
      const stats = WEAPON_DEFS.orbit.stats(this.weaponLevel("orbit"));
      for (let i = 0; i < stats.count; i++) {
        const a = this.orbitAngle * stats.angularSpeed + (i * Math.PI * 2) / stats.count;
        const ox = this.x + Math.cos(a) * stats.radius;
        const oy = this.y + Math.sin(a) * stats.radius;
        ctx.save();
        ctx.shadowColor = "#22d3ee";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#67e8f9";
        ctx.beginPath();
        ctx.arc(ox, oy, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }
}

export function xpForLevel(level) {
  return Math.round(9 + level * 7 + Math.pow(level, 1.6) * 2.2);
}

function fireBolts(player, stats, game) {
  const targets = game.nearestEnemies(player.x, player.y, stats.count);
  if (targets.length === 0) return;
  for (let i = 0; i < stats.count; i++) {
    const target = targets[i % targets.length];
    const a = angleTo(player.x, player.y, target.x, target.y);
    game.projectiles.push(
      new Projectile({
        x: player.x,
        y: player.y,
        angle: a,
        speed: stats.speed,
        damage: stats.damage * player.damageMult,
        pierce: stats.pierce,
        color: "#fde68a",
      })
    );
  }
}

function fireNova(player, stats, game) {
  game.novaPulses.push({ x: player.x, y: player.y, radius: 0, maxRadius: stats.radius, life: 0.35 });
  for (const e of game.enemies) {
    if (dist(e.x, e.y, player.x, player.y) <= stats.radius + e.radius) {
      game.damageEnemy(e, stats.damage * player.damageMult);
    }
  }
  if (game.boss && dist(game.boss.x, game.boss.y, player.x, player.y) <= stats.radius + game.boss.radius) {
    game.damageBoss(stats.damage * player.damageMult);
  }
  game.addScreenShake(3);
}

function updateOrbits(player, stats, dt, game) {
  for (let i = 0; i < stats.count; i++) {
    const a = player.orbitAngle * stats.angularSpeed + (i * Math.PI * 2) / stats.count;
    const ox = player.x + Math.cos(a) * stats.radius;
    const oy = player.y + Math.sin(a) * stats.radius;
    for (const e of game.enemies) {
      if ((e._orbitHit ?? 0) > 0) continue;
      if (circlesOverlap(ox, oy, 7, e.x, e.y, e.radius)) {
        game.damageEnemy(e, stats.damage * player.damageMult);
        e._orbitHit = stats.hitCooldown;
      }
    }
    const boss = game.boss;
    if (boss && (boss._orbitHit ?? 0) <= 0 && circlesOverlap(ox, oy, 7, boss.x, boss.y, boss.radius)) {
      game.damageBoss(stats.damage * player.damageMult);
      if (game.boss === boss) boss._orbitHit = stats.hitCooldown;
    }
  }
}

export const ENEMY_DEFS = {
  shambler: { hp: 20, speed: 70, damage: 8, radius: 12, color: "#b91c1c", xp: 3 },
  sprinter: { hp: 12, speed: 155, damage: 6, radius: 9, color: "#f59e0b", xp: 4 },
  brute: { hp: 75, speed: 46, damage: 16, radius: 20, color: "#7f1d1d", xp: 9 },
  shooter: { hp: 24, speed: 55, damage: 5, radius: 12, color: "#a855f7", xp: 6, ranged: true },
};

export class Enemy {
  constructor(type, x, y, hpMult, dmgMult) {
    this.id = nextId++;
    this.type = type;
    const def = ENEMY_DEFS[type];
    this.x = x;
    this.y = y;
    this.radius = def.radius;
    this.maxHp = def.hp * hpMult;
    this.hp = this.maxHp;
    this.speed = def.speed;
    this.damage = def.damage * dmgMult;
    this.color = def.color;
    this.xpValue = def.xp;
    this.ranged = !!def.ranged;
    this.fireTimer = randRange(0.5, 2.5);
    this._orbitHit = 0;
    this.hitFlash = 0;
  }

  update(dt, game) {
    if (this._orbitHit > 0) this._orbitHit -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    const p = game.player;
    const a = angleTo(this.x, this.y, p.x, p.y);
    const d = dist(this.x, this.y, p.x, p.y);
    if (this.ranged && d < 320) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireTimer = 2.4;
        game.enemyProjectiles.push(
          new EnemyProjectile({ x: this.x, y: this.y, angle: a, speed: 210, damage: this.damage })
        );
      }
      if (d > 160) {
        this.x += Math.cos(a) * this.speed * dt;
        this.y += Math.sin(a) * this.speed * dt;
      }
    } else {
      this.x += Math.cos(a) * this.speed * dt;
      this.y += Math.sin(a) * this.speed * dt;
    }

    if (circlesOverlap(this.x, this.y, this.radius, p.x, p.y, p.radius)) {
      game.damagePlayer(this.damage);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = this.hitFlash > 0 ? "#fff" : this.color;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    if (this.maxHp > 20) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(-this.radius, -this.radius - 8, this.radius * 2, 4);
      ctx.fillStyle = "#4ade80";
      ctx.fillRect(-this.radius, -this.radius - 8, this.radius * 2 * clamp(this.hp / this.maxHp, 0, 1), 4);
    }
    ctx.restore();
  }
}

export class Projectile {
  constructor({ x, y, angle, speed, damage, pierce, color }) {
    this.id = nextId++;
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.damage = damage;
    this.pierce = pierce;
    this.color = color;
    this.radius = 5;
    this.life = 1.6;
    this.hitIds = new Set();
  }

  update(dt, game) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    for (const e of game.enemies) {
      if (this.hitIds.has(e.id)) continue;
      if (circlesOverlap(this.x, this.y, this.radius, e.x, e.y, e.radius)) {
        game.damageEnemy(e, this.damage);
        this.hitIds.add(e.id);
        this.pierce -= 1;
        if (this.pierce < 0) { this.life = 0; break; }
      }
    }
    const boss = game.boss;
    if (this.life > 0 && boss && !this.hitIds.has(boss.id)) {
      if (circlesOverlap(this.x, this.y, this.radius, boss.x, boss.y, boss.radius)) {
        game.damageBoss(this.damage);
        this.hitIds.add(boss.id);
        this.pierce -= 1;
        if (this.pierce < 0) this.life = 0;
      }
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export class EnemyProjectile {
  constructor({ x, y, angle, speed, damage }) {
    this.id = nextId++;
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.damage = damage;
    this.radius = 5;
    this.life = 3;
  }

  update(dt, game) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (circlesOverlap(this.x, this.y, this.radius, game.player.x, game.player.y, game.player.radius)) {
      game.damagePlayer(this.damage);
      this.life = 0;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.shadowColor = "#c084fc";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#e9d5ff";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export class XPOrb {
  constructor(x, y, value) {
    this.id = nextId++;
    this.x = x;
    this.y = y;
    this.value = value;
    this.radius = value > 8 ? 7 : 5;
    this.vx = 0;
    this.vy = 0;
  }

  update(dt, game) {
    const p = game.player;
    const d = dist(this.x, this.y, p.x, p.y);
    if (d < p.magnetRadius) {
      const pull = clamp(1 - d / p.magnetRadius, 0.15, 1) * 620;
      const a = angleTo(this.x, this.y, p.x, p.y);
      this.x += Math.cos(a) * pull * dt;
      this.y += Math.sin(a) * pull * dt;
    }
    if (circlesOverlap(this.x, this.y, this.radius, p.x, p.y, p.radius)) {
      p.gainXp(this.value, game);
      this.dead = true;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#a5f3fc";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export class Particle {
  constructor(x, y, color, opts = {}) {
    const a = randRange(0, Math.PI * 2);
    const speed = opts.speed ?? randRange(40, 160);
    this.x = x;
    this.y = y;
    this.vx = Math.cos(a) * speed;
    this.vy = Math.sin(a) * speed;
    this.color = color;
    this.life = opts.life ?? randRange(0.25, 0.6);
    this.maxLife = this.life;
    this.radius = opts.radius ?? randRange(2, 4);
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.92;
    this.vy *= 0.92;
    this.life -= dt;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = clamp(this.life / this.maxLife, 0, 1);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export class FloatingText {
  constructor(x, y, text, color = "#fff", size = 14) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.size = size;
    this.life = 0.8;
    this.maxLife = 0.8;
  }

  update(dt) {
    this.y -= 32 * dt;
    this.life -= dt;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = clamp(this.life / this.maxLife, 0, 1);
    ctx.fillStyle = this.color;
    ctx.font = `700 ${this.size}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

export { nextId as _nextIdRef };
export function randomEdgePosition(centerX, centerY, radiusOut) {
  const a = randRange(0, Math.PI * 2);
  return { x: centerX + Math.cos(a) * radiusOut, y: centerY + Math.sin(a) * radiusOut };
}
export function randInRing(cx, cy, rMin, rMax) {
  const a = randRange(0, Math.PI * 2);
  const r = randRange(rMin, rMax);
  return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
}
export { randInt };
