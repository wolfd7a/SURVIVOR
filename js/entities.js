import { clamp, dist, angleTo, circlesOverlap, randRange, randInt } from "./utils.js";
import { WEAPON_DEFS, weaponStats } from "./weapons.js";
import { audio } from "./audio.js";

let nextId = 1;

function drawLimb(ctx, x, y, angleDeg, length, width, color) {
  const rad = (angleDeg * Math.PI) / 180;
  const endX = x + Math.sin(rad) * length;
  const endY = y + Math.cos(rad) * length;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(endX, endY);
  ctx.stroke();
}

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
    this.weapons = [{ key: "bolt", level: 1, evolved: false }];
    this.weaponTimers = { bolt: 0.3 };
    this.orbitAngle = 0;
    this.kills = 0;
    this.facing = 0;
    this.animTime = 0;
    this.moving = false;
    this.dying = false;
    this.deathTimer = 0;
  }

  hasWeapon(key) {
    return this.weapons.some((w) => w.key === key);
  }

  weaponLevel(key) {
    const w = this.weapons.find((w) => w.key === key);
    return w ? w.level : 0;
  }

  isEvolved(key) {
    const w = this.weapons.find((w) => w.key === key);
    return !!(w && w.evolved);
  }

  addWeapon(key) {
    if (this.hasWeapon(key)) return;
    this.weapons.push({ key, level: 1, evolved: false });
    this.weaponTimers[key] = 0.2;
  }

  levelUpWeapon(key) {
    const w = this.weapons.find((w) => w.key === key);
    if (w) w.level = Math.min(WEAPON_DEFS[key].maxLevel, w.level + 1);
  }

  evolveWeapon(key) {
    const w = this.weapons.find((w) => w.key === key);
    if (w) w.evolved = true;
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
    const touch = game.touchVector;
    if (touch && (touch.x !== 0 || touch.y !== 0)) {
      mx = touch.x;
      my = touch.y;
    } else {
      if (game.input.left) mx -= 1;
      if (game.input.right) mx += 1;
      if (game.input.up) my -= 1;
      if (game.input.down) my += 1;
    }
    const moveLen = Math.hypot(mx, my);
    this.moving = moveLen > 0.05;
    if (this.moving) {
      const norm = Math.min(1, moveLen);
      mx /= moveLen; my /= moveLen;
      this.facing = Math.atan2(my, mx);
      this.x += mx * this.baseSpeed * norm * dt;
      this.y += my * this.baseSpeed * norm * dt;
      this.animTime += dt * (4 + norm * 6);
    } else {
      this.animTime += dt * 1.2;
    }
    const half = game.arenaSize / 2;
    this.x = clamp(this.x, -half + this.radius, half - this.radius);
    this.y = clamp(this.y, -half + this.radius, half - this.radius);

    this.orbitAngle += dt;
    this.updateWeapons(dt, game);
  }

  updateWeapons(dt, game) {
    for (const w of this.weapons) {
      const stats = weaponStats(w.key, w.level, w.evolved);
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
    const faceDir = Math.cos(this.facing) >= 0 ? 1 : -1;
    const bob = this.moving ? Math.sin(this.animTime) * 2.4 : Math.sin(this.animTime * 0.5) * 1;
    const legSwing = this.moving ? Math.sin(this.animTime * 1.6) : 0;

    ctx.save();
    ctx.translate(this.x, this.y + bob * 0.3);

    if (this.dying) {
      const t = clamp(this.deathTimer / 0.8, 0, 1);
      ctx.globalAlpha = t;
      ctx.scale(1 + (1 - t) * 0.3, t);
      ctx.rotate((1 - t) * faceDir * 0.6);
    } else if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 20) % 2 === 0) {
      ctx.globalAlpha = 0.55;
    }

    ctx.scale(faceDir, 1);

    // ember aura
    const auraPulse = 0.85 + Math.sin(this.animTime * 2.2) * 0.15;
    const auraGrad = ctx.createRadialGradient(0, 4, 2, 0, 4, this.radius * 2.4 * auraPulse);
    auraGrad.addColorStop(0, "rgba(139,92,246,0.35)");
    auraGrad.addColorStop(1, "rgba(139,92,246,0)");
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(0, 4, this.radius * 2.4 * auraPulse, 0, Math.PI * 2);
    ctx.fill();

    // ground shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(0, this.radius * 0.95, this.radius * 0.8, this.radius * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // cloak trailing behind
    ctx.fillStyle = "#2d1b4e";
    ctx.beginPath();
    ctx.moveTo(-this.radius * 0.6, -this.radius * 0.2);
    ctx.quadraticCurveTo(
      -this.radius * 1.7 - legSwing * 4,
      this.radius * 0.6,
      -this.radius * 0.9,
      this.radius * 1.3
    );
    ctx.quadraticCurveTo(0, this.radius * 0.9, this.radius * 0.6, -this.radius * 0.2);
    ctx.closePath();
    ctx.fill();

    // legs
    const skin = this.hitFlash > 0 ? "#fca5a5" : "#3f2d63";
    drawLimb(ctx, 4, this.radius * 0.5, legSwing * 8, this.radius * 0.9, 4.5, skin);
    drawLimb(ctx, -4, this.radius * 0.5, -legSwing * 8, this.radius * 0.9, 4.5, skin);

    // torso
    ctx.fillStyle = this.hitFlash > 0 ? "#fecaca" : "#c4b5fd";
    ctx.beginPath();
    ctx.ellipse(0, -this.radius * 0.15, this.radius * 0.62, this.radius * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#4c1d95";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // arm holding the ember
    const armSwing = this.moving ? Math.sin(this.animTime * 1.6 + Math.PI) * 6 : 0;
    drawLimb(ctx, this.radius * 0.4, -this.radius * 0.1, 30 + armSwing, this.radius * 0.75, 4, "#3f2d63");
    const emberGlow = 0.6 + Math.sin(this.animTime * 5) * 0.4;
    ctx.save();
    ctx.shadowColor = "#f59e0b";
    ctx.shadowBlur = 10 + emberGlow * 6;
    ctx.fillStyle = `rgba(251,191,36,${0.7 + emberGlow * 0.3})`;
    ctx.beginPath();
    ctx.arc(this.radius * 0.95, this.radius * 0.55, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // head + hood
    ctx.fillStyle = this.hitFlash > 0 ? "#fecaca" : "#ddd6fe";
    ctx.beginPath();
    ctx.arc(0, -this.radius * 0.95, this.radius * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2d1b4e";
    ctx.beginPath();
    ctx.arc(0, -this.radius * 1.1, this.radius * 0.5, Math.PI, 0);
    ctx.fill();
    // glowing eyes
    ctx.fillStyle = "#fbbf24";
    ctx.shadowColor = "#fbbf24";
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(this.radius * 0.14, -this.radius * 0.95, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();

    if (this.hasWeapon("orbit")) {
      const evolved = this.isEvolved("orbit");
      const stats = weaponStats("orbit", this.weaponLevel("orbit"), evolved);
      const color = evolved ? WEAPON_DEFS.orbit.evolved.color : "#67e8f9";
      const orbRadius = evolved ? 9 : 7;
      for (let i = 0; i < stats.count; i++) {
        const a = this.orbitAngle * stats.angularSpeed + (i * Math.PI * 2) / stats.count;
        const ox = this.x + Math.cos(a) * stats.radius;
        const oy = this.y + Math.sin(a) * stats.radius;
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = evolved ? 16 : 10;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(ox, oy, orbRadius, 0, Math.PI * 2);
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
  const evolved = player.isEvolved("bolt");
  const color = evolved ? WEAPON_DEFS.bolt.evolved.color : "#fde68a";
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
        color,
      })
    );
  }
}

function fireNova(player, stats, game) {
  const evolved = player.isEvolved("nova");
  const color = evolved ? WEAPON_DEFS.nova.evolved.color : "#67e8f9";
  game.novaPulses.push({ x: player.x, y: player.y, radius: 0, maxRadius: stats.radius, life: 0.35, color });
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
  const hitRadius = player.isEvolved("orbit") ? 9 : 7;
  for (let i = 0; i < stats.count; i++) {
    const a = player.orbitAngle * stats.angularSpeed + (i * Math.PI * 2) / stats.count;
    const ox = player.x + Math.cos(a) * stats.radius;
    const oy = player.y + Math.sin(a) * stats.radius;
    for (const e of game.enemies) {
      if ((e._orbitHit ?? 0) > 0) continue;
      if (circlesOverlap(ox, oy, hitRadius, e.x, e.y, e.radius)) {
        game.damageEnemy(e, stats.damage * player.damageMult);
        e._orbitHit = stats.hitCooldown;
      }
    }
    const boss = game.boss;
    if (boss && (boss._orbitHit ?? 0) <= 0 && circlesOverlap(ox, oy, hitRadius, boss.x, boss.y, boss.radius)) {
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
    this.animTime = randRange(0, 10);
    this.angle = 0;
    this.charging = false;
  }

  update(dt, game) {
    if (this._orbitHit > 0) this._orbitHit -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    const p = game.player;
    const a = angleTo(this.x, this.y, p.x, p.y);
    const d = dist(this.x, this.y, p.x, p.y);
    this.angle = a;
    this.animTime += dt * (this.type === "shambler" ? 3 : this.type === "brute" ? 2.5 : 8);
    this.charging = false;
    if (this.ranged && d < 320) {
      this.fireTimer -= dt;
      this.charging = this.fireTimer <= 0.5;
      if (this.fireTimer <= 0) {
        this.fireTimer = 2.4;
        this.charging = false;
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

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(0, this.radius * 0.8, this.radius * 0.85, this.radius * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    const flashed = this.hitFlash > 0;
    ctx.save();
    if (this.type === "shambler") this.drawHusk(ctx, flashed);
    else if (this.type === "sprinter") this.drawWretch(ctx, flashed);
    else if (this.type === "brute") this.drawBonecrusher(ctx, flashed);
    else if (this.type === "shooter") this.drawWeeper(ctx, flashed);
    else this.drawFallback(ctx, flashed);
    ctx.restore();

    if (this.maxHp > 20) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(-this.radius, -this.radius - 10, this.radius * 2, 4);
      ctx.fillStyle = "#4ade80";
      ctx.fillRect(-this.radius, -this.radius - 10, this.radius * 2 * clamp(this.hp / this.maxHp, 0, 1), 4);
    }
    ctx.restore();
  }

  drawFallback(ctx, flashed) {
    ctx.fillStyle = flashed ? "#fff" : this.color;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  drawHusk(ctx, flashed) {
    const r = this.radius;
    const shuffle = Math.sin(this.animTime) * 3;
    const bodyColor = flashed ? "#fff" : "#8b1a1a";
    // dragging arm
    drawLimb(ctx, r * 0.4, -r * 0.1, 100, r * 1.1, 4, flashed ? "#fff" : "#5c1010");
    // hunched body
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.1 + shuffle * 0.2, r * 0.95, r * 0.85, 0.15, 0, Math.PI * 2);
    ctx.fill();
    // head sunk forward
    ctx.beginPath();
    ctx.arc(r * 0.35, -r * 0.55, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    // glowing eyes
    ctx.fillStyle = "#f87171";
    ctx.shadowColor = "#f87171";
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.arc(r * 0.5, -r * 0.58, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // legs
    drawLimb(ctx, r * 0.3, r * 0.6, 10 + shuffle * 4, r * 0.6, 4, flashed ? "#fff" : "#5c1010");
    drawLimb(ctx, -r * 0.3, r * 0.6, -10 - shuffle * 4, r * 0.6, 4, flashed ? "#fff" : "#5c1010");
  }

  drawWretch(ctx, flashed) {
    const r = this.radius;
    ctx.rotate(this.angle);
    const gallop = Math.sin(this.animTime);
    const bodyColor = flashed ? "#fff" : "#d97706";
    // legs (four, alternating)
    for (let i = 0; i < 4; i++) {
      const side = i < 2 ? 1 : -1;
      const front = i % 2 === 0 ? 1 : -1;
      const swing = Math.sin(this.animTime + (i % 2) * Math.PI) * 12;
      drawLimb(ctx, front * r * 0.5, side * r * 0.3, front * 40 + swing, r * 0.55, 3, flashed ? "#fff" : "#7c2d12");
    }
    // body
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.15, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    // head
    ctx.beginPath();
    ctx.ellipse(r * 1.05, 0, r * 0.4, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    // eye
    ctx.fillStyle = "#fef08a";
    ctx.shadowColor = "#fef08a";
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(r * 1.25, -r * 0.05, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // tail
    ctx.strokeStyle = flashed ? "#fff" : "#7c2d12";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, 0);
    ctx.quadraticCurveTo(-r * 1.5, gallop * 6, -r * 1.8, -gallop * 4);
    ctx.stroke();
  }

  drawBonecrusher(ctx, flashed) {
    const r = this.radius;
    const stomp = Math.sin(this.animTime) * 3;
    const bodyColor = flashed ? "#fff" : "#7f1d1d";
    // legs
    drawLimb(ctx, r * 0.4, r * 0.6, 12 + stomp * 3, r * 0.65, 7, flashed ? "#fff" : "#450a0a");
    drawLimb(ctx, -r * 0.4, r * 0.6, -12 - stomp * 3, r * 0.65, 7, flashed ? "#fff" : "#450a0a");
    // hulking torso
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(0, stomp * 0.3, r, r * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    // shoulder spikes
    ctx.fillStyle = flashed ? "#fff" : "#292524";
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * r * 0.55, -r * 0.55);
      ctx.lineTo(sx * r * 0.95, -r * 1.1);
      ctx.lineTo(sx * r * 0.25, -r * 0.75);
      ctx.closePath();
      ctx.fill();
    }
    // small sunken head
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(0, -r * 0.5, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fbbf24";
    ctx.shadowColor = "#fbbf24";
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(-r * 0.1, -r * 0.52, 2, 0, Math.PI * 2);
    ctx.arc(r * 0.1, -r * 0.52, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  drawWeeper(ctx, flashed) {
    const r = this.radius;
    const bob = Math.sin(this.animTime * 0.6) * 3;
    ctx.translate(0, bob);
    // tentacle wisps
    ctx.strokeStyle = flashed ? "#fff" : "#6b21a8";
    ctx.lineWidth = 3;
    for (let i = -1; i <= 1; i++) {
      const wave = Math.sin(this.animTime + i) * 5;
      ctx.beginPath();
      ctx.moveTo(i * r * 0.5, r * 0.5);
      ctx.quadraticCurveTo(i * r * 0.5 + wave, r * 1.1, i * r * 0.4, r * 1.5);
      ctx.stroke();
    }
    // charge aura
    if (this.charging) {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(this.animTime * 4) * 0.3;
      ctx.fillStyle = "#e9d5ff";
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // eye body
    ctx.fillStyle = flashed ? "#fff" : "#4c1d95";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e9d5ff";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
    ctx.fill();
    // iris tracking player
    const pupilX = Math.cos(this.angle) * r * 0.28;
    const pupilY = Math.sin(this.angle) * r * 0.28;
    ctx.fillStyle = "#6b21a8";
    ctx.beginPath();
    ctx.arc(pupilX, pupilY, this.charging ? r * 0.34 : r * 0.24, 0, Math.PI * 2);
    ctx.fill();
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
      audio.xpPickup();
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
