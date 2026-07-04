import { clamp, randRange, dist, pickWeighted } from "./utils.js";
import {
  Player,
  Enemy,
  ENEMY_DEFS,
  XPOrb,
  Particle,
  FloatingText,
  randomEdgePosition,
} from "./entities.js";
import { Boss } from "./boss.js";
import { generateChoices } from "./upgrades.js";
import { getPermanentBonuses, recordRunResult } from "./save.js";
import { audio } from "./audio.js";

const ARENA_SIZE = 4800;
const VIEW_W = 960;
const VIEW_H = 600;

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function drawDecoration(ctx, x, y, typeRoll, rot, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.globalAlpha = 0.55;
  if (typeRoll < 0.4) {
    ctx.fillStyle = "#2a2a38";
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 6, Math.sin(a) * 4, 7, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (typeRoll < 0.65) {
    ctx.strokeStyle = "rgba(220,220,210,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(10, 0);
    ctx.moveTo(-6, -5);
    ctx.lineTo(-6, 5);
    ctx.moveTo(6, -5);
    ctx.lineTo(6, 5);
    ctx.stroke();
  } else if (typeRoll < 0.85) {
    ctx.strokeStyle = "rgba(90,60,40,0.7)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10 - 4);
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-12, -3);
    ctx.lineTo(-2, 2);
    ctx.lineTo(4, -4);
    ctx.lineTo(14, 3);
    ctx.stroke();
  }
  ctx.restore();
}

export class Game {
  constructor(callbacks) {
    this.callbacks = callbacks;
    this.arenaSize = ARENA_SIZE;
    this.input = { left: false, right: false, up: false, down: false };
    this.touchVector = { x: 0, y: 0 };
    this.state = "menu";
    this.shake = 0;
    this.hitStop = 0;
    this.flashTimer = 0;
    this.flashMaxTimer = 0;
    this.flashColor = "255,255,255";
  }

  startRun() {
    const bonuses = getPermanentBonuses();
    this.player = new Player(bonuses);
    this.enemies = [];
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.xpOrbs = [];
    this.particles = [];
    this.texts = [];
    this.novaPulses = [];
    this.boss = null;
    this.time = 0;
    this.spawnTimer = 0.8;
    this.bossTimer = 90;
    this.bossesDefeated = 0;
    this.eliteTimer = 24;
    this.kills = 0;
    this.coresFromBosses = 0;
    this.coresFromElites = 0;
    this.pendingLevelUps = 0;
    this.camera = { x: 0, y: 0 };
    this.shake = 0;
    this.hitStop = 0;
    this.flashTimer = 0;
    this.ambientEmbers = Array.from({ length: 36 }, () => ({
      x: randRange(-VIEW_W, VIEW_W),
      y: randRange(-VIEW_H, VIEW_H),
      vy: randRange(-22, -9),
      phase: randRange(0, Math.PI * 2),
      size: randRange(1.2, 2.8),
    }));
    this.state = "playing";
  }

  updateAmbient(dt) {
    const halfW = VIEW_W / 2 + 80;
    const halfH = VIEW_H / 2 + 80;
    for (const e of this.ambientEmbers) {
      e.y += e.vy * dt;
      e.phase += dt * 3;
      const dx = e.x - this.camera.x;
      const dy = e.y - this.camera.y;
      if (Math.abs(dx) > halfW || Math.abs(dy) > halfH) {
        e.x = this.camera.x + randRange(-halfW, halfW);
        e.y = this.camera.y + halfH;
      }
    }
  }

  queueLevelUps(n) {
    this.pendingLevelUps = (this.pendingLevelUps || 0) + n;
    if (this.state === "playing") this.showNextLevelUp();
  }

  showNextLevelUp() {
    if (this.pendingLevelUps <= 0) {
      this.state = "playing";
      return;
    }
    this.pendingLevelUps--;
    this.state = "levelup";
    audio.levelUp();
    const choices = generateChoices(this.player);
    this.callbacks.onLevelUp(choices, (choice) => {
      choice.apply(this.player);
      this.showNextLevelUp();
    });
  }

  nearestEnemies(x, y, n) {
    const all = this.enemies.slice();
    if (this.boss) all.push(this.boss);
    all.sort((a, b) => dist(x, y, a.x, a.y) - dist(x, y, b.x, b.y));
    return all.slice(0, Math.max(1, n));
  }

