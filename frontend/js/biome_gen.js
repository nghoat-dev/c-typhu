// Phân tầng độ cao trục Y chuẩn: TOP_Y = 0.02 (ô cờ), ROAD_Y = 0.025 (đường nhựa), GRASS_Y = 0.03 (sân cỏ).
// Ánh sáng ban ngày rực rỡ hiệu chuẩn cho Three.js r170 để màu trắng kem & pastel tươi trong, không xám đục.
import * as THREE from 'three';
import { mulberry32 } from './prng.js';
import { stdMat } from './building_gen.js';

export const BOARD_HALF = 8;
export const INNER_HALF = 5.6;
export const GRASS_HALF = 4.52;
export const TOP_Y = 0.02;
export const ROAD_Y = 0.025;
export const GRASS_Y = 0.03;

export const BIOMES = [
  { key: 'daylight', name: 'Business Tour Isometric', icon: '☀️', felt: '#a8d152', border: '#f0ece7', tileBase: '#f4f1ed', tileTop: '#f6f3ef' },
];

function chamferRectPath(g, x, y, w, h, cut) {
  g.beginPath();
  g.moveTo(x + cut, y);
  g.lineTo(x + w - cut, y);
  g.lineTo(x + w, y + cut);
  g.lineTo(x + w, y + h - cut);
  g.lineTo(x + w - cut, y + h);
  g.lineTo(x + cut, y + h);
  g.lineTo(x, y + h - cut);
  g.lineTo(x, y + cut);
  g.closePath();
}

function makeRoadLoopTexture(maxAniso = 8) {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');

  // Dải gờ vỉa hè ngoài (#d8d5d0) sát mép trong 32 ô cờ
  g.fillStyle = '#d8d5d0';
  g.fillRect(0, 0, S, S);
  g.strokeStyle = '#b8b2ac';
  g.lineWidth = 4;
  g.strokeRect(2, 2, S - 4, S - 4);

  // Dải đường nhựa vòng trong (#757c86)
  const rOut = 18;
  g.fillStyle = '#757c86';
  chamferRectPath(g, rOut, rOut, S - rOut * 2, S - rOut * 2, 18);
  g.fill();
  g.strokeStyle = '#9ca1aa';
  g.lineWidth = 3;
  g.stroke();

  // Vạch kẻ đứt màu trắng (#ffffff) chạy đều giữa làn đường
  g.save();
  g.strokeStyle = '#ffffff';
  g.lineWidth = 5;
  g.setLineDash([24, 20]);
  chamferRectPath(g, 58, 58, S - 116, S - 116, 16);
  g.stroke();
  g.restore();

  // Dải gờ vỉa hè trong (#d8d5d0) bao quanh mép ngoài thảm cỏ
  const cOut = 92;
  g.fillStyle = '#d8d5d0';
  chamferRectPath(g, cOut, cOut, S - cOut * 2, S - cOut * 2, 14);
  g.fill();
  g.strokeStyle = '#b8b2ac';
  g.lineWidth = 4;
  g.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = maxAniso;
  return tex;
}

function makeCenterGrassTexture(maxAniso = 8) {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const rng = mulberry32(851886);

  // Nền cỏ xanh vàng tươi #a8d152 kẻ sọc cắt cỏ xen kẽ #9cc547
  g.fillStyle = '#a8d152';
  g.fillRect(0, 0, S, S);

  const stripes = 8;
  const sw = S / stripes;
  for (let i = 0; i < stripes; i++) {
    if (i % 2 === 1) {
      g.fillStyle = '#9cc547';
      g.fillRect(i * sw, 0, sw, S);
    }
  }

  // Các đường kẻ sân bóng đá màu xanh nhạt / trắng mờ
  g.save();
  g.strokeStyle = 'rgba(255, 255, 255, 0.38)';
  g.lineWidth = 6;
  const pad = 74;
  g.strokeRect(pad, pad, S - pad * 2, S - pad * 2);
  // Đường giữa sân
  g.beginPath(); g.moveTo(pad, S / 2); g.lineTo(S - pad, S / 2); g.stroke();
  // Vòng tròn trung tâm & chấm giao bóng
  g.beginPath(); g.arc(S / 2, S / 2, 128, 0, Math.PI * 2); g.stroke();
  g.fillStyle = 'rgba(255, 255, 255, 0.45)';
  g.beginPath(); g.arc(S / 2, S / 2, 12, 0, Math.PI * 2); g.fill();
  // Khung thành & vòng cấm 2 đầu sân
  g.strokeRect(S / 2 - 190, pad, 380, 128);
  g.strokeRect(S / 2 - 95, pad, 190, 54);
  g.strokeRect(S / 2 - 190, S - pad - 128, 380, 128);
  g.strokeRect(S / 2 - 95, S - pad - 54, 190, 54);
  g.restore();

  // Cụm chấm hoa trắng & vàng li ti rải rác gần 4 góc cỏ
  const corners = [
    [100, 100], [S - 100, 100],
    [100, S - 100], [S - 100, S - 100],
  ];
  for (const [cx, cy] of corners) {
    for (let k = 0; k < 10; k++) {
      const fx = cx + rng.range(-72, 72);
      const fy = cy + rng.range(-72, 72);
      g.fillStyle = 'rgba(72, 112, 24, 0.42)';
      g.beginPath(); g.ellipse(fx, fy + 3, 6, 3, rng.range(0, 3), 0, Math.PI * 2); g.fill();
      g.fillStyle = rng() < 0.55 ? '#ffffff' : '#fff59d';
      g.beginPath(); g.arc(fx, fy, rng.range(3.2, 5.2), 0, Math.PI * 2); g.fill();
    }
  }

  // Lớp đổ bóng viền trong (inner shadow / vignette) tạo cảm giác sân cỏ lõm nhẹ so với vỉa hè
  const aoW = 46;
  const dirs = [
    [0, 0, 0, aoW, 0, 0, S, aoW],
    [0, S, 0, S - aoW, 0, S - aoW, S, aoW],
    [0, 0, aoW, 0, 0, 0, aoW, S],
    [S, 0, S - aoW, 0, S - aoW, 0, aoW, S],
  ];
  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of dirs) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, 'rgba(34, 58, 8, 0.28)');
    gr.addColorStop(1, 'rgba(34, 58, 8, 0)');
    g.fillStyle = gr;
    g.fillRect(rx, ry, rw, rh);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = maxAniso;
  return tex;
}

