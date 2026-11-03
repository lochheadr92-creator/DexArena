import { abilities as CFG } from "@/game/config";

const TAU = Math.PI * 2;
const clamp = (t) => Math.min(1, Math.max(0, t));
const rnd = (a, b) => a + Math.random() * (b - a);
const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const additive = (r, ctx) => {
  if (r.gfx?.additive) ctx.globalCompositeOperation = "lighter";
};

export const ABILITY_DRAWERS = {
  shockwave(r, ctx, e, p) {
    const g = r.toPx(e.x, e.y);
    const rad = r.px(e.radiusTiles || 3) * Math.sqrt(p);
    ctx.save();
    additive(r, ctx);
    for (let i = 0; i < 3; i++) {
      const q = clamp(p - i * 0.12);
      if (q <= 0) continue;
      const rr = rad * (1 - i * 0.18);
      ctx.globalAlpha = (1 - q) * (0.9 - i * 0.25);
      ctx.strokeStyle = i === 1 ? "#ffffff" : e.color;
      ctx.lineWidth = (5 - i) * r.scalePx() * (1 - q * 0.5);
      ctx.beginPath();
      ctx.ellipse(g.x, g.y, rr, rr * 0.55, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  },
  arrows(r, ctx, e, p) {
    if (!e.items) e.items = Array.from({ length: e.count || 5 }, (_, i) => ({ ox: (i - (e.count || 5) / 2 + 0.5) * 0.45, delay: i * 0.08, w: rnd(0.22, 0.3) }));
    const g = r.toPx(e.x, e.y - 0.6);
    ctx.save();
    additive(r, ctx);
    ctx.fillStyle = e.color;
    for (const a of e.items) {
      const q = clamp((p - a.delay) / 0.7);
      if (q <= 0) continue;
      const dir = e.dir || -1;
      const y = g.y + dir * r.px(1.6) * q;
      const x = g.x + r.px(a.ox);
      const w = r.px(a.w);
      ctx.globalAlpha = Math.sin(q * Math.PI) * 0.95;
      ctx.beginPath();
      ctx.moveTo(x, y + dir * w * 1.1);
      ctx.lineTo(x - w, y - dir * w * 0.2);
      ctx.lineTo(x - w * 0.4, y - dir * w * 0.2);
      ctx.lineTo(x - w * 0.4, y - dir * w * 1.1);
      ctx.lineTo(x + w * 0.4, y - dir * w * 1.1);
      ctx.lineTo(x + w * 0.4, y - dir * w * 0.2);
      ctx.lineTo(x + w, y - dir * w * 0.2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  },
  hexflash(r, ctx, e, p, state) {
    const u = e.fromId ? r.findUnit(state, e.fromId) : null;
    const pos = u && u.state !== "bench" && u.state !== "fainted" ? { x: u.pos.x, y: u.pos.y } : { x: e.fx, y: e.fy };
    const g = r.toPx(pos.x, pos.y - 0.5);
    const rad = r.px(1.1) * (0.8 + p * 0.3);
    ctx.save();
    additive(r, ctx);
    ctx.globalAlpha = (1 - p) * 0.9;
    ctx.strokeStyle = e.color;
    ctx.lineWidth = 2.5 * r.scalePx();
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU - Math.PI / 6;
      const x = g.x + Math.cos(a) * rad;
      const y = g.y + Math.sin(a) * rad * 0.9;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    const glow = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, rad);
    glow.addColorStop(0, rgba(e.color, 0.35 * (1 - p)));
    glow.addColorStop(1, rgba(e.color, 0));
    ctx.fillStyle = glow;
    ctx.fill();
    ctx.restore();
  },
  glyph(r, ctx, e, p) {
    const g = r.toPx(e.x, e.y - 2.2);
    ctx.save();
    ctx.globalAlpha = Math.sin(p * Math.PI);
    ctx.fillStyle = e.color;
    ctx.font = `700 ${Math.round(13 * r.scalePx())}px 'Chakra Petch', sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(e.text, g.x + r.px(0.6), g.y - r.px(p * 0.8));
    ctx.restore();
  },
};

export function drawTrapRing(r, ctx, x, y, color, now) {
  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 * r.scalePx();
  ctx.setLineDash([r.px(0.22), r.px(0.16)]);
  ctx.lineDashOffset = (now / 40) % 100;
  ctx.beginPath();
  ctx.ellipse(x, y + r.px(0.25), r.px(0.95), r.px(0.42), 0, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 6 * r.scalePx();
  ctx.stroke();
  ctx.restore();
}

export function drawHoverShadow(r, ctx, x, y, lift) {
  ctx.save();
  ctx.globalAlpha = 0.35 - lift * 0.1;
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.ellipse(x, y + r.px(0.3), r.px(0.55), r.px(0.22), 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function drawPassiveAura(r, ctx, x, y, color, now, soft = false) {
  const pulse = 0.5 + 0.5 * Math.sin(now / 260);
  const rad = r.px(1.15 + pulse * 0.15);
  ctx.save();
  additive(r, ctx);
  const cy = y - r.px(0.7);
  const glow = ctx.createRadialGradient(x, cy, r.px(0.2), x, cy, rad);
  glow.addColorStop(0, rgba(color, soft ? 0.18 : 0.42));
  glow.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, cy, rad, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export class WeatherFx {
  constructor() {
    this.kind = null;
    this.alpha = 0;
    this.target = 0;
    this.items = [];
    this.rays = Array.from({ length: 4 }, (_, i) => ({ a: -0.9 + i * 0.22, w: 0.08 + Math.random() * 0.08, speed: 0.08 + Math.random() * 0.06 }));
  }

  setTarget(kind, active) {
    if (kind !== this.kind) {
      this.kind = kind;
      this.items = [];
    }
    this.target = kind ? (active ? 1 : 0.3) : 0;
  }

  make(cols, rows, initial) {
    switch (this.kind) {
      case "rain":
        return { x: rnd(-2, cols + 2), y: initial ? rnd(-1, rows) : rnd(-3, -0.5), vx: -2.5, vy: rnd(16, 22), len: rnd(0.5, 1), w: rnd(0.6, 1.1) };
      case "hail":
        return { x: rnd(-1, cols + 1), y: initial ? rnd(-1, rows) : rnd(-2, -0.5), vx: rnd(-0.6, 0.6), vy: rnd(7, 10), size: rnd(1.4, 2.6), phase: rnd(0, TAU) };
      case "sand":
        return { x: initial ? rnd(-2, cols) : rnd(-4, -1), y: rnd(-0.5, rows + 0.5), vx: rnd(14, 22), vy: rnd(-0.8, 0.8), len: rnd(0.8, 1.8), w: rnd(0.6, 1.2), a: rnd(0.25, 0.6) };
      case "sun":
        return { x: rnd(0, cols), y: rnd(0, rows), vx: rnd(-0.1, 0.1), vy: rnd(-0.25, -0.08), size: rnd(0.8, 1.6), life: initial ? rnd(0, 2) : 0, maxLife: rnd(1.5, 3) };
      default:
        return null;
    }
  }

  update(dt, state, count) {
    const k = dt * 2.2;
    this.alpha += Math.sign(this.target - this.alpha) * Math.min(Math.abs(this.target - this.alpha), k);
    if (!this.kind || this.alpha <= 0.01) return;
    const { cols, rows } = state.terrain;
    const n = this.kind === "sun" ? Math.ceil(count * 0.5) : count;
    while (this.items.length < n) this.items.push(this.make(cols, rows, true));
    if (this.items.length > n) this.items.length = n;
    for (let i = 0; i < this.items.length; i++) {
      const p = this.items[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life != null) p.life += dt;
      const out = p.y > rows + 1 || p.x > cols + 3 || p.x < -4 || (p.maxLife && p.life >= p.maxLife);
      if (out) this.items[i] = this.make(cols, rows, false);
    }
  }

  draw(ctx, r, now) {
    if (!this.kind || this.alpha <= 0.01) return;
    const cfg = CFG.weather[this.kind];
    const scale = r.scalePx();
    ctx.save();
    ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
    const tint = this.kind === "rain" ? "rgba(30,64,175,0.16)" : this.kind === "sun" ? "rgba(251,191,36,0.13)" : this.kind === "sand" ? "rgba(161,98,7,0.2)" : "rgba(186,230,253,0.12)";
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, r.cssW, r.cssH);
    if (this.kind === "sun") {
      ctx.globalCompositeOperation = "lighter";
      for (const ray of this.rays) {
        const a = ray.a + Math.sin(now / 1000 * ray.speed) * 0.08;
        const len = Math.max(r.cssW, r.cssH) * 1.6;
        const x0 = r.cssW * 0.15;
        const grad = ctx.createLinearGradient(x0, 0, x0 + Math.cos(a + Math.PI / 2) * len, Math.sin(a + Math.PI / 2) * len);
        grad.addColorStop(0, "rgba(254,240,138,0.28)");
        grad.addColorStop(1, "rgba(254,240,138,0)");
        ctx.fillStyle = grad;
        ctx.globalAlpha = this.alpha * 0.8;
        ctx.beginPath();
        ctx.moveTo(x0, 0);
        ctx.lineTo(x0 + Math.cos(a + Math.PI / 2 - ray.w) * len, Math.sin(a + Math.PI / 2 - ray.w) * len);
        ctx.lineTo(x0 + Math.cos(a + Math.PI / 2 + ray.w) * len, Math.sin(a + Math.PI / 2 + ray.w) * len);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
    ctx.globalCompositeOperation = this.kind === "sand" ? "source-over" : "lighter";
    ctx.lineCap = "round";
    for (const p of this.items) {
      const { x, y } = r.toPx(p.x, p.y);
      if (this.kind === "rain") {
        ctx.globalAlpha = this.alpha * 0.55;
        ctx.strokeStyle = "#bfdbfe";
        ctx.lineWidth = p.w * scale;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - r.px(p.len) * 0.12, y - r.px(p.len));
        ctx.stroke();
      } else if (this.kind === "hail") {
        ctx.globalAlpha = this.alpha * 0.9;
        ctx.fillStyle = "#f0f9ff";
        ctx.strokeStyle = "rgba(14,116,144,0.6)";
        ctx.lineWidth = Math.max(1, scale);
        const s = p.size * scale;
        ctx.save();
        ctx.translate(x + Math.sin(now / 300 + p.phase) * 2, y);
        ctx.rotate(now / 400 + p.phase);
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.strokeRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      } else if (this.kind === "sand") {
        ctx.globalAlpha = this.alpha * p.a;
        ctx.strokeStyle = cfg.color;
        ctx.lineWidth = p.w * scale;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - r.px(p.len), y - r.px(p.len) * 0.05);
        ctx.stroke();
      } else {
        const k = Math.sin(Math.min(1, p.life / p.maxLife) * Math.PI);
        ctx.globalAlpha = this.alpha * 0.7 * k;
        ctx.fillStyle = "#fef08a";
        ctx.beginPath();
        ctx.arc(x, y, p.size * scale, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
