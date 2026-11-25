// Điều phối Auth, Lobby, Màn hình Nhân Vật, WebSocket, hàng đợi sự kiện & HUD chuẩn Business Tour.
import gsap from 'gsap';
import { Scene3D } from './scene3d.js';
import { Backdrop2D } from './backdrop2d.js';
import { CHARACTER_DEFS, charDef, renderAvatarDataURL, renderFullBodyDataURL } from './character.js';
import { sfx, isMuted, setMuted, startBgm, stopBgm, bgmOn } from './audio.js';
import { getApiUrl, getWsUrl } from './config.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const DIFF_LABEL = { EASY: 'Dễ', MEDIUM: 'TB', HARD: 'Khó' };
const LEVEL_NAMES = ['Đất', 'Nhà 1', 'Nhà 2', 'Nhà 3', 'Khách sạn'];
const K_LEVEL = [1, 2.5, 6, 14, 30];

const GROUP_COLORS = {
  SPAIN: '#b87676', CHINA: '#8678a3', ITALY: '#c99c6d', GERMANY: '#83994e',
  UK_AUS: '#b59d56', USA: '#8a767d', FRANCE: '#5f9698', RUSSIA: '#648db5',
};

const ATTRACT_BOARD = {
  tiles: [
    { idx: 0, name: 'Bắt Đầu', type: 'START' },
    { idx: 1, name: 'Granada', type: 'CITY', group: 'SPAIN', price: 60 },
    { idx: 2, name: 'Seville', type: 'CITY', group: 'SPAIN', price: 60 },
    { idx: 3, name: 'Madrid', type: 'CITY', group: 'SPAIN', price: 80 },
    { idx: 4, name: 'Bali', type: 'RESORT', group: 'RESORT', price: 200 },
    { idx: 5, name: 'Hồng Kông', type: 'CITY', group: 'CHINA', price: 100 },
    { idx: 6, name: 'Bắc Kinh', type: 'CITY', group: 'CHINA', price: 100 },
    { idx: 7, name: 'Thượng Hải', type: 'CITY', group: 'CHINA', price: 120 },
    { idx: 8, name: 'Hòn Đảo Bị Lãng Quên', type: 'JAIL' },
    { idx: 9, name: 'Venice', type: 'CITY', group: 'ITALY', price: 140 },
    { idx: 10, name: 'Milan', type: 'CITY', group: 'ITALY', price: 140 },
    { idx: 11, name: 'Roma', type: 'CITY', group: 'ITALY', price: 160 },
    { idx: 12, name: 'Cơ Hội', type: 'CHANCE' },
    { idx: 13, name: 'Hamburg', type: 'CITY', group: 'GERMANY', price: 180 },
    { idx: 14, name: 'Síp', type: 'RESORT', group: 'RESORT', price: 200 },
    { idx: 15, name: 'Berlin', type: 'CITY', group: 'GERMANY', price: 200 },
    { idx: 16, name: 'Giải Đấu Thế Giới', type: 'CHAMPIONSHIP' },
    { idx: 17, name: 'London', type: 'CITY', group: 'UK_AUS', price: 220 },
    { idx: 18, name: 'Dubai', type: 'RESORT', group: 'RESORT', price: 200 },
    { idx: 19, name: 'Sydney', type: 'CITY', group: 'UK_AUS', price: 240 },
    { idx: 20, name: 'Cơ Hội', type: 'CHANCE' },
    { idx: 21, name: 'Chicago', type: 'CITY', group: 'USA', price: 260 },
    { idx: 22, name: 'Las Vegas', type: 'CITY', group: 'USA', price: 280 },
    { idx: 23, name: 'New York', type: 'CITY', group: 'USA', price: 300 },
    { idx: 24, name: 'Chuyến Đi Vòng Quanh Thế Giới', type: 'WORLD_TOUR' },
    { idx: 25, name: 'Nice', type: 'RESORT', group: 'RESORT', price: 200 },
    { idx: 26, name: 'Lyon', type: 'CITY', group: 'FRANCE', price: 320 },
    { idx: 27, name: 'Paris', type: 'CITY', group: 'FRANCE', price: 350 },
    { idx: 28, name: 'Cơ Hội', type: 'CHANCE' },
    { idx: 29, name: 'Sochi', type: 'CITY', group: 'RUSSIA', price: 380 },
    { idx: 30, name: 'Thuế', type: 'TAX' },
    { idx: 31, name: 'Moskva', type: 'CITY', group: 'RUSSIA', price: 420 },
  ],
};

const COIN_SVG = `
<svg class="coin-svg" viewBox="0 0 32 32">
  <defs><radialGradient id="cg" cx="35%" cy="30%"><stop offset="0%" stop-color="#fef9c3"/><stop offset="55%" stop-color="#fbbf24"/><stop offset="100%" stop-color="#b45309"/></radialGradient></defs>
  <circle cx="16" cy="16" r="14" fill="url(#cg)" stroke="#fef08a" stroke-width="2"/>
  <text x="16" y="21" font-size="15" font-weight="900" fill="#78350f" text-anchor="middle">$</text>
</svg>`;

function formatMoney(n) {
  return Number(n || 0).toLocaleString('en-US') + 'K';
}

function houseThumbSVG(lv, col = '#2591da') {
  if (lv === 0) {
    return `<svg viewBox="0 0 80 56" width="66" height="46"><polygon points="10,36 40,20 70,36 40,52" fill="#84cc16" stroke="#65a30d" stroke-width="2"/><polygon points="24,33 40,25 56,33 40,41" fill="${col}" opacity="0.65"/></svg>`;
  }
  if (lv === 1) {
    return `<svg viewBox="0 0 80 56" width="66" height="46"><polygon points="10,38 40,22 70,38 40,54" fill="#84cc16"/><polygon points="26,28 40,14 54,28 54,40 26,40" fill="#fef3c7" stroke="#b45309" stroke-width="2"/><polygon points="22,28 40,11 58,28" fill="#ef4444"/></svg>`;
  }
  if (lv === 2) {
    return `<svg viewBox="0 0 80 56" width="66" height="46"><polygon points="8,39 40,22 72,39 40,54" fill="#84cc16"/><rect x="20" y="21" width="17" height="19" fill="#fed7aa" stroke="#9a3412" stroke-width="1.5"/><polygon points="18,21 28.5,11 39,21" fill="#ec4899"/><rect x="43" y="19" width="18" height="21" fill="#fde68a" stroke="#9a3412" stroke-width="1.5"/><polygon points="41,19 52,9 63,19" fill="#e11d48"/></svg>`;
  }
  if (lv === 3) {
    return `<svg viewBox="0 0 80 56" width="66" height="46"><polygon points="8,40 40,24 72,40 40,54" fill="#84cc16"/><rect x="22" y="12" width="18" height="28" fill="#f8fafc" stroke="#334155" stroke-width="1.5"/><rect x="40" y="8" width="18" height="32" fill="#e2e8f0" stroke="#334155" stroke-width="1.5"/><polygon points="20,12 40,2 60,12" fill="#dc2626"/></svg>`;
  }
  return `<svg viewBox="0 0 120 84" width="108" height="76"><polygon points="12,56 60,30 108,56 60,80" fill="#84cc16" stroke="#65a30d" stroke-width="2"/><rect x="34" y="16" width="52" height="42" rx="4" fill="#ffffff" stroke="#b45309" stroke-width="2.5"/><rect x="48" y="6" width="24" height="12" rx="3" fill="#facc15" stroke="#b45309" stroke-width="2"/><rect x="42" y="24" width="10" height="10" fill="#fbbf24"/><rect x="55" y="24" width="10" height="10" fill="#fbbf24"/><rect x="68" y="24" width="10" height="10" fill="#fbbf24"/><rect x="52" y="42" width="16" height="16" fill="#0ea5e9"/></svg>`;
}

const app = {
  token: localStorage.getItem('bt_token') || '',
  user: null,
  ws: null,
  room: null,
  board: null,
  state: null,
  latestState: null,
  seed: null,
  deadline: null,
  matchDeadline: null,
  serverOffset: 0,
  turnSeconds: 30,
  returnScreen: 'lobby-screen',
  queue: [],
  draining: false,
  soloBots: ['MEDIUM'],
  reconnectDelay: 800,
  backdrop: new Backdrop2D($('#bg-2d-canvas')),
  scene: new Scene3D($('#scene-canvas')),
};

app.backdrop.setThemeBySeed(2026);
app.scene.initAttractScene(ATTRACT_BOARD);
app.scene.inspectCallback = (idx) => openDeedModal(idx);

