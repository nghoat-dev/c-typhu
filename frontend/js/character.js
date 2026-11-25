// 4 Nhân vật chuẩn Business Tour (Doanh nhân, Khách du lịch, Quý bà với một con chó, Nữ doanh nhân):
// Mô hình 3D Chibi có phụ kiện riêng + Vòng chỉ báo lượt + Chân dung 2D + Minh họa toàn thân 2D.
import * as THREE from 'three';

export const CHARACTER_DEFS = [
  {
    id: 0,
    key: 'businessman',
    name: 'Doanh nhân',
    gender: 'Nam',
    color: '#d81b60',
    portraitBg: '#880e4f',
    suit: '#b91c50',
    shirt: '#fbcfe8',
    pants: '#27272a',
    hair: '#6d132b',
    skin: '#f3c1a2',
    intro: 'Một doanh nhân chuyên nghiệp và uy tín.',
    detail: 'Mặc suit màu hồng rượu kèm cà vạt, sơ mi hồng nhạt, quần tối màu, chân đi giày tây. Tay xách vali nâu. Tóc vuốt ngược màu đỏ tía.',
  },
  {
    id: 1,
    key: 'traveler',
    name: 'Khách du lịch',
    gender: 'Nam',
    color: '#689f38',
    portraitBg: '#4d7c0f',
    suit: '#7cb342',
    shirt: '#d9f99d',
    pants: '#4d412e',
    hair: '#5c4b23',
    skin: '#cfa176',
    intro: 'Một người tìm kiếm các cuộc phiêu lưu.',
    detail: 'Mặc áo sơ mi xanh lá chuối khoác ngoài áo thun sáng, quần short khaki, da ngăm khỏe khoắn. Đeo kính râm đen, máy ảnh trước ngực và balo sau lưng.',
  },
  {
    id: 2,
    key: 'lady',
    name: 'Quý bà với một con chó',
    gender: 'Nữ',
    color: '#eab308',
    portraitBg: '#a16207',
    suit: '#facc15',
    shirt: '#fef08a',
    pants: '#9a5b25',
    hair: '#facc15',
    skin: '#fbd3b6',
    intro: 'Một quý cô quyến rũ và người bạn trung thành của mình.',
    detail: 'Mặc áo thun vàng kèm váy nâu ngắn, đeo túi xách màu cam nâu. Tóc vàng buộc đuôi ngựa cao. Tay dắt theo một chú chó nhỏ trung thành.',
  },
  {
    id: 3,
    key: 'businesswoman',
    name: 'Nữ doanh nhân',
    gender: 'Nữ',
    color: '#2563eb',
    portraitBg: '#1e3a8a',
    suit: '#2563eb',
    shirt: '#eff6ff',
    pants: '#1d4ed8',
    hair: '#221f4b',
    skin: '#f7c9ad',
    intro: 'Đừng cản đường cô ấy.',
    detail: 'Mặc váy zip kèm blazer xanh dương thanh lịch. Tóc ngắn màu xanh tím than. Tay trái cầm cặp tài liệu xanh nhạt, tay phải nghe điện thoại.',
  },
];

export function charDef(lookSeed) {
  const n = Number.isFinite(Number(lookSeed)) ? Math.trunc(Number(lookSeed)) : 0;
  return CHARACTER_DEFS[((n % 4) + 4) % 4];
}

export function describeLook(seed) {
  return charDef(seed);
}

