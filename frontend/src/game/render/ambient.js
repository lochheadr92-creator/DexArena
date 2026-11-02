import { animations } from "@/game/config";

const CFG = animations.ambient;
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);

export class Ambient {
  constructor() {
    this.items = [];
    this.count = 0;
    this.terrainId = null;
    this.waterTiles = [];
  }

  configure(count) {
    this.count = count;
    if (!count) this.items = [];
    else if (this.items.length > count) this.items.length = count;
  }

  reset(state) {
    this.terrainId = state.terrain.id;
    this.items = [];
    this.waterTiles = [];
    state.terrain.tiles.forEach((row, r) => row.forEach((t, c) => t === "water" && this.waterTiles.push({ c, r })));
  }

  kindFor(state) {
    const cfg = CFG[state.terrain.id];
    if (!cfg) return null;
    return cfg.kind === "glint" && !this.waterTiles.length ? { ...cfg, kind: "motes" } : cfg;
  }

  make(kind, cols, rows, initial) {
    switch (kind) {
      case "snow":
        return { x: rnd(-1, cols + 1), y: initial ? rnd(0, rows) : -0.5, vx: rnd(0.2, 0.6), vy: rnd(0.9, 1.8), size: rnd(1.2, 2.6), phase: rnd(0, TAU), life: 0, maxLife: 99 };
      case "pollen":
        return { x: rnd(0, cols), y: initial ? rnd(0, rows) : rows + 0.5, vx: rnd(-0.2, 0.2), vy: rnd(-0.7, -0.3), size: rnd(0.9, 1.8), phase: rnd(0, TAU), life: 0, maxLife: 99 };
      case "motes":
        return { x: rnd(0, cols), y: rnd(0, rows), vx: rnd(-0.15, 0.15), vy: rnd(-0.12, 0.12), size: rnd(0.8, 1.5), phase: rnd(0, TAU), life: 0, maxLife: rnd(4, 9) };
      case "glint": {
        const t = this.waterTiles[Math.floor(Math.random() * this.waterTiles.length)];
        return { x: t.c + Math.random(), y: t.r + Math.random(), vx: 0, vy: 0, size: rnd(0.9, 1.8), phase: rnd(0, TAU), life: initial ? rnd(0, 1) : 0, maxLife: rnd(0.9, 1.8) };
      }
      default:
        return null;
    }
  }

  update(dt, state) {
    if (!this.count) return;
    if (this.terrainId !== state.terrain.id) this.reset(state);
    const cfg = this.kindFor(state);
    if (!cfg) return;
    const { cols, rows } = state.terrain;
    this.kind = cfg.kind;
    this.color = cfg.color;
    const target = cfg.kind === "glint" ? Math.ceil(this.count * 0.35) : this.count;
    while (this.items.length < target) this.items.push(this.make(cfg.kind, cols, rows, true));
    if (this.items.length > target) this.items.length = target;
    for (let i = 0; i < this.items.length; i++) {
      const p = this.items[i];
      p.life += dt;
      p.x += (p.vx + (cfg.kind === "snow" || cfg.kind === "pollen" ? Math.sin(p.life * 1.3 + p.phase) * 0.35 : 0)) * dt;
      p.y += p.vy * dt;
      const out = p.y > rows + 0.6 || p.y < -0.6 || p.x < -1.2 || p.x > cols + 1.2 || p.life >= p.maxLife;
      if (out) this.items[i] = this.make(cfg.kind, cols, rows, false);
    }
  }

  draw(ctx, r) {
    if (!this.count || !this.items.length) return;
    const scale = r.scalePx();
    ctx.save();
    if (this.kind === "pollen" || this.kind === "glint") ctx.globalCompositeOperation = "lighter";
    for (const p of this.items) {
      const { x, y } = r.toPx(p.x, p.y);
      const s = p.size * scale;
      if (this.kind === "snow") {
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = this.color;
        ctx.strokeStyle = "rgba(3,105,161,0.7)";
        ctx.lineWidth = Math.max(1, scale * 1.2);
        ctx.beginPath();
        ctx.arc(x, y, s, 0, TAU);
        ctx.fill();
        ctx.stroke();
      } else if (this.kind === "pollen") {
        ctx.globalAlpha = 0.45 + 0.35 * Math.sin(p.life * 3 + p.phase);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(x, y, s, 0, TAU);
        ctx.fill();
      } else if (this.kind === "motes") {
        ctx.globalAlpha = 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(p.life * 2 + p.phase));
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(x, y, s, 0, TAU);
        ctx.fill();
      } else {
        const k = Math.sin(Math.min(1, p.life / p.maxLife) * Math.PI);
        const len = s * (1.2 + k * 1.6);
        ctx.globalAlpha = 0.7 * k;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = Math.max(0.8, scale);
        ctx.beginPath();
        ctx.moveTo(x - len, y);
        ctx.lineTo(x + len, y);
        ctx.moveTo(x, y - len * 0.6);
        ctx.lineTo(x, y + len * 0.6);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
