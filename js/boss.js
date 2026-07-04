import { dist, clamp, angleTo, randRange, circlesOverlap } from "./utils.js";
import { randInRing } from "./entities.js";

const NAMES = ["THE HOLLOW KING", "MATRIARCH OF ASH", "THE UNBLINKING", "WARDEN OF THE PIT"];

export class Boss {
  constructor(tier, arenaSize) {
    this.id = -1000 - tier;
    this.name = NAMES[Math.min(tier, NAMES.length - 1)];
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
    this.callout = "";
    this.calloutTimer = 0;
    this.deathHandled = false;
    this._orbitHit = 0;
  }

  nextPattern() {
    if (this.bag.length === 0) {
      this.bag = ["slam", "slam", "charge", "weakpoint", "weakpoint", "charge"];
      // shuffle
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

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.shadowColor = this.stunTimer > 0 ? "#facc15" : "#f43f5e";
    ctx.shadowBlur = 20;
    ctx.fillStyle = this.stunTimer > 0 ? "#fde68a" : "#3b0764";
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f43f5e";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
}
