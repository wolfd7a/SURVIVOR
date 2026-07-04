export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function randRange(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

export function randInt(lo, hi) {
  return Math.floor(randRange(lo, hi + 1));
}

export function choice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function circlesOverlap(ax, ay, ar, bx, by, br) {
  return dist(ax, ay, bx, by) <= ar + br;
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

// Weighted pick without replacement, up to n items.
export function pickWeighted(items, n) {
  const pool = items.slice();
  const out = [];
  while (pool.length && out.length < n) {
    const total = pool.reduce((s, i) => s + i.weight, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < pool.length; idx++) {
      r -= pool[idx].weight;
      if (r <= 0) break;
    }
    out.push(pool.splice(Math.min(idx, pool.length - 1), 1)[0]);
  }
  return out;
}