// ------------------------------------------------------------------ Helpers
function toast(msg, isErr = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (isErr ? ' err' : '');
  el.textContent = msg;
  $('#toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function showScreen(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  $(`#${id}`).classList.add('active');
}

function send(payload) {
  if (!app.ws || app.ws.readyState !== 1) {
    toast('Đang mất kết nối máy chủ...', true);
    return false;
  }
  app.ws.send(JSON.stringify(payload));
  return true;
}

async function api(url, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (app.token) headers.Authorization = `Bearer ${app.token}`;
  const res = await fetch(getApiUrl(url), { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Lỗi yêu cầu');
  return data;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// ------------------------------------------------------------------ Auth & Profile
async function initAuth() {
  if (app.token) {
    try {
      const me = await api('/api/me');
      app.user = me.user;
      onAuthed();
      return;
    } catch {
      localStorage.removeItem('bt_token');
      app.token = '';
    }
  }
  showScreen('auth-screen');
}

function onAuthed() {
  updateProfileUI();
  showScreen('lobby-screen');
  connectWs();
}

function updateProfileUI() {
  const u = app.user;
  if (!u) return;
  const def = charDef(u.look || 0);
  const avaUrl = renderAvatarDataURL(def.id, def.color, false);
  $('#user-avatar-img').src = avaUrl;
  $('#char-user-ava').src = avaUrl;
  $('#user-name-display').textContent = u.name;
  $('#char-user-name').textContent = u.name;
  $('#char-selected-label').textContent = `Nhân vật: ${def.name}`;
  const provMap = { guest: 'Khách', google: 'Google', facebook: 'Facebook' };
  $('#user-provider-badge').textContent = `${provMap[u.provider] || u.provider} • ${def.name}`;
  $('#btn-link-social').classList.toggle('hidden', u.provider !== 'guest');
}

$('#btn-guest').onclick = async () => {
  sfx.unlock(); sfx.click();
  try {
    const res = await api('/api/auth/guest', { method: 'POST' });
    app.token = res.token; app.user = res.user;
    localStorage.setItem('bt_token', app.token);
    onAuthed();
  } catch (e) { toast(e.message, true); }
};

function openSocialModal(defaultProvider = 'google', isUpgrade = false) {
  const label = defaultProvider === 'facebook' ? 'Facebook' : 'Google';
  openModal(`
    <div class="modal-head">
      <h3>${isUpgrade ? '🔗 Liên kết tài khoản' : '🔐 Đăng nhập'} ${label}</h3>
      <button class="bt-circle-btn sm danger" id="modal-close">✕</button>
    </div>
    <p class="card-desc">Nhập thông tin ${label} để lưu hồ sơ và bảng xếp hạng.</p>
    <form id="social-form" style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">
      <select id="soc-provider">
        <option value="google" ${defaultProvider === 'google' ? 'selected' : ''}>Google</option>
        <option value="facebook" ${defaultProvider === 'facebook' ? 'selected' : ''}>Facebook</option>
      </select>
      <input id="soc-name" type="text" required maxlength="24" placeholder="Tên hiển thị" value="${isUpgrade && app.user ? escapeHtml(app.user.name) : ''}" />
      <input id="soc-email" type="email" required placeholder="Email / ID tài khoản" />
      <button class="btn btn-sky" type="submit">Xác nhận ${isUpgrade ? 'Liên kết' : 'Đăng nhập'}</button>
    </form>
  `);
  $('#social-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const provider = $('#soc-provider').value;
      const name = $('#soc-name').value.trim();
      const email = $('#soc-email').value.trim();
      const res = await api('/api/auth/social', {
        method: 'POST',
        body: JSON.stringify({ provider, name, email, ext_id: email }),
      });
      app.token = res.token; app.user = res.user;
      localStorage.setItem('bt_token', app.token);
      closeModal();
      toast(isUpgrade ? 'Đã liên kết tài khoản!' : `Chào mừng ${app.user.name}!`);
      if (app.ws) { app.ws.close(); app.ws = null; }
      onAuthed();
    } catch (err) { toast(err.message, true); }
  };
}

$('#btn-google').onclick = () => { sfx.unlock(); sfx.click(); openSocialModal('google', false); };
$('#btn-facebook').onclick = () => { sfx.unlock(); sfx.click(); openSocialModal('facebook', false); };
$('#btn-link-social').onclick = () => { sfx.click(); openSocialModal('google', true); };

$('#btn-logout').onclick = () => {
  sfx.click();
  localStorage.removeItem('bt_token');
  app.token = ''; app.user = null;
  if (app.ws) { app.ws.close(); app.ws = null; }
  app.scene.initAttractScene(ATTRACT_BOARD);
  showScreen('auth-screen');
};

$('#btn-edit-name').onclick = () => {
  const n = prompt('Nhập tên hiển thị mới (tối đa 20 ký tự):', app.user?.name || '');
  if (n && n.trim()) send({ action: 'SET_NAME', name: n.trim() });
};

// ------------------------------------------------------------------ Màn hình NHÂN VẬT (Ảnh mẫu 2)
function openCharacterScreen(returnTo = 'lobby-screen') {
  app.returnScreen = returnTo;
  renderCharacterScreen();
  showScreen('character-screen');
}

function showCharacterInfoModal(def) {
  openModal(`
    <div class="modal-head">
      <h3>ℹ️ ${escapeHtml(def.name)}</h3>
      <button class="bt-circle-btn sm danger" id="modal-close">✕</button>
    </div>
    <div style="display:flex;gap:14px;align-items:center;">
      <img src="${renderFullBodyDataURL(def.id)}" style="height:150px;background:#e2dcd0;border-radius:12px;padding:6px;" alt="" />
      <div style="font-size:13.5px;line-height:1.55;">
        <p style="margin:0 0 6px;"><b>Giới thiệu:</b> ${escapeHtml(def.intro)}</p>
        <p style="margin:0 0 6px;"><b>Đặc điểm:</b> ${escapeHtml(def.detail)}</p>
        <p style="margin:0;"><b>Giới tính:</b> ${escapeHtml(def.gender)}</p>
      </div>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-top:12px;">
      <button class="btn btn-sky btn-sm" id="char-pick-confirm">Chọn nhân vật này</button>
    </div>
  `);
  $('#char-pick-confirm').onclick = () => {
    sfx.click();
    selectCharacter(def.id);
    closeModal();
  };
}

function selectCharacter(id) {
  if (!app.user) return;
  app.user.look = id;
  updateProfileUI();
  renderCharacterScreen();
  send({ action: 'SET_LOOK', look: id });
  toast(`Đã chọn nhân vật: ${charDef(id).name}`);
}

function renderCharacterScreen() {
  const myLook = charDef(app.user?.look || 0).id;
  // Bên trái: 4 nhân vật cho trò chơi (2x2 có ảnh toàn thân + chân dung góc dưới trái)
  $('#char-selected-grid').innerHTML = CHARACTER_DEFS.map(d => `
    <div class="char-slot-card ${d.id === myLook ? 'mine' : ''}" data-id="${d.id}" title="Bấm để chọn ${escapeHtml(d.name)}">
      <div class="char-slot-inner"><img src="${renderFullBodyDataURL(d.id)}" alt="" /></div>
      <div class="char-mini-portrait"><img src="${renderAvatarDataURL(d.id)}" alt="" /></div>
    </div>
  `).join('');
  $('#char-selected-grid').querySelectorAll('.char-slot-card').forEach(el => {
    el.onclick = () => { sfx.click(); selectCharacter(Number(el.dataset.id)); };
  });

  // Bên phải: Tất cả nhân vật (4 nhân vật đã mở + 2 vật phẩm khóa minh họa)
  const lockedExtras = [
    { name: 'Quả bóng bay', icon: '🎈' },
    { name: 'Xe Jeep', icon: '🚙' },
  ];
  $('#char-all-grid').innerHTML = CHARACTER_DEFS.map(d => `
    <div class="char-catalog-card" data-id="${d.id}">
      <div class="char-card-head">${escapeHtml(d.name)}</div>
      <button class="char-info-btn" data-info="${d.id}" title="Xem thông tin">i</button>
      <div class="char-card-stage">
        <img src="${renderFullBodyDataURL(d.id)}" alt="" />
        ${d.id === myLook ? '<div class="stamp-chosen">ĐÃ CHỌN</div>' : ''}
      </div>
    </div>
  `).join('') + lockedExtras.map(ex => `
    <div class="char-catalog-card locked">
      <div class="char-card-head">${escapeHtml(ex.name)}</div>
      <div class="char-card-stage">
        <span style="font-size:66px;opacity:0.7;">${ex.icon}</span>
        <span class="char-lock-tag">🔒</span>
      </div>
    </div>
  `).join('');

  $('#char-all-grid').querySelectorAll('.char-catalog-card[data-id]').forEach(card => {
    card.onclick = (e) => {
      if (e.target.closest('.char-info-btn')) return;
      sfx.click();
      selectCharacter(Number(card.dataset.id));
    };
  });
  $('#char-all-grid').querySelectorAll('.char-info-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      sfx.click();
      showCharacterInfoModal(charDef(Number(btn.dataset.info)));
    };
  });
}

$('#btn-open-chars').onclick = () => { sfx.click(); openCharacterScreen('lobby-screen'); };
$('#btn-pick-char-room').onclick = () => { sfx.click(); openCharacterScreen('room-screen'); };
$('#btn-close-chars').onclick = () => { sfx.click(); showScreen(app.returnScreen || 'lobby-screen'); };
$('#btn-char-home').onclick = () => { sfx.click(); showScreen('lobby-screen'); };

// ------------------------------------------------------------------ WebSocket
function connectWs() {
  if (!app.token) return;
  if (app.ws && (app.ws.readyState === 0 || app.ws.readyState === 1)) return;
  const ws = new WebSocket(getWsUrl(app.token));
  app.ws = ws;

  ws.onopen = () => { app.reconnectDelay = 800; send({ action: 'LIST_ROOMS' }); };
  ws.onmessage = (e) => handleWsMessage(JSON.parse(e.data));
  ws.onclose = () => {
    if (app.ws !== ws) return;
    app.ws = null;
    if (!app.token) return;
    setTimeout(() => { app.reconnectDelay = Math.min(6000, app.reconnectDelay * 1.5); connectWs(); }, app.reconnectDelay);
  };
}

function handleWsMessage(msg) {
  switch (msg.type) {
    case 'HELLO': app.user = msg.user; updateProfileUI(); break;
    case 'ROOM_LIST': renderPublicRooms(msg.rooms || []); break;
    case 'ROOM_STATE':
      app.room = msg.room;
      if (msg.room.status === 'LOBBY') { renderRoom(); showScreen('room-screen'); }
      break;
    case 'LEFT_ROOM':
      app.room = null; app.state = null; app.latestState = null; app.matchDeadline = null;
      app.queue = []; app.draining = false;
      $('#match-timer').classList.add('hidden');
      app.scene.initAttractScene(ATTRACT_BOARD);
      showScreen('lobby-screen');
      send({ action: 'LIST_ROOMS' });
      break;
    case 'GAME_SYNC': onGameSync(msg); break;
    case 'GAME_EVENTS':
      if (msg.server_time) app.serverOffset = msg.server_time - Date.now() / 1000;
      app.deadline = msg.deadline || null;
      if (msg.state) app.latestState = msg.state;
      else if (msg.events?.length && msg.events[msg.events.length - 1].state) {
        app.latestState = msg.events[msg.events.length - 1].state;
      }
      app.queue.push(...(msg.events || []));
      drainQueue();
      break;
    case 'ERROR':
      toast(msg.message, true);
      if (msg.auth) { localStorage.removeItem('bt_token'); app.token = ''; showScreen('auth-screen'); }
      break;
  }
}

// ------------------------------------------------------------------ Lobby & Room
function renderSoloBotConfigs() {
  const wrap = $('#solo-bot-configs');
  wrap.innerHTML = app.soloBots.map((d, i) => `
    <div class="bot-cfg-row">
      <span>🤖 AI Bot #${i + 1}</span>
      <select class="solo-diff" data-i="${i}">
        <option value="EASY" ${d === 'EASY' ? 'selected' : ''}>Dễ (Tập sự)</option>
        <option value="MEDIUM" ${d === 'MEDIUM' ? 'selected' : ''}>Trung bình</option>
        <option value="HARD" ${d === 'HARD' ? 'selected' : ''}>Khó (Heuristic)</option>
      </select>
    </div>
  `).join('');
  wrap.querySelectorAll('.solo-diff').forEach(sel => {
    sel.onchange = () => { app.soloBots[Number(sel.dataset.i)] = sel.value; };
  });
}
renderSoloBotConfigs();

$$('#solo-bot-count .seg').forEach(btn => {
  btn.onclick = () => {
    sfx.click();
    $$('#solo-bot-count .seg').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const n = Number(btn.dataset.n);
    while (app.soloBots.length < n) app.soloBots.push('MEDIUM');
    app.soloBots.length = n;
    renderSoloBotConfigs();
  };
});

$('#btn-start-solo').onclick = () => { sfx.unlock(); sfx.click(); send({ action: 'CREATE_ROOM', solo: true, bots: app.soloBots }); };
$('#btn-quick-match').onclick = () => { sfx.unlock(); sfx.click(); send({ action: 'QUICK_MATCH' }); };
$('#btn-create-private').onclick = () => { sfx.unlock(); sfx.click(); send({ action: 'CREATE_ROOM', public: false }); };
$('#btn-create-public').onclick = () => { sfx.unlock(); sfx.click(); send({ action: 'CREATE_ROOM', public: true }); };
$('#btn-refresh-rooms').onclick = () => { sfx.click(); send({ action: 'LIST_ROOMS' }); };
$('#btn-join-code').onclick = () => {
  sfx.unlock(); sfx.click();
  const code = $('#input-room-code').value.trim().toUpperCase();
  if (!code) return toast('Hãy nhập mã phòng!', true);
  send({ action: 'JOIN_ROOM', code });
};

function renderPublicRooms(rooms) {
  const el = $('#public-rooms-list');
  if (!rooms.length) {
    el.innerHTML = `<div class="muted" style="text-align:center;margin:14px 0;font-size:13px;">Chưa có phòng công khai nào. Hãy tạo phòng mới!</div>`;
    return;
  }
  el.innerHTML = rooms.map(r => `
    <div class="pub-item">
      <div><b>${escapeHtml(r.code)}</b> • Chủ phòng: ${escapeHtml(r.host)}</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="badge">${r.players}/4</span>
        <button class="btn btn-sky btn-xs pub-join" data-code="${escapeHtml(r.code)}">Vào</button>
      </div>
    </div>
  `).join('');
  el.querySelectorAll('.pub-join').forEach(b => { b.onclick = () => send({ action: 'JOIN_ROOM', code: b.dataset.code }); });
}

function renderRoom() {
  const r = app.room;
  if (!r) return;
  const isHost = r.host_id === app.user?.id;
  $('#room-code-text').textContent = r.code;
  $('#chk-room-public').checked = r.public;
  $('#chk-room-public').disabled = !isHost;
  $$('.host-only').forEach(el => el.classList.toggle('hidden', !isHost));
  $('#host-bot-add').classList.toggle('hidden', !isHost || r.seats.length >= 4);

  const grid = $('#room-seats');
  let html = '';
  for (let i = 0; i < 4; i++) {
    const s = r.seats[i];
    if (!s) { html += `<div class="seat-card empty">Ghế trống #${i + 1}</div>`; continue; }
    const isMe = s.id === app.user?.id;
    const def = charDef(s.look || 0);
    const avaUrl = renderAvatarDataURL(def.id, s.color, s.is_bot);
    html += `
      <div class="seat-card" style="border-color:${s.color}">
        <div class="seat-avatar"><img class="ava-img" src="${avaUrl}" alt="" /></div>
        <div class="seat-info">
          <div class="seat-name">${escapeHtml(s.name)} ${s.id === r.host_id ? '👑' : ''} ${isMe ? '(Bạn)' : ''}</div>
          <div class="seat-sub">
            <span class="badge" style="background:${s.color};color:#fff;">${escapeHtml(def.name)}</span>
            ${s.is_bot ? `<span class="badge bot">BOT ${DIFF_LABEL[s.difficulty]}</span>` : (s.connected ? '<span class="badge">Trực tuyến</span>' : '<span class="badge off">Offline</span>')}
          </div>
        </div>
        ${s.is_bot && isHost ? `
          <select class="seat-bot-diff" data-id="${s.id}">
            <option value="EASY" ${s.difficulty === 'EASY' ? 'selected' : ''}>Dễ</option>
            <option value="MEDIUM" ${s.difficulty === 'MEDIUM' ? 'selected' : ''}>TB</option>
            <option value="HARD" ${s.difficulty === 'HARD' ? 'selected' : ''}>Khó</option>
          </select>
          <button class="btn btn-pink btn-xs seat-rem-bot" data-id="${s.id}">✕</button>
        ` : ''}
      </div>
    `;
  }
  grid.innerHTML = html;
  grid.querySelectorAll('.seat-bot-diff').forEach(sel => { sel.onchange = () => send({ action: 'SET_BOT_DIFFICULTY', seat_id: sel.dataset.id, difficulty: sel.value }); });
  grid.querySelectorAll('.seat-rem-bot').forEach(btn => { btn.onclick = () => send({ action: 'REMOVE_BOT', seat_id: btn.dataset.id }); });
}

$('#btn-copy-code').onclick = () => { navigator.clipboard?.writeText(app.room?.code || ''); toast(`Đã sao chép mã phòng ${app.room?.code}`); };
$('#chk-room-public').onchange = (e) => send({ action: 'SET_PUBLIC', public: e.target.checked });
$('#btn-leave-room').onclick = () => { sfx.click(); send({ action: 'LEAVE_ROOM' }); };
$('#btn-add-bot').onclick = () => { sfx.click(); send({ action: 'ADD_BOT', difficulty: $('#select-add-bot-diff').value }); };
$('#btn-start-game').onclick = () => { sfx.click(); send({ action: 'START_GAME' }); };

// ------------------------------------------------------------------ Match & Event Queue
function onGameSync(msg) {
  app.room = msg.room;
  app.seed = msg.seed;
  app.board = msg.board;
  app.state = msg.state;
  app.latestState = msg.state;
  app.deadline = msg.deadline || null;
  app.matchDeadline = msg.match_deadline || null;
  app.turnSeconds = msg.turn_seconds || 30;
  app.queue = [];
  app.draining = false;

  app.backdrop.setThemeBySeed(msg.seed);
  app.scene.initMatch(msg.seed, msg.board, msg.state);
  app.scene.setTimerText('30:00');
  $('#decision-modal').classList.add('hidden');
  $('#chance-popup').classList.add('hidden');
  $('#worldcup-overlay').classList.add('hidden');
  $('#dice-result-banner').classList.add('hidden');
  $('#match-timer').classList.toggle('hidden', !app.matchDeadline);
  closeModal();

  showScreen('hud-screen');
  renderPlayerCards();
  renderTurnUI();
}

async function drainQueue() {
  if (app.draining) return;
  app.draining = true;
  $('#action-bar').classList.add('hidden');
  $('#decision-modal').classList.add('hidden');
  app.scene.clearSelectableTiles();

  try {
    while (app.queue.length) {
      const ev = app.queue.shift();
      try { await processEvent(ev); }
      catch (err) {
        console.error('Event error:', ev, err);
        if (ev?.state) { app.state = ev.state; app.scene.applyState(ev.state, { instant: true }); }
      }
    }
  } finally {
    if (app.latestState) {
      app.state = app.latestState;
      app.scene.applyState(app.state, { instant: true });
    }
    app.draining = false;
    renderPlayerCards();
    renderTurnUI();
  }
}

let confettiHandle = null;
function launchConfetti(durationMs = 2400) {
  const c = $('#fx-confetti-canvas');
  const g = c.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth, H = window.innerHeight;
  c.width = W * dpr; c.height = H * dpr;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cols = ['#fbbf24', '#ef4444', '#3b82f6', '#22c55e', '#ec4899', '#a855f7'];
  const pieces = Array.from({ length: 130 }, (_, i) => ({
    x: W * (0.2 + Math.random() * 0.6), y: H * (0.35 + Math.random() * 0.2),
    vx: (Math.random() - 0.5) * 14, vy: -8 - Math.random() * 12,
    w: 7 + Math.random() * 7, h: 5 + Math.random() * 6,
    rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, col: cols[i % cols.length],
  }));
  const start = performance.now();
  if (confettiHandle) cancelAnimationFrame(confettiHandle);
  const step = (now) => {
    const elapsed = now - start;
    g.clearRect(0, 0, W, H);
    if (elapsed > durationMs) { confettiHandle = null; return; }
    g.globalAlpha = Math.max(0, elapsed > durationMs - 500 ? (durationMs - elapsed) / 500 : 1);
    for (const p of pieces) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.34; p.vx *= 0.99; p.rot += p.vr;
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
      g.fillStyle = p.col; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      g.restore();
    }
    confettiHandle = requestAnimationFrame(step);
  };
  confettiHandle = requestAnimationFrame(step);
}