  addScreenShake(mag) {
    this.shake = Math.min(24, this.shake + mag);
  }

  triggerHitStop(duration) {
    this.hitStop = Math.max(this.hitStop, duration);
  }

  triggerFlash(color, duration) {
    this.flashColor = color;
    this.flashTimer = duration;
    this.flashMaxTimer = duration;
  }

  spawnParticleBurst(x, y, color, count) {
    for (let i = 0; i < count; i++) this.particles.push(new Particle(x, y, color));
  }

  damageEnemy(e, dmg) {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    e.hitFlash = 0.12;
    audio.hitEnemy();
    this.texts.push(new FloatingText(e.x, e.y - e.radius - 4, Math.round(dmg).toString(), "#fecaca", 13));
    if (e.hp <= 0) this.onEnemyDeath(e);
  }

  onEnemyDeath(e) {
    this.kills++;
    audio.enemyDeath();
    this.xpOrbs.push(new XPOrb(e.x, e.y, e.xpValue));
    this.spawnParticleBurst(e.x, e.y, e.color, e.elite ? 26 : 10);
    if (e.elite) {
      this.coresFromElites += 4;
      this.xpOrbs.push(new XPOrb(e.x + 10, e.y, Math.round(e.xpValue * 0.4)));
      this.triggerHitStop(0.05);
      this.triggerFlash("251,191,36", 0.12);
      this.addScreenShake(6);
    }
  }

  damageBoss(dmg, opts = {}) {
    if (!this.boss || this.boss.hp <= 0) return;
    this.boss.hp -= dmg;
    this.texts.push(
      new FloatingText(
        this.boss.x,
        this.boss.y - this.boss.radius - 10,
        Math.round(dmg).toString(),
        opts.crit ? "#fde68a" : "#fecaca",
        opts.crit ? 18 : 14
      )
    );
    if (opts.crit) {
      this.triggerHitStop(0.09);
      this.triggerFlash("250,204,21", 0.15);
    }
    if (this.boss.hp <= 0 && !this.boss.deathHandled) {
      this.boss.deathHandled = true;
      this.onBossDeath();
    }
  }

  onBossDeath() {
    const boss = this.boss;
    audio.bossDefeat();
    this.spawnParticleBurst(boss.x, boss.y, "#f43f5e", 40);
    this.addScreenShake(14);
    this.triggerHitStop(0.16);
    this.triggerFlash("244,63,94", 0.3);
    this.xpOrbs.push(new XPOrb(boss.x - 15, boss.y, 45));
    this.xpOrbs.push(new XPOrb(boss.x + 15, boss.y, 45));
    this.coresFromBosses += 15 + this.bossesDefeated * 5;
    this.bossesDefeated++;
    this.bossTimer = 100 + this.bossesDefeated * 45;
    this.callbacks.onBossEnd?.(boss.name);
    this.boss = null;
  }

  damagePlayer(amount) {
    const actual = this.player.takeDamage(amount);
    if (actual > 0) {
      audio.playerHit();
      this.texts.push(new FloatingText(this.player.x, this.player.y - 24, "-" + Math.round(actual), "#f87171", 15));
      this.addScreenShake(actual > 15 ? 7 : 3);
    }
  }

  spawnBoss() {
    this.boss = new Boss(this.bossesDefeated, this.arenaSize);
    const spot = randomEdgePosition(this.player.x, this.player.y, 340);
    this.boss.x = spot.x;
    this.boss.y = spot.y;
    audio.bossSpawn();
    this.callbacks.onBossStart?.(this.boss.name);
  }

  pickEnemyType(t) {
    const pool = [
      { type: "shambler", weight: 10 },
      { type: "sprinter", weight: 8 },
    ];
    if (t > 25) pool.push({ type: "brute", weight: 5 });
    if (t > 55) pool.push({ type: "shooter", weight: 5 });
    return pickWeighted(pool, 1)[0].type;
  }

  updateEliteSpawning(dt) {
    if (this.boss) return;
    this.eliteTimer -= dt;
    if (this.eliteTimer > 0) return;
    this.eliteTimer = randRange(38, 58);
    if (this.enemies.length > 160) return;
    const hpMult = 1 + this.time * 0.02;
    const dmgMult = 1 + this.time * 0.01;
    const type = this.pickEnemyType(this.time);
    const pos = randomEdgePosition(this.player.x, this.player.y, randRange(480, 620));
    this.enemies.push(new Enemy(type, pos.x, pos.y, hpMult, dmgMult, true));
  }

