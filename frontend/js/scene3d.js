// Bàn cờ Isometric 2.5D/3D trực giao sáng trong, phân tầng trục Y rõ ràng:
// Đế (y = -1.0 .. 0.0) -> 32 Ô cờ (y = 0.02) -> Đường nhựa (y = 0.025) -> Sân cỏ trung tâm (y = 0.03).
import * as THREE from 'three';
import gsap from 'gsap';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildBiome, BOARD_HALF, INNER_HALF, TOP_Y, GRASS_Y } from './biome_gen.js';
import { createBuilding, stdMat } from './building_gen.js';
import { Character } from './character.js';
import { DiceRoller } from './dice_physics.js';
import { drawLandmark } from './landmarks.js';
import { hashSeed } from './prng.js';
import { sfx } from './audio.js';

const CORNER = 2.4;
const EDGE_W = 1.6;
const EDGE_D = 2.4;
const TILE_THICK = TOP_Y; // từ y = 0.00 lên y = 0.02

// 8 màu pastel tươi rõ (65% phía trong ô thành phố)
const PASTEL_GROUP_COLORS = {
  SPAIN: '#dfa5a5',   // Hồng đất
  CHINA: '#b9add4',   // Tím nhạt
  ITALY: '#f5d6b0',   // Kem đào
  GERMANY: '#bcd482', // Xanh cốm
  UK_AUS: '#ebd798',  // Vàng cát
  USA: '#bfa9b0',     // Xám hồng
  FRANCE: '#98c7c7',  // Xanh ngọc
  RUSSIA: '#99badd',  // Xanh dương nhạt
};

export function tileTransform(idx) {
  if (idx === 0) return { x: 6.8, z: 6.8, rotY: 0, w: CORNER, d: CORNER, corner: true };
  if (idx === 8) return { x: -6.8, z: 6.8, rotY: -Math.PI / 2, w: CORNER, d: CORNER, corner: true };
  if (idx === 16) return { x: -6.8, z: -6.8, rotY: Math.PI, w: CORNER, d: CORNER, corner: true };
  if (idx === 24) return { x: 6.8, z: -6.8, rotY: Math.PI / 2, w: CORNER, d: CORNER, corner: true };
  if (idx < 8) return { x: INNER_HALF - (idx - 0.5) * EDGE_W, z: 6.8, rotY: 0, w: EDGE_W, d: EDGE_D, corner: false };
  if (idx < 16) return { x: -6.8, z: INNER_HALF - (idx - 8 - 0.5) * EDGE_W, rotY: -Math.PI / 2, w: EDGE_W, d: EDGE_D, corner: false };
  if (idx < 24) return { x: -INNER_HALF + (idx - 16 - 0.5) * EDGE_W, z: -6.8, rotY: Math.PI, w: EDGE_W, d: EDGE_D, corner: false };
  return { x: 6.8, z: -INNER_HALF + (idx - 24 - 0.5) * EDGE_W, rotY: Math.PI / 2, w: EDGE_W, d: EDGE_D, corner: false };
}

function makeRectBorderGeo(w, d, thickness = 0.08) {
  const ow = (w - 0.06) / 2, od = (d - 0.06) / 2;
  const iw = ow - thickness, id = od - thickness;
  const s = new THREE.Shape();
  s.moveTo(-ow, -od); s.lineTo(ow, -od); s.lineTo(ow, od); s.lineTo(-ow, od); s.closePath();
  const h = new THREE.Path();
  h.moveTo(-iw, -id); h.lineTo(-iw, id); h.lineTo(iw, id); h.lineTo(iw, -id); h.closePath();
  s.holes.push(h);
  const geo = new THREE.ShapeGeometry(s);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function makeContactShadowTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  for (let i = 0; i < 18; i++) {
    const pad = 28 + i * 3.5;
    g.fillStyle = 'rgba(38, 56, 86, 0.022)';
    g.beginPath();
    g.roundRect(pad, pad, S - pad * 2, S - pad * 2, 26);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSidewalkGrooveTexture(maxAniso) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#f0ece7';
  g.fillRect(0, 0, 512, 64);
  g.strokeStyle = '#b8b2ac';
  g.lineWidth = 4;
  g.strokeRect(1, 1, 510, 62);
  for (let x = 64; x < 512; x += 64) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 64); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(8, 1);
  tex.anisotropy = maxAniso;
  return tex;
}

