import { animations } from "@/game/config";

export class ParticleSystem {
  constructor() {
    this.items = [];
  }

  spawn(p) {
    if (!animations.animationsEnabled || this.items.length >= animations.particleCap) return;
    this.items.push({ life: 0, gravity: 0, size: 3, alpha: 1, ...p });
  }

  burst(x, y, n, { color, speed = 3, maxLife = 0.35, size = 3, gravity = 0, spread = Math.PI * 2, angle = 0 }) {
    for (let i = 0; i < n; i++) {
      const a = angle + (spread * i) / n + (Math.random() - 0.5) * (spread / n);
      const s = speed * (0.6 + Math.random() * 0.6);
      this.spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, maxLife, color, size, gravity });
    }
  }

  update(dt) {
    const keep = [];
    for (const p of this.items) {
      p.life += dt;
      if (p.life >= p.maxLife) continue;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      keep.push(p);
    }
    this.items = keep;
  }

  draw(ctx, toPx, ts) {
    for (const p of this.items) {
      const t = p.life / p.maxLife;
      const { x, y } = toPx(p.x, p.y);
      ctx.globalAlpha = (1 - t) * p.alpha;
      ctx.fillStyle = p.color;
      const r = (p.size * (1 - t * 0.5) * ts) / 22.5;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
