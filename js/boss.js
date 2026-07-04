import { dist, clamp, angleTo, randRange, circlesOverlap } from "./utils.js";
import { randInRing, Enemy } from "./entities.js";
import { BOSS_LORE } from "./lore.js";
import { audio } from "./audio.js";

function angleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

const SUMMON_TYPES = ["shambler", "sprinter"];

export class Boss {
  constructor(tier, arenaSize) {
    const lore = BOSS_LORE[Math.min(tier, BOSS_LORE.length - 1)];
    this.id = -1000 - tier;
    this.name = lore.name;
    this.lore = lore;
    this.tier = tier;
    this.radius = 34;
    this.maxHp = 380 * (1 + tier * 0.65);
    this.hp = this.maxHp;
    this.speed = 58;
    this.contactDamage = 20 + tier * 4;
    this.x = 0;
    this.y = -260;
    this.arenaSize = arenaSize;
    this.phase = "enter";
    this.phaseTimer = 1.6;
    this.bag = [];
    this.stunTimer = 0;
    this.telegraph = null;
    this.weakpoint = null;
    this.pits = [];
    this.gazeCurrentAngle = 0;
    this.callout = "";
    this.calloutTimer = 0;
    this.deathHandled = false;
    this._orbitHit = 0;
    this.animTime = 0;
    this.setCallout(lore.intro, 2.6);
  }

  patternPool() {
    // Every boss keeps the core slam/charge/weak-point kit; each tier layers
    // in one signature move so fights feel like different characters, not
    // just palette-swapped numbers.
    if (this.tier === 1) return ["slam", "charge", "weakpoint", "weakpoint", "summon", "summon"];
    if (this.tier === 2) return ["slam", "charge", "weakpoint", "gaze", "gaze", "gaze"];
    if (this.tier >= 3) return ["slam", "charge", "weakpoint", "pits", "pits", "pits"];
    return ["slam", "slam", "charge", "weakpoint", "weakpoint", "charge"];
  }