// Nhãn tên 4 ô góc chữ trắng viền xám đen sắc nét, dễ đọc
function makeCornerLabelSprite(text, scaleW = 3.1) {
  const c = document.createElement('canvas');
  c.width = 896; c.height = 224;
  const g = c.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = "900 50px 'Segoe UI', Arial, sans-serif";
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > 780 && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  const lh = 56;
  const sy = 112 - ((lines.length - 1) * lh) / 2;
  lines.forEach((l, i) => {
    g.shadowColor = 'rgba(0,0,0,0.42)';
    g.shadowBlur = 8;
    g.shadowOffsetY = 3;
    g.strokeStyle = '#1e2026';
    g.lineWidth = 12;
    g.lineJoin = 'round';
    g.strokeText(l, 448, sy + i * lh);
    g.shadowBlur = 0; g.shadowOffsetY = 0;
    g.fillStyle = '#ffffff';
    g.fillText(l, 448, sy + i * lh);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(scaleW, scaleW * 0.25, 1);
  sp.renderOrder = 15;
  return sp;
}

function makeTrophyMesh(scale = 1) {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: '#f5b82e', metalness: 0.15, roughness: 0.5 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.12, 16), stdMat('#4a4950', { roughness: 0.85 }));
  base.position.y = 0.06;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.24, 12), gold);
  stem.position.y = 0.24;
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.11, 0.32, 16), gold);
  cup.position.y = 0.5;
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), gold);
  globe.position.y = 0.68;
  g.add(base, stem, cup, globe);
  g.scale.setScalar(scale);
  return g;
}

// 4 Tiểu cảnh 3D ở 4 ô góc (tăng kích thước +25%, đặt nổi tại y = 0.03)
function makeStartCornerModel() {
  const g = new THREE.Group();
  const matte = (col) => stdMat(col, { roughness: 0.85, metalness: 0.0 });
  for (const x of [-0.32, 0.32]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 0.56, 8), matte('#8c583a'));
    p.position.set(x, 0.28, 0.08); p.castShadow = true; g.add(p);
  }
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.42, 0.08), matte('#7ac142'));
  board.position.set(0, 0.42, 0.08); board.castShadow = true; g.add(board);

  // Lá cờ đỏ-vàng cắm chéo nổi bật
  const pole1 = new THREE.Group();
  pole1.position.set(-0.34, 0, -0.26);
  pole1.rotation.z = 0.24;
  pole1.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.028, 1.05, 8), matte('#ffffff')).translateY(0.52));
  pole1.add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.26, 0.04), matte('#ef4444')).translateX(0.23).translateY(0.88));
  pole1.traverse(c => { if (c.isMesh) c.castShadow = true; });

  const pole2 = new THREE.Group();
  pole2.position.set(0.28, 0, -0.26);
  pole2.rotation.z = -0.24;
  pole2.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.028, 1.0, 8), matte('#ffffff')).translateY(0.5));
  pole2.add(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.25, 0.04), matte('#facc15')).translateX(-0.22).translateY(0.84));
  pole2.traverse(c => { if (c.isMesh) c.castShadow = true; });

  g.add(pole1, pole2);
  g.scale.setScalar(1.25);
  return g;
}

function makeJailCornerModel() {
  const g = new THREE.Group();
  const matte = (col) => stdMat(col, { roughness: 0.88, metalness: 0.0 });
  const sand = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), matte('#f0d69c'));
  sand.scale.set(1.18, 0.28, 1.18);
  sand.position.set(-0.08, 0, -0.1);
  g.add(sand);

  const trunkMat = matte('#8c583a');
  let tx = -0.04, ty = 0.14, tz = -0.08;
  for (let s = 0; s < 5; s++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.052 - s * 0.005, 0.065 - s * 0.005, 0.23, 8), trunkMat);
    seg.position.set(tx, ty + s * 0.18, tz);
    seg.rotation.z = 0.08 + s * 0.07;
    seg.castShadow = true;
    g.add(seg);
    tx -= 0.042;
  }
  const crownX = tx - 0.02, crownY = ty + 4.35 * 0.18, crownZ = tz;
  for (let i = 0; i < 8; i++) {
    const lf = new THREE.Mesh(new THREE.ConeGeometry(0.125, 0.66, 5), matte('#68b038'));
    lf.geometry.translate(0, 0.33, 0);
    lf.position.set(crownX, crownY, crownZ);
    lf.rotation.set(0, (i / 8) * Math.PI * 2, 0);
    lf.rotateX(1.2);
    lf.castShadow = true;
    g.add(lf);
  }
  g.scale.setScalar(1.25);
  return g;
}

function makeStadiumCornerModel() {
  // Sân vận động bầu dục 2 tầng khán đài đỏ-trắng bao quanh sân cỏ xanh bên trong
  const g = new THREE.Group();
  const matte = (col) => stdMat(col, { roughness: 0.85, metalness: 0.0 });

  const tier1 = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.94, 0.24, 30), matte('#f8f6f2'));
  tier1.scale.set(1.08, 1, 0.9); tier1.position.y = 0.12; tier1.castShadow = true; tier1.receiveShadow = true;

  const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.84, 0.2, 30), matte('#c81e45'));
  tier2.scale.set(1.08, 1, 0.9); tier2.position.y = 0.32; tier2.castShadow = true;

  const innerBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.62, 0.14, 28), matte('#e5e1dc'));
  innerBowl.scale.set(1.08, 1, 0.9); innerBowl.position.y = 0.34;

  const pitch = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 0.05, 24), matte('#7ec242'));
  pitch.scale.set(1.06, 1, 0.88); pitch.position.y = 0.40;
  g.add(tier1, tier2, innerBowl, pitch);

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.25;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.08, 0.25), matte(i % 2 === 0 ? '#a31639' : '#ffffff'));
    roof.position.set(Math.cos(a) * 0.75 * 1.08, 0.45, Math.sin(a) * 0.75 * 0.9);
    roof.rotation.y = -a + Math.PI / 2;
    roof.castShadow = true;
    g.add(roof);
  }
  g.scale.setScalar(1.25);
  return g;
}

