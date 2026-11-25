// Bộ sinh kiến trúc công trình 3D ngẫu nhiên (Cấp 1–4 + Bãi Biển) theo seed = match_seed + tile_idx.
import * as THREE from 'three';
import { mulberry32 } from './prng.js';

const PASTELS = ['#f8d7a8', '#f4b6a6', '#c9e4de', '#f6eac2', '#dfd3f0', '#bfd8f7', '#f3c6d8', '#e8e8e8', '#ffe0b3'];
const ROOFS = ['#b5483b', '#5b6d8a', '#3f6b4f', '#8a5a3b', '#2f3d4c', '#a8323e'];

const matCache = new Map();
export function stdMat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...opts }));
  return matCache.get(key);
}

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function windowTexture(rng, cols, rows, lit, wall = '#2b3442', on = '#ffe9a8', off = '#1b2230') {
  const c = document.createElement('canvas');
  c.width = 16 * cols; c.height = 16 * rows;
  const g = c.getContext('2d');
  g.fillStyle = wall; g.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    g.fillStyle = rng() < lit ? on : off;
    g.fillRect(x * 16 + 3, y * 16 + 3, 10, 10);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
}

function miniTree(rng, x, z) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.14, 6), stdMat('#7a5134'));
  trunk.position.y = 0.07;
  const crown = new THREE.Mesh(rng() < 0.5 ? new THREE.ConeGeometry(0.1, 0.24, 7) : new THREE.IcosahedronGeometry(0.1, 0),
    stdMat(rng.pick(['#4caf50', '#2e7d32', '#66bb6a'])));
  crown.position.y = 0.24;
  crown.castShadow = trunk.castShadow = true;
  g.add(trunk, crown); g.position.set(x, 0, z);
  return g;
}

export function makeFlag(color, h = 0.45) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, h, 6), stdMat('#dddddd', { metalness: 0.6 }));
  pole.position.y = h / 2;
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.13),
    new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, emissive: color, emissiveIntensity: 0.35 }));
  flag.position.set(0.1, h - 0.07, 0);
  g.add(pole, flag);
  g.userData.flag = flag;
  return g;
}

function villa(rng, ownerColor) {
  const g = new THREE.Group();
  const w = rng.range(0.5, 0.65), h = rng.range(0.32, 0.42), d = rng.range(0.42, 0.52);
  const wall = stdMat(rng.pick(PASTELS));
  const roofM = stdMat(rng.pick(ROOFS));
  g.add(box(w, h, d, wall));
  const roofType = rng.int(0, 2);
  if (roofType === 0) { // mái thái chữ A
    const s = new THREE.Shape();
    s.moveTo(-d * 0.58, 0); s.lineTo(d * 0.58, 0); s.lineTo(0, d * 0.5); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: w * 1.08, bevelEnabled: false });
    geo.translate(0, 0, -w * 0.54);
    const roof = new THREE.Mesh(geo, roofM);
    roof.rotation.y = Math.PI / 2;
    roof.position.y = h;
    roof.castShadow = true; g.add(roof);
  } else if (roofType === 1) { // mái bằng có lan can
    g.add(box(w * 1.06, 0.04, d * 1.06, roofM, 0, h, 0));
    g.add(box(w * 0.4, 0.12, d * 0.4, wall, rng.range(-0.1, 0.1), h + 0.04, 0));
  } else { // mái vòm
    const dome = new THREE.Mesh(new THREE.SphereGeometry(Math.min(w, d) * 0.48, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), roofM);
    dome.position.y = h; dome.castShadow = true; g.add(dome);
  }
  // ống khói
  if (roofType !== 2) g.add(box(0.07, 0.18, 0.07, stdMat('#6d4c41'), rng.range(-w / 3, w / 3), h + 0.05, rng.range(-d / 4, d / 4)));
  // cửa & ban công (mặt hướng vào tâm bàn cờ = -z)
  g.add(box(0.1, 0.17, 0.02, stdMat('#5d4037'), 0, 0, -d / 2 - 0.005));
  if (rng() < 0.6) g.add(box(w * 0.5, 0.03, 0.1, stdMat('#ffffff'), 0, h * 0.62, -d / 2 - 0.05));
  const winM = stdMat('#9fd3ff', { emissive: '#335577', emissiveIntensity: 0.4 });
  g.add(box(0.09, 0.08, 0.02, winM, -w * 0.3, h * 0.45, -d / 2 - 0.006));
  g.add(box(0.09, 0.08, 0.02, winM, w * 0.3, h * 0.45, -d / 2 - 0.006));
  const n = rng.int(1, 2);
  for (let i = 0; i < n; i++) g.add(miniTree(rng, (i ? 1 : -1) * rng.range(0.42, 0.55), rng.range(-0.25, 0.2)));
  const flag = makeFlag(ownerColor, 0.35); flag.position.set(-w / 2 + 0.05, h, d / 2 - 0.05); g.add(flag);
  return g;
}

