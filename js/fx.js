// Pre-rendered glow sprites. Canvas shadowBlur is recomputed per draw call and
// becomes the frame-time bottleneck once entity counts climb; a cached
// radial-gradient sprite blitted with drawImage costs a fraction of that.

const SPRITE_SIZE = 64;
const CORE_R = 14; // radius of the solid core inside the 32px sprite half-size

const cache = new Map();

function buildSprite(color, coreColor) {
  const c = document.createElement("canvas");
  c.width = SPRITE_SIZE;
  c.height = SPRITE_SIZE;
  const g = c.getContext("2d");
  const half = SPRITE_SIZE / 2;
  const grad = g.createRadialGradient(half, half, 1, half, half, half);
  grad.addColorStop(0, coreColor);
  grad.addColorStop(CORE_R / half, coreColor);
  grad.addColorStop(CORE_R / half + 0.08, color);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.beginPath();
  g.arc(half, half, half, 0, Math.PI * 2);
  g.fill();
  return c;
}

export function glowSprite(color, coreColor = color) {
  const key = color + "|" + coreColor;
  let sprite = cache.get(key);
  if (!sprite) {
    sprite = buildSprite(color, coreColor);
    cache.set(key, sprite);
  }
  return sprite;
}

// Draw a glowing circle whose solid core has radius r; the halo extends ~2.3r.
export function drawGlowCircle(ctx, x, y, r, color, coreColor = color, alpha = 1) {
  const half = r * (32 / CORE_R);
  if (alpha !== 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.drawImage(glowSprite(color, coreColor), x - half, y - half, half * 2, half * 2);
    ctx.restore();
  } else {
    ctx.drawImage(glowSprite(color, coreColor), x - half, y - half, half * 2, half * 2);
  }
}