function makeWorldTourCornerModel() {
  const g = new THREE.Group();
  const matte = (col) => stdMat(col, { roughness: 0.85, metalness: 0.0 });

  const tower = new THREE.Group();
  tower.position.set(-0.46, 0, -0.44);
  tower.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.56, 12), matte('#ffffff')).translateY(0.28));
  tower.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.15, 0.16, 12), matte('#3b82f6')).translateY(0.62));
  tower.add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 12), matte('#ffffff')).translateY(0.72));
  tower.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), matte('#ffffff')).translateY(0.8));
  tower.traverse(c => { if (c.isMesh) c.castShadow = true; });
  g.add(tower);

  const jet = new THREE.Group();
  const whiteM = matte('#ffffff');
  const blueM = matte('#2563eb');
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.94, 14), whiteM);
  fus.rotation.x = Math.PI / 2;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.24, 14), whiteM);
  nose.rotation.x = -Math.PI / 2; nose.position.z = -0.58;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.035, 0.24), whiteM);
  wing.position.set(0, 0, -0.02);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.18), blueM);
  fin.position.set(0, 0.13, 0.36);
  const hStab = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.03, 0.14), blueM);
  hStab.position.set(0, 0.02, 0.38);
  jet.add(fus, nose, wing, fin, hStab);
  jet.position.set(0.2, 0.14, 0.04);
  jet.rotation.y = -0.78;
  jet.traverse(c => { if (c.isMesh) c.castShadow = true; });
  g.add(jet);
  g.scale.setScalar(1.25);
  return g;
}

