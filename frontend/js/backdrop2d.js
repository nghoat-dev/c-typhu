// Nền bầu trời Business Tour sáng trong trẻo: gradient chéo mượt từ góc trên-phải (#6ba3df)
// sang góc dưới-trái (#d4e8f9), kèm các ô vuông bo góc trong suốt trôi nhẹ ở hai góc dưới.
import { mulberry32 } from './prng.js';

export const BACKDROP_THEMES = [
  { key: 'daylight', name: 'Business Tour Isometric', icon: '☀️' },
];

export class Backdrop2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.off = document.createElement('canvas');
    this.offCtx = this.off.getContext('2d');
    this.seed = 2026;
    this.w = 1280;
    this.h = 720;
    this.dpr = 1;
    this.squares = [];
    this.staticDirty = true;

    this._initParticles();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.off.width = this.canvas.width;
    this.off.height = this.canvas.height;
    this.staticDirty = true;
  }

  getTheme() {
    return BACKDROP_THEMES[0];
  }

  setThemeBySeed(seed) {
    this.seed = (seed || 2026) >>> 0;
    this._initParticles();
    this.staticDirty = true;
    return this.getTheme();
  }

  _initParticles() {
    const rng = mulberry32(this.seed ^ 0x4E19);
    // Ô vuông bo góc trong suốt nhẹ ở hai góc dưới trái và dưới phải (opacity 0.15 - 0.25)
    this.squares = Array.from({ length: 18 }, (_, i) => {
      const left = i % 2 === 0;
      return {
        x: left ? rng.range(0.02, 0.28) : rng.range(0.72, 0.98),
        y: rng.range(0.68, 0.96),
        sz: rng.range(20, 44),
        rot: rng.range(-0.4, 0.4),
        vRot: rng.range(-0.1, 0.1),
        sp: rng.range(0.35, 0.75),
        ph: rng.range(0, Math.PI * 2),
        alpha: rng.range(0.15, 0.25),
      };
    });
  }

  _buildStatic() {
    this.staticDirty = false;
    const g = this.offCtx;
    const W = this.w, H = this.h;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, W, H);

    // Gradient chéo mượt từ góc trên-phải (#6ba3df) xuống góc dưới-trái (#d4e8f9)
    const sky = g.createLinearGradient(W, 0, 0, H);
    sky.addColorStop(0, '#6ba3df');
    sky.addColorStop(0.5, '#a4cbf0');
    sky.addColorStop(1, '#d4e8f9');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
  }

  _loop(now) {
    requestAnimationFrame(this._loop);
    if (this.staticDirty) this._buildStatic();
    const t = now * 0.001;
    const g = this.ctx;
    const W = this.w, H = this.h;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.drawImage(this.off, 0, 0, W, H);

    for (const q of this.squares) {
      const px = q.x * W + Math.sin(t * q.sp + q.ph) * 10;
      const py = q.y * H + Math.cos(t * q.sp * 0.8 + q.ph) * 8;
      g.save();
      g.translate(px, py);
      g.rotate(q.rot + Math.sin(t * 0.4 + q.ph) * q.vRot);
      g.fillStyle = `rgba(255, 255, 255, ${(q.alpha * 0.22).toFixed(3)})`;
      g.strokeStyle = `rgba(255, 255, 255, ${q.alpha.toFixed(3)})`;
      g.lineWidth = 1.5;
      g.beginPath();
      g.roundRect(-q.sz / 2, -q.sz / 2, q.sz, q.sz, 6);
      g.fill();
      g.stroke();
      g.restore();
    }
  }
}