function drawScoreboard(canvas, timerText, diceBadge) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);

  g.fillStyle = '#333236';
  g.beginPath(); g.roundRect(4, 4, W - 8, H - 8, 22); g.fill();
  g.strokeStyle = '#55535a';
  g.lineWidth = 6;
  g.beginPath(); g.roundRect(6, 6, W - 12, H - 12, 20); g.stroke();

  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '800 88px "Consolas", "Segoe UI", monospace';
  g.fillText(timerText || '--:--', W / 2, H * 0.52);

  if (diceBadge !== null && diceBadge !== undefined) {
    g.fillStyle = '#ffffff';
    g.beginPath(); g.roundRect(W / 2 - 44, H - 56, 88, 42, 12); g.fill();
    g.fillStyle = '#222222';
    g.font = '800 32px "Segoe UI", sans-serif';
    g.fillText(`${diceBadge}`, W / 2, H - 34);
  }
}

export function buildBiome(scene, _seed = 2026, maxAniso = 8) {
  const biome = BIOMES[0];
  const root = new THREE.Group();
  root.name = 'biome';
  scene.fog = null;
  scene.add(root);

  // Ánh sáng ban ngày rực rỡ, hiệu chuẩn cho Three.js r170 (khử màu xám đục hoàn toàn)
  const ambient = new THREE.AmbientLight(0xffffff, 1.75);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xdbeafe, 1.05);
  const sun = new THREE.DirectionalLight(0xfffdf5, 1.55);
  sun.position.set(-15, 26, -5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -13.5, right: 13.5, top: 13.5, bottom: -13.5, near: 4, far: 64 });
  sun.shadow.bias = -0.0005;
  root.add(ambient, hemi, sun, sun.target);

  // 1. Dải đường nhựa vòng trong (y = 0.025) sát mép trong 32 ô cờ
  const roadMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(INNER_HALF * 2, INNER_HALF * 2),
    new THREE.MeshStandardMaterial({ map: makeRoadLoopTexture(maxAniso), roughness: 0.9, metalness: 0.0 }),
  );
  roadMesh.rotation.x = -Math.PI / 2;
  roadMesh.position.y = ROAD_Y;
  roadMesh.receiveShadow = true;
  root.add(roadMesh);

  // 2. Thảm cỏ sân bóng trung tâm (y = 0.03) nằm lọt lòng bên trong vòng đường nhựa
  const grassMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(GRASS_HALF * 2, GRASS_HALF * 2),
    new THREE.MeshStandardMaterial({ map: makeCenterGrassTexture(maxAniso), roughness: 0.9, metalness: 0.0 }),
  );
  grassMesh.rotation.x = -Math.PI / 2;
  grassMesh.position.y = GRASS_Y;
  grassMesh.receiveShadow = true;
  root.add(grassMesh);

  // 3. Bảng đồng hồ đếm giờ nổi hẳn trên sân cỏ sát góc trên cùng với 2 chân trụ đen đổ bóng
  const signGrp = new THREE.Group();
  signGrp.position.set(-3.78, GRASS_Y, -3.78);
  signGrp.rotation.y = Math.PI / 4;

  const legMat = stdMat('#1f2024', { roughness: 0.85, metalness: 0.0 });
  const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.52, 10), legMat);
  postL.position.set(-0.56, 0.26, 0); postL.castShadow = true;
  const postR = postL.clone();
  postR.position.x = 0.56;

  const signCanvas = document.createElement('canvas');
  signCanvas.width = 512; signCanvas.height = 210;
  let curTimer = '--:--';
  let curDice = null;
  drawScoreboard(signCanvas, curTimer, curDice);
  const signTex = new THREE.CanvasTexture(signCanvas);
  signTex.colorSpace = THREE.SRGBColorSpace;
  signTex.anisotropy = maxAniso;

  const matteBody = stdMat('#333236', { roughness: 0.9, metalness: 0.0 });
  const boardMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.82, 0.74, 0.1),
    [
      matteBody, matteBody, matteBody, matteBody,
      new THREE.MeshBasicMaterial({ map: signTex }),
      matteBody,
    ],
  );
  boardMesh.position.set(0, 0.76, 0);
  boardMesh.castShadow = true;
  signGrp.add(postL, postR, boardMesh);
  root.add(signGrp);

  return {
    ...biome,
    tile: { base: biome.tileBase, top: biome.tileTop, board: biome.border },
    root,
    setRound() {},
    setTimerText(txt) {
      const next = txt || '--:--';
      if (next === curTimer) return;
      curTimer = next;
      drawScoreboard(signCanvas, curTimer, curDice);
      signTex.needsUpdate = true;
    },
    setDiceBadge(sumOrNull) {
      if (sumOrNull === curDice) return;
      curDice = sumOrNull;
      drawScoreboard(signCanvas, curTimer, curDice);
      signTex.needsUpdate = true;
    },
    update() {},
  };
}