export class Scene3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.LinearToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.maxAniso = this.renderer.capabilities.getMaxAnisotropy();

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-14, 14, 10, -10, 0.5, 160);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enableRotate = false;
    this.controls.enablePan = false;
    this.controls.minZoom = 0.85;
    this.controls.maxZoom = 1.65;

    this.attractMode = false;
    this.matchGroup = new THREE.Group();
    this.scene.add(this.matchGroup);

    this.biome = null;
    this.dice = null;
    this.tileVisuals = [];
    this.tileMeshes = [];
    this.chars = new Map();
    this.beaconsGroup = new THREE.Group();
    this.selectGroup = new THREE.Group();
    this.fxGroup = new THREE.Group();
    this.spinners = [];
    this.bursts = [];
    this.boardData = null;
    this.seed = 1;
    this.state = null;
    this.buildingPop = [];
    this.shakeTasks = [];
    this.selectableSet = null;
    this.selectCallback = null;
    this.inspectCallback = null;
    this.activeTl = null;

    this.raycaster = new THREE.Raycaster();
    this.pointerDownPos = null;
    this._bindEvents();
    this.updateResponsiveCamera();

    this.lastTime = performance.now();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  updateResponsiveCamera() {
    const w = window.innerWidth, h = window.innerHeight;
    const aspect = w / Math.max(1, h);
    this.renderer.setSize(w, h);

    // Góc nhìn Isometric trực giao chuẩn (~33.5°), giữ trọn 4 góc bàn cờ & khoảng thở trên/dưới rộng rãi
    const dir = new THREE.Vector3(1, 0.936, 1).normalize();
    const targetY = w < 760 ? -0.45 : -0.25;
    this.controls.target.set(0, targetY, 0);
    this.camera.position.copy(dir.multiplyScalar(54)).add(this.controls.target);

    const reqW = w < 760 ? 24.6 : 26.8;
    const reqH = w < 760 ? 19.6 : 18.0;
    const viewH = Math.max(reqH, reqW / aspect);
    const viewW = viewH * aspect;

    this.camera.left = -viewW / 2;
    this.camera.right = viewW / 2;
    this.camera.top = viewH / 2;
    this.camera.bottom = -viewH / 2;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  _bindEvents() {
    window.addEventListener('resize', () => this.updateResponsiveCamera());
    this.canvas.addEventListener('pointerdown', (e) => {
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
    });
    this.canvas.addEventListener('pointerup', (e) => {
      if (!this.pointerDownPos || this.attractMode) return;
      const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
      if (dist > 6) return;
      const rect = this.canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      this.raycaster.setFromCamera(ndc, this.camera);
      const hits = this.raycaster.intersectObjects(this.tileMeshes || [], false);
      if (!hits.length) return;
      const idx = hits[0].object.userData.tileIdx;
      if (this.selectableSet && this.selectableSet.has(idx)) {
        sfx.click();
        const cb = this.selectCallback;
        this.clearSelectableTiles();
        if (cb) cb(idx);
      } else if (this.inspectCallback) {
        sfx.click();
        this.inspectCallback(idx);
      }
    });
  }

  clear() {
    if (this.activeTl) { this.activeTl.kill(); this.activeTl = null; }
    if (this.biome) { this.scene.remove(this.biome.root); this.biome = null; }
    while (this.matchGroup.children.length) this.matchGroup.remove(this.matchGroup.children[0]);
    while (this.beaconsGroup.children.length) this.beaconsGroup.remove(this.beaconsGroup.children[0]);
    while (this.selectGroup.children.length) this.selectGroup.remove(this.selectGroup.children[0]);
    while (this.fxGroup.children.length) this.fxGroup.remove(this.fxGroup.children[0]);
    this.tileVisuals = [];
    this.tileMeshes = [];
    this.chars.clear();
    this.buildingPop = [];
    this.shakeTasks = [];
    this.spinners = [];
    this.bursts = [];
    this.selectableSet = null;
    this.selectCallback = null;
  }

  initAttractScene(boardData = null) {
    this.clear();
    this.attractMode = true;
    this.biome = buildBiome(this.scene, 2026, this.maxAniso);
    this._buildBoardFrame();
    if (boardData) {
      this._buildTiles(boardData);
    }
    this.biome.setTimerText('--:--');
    this.updateResponsiveCamera();
  }

  initMatch(seed, boardData, state) {
    this.clear();
    this.attractMode = false;
    this.seed = seed;
    this.boardData = boardData;
    this.biome = buildBiome(this.scene, seed, this.maxAniso);
    this._buildBoardFrame();
    this._buildTiles(boardData);
    this.matchGroup.add(this.beaconsGroup, this.selectGroup, this.fxGroup);
    this.dice = new DiceRoller(this.matchGroup);
    this._buildPlayers(state.players);
    this.applyState(state, { instant: true });
    this.updateResponsiveCamera();
    return this.biome;
  }

  setTimerText(txt) {
    if (this.biome?.setTimerText) this.biome.setTimerText(txt);
  }

  setDiceBadge(val) {
    if (this.biome?.setDiceBadge) this.biome.setDiceBadge(val);
  }

  resetCamera() {
    this.camera.zoom = 1;
    this.updateResponsiveCamera();
  }

  _buildBoardFrame() {
    // Bóng đổ mềm dưới gầm (y = -1.04)
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(BOARD_HALF * 2 + 3.4, BOARD_HALF * 2 + 3.4),
      new THREE.MeshBasicMaterial({ map: makeContactShadowTexture(), transparent: true, depthWrite: false }),
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.set(0.32, -1.04, 0.32);

    // Khối đế bàn cờ: đáy y = -1.0, mặt trên đúng y = 0.0 (KHÔNG che phủ lên y = 0.02 / 0.025 / 0.03)
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(BOARD_HALF * 2 + 0.44, 0.86, BOARD_HALF * 2 + 0.44),
      stdMat('#8e8999', { roughness: 0.92, metalness: 0.0 }),
    );
    plinth.position.y = -0.57; // -1.00 .. -0.14
    plinth.receiveShadow = true;

    const grooveTex = makeSidewalkGrooveTexture(this.maxAniso);
    const grooveSide = new THREE.MeshStandardMaterial({ map: grooveTex, roughness: 0.9, metalness: 0.0 });
    const topCurbMat = stdMat('#f0ece7', { roughness: 0.9, metalness: 0.0 });
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(BOARD_HALF * 2 + 0.56, 0.14, BOARD_HALF * 2 + 0.56),
      [grooveSide, grooveSide, topCurbMat, topCurbMat, grooveSide, grooveSide],
    );
    rim.position.y = -0.07; // -0.14 .. 0.00 (tuyệt đối dưới y = 0.02)
    rim.receiveShadow = true;
    rim.castShadow = true;

    this.matchGroup.add(shadowPlane, plinth, rim);
  }

  _buildTiles(boardData) {
    const cornerGeo = new THREE.BoxGeometry(CORNER - 0.04, TILE_THICK, CORNER - 0.04);
    const edgeGeo = new THREE.BoxGeometry(EDGE_W - 0.04, TILE_THICK, EDGE_D - 0.04);

    for (let i = 0; i < 32; i++) {
      const tr = tileTransform(i);
      const t = boardData.tiles[i];
      const grp = new THREE.Group();
      grp.position.set(tr.x, 0, tr.z);
      grp.rotation.y = tr.rotY;
      this.matchGroup.add(grp);

      // Thân 32 ô cờ đặt từ y = 0.00 lên y = 0.02 (TOP_Y)
      const sideMat = stdMat('#f4f1ed', { roughness: 0.9, metalness: 0.0 });
      const bevelMesh = new THREE.Mesh(tr.corner ? cornerGeo : edgeGeo, sideMat);
      bevelMesh.position.y = TILE_THICK / 2;
      bevelMesh.castShadow = true;
      bevelMesh.receiveShadow = true;
      bevelMesh.userData.tileIdx = i;
      grp.add(bevelMesh);
      this.tileMeshes.push(bevelMesh);

      const topCanvas = document.createElement('canvas');
      topCanvas.width = 512;
      topCanvas.height = 512;
      const topTex = new THREE.CanvasTexture(topCanvas);
      topTex.colorSpace = THREE.SRGBColorSpace;
      topTex.minFilter = THREE.LinearMipmapLinearFilter;
      topTex.anisotropy = this.maxAniso;

      // Mặt trên 32 ô cờ ở y = 0.021
      const cap = new THREE.Mesh(
        new THREE.PlaneGeometry(tr.w - 0.04, tr.d - 0.04),
        new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.88, metalness: 0.0 }),
      );
      cap.rotation.x = -Math.PI / 2;
      cap.position.y = TOP_Y + 0.001;
      cap.receiveShadow = true;
      cap.userData.tileIdx = i;
      grp.add(cap);
      this.tileMeshes.push(cap);

      const borderMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.92 });
      const border = new THREE.Mesh(makeRectBorderGeo(tr.w, tr.d, 0.08), borderMat);
      border.position.y = TOP_Y + 0.004;
      border.visible = false;
      grp.add(border);

      // Công trình 3D đứng trên phần 35% vỉa hè ngoài để không che tên thành phố ở phần 65% trong
      const buildingSlot = new THREE.Group();
      buildingSlot.position.set(0, TOP_Y, tr.d * 0.30);
      grp.add(buildingSlot);

      // 4 Tiểu cảnh 3D góc phóng to +25%, đặt nổi tại y = 0.03 + nhãn chữ sắc nét
      if (i === 0 || i === 8 || i === 16 || i === 24) {
        let model;
        if (i === 0) model = makeStartCornerModel();
        else if (i === 8) model = makeJailCornerModel();
        else if (i === 16) model = makeStadiumCornerModel();
        else model = makeWorldTourCornerModel();
        model.position.set(0, GRASS_Y, -0.10);
        grp.add(model);

        const lbl = makeCornerLabelSprite(t.name.toUpperCase(), i === 0 || i === 16 ? 2.85 : 3.35);
        lbl.position.set(0, 0.52, 0.74);
        grp.add(lbl);
      }

      this.tileVisuals.push({
        idx: i, tile: t, tr, grp, mesh: bevelMesh, canvas: topCanvas, tex: topTex,
        border, borderMat, buildingSlot, building: null, champTrophy: null, lastKey: '',
      });
      this._drawTileFace(this.tileVisuals[i], null, null);
    }
  }

  _drawTileFace(tv, ts, owner) {
    const ctx = tv.canvas.getContext('2d');
    const W = tv.canvas.width, H = tv.canvas.height;
    const t = tv.tile;
    const flip180 = tv.idx >= 9 && tv.idx <= 23;

    // 1. 4 Ô Góc
    if (tv.tr.corner) {
      if (t.type === 'START') {
        ctx.fillStyle = '#f6f3ef';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#7ac142';
        ctx.beginPath();
        ctx.moveTo(42, 42); ctx.lineTo(W - 42, 42); ctx.lineTo(W - 42, H - 72);
        ctx.lineTo(W / 2, H - 28); ctx.lineTo(42, H - 72); ctx.closePath();
        ctx.fill();
      } else if (t.type === 'JAIL') {
        ctx.fillStyle = '#6bc8db';
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
        ctx.lineWidth = 9;
        ctx.beginPath(); ctx.arc(W * 0.47, H * 0.46, 178, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(W * 0.47, H * 0.46, 210, 0.2, Math.PI * 1.75); ctx.stroke();
        ctx.fillStyle = '#f4f1ed';
        ctx.fillRect(0, H - 44, W, 44);
      } else if (t.type === 'CHAMPIONSHIP') {
        ctx.fillStyle = '#a8d152';
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = '#f4f1ed'; ctx.lineWidth = 34;
        ctx.strokeRect(16, 16, W - 32, H - 32);
      } else {
        ctx.fillStyle = '#95a8b8';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#f4f1ed';
        ctx.fillRect(0, 0, W, 34);
        ctx.fillRect(0, H - 44, W, 44);
        ctx.fillStyle = '#ffffff';
        for (let rx = 70; rx < W - 70; rx += 84) ctx.fillRect(rx, H * 0.52, 46, 14);
      }
      ctx.strokeStyle = '#b8b2ac'; ctx.lineWidth = 5;
      ctx.strokeRect(2, 2, W - 4, H - 4);
      tv.tex.needsUpdate = true;
      return;
    }

    // 2. Ô Thành phố (CITY): 65% phía mép trong tô màu pastel, 35% phía mép ngoài nền đá kem #f4f1ed
    if (t.type === 'CITY') {
      const splitY = Math.round(H * 0.65); // 333px
      // 65% phía trong giáp đường nhựa
      ctx.fillStyle = PASTEL_GROUP_COLORS[t.group] || '#dfa5a5';
      ctx.fillRect(0, 0, W, splitY);

      // 35% phía mép ngoài bàn cờ: nền gạch đá kem sáng #f4f1ed
      ctx.fillStyle = '#f4f1ed';
      ctx.fillRect(0, splitY, W, H - splitY);

      // Đường rãnh phân cách #b8b2ac dày 4px rõ nét
      ctx.strokeStyle = '#b8b2ac';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, W - 4, H - 4);
      ctx.beginPath(); ctx.moveTo(0, splitY); ctx.lineTo(W, splitY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W / 2, splitY); ctx.lineTo(W / 2, H); ctx.stroke();

      if (owner) {
        ctx.fillStyle = owner.color;
        ctx.fillRect(4, H - 32, W - 8, 28);
      }

      // Tên thành phố chính giữa dải 65% pastel: font bold 52px, màu #222222
      ctx.save();
      ctx.translate(W / 2, splitY * 0.5);
      if (flip180) ctx.rotate(Math.PI);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#222222';
      ctx.font = "bold 52px 'Segoe UI', Arial, sans-serif";
      const words = t.name.split(' ');
      const lines = [];
      let line = '';
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (ctx.measureText(test).width > W - 36 && line) { lines.push(line); line = w; }
        else line = test;
      }
      if (line) lines.push(line);
      const lh = 58;
      const sy = -((lines.length - 1) * lh) / 2;
      lines.forEach((l, i) => ctx.fillText(l, 0, sy + i * lh));
      ctx.restore();
    } else if (t.type === 'CHANCE' || t.type === 'TAX') {
      // 3. Ô Cơ Hội / Thuế: Nền trắng kem sáng #f6f3ef + rãnh #b8b2ac dày 4px
      ctx.fillStyle = '#f6f3ef';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#b8b2ac';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, W - 4, H - 4);

      ctx.save();
      ctx.translate(W / 2, H / 2);
      if (flip180) ctx.rotate(Math.PI);
      // Vòng tròn cầu vồng 8 múi to rõ chiếm ~55% chiều rộng ô (282px)
      drawLandmark(ctx, t.idx, 0, -48, 312);
      ctx.fillStyle = '#222222';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = "bold 52px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(t.type === 'CHANCE' ? 'Cơ hội' : 'Thuế', 0, 152);
      ctx.restore();
    } else {
      // 4. Ô Bãi Biển / Resort
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#f4dcad');
      grad.addColorStop(0.58, '#f4dcad');
      grad.addColorStop(0.68, '#ffffff');
      grad.addColorStop(0.78, '#6bc8db');
      grad.addColorStop(1, '#58b8cc');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#b8b2ac';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, W - 4, H - 4);
      if (owner) {
        ctx.fillStyle = owner.color;
        ctx.fillRect(4, H - 30, W - 8, 26);
      }
      ctx.save();
      ctx.translate(W / 2, H * 0.36);
      if (flip180) ctx.rotate(Math.PI);
      drawLandmark(ctx, t.idx, 0, -52, 165);
      ctx.fillStyle = '#222222';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = "bold 52px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(t.name, 0, 62);
      ctx.restore();
    }

    if (ts && ts.festival) {
      ctx.save();
      ctx.translate(W - 64, 34);
      if (flip180) ctx.rotate(Math.PI);
      ctx.fillStyle = '#e11d48';
      ctx.beginPath(); ctx.roundRect(-48, -18, 96, 36, 12); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.font = '800 22px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🎪 x2', 0, 1);
      ctx.restore();
    }
    if (ts && ts.blackout > 0) {
      ctx.fillStyle = 'rgba(34, 34, 34, 0.45)';
      ctx.fillRect(0, 0, W, H);
      ctx.font = '104px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('⚡', W / 2, H / 2);
    }
    tv.tex.needsUpdate = true;
  }

  _buildPlayers(players) {
    players.forEach((p) => {
      const ch = new Character(p.look, p.color, p.name, p.is_bot);
      this.matchGroup.add(ch.root);
      this.chars.set(p.id, ch);
      this._placeCharInstant(p, players);
    });
  }

  _slotOffset(idx, total, isCorner) {
    if (total <= 1) return [0, 0];
    const x = isCorner ? 0.34 : 0.27;
    const z = 0.22;
    const offs = [[-x, -z], [x, -z], [-x, z], [x, z]];
    return offs[idx % 4];
  }

  _charCoords(tileIdx, slotIdx, totalOnTile) {
    const tr = tileTransform(tileIdx);
    const [ox, oz] = this._slotOffset(slotIdx, totalOnTile, tr.corner);
    const baseZ = tr.corner ? 0.42 : -0.18;
    const local = new THREE.Vector3(ox, TOP_Y, baseZ + oz);
    local.applyAxisAngle(new THREE.Vector3(0, 1, 0), tr.rotY);
    return new THREE.Vector3(tr.x + local.x, TOP_Y, tr.z + local.z);
  }

  _placeCharInstant(p, players) {
    const ch = this.chars.get(p.id);
    if (!ch) return;
    if (p.bankrupt) { ch.root.visible = false; return; }
    ch.root.visible = true;
    const same = players.filter(q => !q.bankrupt && q.pos === p.pos);
    const slot = same.findIndex(q => q.id === p.id);
    const pos = this._charCoords(p.pos, Math.max(0, slot), same.length);
    ch.root.position.copy(pos);
    const dx = this.camera.position.x - pos.x;
    const dz = this.camera.position.z - pos.z;
    ch.targetYaw = Math.atan2(-dx, -dz);
    ch.root.rotation.y = ch.targetYaw;
  }

  applyState(state, { instant = false } = {}) {
    this.state = state;
    const pmap = new Map(state.players.map(p => [p.id, p]));

    for (let i = 0; i < 32; i++) {
      const tv = this.tileVisuals[i];
      const ts = state.tiles[i];
      const owner = ts.owner ? pmap.get(ts.owner) : null;
      const key = `${ts.owner}|${ts.level}|${ts.champ}|${ts.festival}|${ts.blackout}|${ts.rent}`;
      if (key !== tv.lastKey) {
        const prevLevel = tv.building?.userData?.level ?? -1;
        const prevOwner = tv.lastOwner ?? null;
        tv.lastKey = key;
        tv.lastOwner = ts.owner;
        this._drawTileFace(tv, ts, owner);

        if (owner) { tv.border.visible = true; tv.borderMat.color.set(owner.color); }
        else tv.border.visible = false;

        if (!owner) {
          if (tv.building) { tv.buildingSlot.remove(tv.building); tv.building = null; }
        } else if (prevOwner !== ts.owner || prevLevel !== ts.level) {
          if (tv.building) tv.buildingSlot.remove(tv.building);
          const b = createBuilding(ts.level, hashSeed(this.seed, i), owner.color, tv.tile.type);
          tv.buildingSlot.add(b);
          tv.building = b;
          if (!instant) { b.scale.setScalar(0.05); this.buildingPop.push({ obj: b, t: 0 }); }
        }

        if (ts.champ > 1 && !tv.champTrophy) {
          const ct = makeTrophyMesh(0.42);
          ct.position.set(tv.tr.w * 0.28, TOP_Y, tv.tr.d * 0.28);
          tv.grp.add(ct);
          tv.champTrophy = ct;
          this.spinners.push(ct);
        } else if (ts.champ <= 1 && tv.champTrophy) {
          tv.grp.remove(tv.champTrophy);
          tv.champTrophy = null;
        }
      }
    }

    for (const p of state.players) {
      const ch = this.chars.get(p.id);
      if (ch) ch.setActiveTurn(!state.finished && state.turn_player === p.id && !p.bankrupt);
      if (this._movingPid === p.id) continue;
      this._placeCharInstant(p, state.players);
    }
    this._syncBeacons(state.beacons || [], pmap);
  }

  _syncBeacons(beacons, pmap) {
    while (this.beaconsGroup.children.length) this.beaconsGroup.remove(this.beaconsGroup.children[0]);
    for (const b of beacons) {
      const p = pmap.get(b.player_id);
      if (!p) continue;
      const tr = tileTransform(b.tile);
      const grp = new THREE.Group();
      grp.position.set(tr.x, TOP_Y + 0.02, tr.z);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.55, 4.6, 16, 1, true),
        new THREE.MeshBasicMaterial({
          color: p.color, transparent: true, opacity: 0.36, side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      );
      beam.position.y = 2.3;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.45, 0.65, 24),
        new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      grp.add(beam, ring);
      grp.userData = { beam, ring };
      this.beaconsGroup.add(grp);
    }
  }

  setSelectableTiles(indices, onSelect) {
    this.clearSelectableTiles();
    if (!indices || !indices.length) return;
    this.selectableSet = new Set(indices);
    this.selectCallback = onSelect;
    for (const idx of indices) {
      const tr = tileTransform(idx);
      const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(tr.w - 0.12, tr.d - 0.12),
        new THREE.MeshBasicMaterial({ color: '#facc15', transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
      );
      pad.rotation.x = -Math.PI / 2;
      pad.rotation.z = tr.rotY;
      pad.position.set(tr.x, TOP_Y + 0.015, tr.z);
      this.selectGroup.add(pad);
    }
  }

  clearSelectableTiles() {
    this.selectableSet = null;
    this.selectCallback = null;
    while (this.selectGroup.children.length) this.selectGroup.remove(this.selectGroup.children[0]);
  }

  async rollDice(dice) {
    if (!this.dice) return;
    await this.dice.roll(dice);
    await new Promise(r => setTimeout(r, 320));
  }

  burstTile(idx, color = '#fbbf24') {
    const tr = tileTransform(idx);
    const grp = new THREE.Group();
    grp.position.set(tr.x, TOP_Y + 0.04, tr.z);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.65, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.25, 3.8, 16, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    beam.position.y = 1.9;
    grp.add(ring, beam);
    this.fxGroup.add(grp);
    this.bursts.push({ grp, ring, beam, t: 0 });
  }

  animateMove(pid, frm, to, steps, kind) {
    const ch = this.chars.get(pid);
    if (!ch) return Promise.resolve();
    this._movingPid = pid;
    ch.root.visible = true;
    if (this.activeTl) { this.activeTl.kill(); this.activeTl = null; }

    return new Promise((resolve) => {
      if (kind === 'fly' || kind === 'jail') {
        const end = this._charCoords(to, 0, 1);
        ch.faceTowards(end.x, end.z);
        ch.setAnim(kind === 'fly' ? 'fly' : 'sad');
        if (kind === 'fly') sfx.fly();
        else sfx.jail();
        const dur = kind === 'fly' ? 1.25 : 0.9;
        const tl = gsap.timeline({
          onComplete: () => {
            this.activeTl = null;
            this._movingPid = null;
            ch.setAnim(kind === 'jail' ? 'sad' : 'idle', kind === 'jail' ? 1.5 : 0);
            if (this.state) this.applyState(this.state, { instant: true });
            resolve();
          },
        });
        tl.to(ch.root.position, { x: end.x, z: end.z, duration: dur, ease: 'power2.inOut' }, 0);
        tl.to(ch.root.position, { y: TOP_Y + (kind === 'fly' ? 3.2 : 2.1), duration: dur * 0.5, ease: 'power2.out' }, 0);
        tl.to(ch.root.position, { y: TOP_Y, duration: dur * 0.5, ease: 'power2.in' }, dur * 0.5);
        this.activeTl = tl;
        return;
      }

      const waypoints = [];
      for (let s = 1; s <= steps; s++) {
        const idx = (frm + s) % 32;
        waypoints.push({ idx, pos: this._charCoords(idx, 0, 1) });
      }
      if (!waypoints.length) {
        this._movingPid = null;
        resolve();
        return;
      }

      ch.setAnim('run');
      const segDur = Math.max(0.15, Math.min(0.24, 1.8 / waypoints.length));
      const tl = gsap.timeline({
        onComplete: () => {
          this.activeTl = null;
          this._movingPid = null;
          ch.setAnim('idle');
          if (this.state) this.applyState(this.state, { instant: true });
          resolve();
        },
      });

      waypoints.forEach((wp) => {
        const stepTl = gsap.timeline({
          onStart: () => ch.faceTowards(wp.pos.x, wp.pos.z),
          onComplete: () => sfx.step(),
        });
        stepTl.to(ch.root.position, { x: wp.pos.x, z: wp.pos.z, duration: segDur, ease: 'power1.inOut' }, 0);
        stepTl.to(ch.root.position, { y: TOP_Y + 0.52, duration: segDur * 0.48, ease: 'power2.out' }, 0);
        stepTl.to(ch.root.position, { y: TOP_Y, duration: segDur * 0.52, ease: 'power2.in' }, segDur * 0.48);
        tl.add(stepTl);
      });
      this.activeTl = tl;
    });
  }

  celebrate(pid) { const c = this.chars.get(pid); if (c) c.setAnim('celebrate', 2.4); }
  sad(pid) { const c = this.chars.get(pid); if (c) c.setAnim('sad', 2.4); }

  shakeTile(idx) {
    const tv = this.tileVisuals[idx];
    if (tv) this.shakeTasks.push({ grp: tv.grp, base: tv.grp.position.clone(), t: 0 });
  }

  worldToScreen(pid) {
    const c = this.chars.get(pid);
    if (!c || !c.root.visible) return null;
    const p = c.root.position.clone().add(new THREE.Vector3(0, 1.65, 0));
    p.project(this.camera);
    if (p.z > 1) return null;
    return {
      x: (p.x * 0.5 + 0.5) * window.innerWidth,
      y: (-p.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  _loop(now) {
    requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const t = now / 1000;

    if (this.biome) this.biome.update(dt, t);
    if (this.dice) this.dice.update(dt);
    for (const c of this.chars.values()) c.update(dt);
    for (const sp of this.spinners) sp.rotation.y += dt * 1.4;

    for (const tv of this.tileVisuals) {
      if (tv.building?.userData?.spin) tv.building.userData.spin.rotation.y += dt * 1.6;
    }
    this.beaconsGroup.children.forEach((g, idx) => {
      g.userData.beam.material.opacity = 0.25 + 0.2 * Math.sin(t * 5 + idx);
      const sc = 0.9 + 0.25 * Math.sin(t * 4 + idx);
      g.userData.ring.scale.set(sc, sc, 1);
    });
    this.selectGroup.children.forEach((pad, idx) => {
      pad.material.opacity = 0.28 + 0.25 * Math.sin(t * 6 + idx * 0.3);
    });

    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.t += dt * 1.25;
      const sc = 1 + b.t * 2.5;
      b.ring.scale.set(sc, sc, 1);
      b.ring.material.opacity = Math.max(0, 0.95 * (1 - b.t));
      b.beam.material.opacity = Math.max(0, 0.6 * (1 - b.t));
      b.beam.scale.set(1 + b.t * 0.6, 1 + b.t * 0.5, 1 + b.t * 0.6);
      if (b.t >= 1) { this.fxGroup.remove(b.grp); this.bursts.splice(i, 1); }
    }

    for (let i = this.buildingPop.length - 1; i >= 0; i--) {
      const p = this.buildingPop[i];
      p.t = Math.min(1, p.t + dt * 3.2);
      const s = p.t < 0.7 ? (p.t / 0.7) * 1.14 : 1.14 - ((p.t - 0.7) / 0.3) * 0.14;
      p.obj.scale.setScalar(s);
      if (p.t >= 1) this.buildingPop.splice(i, 1);
    }

    for (let i = this.shakeTasks.length - 1; i >= 0; i--) {
      const s = this.shakeTasks[i];
      s.t += dt;
      if (s.t >= 0.7) { s.grp.position.copy(s.base); this.shakeTasks.splice(i, 1); }
      else {
        const amp = (1 - s.t / 0.7) * 0.14;
        s.grp.position.set(s.base.x + (Math.random() - 0.5) * amp, s.base.y, s.base.z + (Math.random() - 0.5) * amp);
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