// Popup THẺ CƠ HỘI theo thiết kế GDD trang 27
async function showChanceCardModal(card, playerName) {
  const info = app.board?.cards?.[card] || { tier: 'GOLD', name: 'Thẻ Cơ Hội', icon: '❓', desc: 'Nhận hiệu ứng đặc biệt!' };
  const tierMap = { GOLD: 'THẺ VÀNG', SILVER: 'THẺ BẠC', WOOD: 'THẺ MỘC' };
  const tier = info.tier || 'GOLD';
  const backdrop = $('#chance-popup');
  backdrop.innerHTML = `
    <div class="chance-gdd-card" id="chance-card-box">
      <div class="chance-gdd-inner">
        <div class="chance-gdd-head">${escapeHtml(info.name)}</div>
        <span class="chance-tier-pill tier-${tier}">${tierMap[tier] || 'CƠ HỘI'}</span>
        <div class="chance-art-frame">${info.icon}</div>
        <div class="chance-gdd-desc">${escapeHtml(info.desc)}</div>
        <div class="chance-gdd-player">Người rút: ${escapeHtml(playerName)}</div>
      </div>
    </div>
  `;
  backdrop.classList.remove('hidden');
  sfx.cardDraw();
  gsap.fromTo('#chance-card-box', { scale: 0.45, rotationY: -90, opacity: 0 },
    { scale: 1, rotationY: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.6)' });
  setTimeout(() => sfx.cardFlip(), 220);

  await new Promise(r => {
    const t = setTimeout(r, 2200);
    backdrop.onclick = () => { clearTimeout(t); r(); };
  });
  backdrop.onclick = null;
  await gsap.to('#chance-card-box', { scale: 0.8, opacity: 0, duration: 0.2, ease: 'power2.in' });
  backdrop.classList.add('hidden');
}

async function showWorldCupCelebration(playerName, subtitle = 'Chọn 1 thành phố đăng cai nhân hệ số tiền thuê!') {
  const ov = $('#worldcup-overlay');
  ov.innerHTML = `
    <div class="wc-rays"></div>
    <div class="wc-card" id="wc-card-box">
      <svg width="96" height="96" viewBox="0 0 120 120">
        <path d="M35 24 H85 V48 C85 68 74 78 60 80 C46 78 35 68 35 48 Z" fill="#fbbf24" stroke="#b45309" stroke-width="4"/>
        <path d="M35 32 H20 C20 50 28 56 36 56 M85 32 H100 C100 50 92 56 84 56" fill="none" stroke="#f59e0b" stroke-width="5"/>
        <rect x="52" y="78" width="16" height="18" fill="#f59e0b"/>
        <rect x="38" y="96" width="44" height="12" rx="4" fill="#d97706"/>
      </svg>
      <div class="wc-title">GIẢI ĐẤU THẾ GIỚI!</div>
      <div class="wc-sub">${escapeHtml(playerName)} — ${escapeHtml(subtitle)}</div>
    </div>
  `;
  ov.classList.remove('hidden');
  sfx.worldCup();
  launchConfetti(2400);
  gsap.fromTo('#wc-card-box', { scale: 0.45, opacity: 0, y: 30 }, { scale: 1, opacity: 1, y: 0, duration: 0.45, ease: 'back.out(1.5)' });
  await new Promise(r => setTimeout(r, 2000));
  ov.classList.add('hidden');
}

function spawnMoneyPop(pid, delta) {
  const pos = app.scene.worldToScreen(pid);
  if (!pos || !delta) return;
  const el = document.createElement('div');
  el.className = 'float-money ' + (delta > 0 ? 'pos' : 'neg');
  el.textContent = `${delta > 0 ? '+' : ''}${formatMoney(delta)}`;
  el.style.left = `${pos.x}px`;
  el.style.top = `${pos.y}px`;
  $('#floating-layer').appendChild(el);
  setTimeout(() => el.remove(), 1350);
}

async function processEvent(ev) {
  if (ev.type === 'DICE_ROLLED') {
    const total = ev.dice[0] + ev.dice[1];
    app.scene.setDiceBadge(total);
    await app.scene.rollDice(ev.dice);
    const banner = $('#dice-result-banner');
    banner.textContent = `🎲 ${ev.dice[0]} + ${ev.dice[1]} = ${total}${ev.doubles ? ' 🔥 ĐÔI!' : ''}`;
    banner.classList.remove('hidden');
    gsap.fromTo(banner, { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, ease: 'back.out(1.7)' });
    setTimeout(() => banner.classList.add('hidden'), 1100);
  } else if (ev.type === 'MOVE') {
    await app.scene.animateMove(ev.player_id, ev.frm, ev.to, ev.steps, ev.kind);
    app.scene.dice?.hide();
    app.scene.setDiceBadge(null);
  } else if (ev.type === 'WORLD_CUP_ARRIVE') {
    const pl = (ev.state?.players || app.state?.players || []).find(p => p.id === ev.player_id);
    app.scene.burstTile(16, '#fbbf24');
    app.scene.celebrate(ev.player_id);
    await showWorldCupCelebration(pl?.name || 'Người chơi', ev.has_cities ? 'Chọn thành phố đăng cai Giải Đấu Thế Giới!' : 'Đặt chân tới Sân Vận Động Thế Giới!');
  } else if (ev.type === 'CARD') {
    const pl = (ev.state?.players || app.state?.players || []).find(p => p.id === ev.player_id);
    if (pl) app.scene.burstTile(pl.pos, '#f59e0b');
    await showChanceCardModal(ev.card, pl?.name || 'Người chơi');
  } else if (ev.type === 'CHAMPIONSHIP') {
    sfx.build();
    app.scene.burstTile(ev.tile, '#f472b6');
    app.scene.celebrate(ev.player_id);
    launchConfetti(1500);
    if (ev.msg) toast(ev.msg);
  } else if (ev.type === 'BUY' || ev.type === 'BUILD' || ev.type === 'BUYOUT') {
    sfx.build();
    app.scene.celebrate(ev.player_id);
  } else if (ev.type === 'EARTHQUAKE') {
    sfx.quake();
    app.scene.shakeTile(ev.tile);
    if (ev.msg) toast(ev.msg);
  } else if (ev.type === 'BLACKOUT') {
    sfx.zap();
    if (ev.msg) toast(ev.msg);
  } else if (ev.type === 'VICTORY_ALERT') {
    sfx.alert();
    if (ev.msg) toast(ev.msg);
  } else if (ev.type === 'TURN') {
    if (ev.player_id === app.user?.id) sfx.turn();
  } else if (ev.type === 'BANKRUPT') {
    sfx.lose();
    app.scene.sad(ev.player_id);
    if (ev.msg) toast(ev.msg, true);
  }

  if (ev.changes) {
    let anyPos = false, anyNeg = false;
    for (const c of ev.changes) {
      spawnMoneyPop(c.player_id, c.delta);
      if (c.delta > 0) anyPos = true;
      if (c.delta < 0) anyNeg = true;
    }
    if (anyPos) sfx.coin();
    else if (anyNeg && ev.type === 'MONEY') sfx.pay();
  }

  if (ev.state) {
    app.state = ev.state;
    app.scene.applyState(ev.state);
    renderPlayerCards();
  }

  if (ev.type === 'GAME_OVER') {
    sfx.win();
    showGameOver(ev);
  }
}

// ------------------------------------------------------------------ HUD Rendering
function calcNetWorth(p) {
  if (p.net_worth !== undefined) return p.net_worth;
  let nw = p.money || 0;
  if (app.state && app.board) {
    app.state.tiles.forEach((ts, idx) => {
      if (ts.owner === p.id) {
        const t = app.board.tiles[idx];
        nw += (t.price || 0) + (ts.level || 0) * (t.build || 0);
      }
    });
  }
  return nw;
}

function cornerClass(rel, total) {
  if (rel === 0) return 'corner-br';
  if (total === 2) return 'corner-tl';
  if (total === 3) return rel === 1 ? 'corner-bl' : 'corner-tl';
  return ['corner-br', 'corner-bl', 'corner-tl', 'corner-tr'][rel % 4];
}

function renderPlayerCards() {
  if (!app.state) return;
  const wrap = $('#player-cards');
  const turnPid = app.state.turn_player;
  const players = app.state.players;
  const me = players.find(p => p.id === app.user?.id);
  $('#btn-resume-control').classList.toggle('hidden', !(me && me.is_ai_controlled && !app.state.finished));

  const myIdx = Math.max(0, players.findIndex(p => p.id === app.user?.id));
  const total = players.length;

  wrap.innerHTML = players.map((p, idx) => {
    const rel = (idx - myIdx + total) % total;
    const corner = cornerClass(rel, total);
    const active = p.id === turnPid && !app.state.finished;
    const isMe = p.id === app.user?.id;
    const avaUrl = renderAvatarDataURL(p.look || 0, p.color, p.is_bot);
    const netWorth = calcNetWorth(p);
    let badges = '';
    if (isMe) badges += `<span class="badge" style="background:#dbeafe;color:#1d4ed8">BẠN</span>`;
    else if (p.is_bot) badges += `<span class="badge bot">BOT ${DIFF_LABEL[p.difficulty]}</span>`;
    if (p.is_ai_controlled && !p.is_bot) badges += `<span class="badge auto">AUTO</span>`;
    if (!p.connected && !p.is_bot) badges += `<span class="badge off">Offline</span>`;
    if (p.in_jail) badges += `<span class="badge">🏝️ ${p.jail_turns}/3</span>`;

    return `
      <div class="pill-asset ${corner} ${active ? 'active-turn' : ''} ${p.bankrupt ? 'bankrupt' : ''}" style="border-color:${active ? '#fbbf24' : p.color}">
        ${p.bankrupt ? '<div class="pill-bankrupt-stamp">PHÁ SẢN</div>' : ''}
        <div class="pill-ava-col">
          <span class="pill-order">#${idx + 1}</span>
          <div class="pill-ava-ring"><img class="ava-img" src="${avaUrl}" alt="" /></div>
          <div class="pill-name" style="background:${p.color}">${escapeHtml(p.name)}</div>
        </div>
        <div class="pill-body">
          <div class="pill-money-line">
            ${COIN_SVG}
            <span class="pill-label">Tiền:</span>
            <div class="pill-money">${p.bankrupt ? '0K' : formatMoney(p.money)}</div>
          </div>
          <div class="pill-net-line">
            <span>🏛️</span>
            <span class="pill-label">Tổng TS:</span>
            <span class="pill-net">${p.bankrupt ? '0K' : formatMoney(netWorth)}</span>
          </div>
          <div class="pill-meta-line">
            ${badges}
            ${p.angel ? '<span title="Phiếu giảm giá">😇</span>' : ''}
            ${p.jail_free ? '<span title="Đường về nhà">🪪</span>' : ''}
            ${p.wt_target !== null ? '<span title="Vé Du Lịch">✈️</span>' : ''}
          </div>
        </div>
        <div class="pill-timer"><div class="pill-timer-fill" data-pid="${p.id}"></div></div>
      </div>
    `;
  }).join('');
}

setInterval(() => {
  if (!app.state || app.state.finished) return;
  const nowServer = Date.now() / 1000 + app.serverOffset;
  if (app.deadline) {
    const turnPid = app.state.turn_player;
    const pct = Math.min(100, (Math.max(0, app.deadline - nowServer) / app.turnSeconds) * 100);
    $$('.pill-timer-fill').forEach(el => { el.style.width = el.dataset.pid === turnPid ? `${pct}%` : '0%'; });
  }
  if (app.matchDeadline) {
    const rem = Math.max(0, Math.floor(app.matchDeadline - nowServer));
    const mm = String(Math.floor(rem / 60)).padStart(2, '0');
    const ss = String(rem % 60).padStart(2, '0');
    const txt = `${mm}:${ss}`;
    $('#match-timer').textContent = `⏱️ ${txt}`;
    app.scene.setTimerText(txt);
  }
}, 200);

function renderTurnUI() {
  const bar = $('#action-bar');
  const dm = $('#decision-modal');
  bar.classList.add('hidden');
  dm.classList.add('hidden');
  app.scene.clearSelectableTiles();

  if (!app.state || app.state.finished) return;
  const pend = app.state.pending;
  if (!pend) return;

  const actor = app.state.players.find(p => p.id === pend.player_id);
  const isMyTurn = pend.player_id === app.user?.id && !actor?.is_ai_controlled;

  if (!isMyTurn) {
    bar.innerHTML = `<div class="wait-chip">⏳ Đang chờ <b>${escapeHtml(actor?.name || '...')}</b>...</div>`;
    bar.classList.remove('hidden');
    return;
  }

  // ---- 1. LƯỢT ĐỔ XÚC XẮC ----
  if (pend.kind === 'ROLL') {
    let html = '';
    if (pend.world_tour_target !== null && pend.world_tour_target !== undefined) {
      const targetName = app.board.tiles[pend.world_tour_target].name;
      html = `<div class="roll-btn-row"><button class="btn-roll-bt" id="act-roll">✈️ BAY TỚI ${escapeHtml(targetName.toUpperCase())}</button></div>`;
    } else {
      const extraBtns = [];
      if (pend.in_jail) {
        if (pend.can_use_jail_card) extraBtns.push(`<button class="btn-pill-sub" id="act-roll-card">🪪 Thoát Đảo Miễn Phí</button>`);
        extraBtns.push(`<button class="btn-pill-sub" id="act-roll-fine" ${pend.can_pay_fine ? '' : 'disabled'}>💸 Trả 200K Ra Đảo</button>`);
      }
      html = `
        <div class="roll-btn-row">
          ${extraBtns.join('')}
          <button class="btn-roll-bt" id="act-roll">${pend.in_jail ? '🎲 TUNG ĐÔI' : 'ĐỔ XÚC XẮC'}</button>
        </div>
      `;
    }
    bar.innerHTML = html;
    bar.classList.remove('hidden');
    if ($('#act-roll')) {
      gsap.fromTo('#act-roll', { scale: 0.85 }, { scale: 1, duration: 0.25, ease: 'back.out(1.7)' });
      $('#act-roll').onclick = () => {
        sfx.click();
        send({ action: 'ROLL_DICE', pay_jail_fine: false });
      };
    }
    if ($('#act-roll-fine')) $('#act-roll-fine').onclick = () => { sfx.click(); send({ action: 'ROLL_DICE', pay_jail_fine: true }); };
    if ($('#act-roll-card')) $('#act-roll-card').onclick = () => { sfx.click(); send({ action: 'ROLL_DICE', pay_jail_fine: false, use_jail_card: true }); };
    return;
  }

  // ---- 2. MUA ĐẤT / XÂY NHÀ / KHÁCH SẠN / KHU NGHỈ MÁT (Chuẩn GDD trang 35-36) ----
  if (pend.kind === 'BUY' || pend.kind === 'BUILD') {
    const t = app.board.tiles[pend.tile];
    const isBuy = pend.kind === 'BUY';
    const bandCol = t.type === 'RESORT' ? '#0ea5e9' : (GROUP_COLORS[t.group] || '#2591da');

    if (t.type === 'RESORT') {
      const cost = pend.costs[0];
      const afford = actor.money >= cost;
      dm.innerHTML = `
        <div class="dm-ribbon-head" style="background:${bandCol}">
          ${escapeHtml(t.name)}
          <button class="dm-close-x" id="act-skip">✕</button>
        </div>
        <div class="dm-body">
          <div class="resort-split">
            <div class="resort-preview-box">
              <span style="font-size:58px;">🏖️</span>
              <span style="font-weight:900;font-size:13px;color:#0284c7;">KHU NGHỈ MÁT</span>
            </div>
            <div class="resort-tier-list">
              <div style="font-size:12px;font-weight:800;color:#475569;">Tiền thuê tùy theo số khu nghỉ mát sở hữu:</div>
              ${[1, 2, 3, 4].map(n => `<div class="resort-tier-row"><span>✓ ${n} Khu nghỉ mát</span><b>${formatMoney(25 * Math.pow(2, n - 1))}</b></div>`).join('')}
            </div>
          </div>
          <div class="dm-rent-line">Giá thuê hiện tại: <b>${formatMoney(pend.rents[0])}</b></div>
          <button class="btn btn-sky btn-lg" id="act-buy-resort" ${afford ? '' : 'disabled'}>MUA VỚI GIÁ ${formatMoney(cost)}</button>
          <div class="dm-buyout-note">Khu nghỉ mát không thể bị mua lại</div>
        </div>
      `;
      dm.classList.remove('hidden');
      $('#act-buy-resort').onclick = () => { sfx.click(); send({ action: 'BUY_OR_BUILD', tile_idx: pend.tile, target_level: 0 }); };
      $('#act-skip').onclick = () => { sfx.click(); send({ action: 'SKIP' }); };
      return;
    }

    // Lên Khách sạn (khi đã có sẵn 3 nhà từ lượt trước) — GDD trang 35 phải
    if (!isBuy && pend.current_level === 3 && pend.max_level === 4) {
      const cost = pend.costs[4];
      const rent = pend.rents[4];
      const afford = actor.money >= cost;
      dm.innerHTML = `
        <div class="dm-ribbon-head" style="background:${bandCol}">
          ${escapeHtml(t.name)}
          <button class="dm-close-x" id="act-skip">✕</button>
        </div>
        <div class="dm-body">
          <div class="hotel-showcase">
            ${houseThumbSVG(4)}
            <div class="hotel-pink-banner">KHÁCH SẠN</div>
          </div>
          <div class="dm-rent-line">Giá thuê: <b>${formatMoney(rent)}</b></div>
          <button class="btn btn-sky btn-lg" id="act-buy-hotel" ${afford ? '' : 'disabled'}>XÂY KHÁCH SẠN VỚI GIÁ ${formatMoney(cost)}</button>
          <div class="dm-buyout-note">Khách sạn là cấp tối đa và không thể bị đối thủ mua lại</div>
        </div>
      `;
      dm.classList.remove('hidden');
      $('#act-buy-hotel').onclick = () => { sfx.click(); send({ action: 'BUY_OR_BUILD', tile_idx: pend.tile, target_level: 4 }); };
      $('#act-skip').onclick = () => { sfx.click(); send({ action: 'SKIP' }); };
      return;
    }

    // 4 thẻ cột Đất / Nhà 1 / Nhà 2 / Nhà 3 — GDD trang 35 trái + Luật xây theo vòng
    const lo = isBuy ? 0 : pend.current_level + 1;
    let selectedLv = Math.min(pend.max_level, lo);
    for (let lv = pend.max_level; lv >= lo; lv--) {
      if (actor.money >= pend.costs[lv]) { selectedLv = lv; break; }
    }

    const renderPropModal = () => {
      const cost = pend.costs[selectedLv];
      const rent = pend.rents[selectedLv];
      const buyoutPrice = 2 * (t.price + selectedLv * t.build);
      const afford = actor.money >= cost;

      const cardsHtml = [0, 1, 2, 3].map(lv => {
        const lockedByLap = lv > pend.max_level;
        const alreadyBuilt = !isBuy && lv <= pend.current_level;
        const cantClick = lockedByLap || alreadyBuilt || actor.money < (pend.costs[lv] ?? 1e9);
        const lockText = lv === 2 ? 'Sau Vòng 2' : (lv === 3 ? 'Sau Vòng 3' : '');
        return `
          <button class="prop-col-card ${lv === selectedLv ? 'selected' : ''} ${cantClick ? 'locked' : ''}" data-lv="${lv}" ${cantClick ? 'disabled' : ''}>
            <div class="prop-col-img">${houseThumbSVG(lv, actor.color)}</div>
            <div class="prop-col-foot">
              <span>${LEVEL_NAMES[lv]}</span>
              <span class="prop-check">${lv === selectedLv || alreadyBuilt ? '✓' : ''}</span>
            </div>
            ${lockedByLap ? `<div class="prop-lock-note">🔒 ${lockText}</div>` : (alreadyBuilt ? '<div class="prop-lock-note">Đã có</div>' : `<div class="prop-lock-note" style="color:#475569">${formatMoney(pend.costs[lv])}</div>`)}
          </button>
        `;
      }).join('');

      dm.innerHTML = `
        <div class="dm-ribbon-head" style="background:${bandCol}">
          ${escapeHtml(t.name)}
          <button class="dm-close-x" id="act-skip">✕</button>
        </div>
        <div class="dm-body">
          <div class="prop-grid-4">${cardsHtml}</div>
          <div class="dm-rent-line">Giá thuê: <b>${formatMoney(rent)}</b> • Tài sản bạn: ${formatMoney(actor.money)}</div>
          <button class="btn btn-sky btn-lg" id="act-confirm-build" ${afford ? '' : 'disabled'}>
            MUA VỚI GIÁ ${formatMoney(cost)}
          </button>
          <div class="dm-buyout-note">Những người chơi khác có thể mua lại bằng: <b>${formatMoney(buyoutPrice)}</b></div>
        </div>
      `;
      dm.classList.remove('hidden');
      dm.querySelectorAll('.prop-col-card:not(:disabled)').forEach(btn => {
        btn.onclick = () => {
          sfx.click();
          selectedLv = Number(btn.dataset.lv);
          renderPropModal();
        };
      });
      $('#act-confirm-build').onclick = () => { sfx.click(); send({ action: 'BUY_OR_BUILD', tile_idx: pend.tile, target_level: selectedLv }); };
      $('#act-skip').onclick = () => { sfx.click(); send({ action: 'SKIP' }); };
    };
    renderPropModal();
    return;
  }

  // ---- 3. MUA LẠI (BUYOUT) ----
  if (pend.kind === 'BUYOUT') {
    const t = app.board.tiles[pend.tile];
    const owner = app.state.players.find(p => p.id === pend.owner);
    const bandCol = GROUP_COLORS[t.group] || '#e11d48';
    dm.innerHTML = `
      <div class="dm-ribbon-head" style="background:${bandCol}">
        MUA LẠI: ${escapeHtml(t.name)}
        <button class="dm-close-x" id="act-skip">✕</button>
      </div>
      <div class="dm-body">
        <div class="dm-sub">Chủ sở hữu hiện tại: <b>${escapeHtml(owner?.name)}</b> (${LEVEL_NAMES[pend.level]})</div>
        <div class="dm-options">
          <button class="dm-opt" id="act-bo"><span>Mua lại quyền sở hữu</span><b>${formatMoney(pend.price)}</b></button>
          ${pend.can_upgrade ? `<button class="dm-opt" id="act-bo-up"><span>Mua lại &amp; Xây Khách sạn</span><b>${formatMoney(pend.price + pend.upgrade_cost)}</b></button>` : ''}
        </div>
        <div class="dm-footer"><button class="btn btn-soft btn-sm" id="act-skip-btn">Không mua</button></div>
      </div>
    `;
    dm.classList.remove('hidden');
    $('#act-bo').onclick = () => { sfx.click(); send({ action: 'BUYOUT_TILE', tile_idx: pend.tile, upgrade_after: false }); };
    if ($('#act-bo-up')) $('#act-bo-up').onclick = () => { sfx.click(); send({ action: 'BUYOUT_TILE', tile_idx: pend.tile, upgrade_after: true }); };
    $('#act-skip').onclick = $('#act-skip-btn').onclick = () => { sfx.click(); send({ action: 'SKIP' }); };
    return;
  }

  // ---- 4. CHỌN Ô TRÊN BÀN CỜ ----
  if (pend.kind === 'SELECT') {
    const chooseTile = (idx) => send({ action: 'SELECT_TARGET', purpose: pend.purpose, tile_idx: idx });
    app.scene.setSelectableTiles(pend.options, chooseTile);
    if (pend.can_skip) {
      bar.innerHTML = `<button class="btn btn-soft" id="act-skip">Bỏ qua lượt chọn</button>`;
      bar.classList.remove('hidden');
      $('#act-skip').onclick = () => { sfx.click(); send({ action: 'SKIP' }); };
    }
    dm.innerHTML = `
      <div class="dm-ribbon-head" style="background:#2591da">
        CHỌN Ô MỤC TIÊU
        ${pend.can_skip ? '<button class="dm-close-x" id="act-skip-dm">✕</button>' : ''}
      </div>
      <div class="dm-body">
        <div class="dm-sub">${escapeHtml(pend.prompt)} (bấm trực tiếp lên ô sáng trên bàn cờ hoặc danh sách)</div>
        <div class="dm-options">
          ${pend.options.map(i => {
            const t = app.board.tiles[i], ts = app.state.tiles[i];
            const tag = pend.purpose === 'CHAMPIONSHIP'
              ? (pend.wc_tile === null || pend.wc_tile === undefined || pend.wc_tile === i ? 'Miễn phí' : 'Phí chuyển 50K')
              : (pend.purpose === 'WORLD_TOUR' ? 'Vé bay 50K' : (ts.owner ? `Thuê ${formatMoney(ts.rent)}` : t.type));
            return `<button class="dm-opt pick-sel" data-idx="${i}"><span>#${i} ${escapeHtml(t.name)}</span><small class="muted">${tag}</small></button>`;
          }).join('')}
        </div>
      </div>
    `;
    dm.classList.remove('hidden');
    dm.querySelectorAll('.pick-sel').forEach(b => { b.onclick = () => { sfx.click(); chooseTile(Number(b.dataset.idx)); }; });
    if ($('#act-skip-dm')) $('#act-skip-dm').onclick = () => { sfx.click(); send({ action: 'SKIP' }); };
    return;
  }

  // ---- 5. THANH LÝ TÀI SẢN ----
  if (pend.kind === 'LIQUIDATE') {
    const need = pend.debt - actor.money;
    const chosen = new Set();
    const renderLiq = () => {
      const sum = Array.from(chosen).reduce((acc, idx) => acc + pend.options.find(o => o.tile === idx).value, 0);
      dm.innerHTML = `
        <div class="dm-ribbon-head" style="background:#e11d48">BÁN TÀI SẢN TRẢ NỢ</div>
        <div class="dm-body">
          <div class="dm-sub">Khoản nợ: <b>${formatMoney(pend.debt)}</b> • Đã chọn: <b style="color:#16a34a">${formatMoney(sum)}</b> / ${formatMoney(need)}</div>
          <div class="dm-options">
            ${pend.options.map(o => `<button class="dm-opt liq-opt ${chosen.has(o.tile) ? 'selected' : ''}" data-idx="${o.tile}"><span>${chosen.has(o.tile) ? '☑️' : '⬜'} ${escapeHtml(app.board.tiles[o.tile].name)}</span><b>+${formatMoney(o.value)}</b></button>`).join('')}
          </div>
          <div class="dm-footer"><button class="btn btn-pink" id="act-liq" ${sum >= need ? '' : 'disabled'}>Bán &amp; Trả Nợ</button></div>
        </div>
      `;
      dm.querySelectorAll('.liq-opt').forEach(b => {
        b.onclick = () => { const idx = Number(b.dataset.idx); if (chosen.has(idx)) chosen.delete(idx); else chosen.add(idx); renderLiq(); };
      });
      $('#act-liq').onclick = () => { sfx.click(); send({ action: 'LIQUIDATE_TILES', tile_indices: Array.from(chosen) }); };
    };
    dm.classList.remove('hidden');
    renderLiq();
  }
}

// ------------------------------------------------------------------ Modals
function openModal(html) {
  $('#modal-box').innerHTML = html;
  $('#modal-backdrop').classList.remove('hidden');
  const close = $('#modal-close');
  if (close) close.onclick = closeModal;
}
function closeModal() { $('#modal-backdrop').classList.add('hidden'); }
$('#modal-backdrop').onclick = (e) => { if (e.target === $('#modal-backdrop')) closeModal(); };

function openDeedModal(idx) {
  if (!app.board || !app.state) return;
  const t = app.board.tiles[idx], ts = app.state.tiles[idx];
  const owner = ts.owner ? app.state.players.find(p => p.id === ts.owner) : null;
  const col = t.group === 'RESORT' ? '#0ea5e9' : (GROUP_COLORS[t.group] || '#64748b');

  let body = `<p class="card-desc">Ô đặc biệt trên bàn cờ Business Tour 32 ô.</p>`;
  if (t.type === 'CITY') {
    body = `
      <div class="deed-color" style="background:${col}"></div>
      <p style="font-size:13.5px;margin:0 0 10px;">Chủ sở hữu: <b style="color:${owner ? owner.color : '#64748b'}">${owner ? escapeHtml(owner.name) : 'Chưa có chủ'}</b>
      ${ts.festival ? ` • <span style="color:#d97706">🎪 Lễ hội (x2 thuê)</span>` : ''}
      ${ts.champ > 1 ? ` • <span style="color:#db2777">🏆 World Cup (+${ts.champ - 1})</span>` : ''}
      ${ts.blackout > 0 ? ` • <span style="color:#ca8a04">⚡ Cúp điện (${ts.blackout} vòng)</span>` : ''}</p>
      <table class="table">
        <tr><th>Cấp công trình</th><th>Giá xây</th><th>Tiền thuê gốc</th></tr>
        ${K_LEVEL.map((k, lv) => `<tr style="${owner && ts.level === lv ? 'background:#fef3c7;font-weight:800;' : ''}"><td>${LEVEL_NAMES[lv]}</td><td>${formatMoney(lv === 0 ? t.price : t.build)}</td><td>${formatMoney(Math.floor(t.rent * k))}</td></tr>`).join('')}
      </table>
    `;
  } else if (t.type === 'RESORT') {
    body = `
      <div class="deed-color" style="background:#0ea5e9"></div>
      <p style="font-size:13.5px;margin:0 0 10px;">Chủ sở hữu: <b style="color:${owner ? owner.color : '#64748b'}">${owner ? escapeHtml(owner.name) : 'Chưa có chủ'}</b>
      ${ts.festival ? ` • <span style="color:#d97706">🎪 Lễ hội (x2 thuê)</span>` : ''} • Giá mua: <b>${formatMoney(t.price)}</b></p>
      <table class="table">
        <tr><th>Số Khu Nghỉ Mát</th><th>Tiền thuê</th></tr>
        ${[1, 2, 3, 4].map(n => `<tr><td>${n} Khu Nghỉ Mát</td><td>${formatMoney(25 * Math.pow(2, n - 1))}</td></tr>`).join('')}
      </table>
    `;
  }
  openModal(`<div class="modal-head"><h3>📜 #${idx} ${escapeHtml(t.name)}</h3><button class="bt-circle-btn sm danger" id="modal-close">✕</button></div>${body}`);
}