function block(rng, w, h, d, lit) {
  const tex = windowTexture(rng, Math.max(2, Math.round(w * 8)), Math.max(2, Math.round(h * 8)), lit,
    rng.pick(['#c9b79c', '#a9b8c9', '#d8c3a5', '#9aa5b1']), '#ffe7a0', '#40505f');
  const side = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
  const top = stdMat('#6b7280');
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, top, top, side, side]);
  m.position.y = h / 2; m.castShadow = m.receiveShadow = true;
  return m;
}

function streetLamp(x, z) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.36, 6), stdMat('#37474f'));
  pole.position.y = 0.18;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffd54f', emissiveIntensity: 2 }));
  bulb.position.y = 0.37;
  g.add(pole, bulb); g.position.set(x, 0, z);
  return g;
}

function neighborhood(rng, ownerColor) {
  const g = new THREE.Group();
  const h1 = rng.range(0.55, 0.75);
  const h2 = h1 * (1 + rng.range(-0.15, 0.15));
  const b1 = block(rng, 0.42, h1, 0.5, rng.range(0.3, 0.6)); b1.position.x = -0.24;
  const b2 = block(rng, 0.42, h2, 0.5, rng.range(0.3, 0.6)); b2.position.x = 0.24;
  b2.position.y = h2 / 2;
  g.add(b1, b2);
  g.add(box(0.46, 0.04, 0.54, stdMat(rng.pick(ROOFS)), -0.24, h1, 0));
  g.add(box(0.46, 0.04, 0.54, stdMat(rng.pick(ROOFS)), 0.24, h2, 0));
  g.add(streetLamp(-0.55, -0.3), streetLamp(0.55, -0.3));
  const flag = makeFlag(ownerColor, 0.35); flag.position.set(0.24, h2 + 0.04, 0); g.add(flag);
  return g;
}

function tower(rng, ownerColor) {
  const g = new THREE.Group();
  const steps = rng.int(3, 4);
  let y = 0, w = rng.range(0.62, 0.75), d = rng.range(0.55, 0.65);
  const lit = rng.range(0.4, 0.8);
  for (let i = 0; i < steps; i++) {
    const h = rng.range(0.35, 0.5);
    const b = block(rng, w, h, d, lit);
    b.position.y = y + h / 2;
    g.add(b);
    y += h;
    g.add(box(w + 0.03, 0.03, d + 0.03, stdMat(ownerColor, { emissive: ownerColor, emissiveIntensity: 0.25 }), 0, y - 0.015, 0));
    w *= rng.range(0.7, 0.82); d *= rng.range(0.7, 0.82);
  }
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.3, 5), stdMat('#cccccc', { metalness: 0.8 }));
  ant.position.y = y + 0.15; g.add(ant);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), new THREE.MeshStandardMaterial({ color: '#ff5252', emissive: '#ff1744', emissiveIntensity: 2 }));
  tip.position.y = y + 0.31; g.add(tip);
  return g;
}