  updateSpawning(dt) {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    const interval = clamp(1.3 - this.time * 0.008, 0.28, 1.3) * (this.boss ? 2.2 : 1);
    this.spawnTimer = interval;
    const count = Math.min(4, 1 + Math.floor(this.time / 70));
    const hpMult = 1 + this.time * 0.02;
    const dmgMult = 1 + this.time * 0.01;
    for (let i = 0; i < count; i++) {
      if (this.enemies.length > 160) break;
      const type = this.pickEnemyType(this.time);
      const pos = randomEdgePosition(this.player.x, this.player.y, randRange(480, 620));
      this.enemies.push(new Enemy(type, pos.x, pos.y, hpMult, dmgMult));
    }
  }

  update(dt) {
    if (this.state !== "playing") return;
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 40);

    this.player.update(dt, this);

    for (const e of this.enemies) if (e.hp > 0) e.update(dt, this);
    this.enemies = this.enemies.filter((e) => e.hp > 0);

    for (const p of this.projectiles) p.update(dt, this);
    this.projectiles = this.projectiles.filter((p) => p.life > 0);

    for (const p of this.enemyProjectiles) p.update(dt, this);
    this.enemyProjectiles = this.enemyProjectiles.filter((p) => p.life > 0);

    for (const o of this.xpOrbs) o.update(dt, this);
    this.xpOrbs = this.xpOrbs.filter((o) => !o.dead);

    for (const p of this.particles) p.update(dt);
    this.particles = this.particles.filter((p) => p.life > 0);

    for (const t of this.texts) t.update(dt);
    this.texts = this.texts.filter((t) => t.life > 0);

    for (const n of this.novaPulses) n.life -= dt;
    this.novaPulses = this.novaPulses.filter((n) => n.life > 0);
    for (const n of this.novaPulses) n.radius = n.maxRadius * (1 - Math.max(0, n.life) / 0.35);

    if (this.boss) {
      this.boss.update(dt, this);
    } else {
      this.bossTimer -= dt;
      if (this.bossTimer <= 0) this.spawnBoss();
    }

    this.updateSpawning(dt);
    this.updateEliteSpawning(dt);

    if (this.flashTimer > 0) this.flashTimer = Math.max(0, this.flashTimer - dt);

    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.updateAmbient(dt);

