const MUTE_KEY = "nightfallSwarm.muted";

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.noiseBuffer = null;
    this.droneNodes = null;
    this.muted = localStorage.getItem(MUTE_KEY) === "1";
    this._lastXpTick = 0;
  }

  ensureContext() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 1;
    this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.35;
    this.musicGain.connect(this.master);
    this.noiseBuffer = this._buildNoiseBuffer();
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  }

  isMuted() {
    return this.muted;
  }

  setMuted(muted) {
    this.muted = muted;
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  _buildNoiseBuffer() {
    const len = Math.floor(this.ctx.sampleRate * 0.5);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  tone({ freq = 440, type = "sine", duration = 0.15, gain = 0.2, slideTo = null, delay = 0 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }

  noiseBurst({ duration = 0.2, gain = 0.3, filterFreq = 1000 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  hitEnemy() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - (this._lastHitTick || 0) < 0.03) return;
    this._lastHitTick = now;
    this.tone({ freq: 700 + Math.random() * 220, type: "square", duration: 0.06, gain: 0.07 });
  }

  enemyDeath() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - (this._lastDeathTick || 0) < 0.03) return;
    this._lastDeathTick = now;
    this.noiseBurst({ duration: 0.16, gain: 0.16, filterFreq: 1800 });
    this.tone({ freq: 300, type: "sawtooth", duration: 0.12, gain: 0.05, slideTo: 80 });
  }

  playerHit() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - (this._lastPlayerHitTick || 0) < 0.15) return;
    this._lastPlayerHitTick = now;
    this.tone({ freq: 130, type: "sine", duration: 0.18, gain: 0.22, slideTo: 55 });
  }

  xpPickup() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this._lastXpTick < 0.05) return;
    this._lastXpTick = now;
    this.tone({ freq: 1100 + Math.random() * 200, type: "sine", duration: 0.05, gain: 0.045 });
  }

  levelUp() {
    [0, 0.09, 0.18].forEach((delay, i) =>
      this.tone({ freq: 440 * Math.pow(2, i / 3), type: "triangle", duration: 0.16, gain: 0.14, delay })
    );
  }

  bossSpawn() {
    this.tone({ freq: 70, type: "sawtooth", duration: 1.4, gain: 0.16, slideTo: 42 });
  }

  bossStun() {
    [0, 0.06].forEach((delay, i) =>
      this.tone({ freq: 900 + i * 320, type: "sine", duration: 0.25, gain: 0.18, delay })
    );
  }

  bossDefeat() {
    [0, 0.12, 0.24].forEach((delay, i) =>
      this.tone({ freq: 220 * Math.pow(2, i / 2), type: "triangle", duration: 0.4, gain: 0.18, delay })
    );
  }

  gameOver() {
    this.tone({ freq: 220, type: "sine", duration: 1.0, gain: 0.18, slideTo: 55 });
  }

  uiClick() {
    this.tone({ freq: 500, type: "square", duration: 0.04, gain: 0.05 });
  }

  startDrone() {
    if (!this.ctx || this.droneNodes) return;
    const osc1 = this.ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.value = 55;
    const osc2 = this.ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = 55 * 1.5;
    const g = this.ctx.createGain();
    g.gain.value = 0.0001;
    g.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 2);
    osc1.connect(g);
    osc2.connect(g);
    g.connect(this.musicGain);
    osc1.start();
    osc2.start();
    this.droneNodes = { osc1, osc2, g };
  }

  stopDrone() {
    if (!this.droneNodes || !this.ctx) return;
    const { osc1, osc2, g } = this.droneNodes;
    const t = this.ctx.currentTime;
    g.gain.linearRampToValueAtTime(0.0001, t + 1);
    osc1.stop(t + 1.05);
    osc2.stop(t + 1.05);
    this.droneNodes = null;
  }
}

export const audio = new AudioEngine();