function showGameOver(ev) {
  const winName = app.board.win_types[ev.win_type] || ev.win_type;
  const isHost = app.room?.host_id === app.user?.id;
  const didIWin = ev.winner_id === app.user?.id;
  openModal(`
    <div class="gameover-banner" style="background:${didIWin ? 'linear-gradient(180deg, #f59e0b, #d97706)' : 'linear-gradient(180deg, #f43f5e, #d81b60)'}">
      ${didIWin ? '🏆 CHIẾN THẮNG!' : 'KẾT QUẢ TRẬN ĐẤU'}
    </div>
    <p style="font-size:14px;text-align:center;font-weight:700;margin:0 0 10px;">Điều kiện: <span style="color:#1a78c2">${escapeHtml(winName)}</span></p>
    <table class="table">
      <tr><th>#</th><th>Người chơi</th><th>Tiền mặt</th><th>Tổng tài sản</th></tr>
      ${ev.summary.map((s, i) => `<tr><td><b>${i + 1}</b></td><td style="color:${s.color};font-weight:800;">${escapeHtml(s.name)} ${s.is_bot ? '🤖' : ''}</td><td>${s.bankrupt ? 'Phá sản' : formatMoney(s.money)}</td><td><b>${formatMoney(s.net_worth)}</b></td></tr>`).join('')}
    </table>
    <div style="display:flex;justify-content:center;gap:10px;margin-top:16px;">
      ${isHost ? '<button class="btn btn-amber" id="go-again">🔄 CHƠI LẠI</button>' : ''}
      <button class="btn btn-sky btn-lg" id="go-lobby">HOÀN THÀNH</button>
    </div>
  `);
  if ($('#go-again')) $('#go-again').onclick = () => { closeModal(); send({ action: 'PLAY_AGAIN' }); };
  $('#go-lobby').onclick = () => { closeModal(); send({ action: 'LEAVE_ROOM' }); };
}