    if (this.player.hp <= 0 && !this.player.dying) {
      this.player.dying = true;
      this.player.deathTimer = 0;
      this.spawnParticleBurst(this.player.x, this.player.y, "#c4b5fd", 24);
      this.addScreenShake(10);
    }
    if (this.player.dying) {
      this.player.deathTimer += dt;
      if (this.player.deathTimer >= 0.8) this.endRun();
    }
  }

  endRun() {
    this.state = "gameover";
    audio.gameOver();
    audio.stopDrone();
    const timeSurvived = this.time;
    const coresEarned = Math.round(
      timeSurvived / 5 + this.kills * 0.25 + this.coresFromBosses + this.coresFromElites
    );
    recordRunResult({ timeSurvived, level: this.player.level, coresEarned });
    this.callbacks.onGameOver({
      timeSurvived,
      level: this.player.level,
      kills: this.kills,
      bossesDefeated: this.bossesDefeated,
      coresEarned,
    });
  }

  render(ctx) {
    ctx.save();
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = "#0d0d16";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const shakeX = this.shake > 0 ? randRange(-this.shake, this.shake) : 0;
    const shakeY = this.shake > 0 ? randRange(-this.shake, this.shake) : 0;
    ctx.translate(VIEW_W / 2 - this.camera.x + shakeX, VIEW_H / 2 - this.camera.y + shakeY);

    this.drawBackground(ctx);

    for (const n of this.novaPulses) {
      ctx.save();
      ctx.strokeStyle = n.color ? n.color : "rgba(103,232,249,0.7)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const o of this.xpOrbs) o.draw(ctx);
    for (const p of this.enemies) p.draw(ctx);
    if (this.boss) this.boss.draw(ctx);
    for (const p of this.projectiles) p.draw(ctx);
    for (const p of this.enemyProjectiles) p.draw(ctx);
    this.player.draw(ctx);
    for (const p of this.particles) p.draw(ctx);
    for (const t of this.texts) t.draw(ctx);
    this.drawAmbient(ctx);

    ctx.restore();

    const vignette = ctx.createRadialGradient(
      VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35,
      VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.72
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    if (this.flashTimer > 0) {
      ctx.fillStyle = `rgba(${this.flashColor},${(this.flashTimer / this.flashMaxTimer) * 0.35})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    this.drawMinimap(ctx);
  }

  drawMinimap(ctx) {
    const size = 130;
    const margin = 14;
    const x0 = VIEW_W - size - margin;
    const y0 = VIEW_H - size - margin;
    const scale = size / this.arenaSize;

    ctx.save();
    ctx.fillStyle = "rgba(10,10,18,0.62)";
    ctx.fillRect(x0, y0, size, size);
    ctx.strokeStyle = "rgba(139,92,246,0.55)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0, y0, size, size);

    const cx = x0 + size / 2;
    const cy = y0 + size / 2;

    for (const e of this.enemies) {
      const mx = cx + e.x * scale;
      const my = cy + e.y * scale;
      if (mx < x0 || mx > x0 + size || my < y0 || my > y0 + size) continue;
      ctx.fillStyle = e.elite ? "#fbbf24" : "rgba(248,113,113,0.65)";
      const s = e.elite ? 2.6 : 1.6;
      ctx.fillRect(mx - s / 2, my - s / 2, s, s);
    }

    if (this.boss) {
      const mx = cx + this.boss.x * scale;
      const my = cy + this.boss.y * scale;
      ctx.fillStyle = "#f43f5e";
      ctx.beginPath();
      ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const px = cx + this.player.x * scale;
    const py = cy + this.player.y * scale;
    ctx.fillStyle = "#c4b5fd";
    ctx.shadowColor = "#c4b5fd";
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawAmbient(ctx) {
    for (const e of this.ambientEmbers) {
      const sway = Math.sin(e.phase) * 8;
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(e.phase * 1.7) * 0.25;
      ctx.shadowColor = "#fbbf24";
      ctx.shadowBlur = 6;
      ctx.fillStyle = "#fde68a";
      ctx.beginPath();
      ctx.arc(e.x + sway, e.y, e.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawBackground(ctx) {
    const half = this.arenaSize / 2;
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    const grid = 80;
    const startX = Math.floor((this.camera.x - VIEW_W) / grid) * grid;
    const endX = this.camera.x + VIEW_W;
    const startY = Math.floor((this.camera.y - VIEW_H) / grid) * grid;
    const endY = this.camera.y + VIEW_H;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += grid) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += grid) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();

    this.drawDecorations(ctx);

    ctx.save();
    ctx.shadowColor = "rgba(139,92,246,0.6)";
    ctx.shadowBlur = 12;
    ctx.strokeStyle = "rgba(139,92,246,0.55)";
    ctx.lineWidth = 4;
    ctx.strokeRect(-half, -half, this.arenaSize, this.arenaSize);
    ctx.restore();
  }

  drawDecorations(ctx) {
    const cell = 220;
    const startCx = Math.floor((this.camera.x - VIEW_W) / cell);
    const endCx = Math.ceil((this.camera.x + VIEW_W) / cell);
    const startCy = Math.floor((this.camera.y - VIEW_H) / cell);
    const endCy = Math.ceil((this.camera.y + VIEW_H) / cell);
    for (let cx = startCx; cx <= endCx; cx++) {
      for (let cy = startCy; cy <= endCy; cy++) {
        if (hash2(cx, cy) > 0.55) continue;
        const ox = (hash2(cx * 3.1, cy * 7.3) - 0.5) * cell * 0.8;
        const oy = (hash2(cx * 9.7, cy * 2.3) - 0.5) * cell * 0.8;
        const wx = cx * cell + cell / 2 + ox;
        const wy = cy * cell + cell / 2 + oy;
        const typeRoll = hash2(cx * 5.5, cy * 13.1);
        const rot = hash2(cx * 17.3, cy * 4.1) * Math.PI * 2;
        const scale = 0.7 + hash2(cx * 2.9, cy * 8.8) * 0.8;
        drawDecoration(ctx, wx, wy, typeRoll, rot, scale);
      }
    }
  }
}

export { VIEW_W, VIEW_H };