function landmark(rng, ownerColor) {
  const g = new THREE.Group();
  const kind = rng.int(0, 2);
  const glass = new THREE.MeshStandardMaterial({ color: '#bfe6ff', metalness: 0.9, roughness: 0.08, transparent: true, opacity: 0.75, emissive: '#3a6d8c', emissiveIntensity: 0.3 });
  const gold = stdMat('#e0b84a', { metalness: 0.85, roughness: 0.25 });
  let top = 1.6;
  g.add(box(0.95, 0.08, 0.8, stdMat('#eceff1'), 0, 0, 0));
  if (kind === 0) { // Tháp xoắn
    const n = 18; const h = 0.09;
    for (let i = 0; i < n; i++) {
      const s = 0.5 * (1 - i / (n * 1.4));
      const m = box(s, h * 0.9, s, i % 2 ? glass : stdMat('#e3f2fd', { metalness: 0.4, roughness: 0.3 }), 0, 0.08 + i * h, 0);
      m.rotation.y = i * 0.16;
      g.add(m);
    }
    top = 0.08 + n * h;
  } else if (kind === 1) { // Mái vòm pha lê
    g.add(box(0.8, 0.35, 0.65, stdMat('#fafafa'), 0, 0.08, 0));
    for (let i = 0; i < 6; i++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 8), stdMat('#ffffff'));
      c.position.set(-0.33 + i * 0.132, 0.255, -0.34); c.castShadow = true; g.add(c);
    }
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass);
    dome.position.y = 0.43; g.add(dome);
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 8), gold); sp.position.y = 0.92; g.add(sp);
    top = 1.05;
  } else { // Tháp đôi có cầu kính
    const h = rng.range(1.3, 1.6);
    const t1 = block(rng, 0.28, h, 0.32, 0.75); t1.position.x = -0.25;
    const t2 = block(rng, 0.28, h, 0.32, 0.75); t2.position.x = 0.25;
    g.add(t1, t2);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.16), glass); bridge.position.y = h * 0.62; g.add(bridge);
    for (const x of [-0.25, 0.25]) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.25, 4), gold); s.position.set(x, h + 0.12, 0); s.rotation.y = Math.PI / 4; g.add(s); }
    top = h + 0.25;
  }
  // vòng hào quang màu chủ sở hữu
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.025, 8, 48),
    new THREE.MeshStandardMaterial({ color: ownerColor, emissive: ownerColor, emissiveIntensity: 1.4, transparent: true, opacity: 0.9 }));
  halo.rotation.x = Math.PI / 2; halo.position.y = 0.12;
  g.add(halo);
  const flag = makeFlag(ownerColor, 0.5); flag.position.y = top; g.add(flag);
  g.userData.spin = flag;
  g.userData.halo = halo;
  return g;
}

function resortHut(rng, ownerColor) {
  const g = new THREE.Group();
  g.add(box(0.5, 0.25, 0.38, stdMat('#d7b98e'), 0.15, 0, 0.05));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.25, 4), stdMat('#c49a5a'));
  roof.position.set(0.15, 0.37, 0.05); roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof);
  for (let i = 0; i < 2; i++) {
    const x = -0.45 + i * 0.25;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 5), stdMat('#ffffff'));
    pole.position.set(x, 0.15, -0.25);
    const um = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.08, 10), stdMat(i ? ownerColor : '#ffffff'));
    um.position.set(x, 0.3, -0.25); um.castShadow = true;
    g.add(pole, um);
  }
  const flag = makeFlag(ownerColor, 0.4); flag.position.set(0.38, 0.25, 0.2); g.add(flag);
  return g;
}

export function createBuilding(level, seed, ownerColor, tileType = 'CITY') {
  const rng = mulberry32(seed);
  let g;
  if (tileType === 'RESORT') g = resortHut(rng, ownerColor);
  else if (level <= 0) { g = new THREE.Group(); const f = makeFlag(ownerColor, 0.5); g.add(f); g.userData.spin = null; }
  else if (level === 1) g = villa(rng, ownerColor);
  else if (level === 2) g = neighborhood(rng, ownerColor);
  else if (level === 3) g = tower(rng, ownerColor);
  else g = landmark(rng, ownerColor);
  g.userData.level = level;
  return g;
}
