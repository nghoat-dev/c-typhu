// Âm thanh tổng hợp bằng WebAudio (không cần file) — xúc xắc, bước chân, xây nhà, tiền, chiến thắng.
let ctx = null;
let master = null;
let muted = localStorage.getItem('bt_muted') === '1';
let bgmNodes = null;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, { type = 'sine', vol = 0.3, delay = 0, slide = 0, attack = 0.005 } = {}) {
  const c = ensure(); if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

function noise(dur, { vol = 0.3, delay = 0, freq = 2000, q = 1 } = {}) {
  const c = ensure(); if (!c) return;
  const t0 = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0);
}

export const sfx = {
  unlock() { ensure(); },
  dice(strength = 1) { noise(0.06, { vol: 0.25 * strength, freq: 2500 + Math.random() * 1500, q: 3 }); tone(900 + Math.random() * 400, 0.04, { type: 'square', vol: 0.04 * strength }); },
  shake() { for (let i = 0; i < 4; i++) noise(0.05, { vol: 0.12, delay: i * 0.05, freq: 3000, q: 2 }); },
  step() { tone(220 + Math.random() * 40, 0.07, { type: 'triangle', vol: 0.12, slide: -80 }); },
  coin() { tone(988, 0.08, { type: 'square', vol: 0.08 }); tone(1319, 0.25, { type: 'square', vol: 0.08, delay: 0.07 }); },
  pay() { tone(330, 0.15, { type: 'sawtooth', vol: 0.06, slide: -120 }); tone(220, 0.2, { type: 'sawtooth', vol: 0.05, delay: 0.1, slide: -60 }); },
  build() { noise(0.15, { vol: 0.3, freq: 300, q: 0.7 }); tone(523, 0.12, { vol: 0.15, delay: 0.1 }); tone(659, 0.12, { vol: 0.15, delay: 0.18 }); tone(784, 0.25, { vol: 0.15, delay: 0.26 }); },
  card() { noise(0.25, { vol: 0.15, freq: 1200, q: 0.5 }); tone(660, 0.3, { vol: 0.08, delay: 0.1, slide: 300 }); },
  cardDraw() { noise(0.14, { vol: 0.16, freq: 1800, q: 1.2 }); tone(440, 0.16, { type: 'triangle', vol: 0.09, slide: 180 }); },
  cardFlip() { [587, 740, 880, 1175].forEach((f, i) => tone(f, 0.18, { type: 'sine', vol: 0.09, delay: i * 0.045 })); },
  worldCup() {
    [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((f, i) =>
      tone(f, i === 5 ? 0.55 : 0.18, { type: 'triangle', vol: 0.14, delay: i * 0.11 }));
    noise(0.8, { vol: 0.12, delay: 0.15, freq: 1400, q: 0.6 });
  },
  turn() { tone(784, 0.1, { vol: 0.1 }); tone(1046, 0.18, { vol: 0.1, delay: 0.08 }); },
  jail() { tone(196, 0.5, { type: 'sawtooth', vol: 0.08, slide: -80 }); tone(147, 0.6, { type: 'sawtooth', vol: 0.06, delay: 0.2, slide: -50 }); },
  fly() { noise(1.2, { vol: 0.1, freq: 600, q: 0.4 }); tone(300, 1.2, { vol: 0.04, slide: 400 }); },
  alert() { for (let i = 0; i < 3; i++) tone(880, 0.12, { type: 'square', vol: 0.06, delay: i * 0.2 }); },
  quake() { noise(0.9, { vol: 0.4, freq: 120, q: 0.5 }); },
  zap() { tone(1200, 0.3, { type: 'sawtooth', vol: 0.07, slide: -1100 }); },
  win() { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.15, delay: i * 0.14 })); },
  lose() { [392, 349, 311, 262].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.12, delay: i * 0.22 })); },
  click() { tone(1200, 0.03, { type: 'square', vol: 0.04 }); },
  pop() { tone(600, 0.08, { vol: 0.1, slide: 500 }); },
};

export function isMuted() { return muted; }
export function setMuted(m) {
  muted = m;
  localStorage.setItem('bt_muted', m ? '1' : '0');
  if (master) master.gain.value = m ? 0 : 0.5;
}

// Nhạc nền nhẹ (arpeggio sinh tự động)
export function startBgm() {
  const c = ensure(); if (!c || bgmNodes) return;
  const g = c.createGain(); g.gain.value = 0.05; g.connect(master);
  const chords = [[261.6, 329.6, 392], [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7]];
  let step = 0;
  const timer = setInterval(() => {
    if (c.state !== 'running') return;
    const ch = chords[Math.floor(step / 8) % chords.length];
    const f = ch[step % 3] * (step % 8 >= 4 ? 2 : 1);
    const t0 = c.currentTime;
    const o = c.createOscillator(); const e = c.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    e.gain.setValueAtTime(0.0001, t0); e.gain.exponentialRampToValueAtTime(0.5, t0 + 0.02); e.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
    o.connect(e); e.connect(g); o.start(t0); o.stop(t0 + 0.55);
    step++;
  }, 260);
  bgmNodes = { g, timer };
}
export function stopBgm() {
  if (!bgmNodes) return;
  clearInterval(bgmNodes.timer); bgmNodes.g.disconnect(); bgmNodes = null;
}
export function bgmOn() { return !!bgmNodes; }