$('#btn-leaderboard').onclick = async () => {
  sfx.click();
  const load = async (mode) => {
    const res = await api(`/api/leaderboard?mode=${mode}`);
    openModal(`
      <div class="modal-head"><h3>🏆 Bảng Xếp Hạng</h3><button class="bt-circle-btn sm danger" id="modal-close">✕</button></div>
      <div class="seg-group" style="margin-bottom:12px;">
        <button class="seg ${mode === 'PVP' ? 'active' : ''}" id="lb-pvp">Đấu Trực Tuyến</button>
        <button class="seg ${mode === 'AI' ? 'active' : ''}" id="lb-ai">Đấu Với Máy</button>
      </div>
      ${res.rows.length ? `<table class="table"><tr><th>#</th><th>Người chơi</th><th>Thắng</th><th>Số trận</th></tr>${res.rows.map((r, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(r.name || 'Ẩn danh')}</td><td><b>${r.wins}</b></td><td>${r.games}</td></tr>`).join('')}</table>` : '<p class="card-desc">Chưa có dữ liệu trận đấu nào ở chế độ này.</p>'}
    `);
    $('#lb-pvp').onclick = () => load('PVP');
    $('#lb-ai').onclick = () => load('AI');
  };
  load('PVP').catch(e => toast(e.message, true));
};

$('#btn-history').onclick = async () => {
  sfx.click();
  try {
    const res = await api('/api/history');
    openModal(`
      <div class="modal-head"><h3>📜 Lịch Sử 20 Trận Gần Nhất</h3><button class="bt-circle-btn sm danger" id="modal-close">✕</button></div>
      ${res.rows.length ? `<table class="table"><tr><th>Chế độ</th><th>Kết quả</th><th>Kiểu thắng</th><th>Tài sản</th></tr>${res.rows.map(r => `<tr><td>${r.mode}</td><td>${r.won ? '<b style="color:#16a34a">Thắng 🏆</b>' : '<span class="muted">Thua</span>'}</td><td>${escapeHtml(r.win_type)}</td><td>${formatMoney(r.net_worth)}</td></tr>`).join('')}</table>` : '<p class="card-desc">Bạn chưa hoàn thành ván đấu nào.</p>'}
    `);
  } catch (e) { toast(e.message, true); }
};

function openRulesModal() {
  sfx.click();
  openModal(`
    <div class="modal-head"><h3>📖 Luật Business Tour 32 Ô</h3><button class="bt-circle-btn sm danger" id="modal-close">✕</button></div>
    <ul style="font-size:13.5px;line-height:1.65;padding-left:18px;margin:0;color:#334155;">
      <li><b>Khởi đầu:</b> 2,000K tại ô Bắt Đầu; mỗi lần qua ô 0 nhận +300K. Đầu trận chọn ngẫu nhiên 3 ô Lễ Hội (x2 tiền thuê suốt trận).</li>
      <li><b>Xây nhà theo vòng:</b> Vòng 1 &amp; 2 chỉ xây tối đa <b>1 nhà</b>; sau Vòng 2 xây tối đa <b>2 nhà</b>; sau Vòng 3 xây tối đa <b>3 nhà</b>. Chỉ lên <b>Khách sạn (Cấp 4)</b> khi đã có đủ 3 nhà từ trước.</li>
      <li><b>Hệ số thuê (tối đa x10):</b> Cộng +1 khi đủ bộ màu, +1 khi có Lễ Hội, cộng dồn Giải Đấu Thế Giới (chuyển giải sang thành phố khác mất 50K).</li>
      <li><b>Khu Nghỉ Mát (Bali, Síp, Dubai, Nice — 200K):</b> Không thể mua lại; tiền thuê 25K / 50K / 100K / 200K.</li>
      <li><b>Ô Đặc Biệt:</b> Thuế trừ 10% Tổng tài sản; 3 ô Cơ Hội; Du Lịch Thế Giới mất 50K đặt vé bay tới ô bất kỳ.</li>
      <li><b>Chiến thắng:</b> Độc quyền 1 cạnh • Đủ 4 Khu Nghỉ Mát • Độc quyền 3 màu • Phá sản hết đối thủ • Hoặc Tổng tài sản cao nhất khi hết 30 phút.</li>
    </ul>
  `);
}
$('#btn-rules').onclick = openRulesModal;
$('#btn-rules-lobby').onclick = openRulesModal;
$('#btn-char-rules').onclick = openRulesModal;

$('#btn-toggle-bgm').onclick = () => { sfx.unlock(); if (bgmOn()) stopBgm(); else startBgm(); $('#btn-toggle-bgm').style.opacity = bgmOn() ? '1' : '0.55'; };
const syncMuteBtn = () => { $('#btn-toggle-mute').textContent = isMuted() ? '🔇' : '🔊'; };
syncMuteBtn();
$('#btn-toggle-mute').onclick = () => { sfx.unlock(); setMuted(!isMuted()); syncMuteBtn(); };
$('#btn-resume-control').onclick = () => { sfx.click(); send({ action: 'RESUME_CONTROL' }); };
const exitMatchFn = () => {
  if (confirm('Bạn muốn rời khỏi trận đấu hiện tại?')) send({ action: 'LEAVE_ROOM' });
};
$('#btn-exit-match').onclick = exitMatchFn;
$('#btn-exit-match-2').onclick = exitMatchFn;

window.__btPreview = {
  chance: (card = 'ANGEL') => showChanceCardModal(card, app.user?.name || 'Người chơi'),
  worldcup: () => showWorldCupCelebration(app.user?.name || 'Người chơi'),
};

initAuth();
