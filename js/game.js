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

const ARENA_SIZE = 4800;
const VIEW_W = 960;
const VIEW_H = 600;

export class Game {
  constructor(callbacks) {
    this.callbacks = callbacks;
    this.arenaSize = ARENA_SIZE;
    this.input = { left: false, right: false, up: false, down: false };
    this.state = "menu";
    this.shake = 0;
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
    this.kills = 0;
    this.coresFromBosses = 0;
    this.pendingLevelUps = 0;
    this.camera = { x: 0, y: 0 };
    this.shake = 0;
    this.state = "playing";
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

  spawnParticleBurst(x, y, color, count) {
    for (let i = 0; i < count; i++) this.particles.push(new Particle(x, y, color));
  }

  damageEnemy(e, dmg) {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    e.hitFlash = 0.12;
    this.texts.push(new FloatingText(e.x, e.y - e.radius - 4, Math.round(dmg).toString(), "#fecaca", 13));
    if (e.hp <= 0) this.onEnemyDeath(e);
  }

  onEnemyDeath(e) {
    this.kills++;
    this.xpOrbs.push(new XPOrb(e.x, e.y, e.xpValue));
    this.spawnParticleBurst(e.x, e.y, e.color, 10);
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
    if (this.boss.hp <= 0 && !this.boss.deathHandled) {
      this.boss.deathHandled = true;
      this.onBossDeath();
    }
  }

  onBossDeath() {
    const boss = this.boss;
    this.spawnParticleBurst(boss.x, boss.y, "#f43f5e", 40);
    this.addScreenShake(14);
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
      this.texts.push(new FloatingText(this.player.x, this.player.y - 24, "-" + Math.round(actual), "#f87171", 15));
      this.addScreenShake(actual > 15 ? 7 : 3);
    }
  }

  spawnBoss() {
    this.boss = new Boss(this.bossesDefeated, this.arenaSize);
    const spot = randomEdgePosition(this.player.x, this.player.y, 340);
    this.boss.x = spot.x;
    this.boss.y = spot.y;
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

    this.camera.x = this.player.x;
    this.camera.y = this.player.y;

    if (this.player.hp <= 0 && this.state === "playing") this.endRun();
  }

  endRun() {
    this.state = "gameover";
    const timeSurvived = this.time;
    const coresEarned = Math.round(timeSurvived / 5 + this.kills * 0.25 + this.coresFromBosses);
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
      ctx.strokeStyle = "rgba(103,232,249,0.7)";
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

    ctx.restore();
  }

  drawBackground(ctx) {
    const half = this.arenaSize / 2;
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
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

    ctx.strokeStyle = "rgba(244,63,94,0.5)";
    ctx.lineWidth = 4;
    ctx.strokeRect(-half, -half, this.arenaSize, this.arenaSize);
  }
}

export { VIEW_W, VIEW_H };
