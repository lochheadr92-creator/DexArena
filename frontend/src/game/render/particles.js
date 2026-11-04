import { animations } from "@/game/config";

const TAU = Math.PI * 2;

const circle = (ctx, x, y, r) => {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.4, r), 0, TAU);
  ctx.fill();
};
const ellipse = (ctx, x, y, rx, ry) => {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.4, rx), Math.max(0.4, ry), 0, 0, TAU);
  ctx.fill();
};
const line = (ctx, x0, y0, x1, y1) => {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
};

const SHAPES = {
  dot(ctx, p, x, y, r) {
    ctx.fillStyle = p.color;
    circle(ctx, x, y, r);
  },
  ember(ctx, p, x, y, r) {
    ctx.fillStyle = p.color;
    ctx.globalAlpha *= 0.55;
    circle(ctx, x, y, r * 1.7);
    ctx.globalAlpha /= 0.55;
    ctx.fillStyle = p.color2 || "#fde047";
    circle(ctx, x, y, r * 0.8);
  },
  drop(ctx, p, x, y, r) {
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(p.vy, p.vx));
    ctx.fillStyle = p.color;
    ellipse(ctx, 0, 0, r * 1.6, r * 0.8);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    circle(ctx, -r * 0.3, -r * 0.25, r * 0.3);
  },
  spark(ctx, p, x, y, r) {
    const len = r * 2.2 + Math.min(14, Math.hypot(p.vx, p.vy) * 1.2);
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(p.vy, p.vx));
    ctx.lineCap = "round";
    ctx.strokeStyle = p.color;
    ctx.lineWidth = Math.max(0.8, r * 0.9);
    line(ctx, -len / 2, 0, len / 2, 0);
    ctx.strokeStyle = p.color2 || "#ffffff";
    ctx.lineWidth = Math.max(0.5, r * 0.35);
    line(ctx, -len / 2, 0, len / 2, 0);
  },
  shard(ctx, p, x, y, r) {
    ctx.translate(x, y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.6);
    ctx.lineTo(r * 0.8, 0);
    ctx.lineTo(0, r * 1.6);
    ctx.lineTo(-r * 0.8, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = p.color2 || "rgba(255,255,255,0.8)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  },
  leaf(ctx, p, x, y, r) {
    ctx.translate(x, y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ellipse(ctx, 0, 0, r * 1.7, r * 0.8);
    ctx.strokeStyle = p.color2 || "rgba(0,0,0,0.35)";
    ctx.lineWidth = 0.8;
    line(ctx, -r * 1.7, 0, r * 1.7, 0);
  },
  bubble(ctx, p, x, y, r) {
    ctx.strokeStyle = p.color;
    ctx.lineWidth = Math.max(0.8, r * 0.35);
    ctx.beginPath();
    ctx.arc(x, y, r * 1.3, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    circle(ctx, x - r * 0.4, y - r * 0.45, r * 0.3);
  },
  sparkle(ctx, p, x, y, r, t) {
    const s = r * (1.6 + 0.6 * Math.sin(t * Math.PI * 4 + p.rot));
    ctx.translate(x, y);
    ctx.rotate(p.rot * 0.3);
    ctx.fillStyle = p.color2 || "#ffffff";
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.quadraticCurveTo(0, 0, s, 0);
    ctx.quadraticCurveTo(0, 0, 0, s);
    ctx.quadraticCurveTo(0, 0, -s, 0);
    ctx.quadraticCurveTo(0, 0, 0, -s);
    ctx.fill();
    ctx.fillStyle = p.color;
    circle(ctx, 0, 0, r * 0.45);
  },
  wisp(ctx, p, x, y, r, t) {
    const rr = r * (1.4 + t * 1.6);
    ctx.globalAlpha *= 0.45;
    ctx.fillStyle = p.color;
    circle(ctx, x, y, rr);
    ctx.fillStyle = p.color2 || p.color;
    circle(ctx, x, y, rr * 0.5);
  },
  chunk(ctx, p, x, y, r) {
    ctx.translate(x, y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(-r, 0, r * 2, r);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(-r, -r, r * 2, r * 0.45);
  },
  smoke(ctx, p, x, y, r, t) {
    const rr = r * (1.1 + t * 2.4);
    ctx.globalAlpha *= 0.4;
    ctx.fillStyle = p.color;
    circle(ctx, x, y, rr);
    ctx.globalAlpha *= 0.7;
    circle(ctx, x + rr * 0.3, y - rr * 0.2, rr * 0.6);
  },
  feather(ctx, p, x, y, r) {
    ctx.translate(x, y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ellipse(ctx, 0, 0, r * 2, r * 0.6);
    ctx.strokeStyle = p.color2 || "rgba(255,255,255,0.7)";
    ctx.lineWidth = 0.7;
    line(ctx, -r * 2, 0, r * 2, 0);
  },
  ring(ctx, p, x, y, r, t) {
    ctx.strokeStyle = p.color;
    ctx.lineWidth = Math.max(0.8, r * 0.5 * (1 - t));
    ctx.beginPath();
    ctx.arc(x, y, r * (1 + t * 3), 0, TAU);
    ctx.stroke();
  },
};

export class ParticleSystem {
  constructor() {
    this.items = [];
    this.cap = animations.particleCap;
    this.mult = 1;
    this.additive = true;
    this.typed = true;
    this.muted = false;
  }

  spawn(p) {
    if (this.muted || !animations.animationsEnabled || this.items.length >= this.cap) return;
    const shape = this.typed ? p.shape || "dot" : "dot";
    this.items.push({ life: 0, gravity: 0, size: 3, alpha: 1, rot: Math.random() * TAU, spin: 0, drag: 0, ...p, shape });
  }

  burst(x, y, n, { color, speed = 3, maxLife = 0.35, size = 3, gravity = 0, spread = TAU, angle = 0, ...style }) {
    const count = Math.max(1, Math.round(n * this.mult));
    for (let i = 0; i < count; i++) {
      const a = angle + (spread * i) / count + (Math.random() - 0.5) * (spread / count);
      const s = speed * (0.6 + Math.random() * 0.6);
      this.spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, maxLife: maxLife * (0.8 + Math.random() * 0.4), color, size: size * (0.75 + Math.random() * 0.5), gravity, ...style });
    }
  }

  update(dt) {
    const keep = [];
    for (const p of this.items) {
      p.life += dt;
      if (p.life >= p.maxLife) continue;
      p.vy += p.gravity * dt;
      if (p.drag) {
        const k = Math.max(0, 1 - p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      if (p.sway) p.vx += Math.sin((p.life + p.rot) * p.sway) * dt * 2.5;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      keep.push(p);
    }
    this.items = keep;
  }

  draw(ctx, toPx, ts) {
    const scale = ts / 22.5;
    const passes = this.additive ? [false, true] : [null];
    for (const additivePass of passes) {
      ctx.save();
      if (additivePass) ctx.globalCompositeOperation = "lighter";
      for (const p of this.items) {
        if (additivePass !== null && !!p.additive !== additivePass) continue;
        const t = p.life / p.maxLife;
        const { x, y } = toPx(p.x, p.y);
        const grows = p.shape === "smoke" || p.shape === "wisp" || p.shape === "ring";
        const r = p.size * (grows ? 1 : 1 - t * 0.5) * scale;
        ctx.save();
        ctx.globalAlpha = (1 - t) * p.alpha * (p.flicker ? 0.6 + Math.random() * 0.4 : 1);
        (SHAPES[p.shape] || SHAPES.dot)(ctx, p, x, y, r, t);
        ctx.restore();
      }
      ctx.restore();
    }
  }
}