  nextPattern() {
    if (this.bag.length === 0) {
      this.bag = this.patternPool();
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    return this.bag.pop();
  }

  setCallout(text, duration = 1.4) {
    this.callout = text;
    this.calloutTimer = duration;
  }

  update(dt, game) {
    this.animTime += dt;
    if (this.calloutTimer > 0) this.calloutTimer -= dt;
    if (this._orbitHit > 0) this._orbitHit -= dt;

    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      return;
    }

    const p = game.player;

    switch (this.phase) {
      case "enter": {
        const a = angleTo(this.x, this.y, 0, 0);
        this.x += Math.cos(a) * this.speed * 1.4 * dt;
        this.y += Math.sin(a) * this.speed * 1.4 * dt;
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) this.enterRecover();
        break;
      }
      case "recover": {
        this.chaseSlowly(dt, game);
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) this.beginPattern(game);
        break;
      }
      case "telegraph_slam": {
        this.phaseTimer -= dt;
        this.telegraph.radius = this.telegraph.maxRadius * (1 - Math.max(0, this.phaseTimer) / this.telegraph.duration);
        if (this.phaseTimer <= 0) this.resolveSlam(game);
        break;
      }
      case "telegraph_charge": {
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) this.beginCharge(game);
        break;
      }
      case "telegraph_weakpoint": {
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) {
          this.phase = "weakpoint_active";
          this.weakpoint = this.pendingWeakpoint;
          this.pendingWeakpoint = null;
        }
        break;
      }
      case "charging": {
        this.x += Math.cos(this.telegraph.angle) * 780 * dt;
        this.y += Math.sin(this.telegraph.angle) * 780 * dt;
        if (circlesOverlap(this.x, this.y, this.radius, p.x, p.y, p.radius)) {
          game.damagePlayer(this.contactDamage * 1.1);
        }
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) this.enterRecover();
        break;
      }
      case "summon_cast": {
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) this.resolveSummon(game);
        break;
      }
      case "telegraph_gaze": {
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) this.beginGazeSweep(game);
        break;
      }
      case "gazing": {
        this.gazeElapsed += dt;
        this.gazeCurrentAngle = this.gazeStartAngle + this.gazeSpeed * this.gazeElapsed;
        const angToPlayer = angleTo(this.x, this.y, p.x, p.y);
        const d = dist(this.x, this.y, p.x, p.y);
        if (Math.abs(angleDiff(angToPlayer, this.gazeCurrentAngle)) < 0.14 && d < 900) {
          game.damagePlayer(this.contactDamage * 1.6 * dt);
        }
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) this.enterRecover();
        break;
      }
      case "telegraph_pits": {
        this.phaseTimer -= dt;
        for (const pit of this.pits) pit.radius = pit.maxRadius * (1 - Math.max(0, this.phaseTimer) / pit.duration);
        if (this.phaseTimer <= 0) this.resolvePits(game);
        break;
      }
      case "weakpoint_active": {
        this.chaseSlowly(dt, game);
        const wp = this.weakpoint;
        wp.windowTimer -= dt;
        const inside = dist(p.x, p.y, wp.x, wp.y) <= wp.radius;
        if (inside) wp.timeInZone += dt;
        if (wp.timeInZone >= wp.required) {
          this.triggerStun(game);
        } else if (wp.windowTimer <= 0) {
          this.weakpoint = null;
          this.setCallout("Opportunity missed...", 1.1);
          this.enterRecover();
        }
        break;
      }
    }

    const half = this.arenaSize / 2 - this.radius;
    this.x = clamp(this.x, -half, half);
    this.y = clamp(this.y, -half, half);

    if (this.phase !== "weakpoint_active" && this.phase !== "telegraph_weakpoint") {
      if (circlesOverlap(this.x, this.y, this.radius, p.x, p.y, p.radius)) {
        game.damagePlayer(this.contactDamage * dt * 2.4);
      }
    }
  }

  chaseSlowly(dt, game) {
    const p = game.player;
    const d = dist(this.x, this.y, p.x, p.y);
    if (d > 120) {
      const a = angleTo(this.x, this.y, p.x, p.y);
      this.x += Math.cos(a) * this.speed * dt;
      this.y += Math.sin(a) * this.speed * dt;
    }
  }

  enterRecover() {
    this.phase = "recover";
    this.phaseTimer = randRange(0.9, 1.3);
    this.telegraph = null;
  }

  beginPattern(game) {
    const pattern = this.nextPattern();
    if (pattern === "slam") this.beginSlam(game);
    else if (pattern === "charge") this.beginChargeTelegraph(game);
    else if (pattern === "weakpoint") this.beginWeakpoint(game);
    else if (pattern === "summon") this.beginSummon(game);
    else if (pattern === "gaze") this.beginGaze(game);
    else if (pattern === "pits") this.beginPits(game);
  }

  beginSummon(game) {
    this.setCallout("THE BROOD ANSWERS", 1.6);
    this.phase = "summon_cast";
    this.phaseTimer = 1.0;
  }

  resolveSummon(game) {
    const half = this.arenaSize / 2 - 40;
    for (let i = 0; i < 2; i++) {
      const spot = randInRing(this.x, this.y, 70, 150);
      const x = clamp(spot.x, -half, half);
      const y = clamp(spot.y, -half, half);
      const type = SUMMON_TYPES[Math.floor(Math.random() * SUMMON_TYPES.length)];
      game.enemies.push(new Enemy(type, x, y, 1 + game.time * 0.02, 1 + game.time * 0.01));
    }
    game.spawnParticleBurst(this.x, this.y, "#f43f5e", 16);
    this.enterRecover();
  }

  beginGaze(game) {
    this.setCallout("THE GAZE OPENS", 1.4);
    this.phase = "telegraph_gaze";
    this.phaseTimer = 0.7;
    const startAngle = angleTo(this.x, this.y, game.player.x, game.player.y) - 0.9;
    this.telegraph = { kind: "gaze", angle: startAngle, duration: 0.7 };
  }

  beginGazeSweep(game) {
    this.phase = "gazing";
    this.phaseTimer = 1.6;
    this.gazeStartAngle = this.telegraph.angle;
    this.gazeSpeed = 1.8;
    this.gazeElapsed = 0;
    this.gazeCurrentAngle = this.gazeStartAngle;
    this.telegraph = null;
    game.addScreenShake(3);
  }

  beginPits(game) {
    this.setCallout("THE PIT OPENS", 1.4);
    this.phase = "telegraph_pits";
    this.phaseTimer = 1.1;
    const half = this.arenaSize / 2 - 60;
    const count = 3;
    this.pits = [];
    for (let i = 0; i < count; i++) {
      const spot = randInRing(game.player.x, game.player.y, 50, 260);
      this.pits.push({
        x: clamp(spot.x, -half, half),
        y: clamp(spot.y, -half, half),
        radius: 0,
        maxRadius: 68,
        duration: 1.1,
      });
    }
  }

  resolvePits(game) {
    const p = game.player;
    for (const pit of this.pits) {
      if (dist(p.x, p.y, pit.x, pit.y) <= pit.maxRadius + p.radius) {
        game.damagePlayer(24 + this.tier * 3);
      }
      game.spawnParticleBurst(pit.x, pit.y, "#f87171", 14);
    }
    game.addScreenShake(8);
    this.pits = [];
    this.enterRecover();
  }

  beginSlam(game) {
    this.setCallout("INCOMING SLAM!");
    this.phase = "telegraph_slam";
    this.phaseTimer = 1.0;
    this.telegraph = {
      x: game.player.x,
      y: game.player.y,
      radius: 0,
      maxRadius: 105 + this.tier * 6,
      duration: 1.0,
      kind: "slam",
    };
  }

  resolveSlam(game) {
    const p = game.player;
    if (dist(p.x, p.y, this.telegraph.x, this.telegraph.y) <= this.telegraph.maxRadius + p.radius) {
      game.damagePlayer(28 + this.tier * 4);
    }
    game.spawnParticleBurst(this.telegraph.x, this.telegraph.y, "#f87171", 22);
    game.addScreenShake(8);
    this.telegraph = null;
    this.enterRecover();
  }

  beginChargeTelegraph(game) {
    this.setCallout("CHARGE!");
    this.phase = "telegraph_charge";
    this.phaseTimer = 0.8;
    const angle = angleTo(this.x, this.y, game.player.x, game.player.y);
    this.telegraph = { angle, duration: 0.8, kind: "charge" };
  }

  beginCharge(game) {
    this.phase = "charging";
    this.phaseTimer = 0.42;
    game.addScreenShake(4);
  }

  beginWeakpoint(game) {
    this.setCallout("WEAK POINT OPENING!", 1.6);
    this.phase = "telegraph_weakpoint";
    this.phaseTimer = 0.6;
    const spot = randInRing(this.x, this.y, 90, 220);
    const half = this.arenaSize / 2 - 60;
    this.pendingWeakpoint = {
      x: clamp(spot.x, -half, half),
      y: clamp(spot.y, -half, half),
      radius: 52,
      windowTimer: 3.2,
      timeInZone: 0,
      required: 1.1,
    };
  }

  triggerStun(game) {
    this.weakpoint = null;
    this.stunTimer = 2.4;
    audio.bossStun();
    this.setCallout("STUNNED! Weak point struck!", 1.6);
    const dmg = this.maxHp * 0.16;
    game.damageBoss(dmg, { crit: true });
    game.spawnParticleBurst(game.player.x, game.player.y, "#facc15", 26);
    game.addScreenShake(10);
    this.enterRecover();
  }

  draw(ctx) {
    if (this.telegraph?.kind === "slam") {
      ctx.save();
      ctx.strokeStyle = "rgba(248,113,113,0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.telegraph.x, this.telegraph.y, this.telegraph.maxRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(248,113,113,0.25)";
      ctx.beginPath();
      ctx.arc(this.telegraph.x, this.telegraph.y, this.telegraph.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (this.telegraph?.kind === "charge") {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.telegraph.angle);
      ctx.fillStyle = "rgba(248,113,113,0.3)";
      ctx.fillRect(0, -34, 900, 68);
      ctx.restore();
    }
    if (this.telegraph?.kind === "gaze") {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.telegraph.angle);
      ctx.strokeStyle = "rgba(196,181,253,0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(900, 0);
      ctx.stroke();
      ctx.restore();
    }
    if (this.phase === "gazing") {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.gazeCurrentAngle);
      const grad = ctx.createLinearGradient(0, 0, 900, 0);
      grad.addColorStop(0, "rgba(233,213,255,0.95)");
      grad.addColorStop(1, "rgba(233,213,255,0.05)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 22;
      ctx.shadowColor = "#e9d5ff";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(900, 0);
      ctx.stroke();
      ctx.restore();
    }
    if (this.pits && this.pits.length) {
      for (const pit of this.pits) {
        ctx.save();
        ctx.strokeStyle = "rgba(248,113,113,0.9)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(pit.x, pit.y, pit.maxRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(127,29,29,0.4)";
        ctx.beginPath();
        ctx.arc(pit.x, pit.y, pit.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    if (this.weakpoint) {
      const wp = this.weakpoint;
      ctx.save();
      const pct = clamp(wp.timeInZone / wp.required, 0, 1);
      ctx.strokeStyle = "rgba(250,204,21,0.9)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, wp.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(250,204,21,0.18)";
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, wp.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fde68a";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, wp.radius + 10, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const hpPct = clamp(this.hp / this.maxHp, 0, 1);
    const stunned = this.stunTimer > 0;
    const charging = this.phase.startsWith("telegraph") || this.phase === "charging";
    const auraColor = stunned ? "#fde68a" : charging ? "#fb7185" : "#c026d3";

    ctx.save();
    ctx.translate(this.x, this.y);

    // ground shadow
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(0, this.radius * 0.85, this.radius * 1.1, this.radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // outer rotating shard ring
    const shardCount = 6;
    for (let i = 0; i < shardCount; i++) {
      const a = this.animTime * (stunned ? 3.2 : 0.7) + (i * Math.PI * 2) / shardCount;
      const sx = Math.cos(a) * (this.radius + 14);
      const sy = Math.sin(a) * (this.radius + 14);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = auraColor;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(5, 7);
      ctx.lineTo(-5, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // core body
    const pulse = 1 + Math.sin(this.animTime * (stunned ? 10 : 3)) * (stunned ? 0.06 : 0.03);
    ctx.shadowColor = auraColor;
    ctx.shadowBlur = stunned ? 28 : 20;
    ctx.fillStyle = stunned ? "#fef3c7" : "#2e1065";
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = auraColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // inner crystalline heart
    ctx.fillStyle = auraColor;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(0, -this.radius * 0.5);
    ctx.lineTo(this.radius * 0.35, 0);
    ctx.lineTo(0, this.radius * 0.5);
    ctx.lineTo(-this.radius * 0.35, 0);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // cracks that spread as HP drops
    const crackCount = Math.round((1 - hpPct) * 7);
    ctx.strokeStyle = "rgba(0,0,0,0.65)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < crackCount; i++) {
      const a = (i / 7) * Math.PI * 2 + this.tier;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * this.radius * 0.9, Math.sin(a) * this.radius * 0.9);
      ctx.stroke();
    }

    ctx.restore();
  }
}