function M(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness: 0.06, ...opts });
}

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function makeFaceTexture(def) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = def.skin;
  g.fillRect(0, 0, 512, 256);

  const cx = 256, cy = 128;
  // Má hồng nhẹ / sống mũi
  g.fillStyle = def.id === 0 ? 'rgba(225, 29, 72, 0.36)' : 'rgba(244, 63, 94, 0.25)';
  if (def.id === 0) {
    g.beginPath(); g.arc(cx, cy + 7, 7, 0, Math.PI * 2); g.fill();
  }
  g.beginPath(); g.ellipse(cx - 38, cy + 16, 13, 7, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(cx + 38, cy + 16, 13, 7, 0, 0, Math.PI * 2); g.fill();

  // Lông mày & đôi mắt
  for (const s of [-1, 1]) {
    const ex = cx + s * 24;
    g.strokeStyle = def.hair; g.lineWidth = 4.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(ex - 11, cy - 20); g.lineTo(ex + 11, cy - 21); g.stroke();
    g.fillStyle = '#0f172a';
    g.beginPath(); g.ellipse(ex, cy - 3, 10, 13, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(ex - 3, cy - 8, 4, 0, Math.PI * 2); g.fill();
  }

  // Miệng
  g.strokeStyle = def.id === 2 ? '#e11d48' : '#7c2d12';
  g.lineWidth = 4.5; g.lineCap = 'round';
  g.beginPath();
  if (def.id === 3) {
    g.moveTo(cx - 10, cy + 20); g.quadraticCurveTo(cx, cy + 23, cx + 10, cy + 17);
  } else {
    g.arc(cx, cy + 16, 11, 0.15 * Math.PI, 0.85 * Math.PI);
  }
  g.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeTurnRingTexture(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 36, 128, 128, 122);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.55, color + '55');
  gr.addColorStop(0.84, '#facc15ee');
  gr.addColorStop(1, 'rgba(250,204,21,0)');
  g.fillStyle = gr;
  g.beginPath(); g.arc(128, 128, 122, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#ffffff'; g.lineWidth = 6;
  g.beginPath(); g.arc(128, 128, 106, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = color; g.lineWidth = 4; g.setLineDash([18, 10]);
  g.beginPath(); g.arc(128, 128, 86, 0, Math.PI * 2); g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------- CHÂN DUNG 2D (Khung góc trái dưới trong ảnh mẫu 2 & HUD 4 góc) ----------------
const avatarCache = new Map();
export function renderAvatarDataURL(lookSeed, _colorOverride = null, isBot = false) {
  const def = charDef(lookSeed);
  const key = `${def.id}|${isBot ? 1 : 0}`;
  if (avatarCache.has(key)) return avatarCache.get(key);

  const c = document.createElement('canvas');
  c.width = 160; c.height = 160;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 160, 160);
  bg.addColorStop(0, def.color);
  bg.addColorStop(1, def.portraitBg);
  g.fillStyle = bg;
  g.fillRect(0, 0, 160, 160);

  g.save();
  g.translate(80, 96);
  g.lineJoin = 'round'; g.lineCap = 'round';

  // Cổ & vai áo
  g.fillStyle = def.suit;
  g.beginPath(); g.roundRect(-48, 22, 96, 52, 20); g.fill();
  g.fillStyle = def.shirt;
  g.beginPath(); g.moveTo(-16, 22); g.lineTo(0, 48); g.lineTo(16, 22); g.closePath(); g.fill();
  if (def.id === 0) {
    g.fillStyle = '#9f1239';
    g.beginPath(); g.moveTo(-5, 25); g.lineTo(5, 25); g.lineTo(4, 58); g.lineTo(0, 64); g.lineTo(-4, 58); g.closePath(); g.fill();
  }
  g.fillStyle = def.skin;
  g.beginPath(); g.roundRect(-12, 8, 24, 24, 8); g.fill();

  // Tóc sau cho Quý bà / Nữ doanh nhân
  if (def.id === 2) {
    g.fillStyle = def.hair;
    g.beginPath(); g.ellipse(-34, -36, 24, 34, -0.35, 0, Math.PI * 2); g.fill();
  } else if (def.id === 3) {
    g.fillStyle = def.hair;
    g.beginPath(); g.ellipse(0, -14, 48, 42, 0, 0, Math.PI * 2); g.fill();
  }

  // Khuôn mặt
  g.fillStyle = def.skin;
  g.beginPath(); g.ellipse(0, -10, 38, 42, 0, 0, Math.PI * 2); g.fill();
  // Tai
  g.beginPath(); g.arc(-37, -6, 9, 0, Math.PI * 2); g.arc(37, -6, 9, 0, Math.PI * 2); g.fill();

  // Mũi & má hồng
  g.fillStyle = def.id === 0 ? 'rgba(225,29,72,0.42)' : 'rgba(244,63,94,0.24)';
  g.beginPath(); g.ellipse(-20, 4, 8, 5, 0, 0, Math.PI * 2); g.ellipse(20, 4, 8, 5, 0, 0, Math.PI * 2); g.fill();

  // Mắt / Kính râm
  if (def.id === 1) {
    g.fillStyle = '#0f172a';
    g.beginPath(); g.roundRect(-34, -22, 30, 20, 6); g.roundRect(4, -22, 30, 20, 6); g.fill();
    g.fillRect(-5, -16, 10, 5);
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.fillRect(-28, -19, 10, 4); g.fillRect(10, -19, 10, 4);
  } else {
    for (const s of [-1, 1]) {
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(s * 15, -10, 8, 10, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = def.id === 3 ? '#1d4ed8' : '#3b2314';
      g.beginPath(); g.arc(s * 15, -9, 5.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0f172a'; g.beginPath(); g.arc(s * 15, -9, 2.8, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(s * 15 - 2, -12, 2, 0, Math.PI * 2); g.fill();
      g.strokeStyle = def.hair; g.lineWidth = 3.5;
      g.beginPath(); g.moveTo(s * 15 - 8, -22); g.lineTo(s * 15 + 8, -23); g.stroke();
    }
  }

  // Miệng
  g.strokeStyle = def.id >= 2 ? '#e11d48' : '#7c2d12';
  g.lineWidth = 3.5;
  g.beginPath(); g.arc(0, 8, 10, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();

  // Tóc mái đặc trưng
  g.fillStyle = def.hair;
  if (def.id === 0) {
    g.beginPath();
    g.moveTo(-38, -18); g.quadraticCurveTo(-36, -64, 6, -64);
    g.quadraticCurveTo(42, -62, 38, -18); g.quadraticCurveTo(16, -42, -14, -36); g.closePath(); g.fill();
  } else if (def.id === 1) {
    g.beginPath();
    g.moveTo(-40, -18); g.quadraticCurveTo(-32, -66, 0, -64);
    g.quadraticCurveTo(38, -66, 40, -18); g.quadraticCurveTo(8, -42, -40, -18); g.closePath(); g.fill();
  } else if (def.id === 2) {
    g.beginPath();
    g.moveTo(-40, -14); g.quadraticCurveTo(-24, -64, 14, -56);
    g.quadraticCurveTo(42, -44, 38, -14); g.quadraticCurveTo(8, -36, -40, -14); g.closePath(); g.fill();
  } else {
    g.beginPath();
    g.moveTo(-44, -8); g.quadraticCurveTo(-36, -62, 4, -60);
    g.quadraticCurveTo(42, -58, 44, -8); g.quadraticCurveTo(12, -32, -18, -28); g.closePath(); g.fill();
  }
  g.restore();

  if (isBot) {
    g.fillStyle = 'rgba(15, 23, 42, 0.72)';
    g.beginPath(); g.roundRect(102, 122, 50, 28, 8); g.fill();
    g.fillStyle = '#e2e8f0'; g.font = '900 16px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('BOT', 127, 136);
  }

  const url = c.toDataURL();
  avatarCache.set(key, url);
  return url;
}

// ---------------- MINH HỌA TOÀN THÂN 2D (Màn hình NHÂN VẬT chuẩn ảnh mẫu 2) ----------------
const bodyCache = new Map();
export function renderFullBodyDataURL(lookSeed) {
  const def = charDef(lookSeed);
  if (bodyCache.has(def.id)) return bodyCache.get(def.id);

  const c = document.createElement('canvas');
  c.width = 240; c.height = 300;
  const g = c.getContext('2d');
  g.lineJoin = 'round'; g.lineCap = 'round';

  // Bóng nền dưới chân
  g.fillStyle = 'rgba(0,0,0,0.14)';
  g.beginPath(); g.ellipse(118, 274, 42, 11, 0, 0, Math.PI * 2); g.fill();

  const cx = 118;
  g.save();
  if (def.id === 0) {
    // Doanh nhân: suit đỏ rượu, quần đen, vali da nâu
    g.fillStyle = '#18181b';
    g.fillRect(cx - 16, 186, 13, 76); g.fillRect(cx + 3, 186, 13, 76);
    g.beginPath(); g.ellipse(cx - 12, 265, 11, 6, 0, 0, Math.PI * 2); g.ellipse(cx + 12, 265, 11, 6, 0, 0, Math.PI * 2); g.fill();
    // Tay xách vali
    g.fillStyle = '#854d27';
    g.beginPath(); g.roundRect(cx + 22, 186, 36, 34, 6); g.fill();
    g.strokeStyle = '#5c3419'; g.lineWidth = 4; g.strokeRect(cx + 32, 178, 16, 8);
    // Thân áo vest
    g.fillStyle = def.suit;
    g.beginPath(); g.roundRect(cx - 24, 108, 48, 86, 12); g.fill();
    g.fillStyle = def.shirt;
    g.beginPath(); g.moveTo(cx - 10, 108); g.lineTo(cx, 152); g.lineTo(cx + 10, 108); g.closePath(); g.fill();
    g.fillStyle = '#9f1239';
    g.beginPath(); g.moveTo(cx - 4, 112); g.lineTo(cx + 4, 112); g.lineTo(cx + 3, 148); g.lineTo(cx, 154); g.lineTo(cx - 3, 148); g.closePath(); g.fill();
    // Tay
    g.strokeStyle = def.suit; g.lineWidth = 13;
    g.beginPath(); g.moveTo(cx - 22, 118); g.lineTo(cx - 36, 150); g.lineTo(cx - 22, 170); g.stroke();
    g.beginPath(); g.moveTo(cx + 22, 118); g.lineTo(cx + 36, 168); g.stroke();
    g.fillStyle = def.skin;
    g.beginPath(); g.arc(cx - 20, 172, 6, 0, Math.PI * 2); g.arc(cx + 36, 174, 6, 0, Math.PI * 2); g.fill();
    // Đầu & tóc vuốt
    g.fillStyle = def.skin; g.fillRect(cx - 7, 94, 14, 18);
    g.beginPath(); g.ellipse(cx, 66, 26, 30, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = def.hair;
    g.beginPath(); g.moveTo(cx - 24, 58); g.quadraticCurveTo(cx - 28, 22, cx + 8, 24);
    g.quadraticCurveTo(cx + 30, 26, cx + 24, 60); g.quadraticCurveTo(cx + 6, 42, cx - 24, 58); g.closePath(); g.fill();
    g.fillStyle = '#0f172a'; g.beginPath(); g.arc(cx - 9, 64, 3.2, 0, Math.PI * 2); g.arc(cx + 9, 64, 3.2, 0, Math.PI * 2); g.fill();
  } else if (def.id === 1) {
    // Khách du lịch: balo, áo xanh lá chuối, quần short khaki, máy ảnh & kính râm
    g.fillStyle = '#ca8a04';
    g.beginPath(); g.roundRect(cx - 28, 108, 22, 54, 8); g.fill();
    g.fillStyle = def.skin;
    g.fillRect(cx - 15, 212, 11, 48); g.fillRect(cx + 4, 212, 11, 48);
    g.fillStyle = '#1e293b';
    g.beginPath(); g.ellipse(cx - 10, 264, 11, 6, 0, 0, Math.PI * 2); g.ellipse(cx + 10, 264, 11, 6, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = def.pants;
    g.fillRect(cx - 20, 176, 17, 40); g.fillRect(cx + 3, 176, 17, 40);
    g.fillStyle = def.suit;
    g.beginPath(); g.roundRect(cx - 23, 106, 46, 74, 10); g.fill();
    g.fillStyle = def.shirt; g.fillRect(cx - 9, 108, 18, 66);
    // Máy ảnh trước ngực
    g.fillStyle = '#1f2937'; g.beginPath(); g.roundRect(cx - 12, 140, 24, 16, 4); g.fill();
    g.fillStyle = '#94a3b8'; g.beginPath(); g.arc(cx, 148, 5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = def.skin; g.lineWidth = 10;
    g.beginPath(); g.moveTo(cx - 22, 122); g.lineTo(cx - 32, 166); g.moveTo(cx + 22, 122); g.lineTo(cx + 32, 166); g.stroke();
    // Đầu, tóc & kính râm
    g.fillStyle = def.skin;
    g.beginPath(); g.ellipse(cx, 68, 25, 28, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = def.hair;
    g.beginPath(); g.moveTo(cx - 25, 60); g.quadraticCurveTo(cx - 18, 26, cx + 6, 30);
    g.quadraticCurveTo(cx + 28, 32, cx + 25, 62); g.quadraticCurveTo(cx, 44, cx - 25, 60); g.closePath(); g.fill();
    g.fillStyle = '#0f172a';
    g.beginPath(); g.roundRect(cx - 21, 57, 18, 12, 3); g.roundRect(cx + 3, 57, 18, 12, 3); g.fill();
  } else if (def.id === 2) {
    // Quý bà với một con chó
    g.fillStyle = def.skin;
    g.fillRect(cx - 14, 198, 9, 60); g.fillRect(cx + 3, 198, 9, 60);
    g.fillStyle = '#b45309';
    g.beginPath(); g.ellipse(cx - 10, 262, 9, 5, 0, 0, Math.PI * 2); g.ellipse(cx + 8, 262, 9, 5, 0, 0, Math.PI * 2); g.fill();
    // Chú chó nhỏ & dây dắt
    g.strokeStyle = '#92400e'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(cx + 30, 168); g.quadraticCurveTo(cx + 42, 206, cx + 52, 232); g.stroke();
    g.fillStyle = '#d97706';
    g.beginPath(); g.ellipse(cx + 58, 246, 16, 10, -0.1, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(cx + 48, 234, 9, 0, Math.PI * 2); g.fill();
    g.fillRect(cx + 48, 250, 4, 14); g.fillRect(cx + 64, 250, 4, 14);
    // Chân váy & áo vàng
    g.fillStyle = def.pants;
    g.beginPath(); g.moveTo(cx - 18, 162); g.lineTo(cx + 18, 162); g.lineTo(cx + 24, 202); g.lineTo(cx - 24, 202); g.closePath(); g.fill();
    g.fillStyle = def.suit;
    g.beginPath(); g.roundRect(cx - 18, 106, 36, 58, 10); g.fill();
    g.fillStyle = '#d97706'; g.beginPath(); g.roundRect(cx - 28, 148, 22, 20, 5); g.fill();
    g.strokeStyle = def.skin; g.lineWidth = 8.5;
    g.beginPath(); g.moveTo(cx - 18, 116); g.lineTo(cx - 26, 158); g.moveTo(cx + 18, 116); g.lineTo(cx + 30, 168); g.stroke();
    // Đầu & tóc đuôi ngựa
    g.fillStyle = def.hair;
    g.beginPath(); g.ellipse(cx - 26, 54, 14, 26, -0.35, 0, Math.PI * 2); g.fill();
    g.fillStyle = def.skin;
    g.beginPath(); g.ellipse(cx, 68, 23, 27, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = def.hair;
    g.beginPath(); g.moveTo(cx - 24, 62); g.quadraticCurveTo(cx - 10, 28, cx + 22, 42);
    g.quadraticCurveTo(cx + 26, 54, cx + 22, 66); g.quadraticCurveTo(cx, 48, cx - 24, 62); g.closePath(); g.fill();
    g.fillStyle = '#0f172a'; g.beginPath(); g.arc(cx - 8, 68, 3, 0, Math.PI * 2); g.arc(cx + 8, 68, 3, 0, Math.PI * 2); g.fill();
  } else {
    // Nữ doanh nhân: blazer xanh dương, tóc bob tím than, tay phải nghe điện thoại, tay trái cầm cặp tài liệu
    g.fillStyle = def.skin;
    g.fillRect(cx - 12, 204, 8, 54); g.fillRect(cx + 4, 204, 8, 54);
    g.fillStyle = '#0f172a';
    g.beginPath(); g.ellipse(cx - 8, 262, 8, 5, 0, 0, Math.PI * 2); g.ellipse(cx + 8, 262, 8, 5, 0, 0, Math.PI * 2); g.fill();
    // Cặp tài liệu xanh nhạt tay trái (bên phải hình)
    g.fillStyle = '#7dd3fc'; g.beginPath(); g.roundRect(cx + 18, 160, 28, 34, 4); g.fill();
    g.fillStyle = def.pants; g.fillRect(cx - 18, 164, 36, 44);
    g.fillStyle = def.suit; g.beginPath(); g.roundRect(cx - 20, 106, 40, 62, 10); g.fill();
    g.fillStyle = def.shirt;
    g.beginPath(); g.moveTo(cx - 8, 106); g.lineTo(cx, 134); g.lineTo(cx + 8, 106); g.closePath(); g.fill();
    // Tay phải cầm điện thoại nghe, tay trái cầm tài liệu
    g.strokeStyle = def.suit; g.lineWidth = 9.5;
    g.beginPath(); g.moveTo(cx - 18, 116); g.lineTo(cx - 32, 134); g.lineTo(cx - 24, 82); g.stroke();
    g.beginPath(); g.moveTo(cx + 18, 116); g.lineTo(cx + 28, 164); g.stroke();
    g.fillStyle = '#0f172a'; g.beginPath(); g.roundRect(cx - 31, 66, 9, 18, 2); g.fill();
    // Đầu & tóc bob
    g.fillStyle = def.hair; g.beginPath(); g.ellipse(cx, 68, 30, 30, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = def.skin; g.beginPath(); g.ellipse(cx, 70, 22, 26, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = def.hair;
    g.beginPath(); g.moveTo(cx - 24, 68); g.quadraticCurveTo(cx - 18, 32, cx + 10, 36);
    g.quadraticCurveTo(cx + 28, 42, cx + 22, 68); g.quadraticCurveTo(cx, 48, cx - 24, 68); g.closePath(); g.fill();
    g.fillStyle = '#0f172a'; g.beginPath(); g.arc(cx - 7, 70, 3, 0, Math.PI * 2); g.arc(cx + 9, 70, 3, 0, Math.PI * 2); g.fill();
  }
  g.restore();

  const url = c.toDataURL();
  bodyCache.set(def.id, url);
  return url;
}

// ---------------- NHÂN VẬT 3D CHIBI CHUẨN 4 NHÂN VẬT ----------------
export class Character {
  constructor(lookSeed, color, name = '', isBot = false) {
    this.def = charDef(lookSeed);
    this.look = this.def;
    this.color = color || this.def.color;
    this.isBot = isBot;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.anim = 'idle';
    this.animTime = 0;
    this.tempUntil = 0;
    this.activeTurn = false;
    this.phase = Math.random() * 10;
    this.dog = null;
    this.dogTail = null;
    this.build();
  }

  build() {
    const D = this.def;
    const skin = M(D.skin);
    const suit = M(D.suit, { roughness: 0.38 });
    const shirt = M(D.shirt);
    const pants = M(D.pants);
    const hair = M(D.hair, { roughness: 0.55 });

    // Vòng chỉ báo tới lượt xoay nhẹ dưới chân
    this.magicRing = new THREE.Mesh(
      new THREE.PlaneGeometry(1.12, 1.12),
      new THREE.MeshBasicMaterial({
        map: makeTurnRingTexture(this.color),
        transparent: true, opacity: 0.96, side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    this.magicRing.rotation.x = -Math.PI / 2;
    this.magicRing.position.y = 0.015;
    this.magicRing.visible = false;
    this.root.add(this.magicRing);

    // Đế đứng tròn gọn gàng có viền màu nhân vật
    const base = mesh(new THREE.CylinderGeometry(0.32, 0.35, 0.05, 22), M('#e2e8f0', { roughness: 0.35 }), 0, 0.025, 0);
    const rim = mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.028, 22), M(this.color), 0, 0.014, 0);
    this.body.add(base, rim);

    // Chân & Giày
    this.legL = new THREE.Group(); this.legR = new THREE.Group();
    const legMat = D.id >= 1 ? skin : pants;
    const shoeMat = M(D.id === 2 ? '#92400e' : '#18181b');
    for (const [leg, x] of [[this.legL, -0.09], [this.legR, 0.09]]) {
      leg.position.set(x, 0.36, 0);
      leg.add(mesh(new THREE.CapsuleGeometry(0.056, 0.16, 6, 10), legMat, 0, -0.15, 0));
      if (D.id === 1 || D.id === 3) {
        leg.add(mesh(new THREE.CylinderGeometry(0.068, 0.072, 0.13, 10), pants, 0, -0.06, 0));
      }
      leg.add(mesh(new THREE.SphereGeometry(0.07, 10, 8), shoeMat, 0, -0.28, -0.02));
      this.body.add(leg);
    }

    // Thân áo
    this.torso = new THREE.Group(); this.torso.position.y = 0.36;
    this.body.add(this.torso);
    this.torso.add(mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.33, 16), suit, 0, 0.165, 0));
    this.torso.add(mesh(new THREE.SphereGeometry(0.15, 14, 10), suit, 0, 0.27, 0));

    if (D.id === 2) {
      // Váy nâu xòe nhẹ
      this.torso.add(mesh(new THREE.CylinderGeometry(0.15, 0.22, 0.18, 16), pants, 0, -0.02, 0));
      // Túi xách nâu
      this.torso.add(mesh(new THREE.BoxGeometry(0.08, 0.12, 0.14), M('#b45309'), -0.18, 0.04, 0.04));
    } else if (D.id === 3) {
      // Chân váy bút chì xanh dương + cổ sơ mi
      this.torso.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.18, 16), pants, 0, -0.02, 0));
      this.torso.add(mesh(new THREE.BoxGeometry(0.08, 0.16, 0.03), shirt, 0, 0.21, -0.145));
    } else if (D.id === 0) {
      // Sơ mi hồng nhạt + cà vạt đỏ sẫm
      this.torso.add(mesh(new THREE.BoxGeometry(0.09, 0.18, 0.03), shirt, 0, 0.2, -0.145));
      this.torso.add(mesh(new THREE.BoxGeometry(0.035, 0.18, 0.02), M('#881337'), 0, 0.19, -0.16));
    } else if (D.id === 1) {
      // Áo thun trong + balo vàng sau lưng + máy ảnh trước ngực
      this.torso.add(mesh(new THREE.BoxGeometry(0.09, 0.22, 0.03), shirt, 0, 0.18, -0.145));
      this.torso.add(mesh(new THREE.BoxGeometry(0.24, 0.28, 0.14), M('#ca8a04'), 0, 0.18, 0.18));
      this.torso.add(mesh(new THREE.BoxGeometry(0.12, 0.08, 0.06), M('#1f2937'), 0, 0.12, -0.17));
      this.torso.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 10).rotateX(Math.PI / 2), M('#94a3b8'), 0, 0.12, -0.21));
    }

    // Hai tay + phụ kiện cầm tay
    this.armL = new THREE.Group(); this.armR = new THREE.Group();
    const armMat = D.id === 2 ? skin : suit;
    for (const [arm, x] of [[this.armL, -0.19], [this.armR, 0.19]]) {
      arm.position.set(x, 0.28, 0);
      arm.add(mesh(new THREE.CapsuleGeometry(0.048, 0.16, 6, 10), armMat, 0, -0.1, 0));
      arm.add(mesh(new THREE.SphereGeometry(0.052, 10, 8), skin, 0, -0.22, 0));
      this.torso.add(arm);
    }

    if (D.id === 0) {
      // Vali nâu cho Doanh nhân
      const bag = new THREE.Group();
      bag.add(mesh(new THREE.BoxGeometry(0.07, 0.18, 0.22), M('#78350f'), 0, -0.09, 0));
      bag.add(mesh(new THREE.BoxGeometry(0.03, 0.04, 0.1), M('#451a03'), 0, 0.01, 0));
      bag.position.set(0.02, -0.25, 0);
      this.armR.add(bag);
    } else if (D.id === 3) {
      // Cặp tài liệu tay trái, điện thoại tay phải
      this.armR.add(mesh(new THREE.BoxGeometry(0.04, 0.17, 0.14), M('#7dd3fc'), 0.03, -0.24, -0.02));
      this.armL.rotation.z = 0.55;
      this.armL.rotation.x = -1.65;
      this.armL.add(mesh(new THREE.BoxGeometry(0.03, 0.11, 0.06), M('#0f172a'), 0.02, -0.24, -0.02));
    }

    // Đầu & Tóc đặc trưng
    this.head = new THREE.Group(); this.head.position.y = 0.41;
    this.torso.add(this.head);
    const headMat = new THREE.MeshStandardMaterial({ map: makeFaceTexture(D), roughness: 0.5 });
    const headMesh = mesh(new THREE.SphereGeometry(0.225, 24, 18), headMat, 0, 0.19, 0);
    headMesh.rotation.y = -Math.PI / 2;
    this.head.add(headMesh);

    if (D.id === 0) {
      // Tóc đỏ tía vuốt ngược
      this.head.add(mesh(new THREE.SphereGeometry(0.235, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), hair, 0, 0.2, 0.02));
      for (let i = -1; i <= 1; i++) {
        const sp = mesh(new THREE.ConeGeometry(0.06, 0.14, 6), hair, i * 0.07, 0.42, -0.03);
        sp.rotation.x = 0.45; this.head.add(sp);
      }
    } else if (D.id === 1) {
      // Tóc nâu + kính râm đen
      this.head.add(mesh(new THREE.SphereGeometry(0.235, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 0.21, 0.02));
      const gm = M('#0f172a', { metalness: 0.85, roughness: 0.18 });
      this.head.add(mesh(new THREE.BoxGeometry(0.12, 0.065, 0.03), gm, -0.08, 0.2, -0.225));
      this.head.add(mesh(new THREE.BoxGeometry(0.12, 0.065, 0.03), gm, 0.08, 0.2, -0.225));
      this.head.add(mesh(new THREE.BoxGeometry(0.32, 0.016, 0.02), gm, 0, 0.22, -0.225));
    } else if (D.id === 2) {
      // Tóc vàng + đuôi ngựa cao + chú chó trung thành trên đế
      this.head.add(mesh(new THREE.SphereGeometry(0.236, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.56), hair, 0, 0.2, 0.02));
      const pony = mesh(new THREE.ConeGeometry(0.09, 0.34, 10), hair, 0, 0.26, 0.26);
      pony.rotation.x = 2.4; this.head.add(pony);

      const dog = new THREE.Group();
      const fur = M('#d97706');
      dog.add(mesh(new THREE.CapsuleGeometry(0.065, 0.14, 5, 8).rotateX(Math.PI / 2), fur, 0, 0.13, 0));
      dog.add(mesh(new THREE.SphereGeometry(0.07, 10, 8), fur, 0, 0.2, -0.1));
      dog.add(mesh(new THREE.ConeGeometry(0.024, 0.055, 5), M('#92400e'), -0.045, 0.26, -0.09));
      dog.add(mesh(new THREE.ConeGeometry(0.024, 0.055, 5), M('#92400e'), 0.045, 0.26, -0.09));
      for (const lx of [-0.04, 0.04]) for (const lz of [-0.06, 0.06]) {
        dog.add(mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.09, 6), fur, lx, 0.07, lz));
      }
      this.dogTail = mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.09, 6), fur, 0, 0.17, 0.12);
      this.dogTail.rotation.x = -0.6;
      dog.add(this.dogTail);
      dog.position.set(0.26, 0.02, -0.08);
      this.dog = dog;
      this.body.add(dog);
    } else {
      // Tóc bob ngắn xanh tím than
      this.head.add(mesh(new THREE.SphereGeometry(0.242, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), hair, 0, 0.2, 0.03));
      this.head.add(mesh(new THREE.BoxGeometry(0.36, 0.24, 0.16), hair, 0, 0.09, 0.12));
    }

    // Ngôi sao chóng mặt (Sad)
    this.stars = new THREE.Group(); this.stars.position.y = 0.52; this.stars.visible = false;
    for (let i = 0; i < 3; i++) {
      const s = mesh(new THREE.OctahedronGeometry(0.05), M('#fde047', { emissive: '#f59e0b', emissiveIntensity: 1.2 }));
      const a = (i / 3) * Math.PI * 2;
      s.position.set(Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22);
      this.stars.add(s);
    }
    this.head.add(this.stars);

    // Máy bay mini 3D (Fly)
    this.plane = new THREE.Group(); this.plane.visible = false;
    const pm = M('#f8fafc', { metalness: 0.35 }), pc = M(this.color);
    this.plane.add(mesh(new THREE.CylinderGeometry(0.11, 0.07, 0.9, 12).rotateX(Math.PI / 2), pm, 0, 0, 0));
    this.plane.add(mesh(new THREE.BoxGeometry(1.15, 0.04, 0.22), pc, 0, 0, 0.02));
    this.plane.add(mesh(new THREE.BoxGeometry(0.4, 0.04, 0.14), pc, 0, 0, 0.4));
    this.plane.add(mesh(new THREE.BoxGeometry(0.04, 0.2, 0.14), pc, 0, 0.1, 0.4));
    this.prop = mesh(new THREE.BoxGeometry(0.36, 0.04, 0.03), M('#fbbf24'), 0, 0, -0.46);
    this.plane.add(this.prop);
    this.plane.position.y = 0.16;
    this.root.add(this.plane);

    this.root.scale.setScalar(1.24);
  }

  setActiveTurn(active) {
    this.activeTurn = !!active;
    this.magicRing.visible = this.activeTurn;
  }

  setAnim(name, duration = 0) {
    this.anim = name;
    this.animTime = 0;
    this.tempUntil = duration ? performance.now() + duration * 1000 : 0;
    this.stars.visible = name === 'sad';
    this.plane.visible = name === 'fly';
  }

  faceTowards(x, z) {
    const dx = x - this.root.position.x, dz = z - this.root.position.z;
    if (dx * dx + dz * dz < 1e-4) return;
    this.targetYaw = Math.atan2(-dx, -dz);
  }

  update(dt) {
    if (this.tempUntil && performance.now() > this.tempUntil) this.setAnim('idle');
    this.animTime += dt;
    const t = this.animTime + this.phase;

    if (this.activeTurn) {
      this.magicRing.rotation.z += dt * 1.25;
      const pulse = 1 + Math.sin(t * 4) * 0.06;
      this.magicRing.scale.set(pulse, pulse, 1);
    }
    if (this.dogTail) {
      this.dogTail.rotation.z = Math.sin(t * 9) * 0.45;
    }

    if (this.targetYaw !== undefined) {
      let d = this.targetYaw - this.root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.root.rotation.y += d * Math.min(1, dt * 12);
    }

    this.legL.rotation.set(0, 0, 0); this.legR.rotation.set(0, 0, 0);
    if (this.def.id !== 3) { this.armL.rotation.set(0, 0, 0); }
    else { this.armL.rotation.set(-1.65, 0, 0.55); }
    this.armR.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0); this.torso.rotation.set(0, 0, 0);
    this.body.position.y = 0;

    switch (this.anim) {
      case 'run': {
        const s = Math.sin(t * 16);
        this.legL.rotation.x = s * 0.7; this.legR.rotation.x = -s * 0.7;
        if (this.def.id !== 3) this.armL.rotation.x = -s * 0.8;
        this.armR.rotation.x = s * 0.65;
        this.torso.rotation.x = -0.12;
        break;
      }
      case 'celebrate': {
        const s = Math.sin(t * 10);
        this.body.position.y = Math.abs(Math.sin(t * 6)) * 0.25;
        this.armL.rotation.set(0, 0, -2.5 + s * 0.3);
        this.armR.rotation.set(0, 0, 2.5 - s * 0.3);
        this.head.rotation.y = Math.sin(t * 4) * 0.3;
        break;
      }
      case 'sad': {
        this.head.rotation.x = 0.45; this.torso.rotation.x = 0.15;
        this.torso.rotation.z = Math.sin(t * 2) * 0.08;
        this.stars.rotation.y = t * 4;
        break;
      }
      case 'fly': {
        this.body.position.y = 0.22;
        this.legL.rotation.x = -1.1; this.legR.rotation.x = -1.1;
        this.armL.rotation.set(0, 0, -1.2); this.armR.rotation.set(0, 0, 1.2);
        this.prop.rotation.z = t * 40;
        this.root.rotation.z = Math.sin(t * 3) * 0.08;
        break;
      }
      default: {
        const s = Math.sin(t * 2.4);
        this.torso.scale.y = 1 + s * 0.018;
        if (this.def.id !== 3) this.armL.rotation.z = -0.08 - s * 0.03;
        this.armR.rotation.z = 0.08 + s * 0.03;
        this.head.rotation.y = Math.sin(t * 0.8) * 0.22;
        this.root.rotation.z = 0;
      }
    }
  }
}
