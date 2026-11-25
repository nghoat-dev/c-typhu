// Bộ sinh số ngẫu nhiên đồng bộ theo match_seed (Mulberry32) + tiện ích procedural.
export function mulberry32(seed) {
  let a = seed >>> 0;
  const rng = function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (a0, b0) => a0 + (b0 - a0) * rng();
  rng.int = (a0, b0) => Math.floor(a0 + (b0 - a0 + 1) * rng());
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.chance = (p) => rng() < p;
  return rng;
}

export function hashSeed(...parts) {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    h ^= 0x9e3779b9; h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// Perlin noise 2D có seed
export function makeNoise2D(seed) {
  const rng = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = (h, x, y) => { const u = (h & 1) ? x : -x; const v = (h & 2) ? y : -y; return (h & 4) ? u + v : (u + v) * 0.7071; };
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  return function (x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const aa = perm[X + perm[Y]], ab = perm[X + perm[Y + 1]], ba = perm[X + 1 + perm[Y]], bb = perm[X + 1 + perm[Y + 1]];
    return lerp(lerp(grad(aa, x, y), grad(ba, x - 1, y), u), lerp(grad(ab, x, y - 1), grad(bb, x - 1, y - 1), u), v);
  };
}

// Poisson Disk Sampling (dart throwing có lưới gia tốc) trong vùng chấp nhận được
export function poissonDisk(rng, minDist, count, accept, bounds) {
  const pts = [];
  const tries = count * 40;
  for (let i = 0; i < tries && pts.length < count; i++) {
    const x = bounds.x0 + rng() * (bounds.x1 - bounds.x0);
    const z = bounds.z0 + rng() * (bounds.z1 - bounds.z0);
    if (!accept(x, z)) continue;
    let ok = true;
    for (const q of pts) { if ((q.x - x) ** 2 + (q.z - z) ** 2 < minDist * minDist) { ok = false; break; } }
    if (ok) pts.push({ x, z });
  }
  return pts;
}
