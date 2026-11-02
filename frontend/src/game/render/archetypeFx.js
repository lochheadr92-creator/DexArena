import { moveVisuals } from "@/game/config";

const ARCH = moveVisuals.archetypes;
const clamp = (t) => Math.min(1, Math.max(0, t));
const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

function anchor(r, state, e) {
  const u = e.fromId ? r.findUnit(state, e.fromId) : null;
  return u && u.state !== "bench" && u.state !== "fainted" ? { x: u.pos.x, y: u.pos.y - 0.4 } : { x: e.fx, y: e.fy - 0.4 };
}

export function drawCone(r, ctx, from, to, color, len, alpha) {
  const a = r.toPx(from.x, from.y);
  const b = r.toPx(to.x, to.y);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 1;
  const nx = -dy / d;
  const ny = dx / d;
  const hx = a.x + dx * len;
  const hy = a.y + dy * len;
  const base = r.px(ARCH.spread.coneBaseTiles) / 2;
  const head = (r.px(ARCH.spread.coneWidthTiles) / 2) * len;
  const grad = ctx.createLinearGradient(a.x, a.y, hx, hy);
  grad.addColorStop(0, rgba(color, 0.9 * alpha));
  grad.addColorStop(0.6, rgba(color, 0.55 * alpha));
  grad.addColorStop(1, rgba(color, 0.05 * alpha));
  ctx.save();
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(a.x + nx * base, a.y + ny * base);
  ctx.lineTo(hx + nx * head, hy + ny * head);
  ctx.quadraticCurveTo(hx + dx * 0.08, hy + dy * 0.08, hx - nx * head, hy - ny * head);
  ctx.lineTo(a.x - nx * base, a.y - ny * base);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgba("#ffffff", 0.3 * alpha);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(hx + nx * head * 0.4, hy + ny * head * 0.4);
  ctx.lineTo(hx - nx * head * 0.4, hy - ny * head * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  return { hx, hy, headTiles: { x: from.x + (to.x - from.x) * len, y: from.y + (to.y - from.y) * len } };
}

export function drawBeam(r, ctx, from, to, color, width, alpha) {
  const a = r.toPx(from.x, from.y);
  const b = r.toPx(to.x, to.y);
  ctx.save();
  ctx.lineCap = "round";
  for (const [w, c, al] of [
    [width * 3.2, color, 0.22],
    [width, color, 0.95],
    [width * 0.35, "#ffffff", 0.95],
  ]) {
    ctx.globalAlpha = al * alpha;
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawOrb(r, ctx, pos, lift, color, radiusPx, alpha = 1) {
  const g = r.toPx(pos.x, pos.y);
  const y = g.y - r.px(lift);
  ctx.save();
  ctx.globalAlpha = 0.3 * alpha * (1 - Math.min(0.7, lift / 2));
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(g.x, g.y, radiusPx * 0.9, radiusPx * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  const glow = ctx.createRadialGradient(g.x, y, radiusPx * 0.4, g.x, y, radiusPx * 2.4);
  glow.addColorStop(0, rgba(color, 0.8));
  glow.addColorStop(1, rgba(color, 0));
  ctx.globalAlpha = alpha;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(g.x, y, radiusPx * 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(g.x, y, radiusPx, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(g.x - radiusPx * 0.25, y - radiusPx * 0.25, radiusPx * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const drawers = {
  plume(r, ctx, e, p, state) {
    const from = anchor(r, state, e);
    const len = e.fixedLen ?? Math.min(1, p / 0.55);
    const alpha = e.fadeOnly ? 1 - p : p < 0.65 ? 1 : (1 - p) / 0.35;
    const head = drawCone(r, ctx, from, { x: e.tx, y: e.ty - 0.4 }, e.color, len, alpha);
    if (!e.fadeOnly && p < 0.65 && Math.random() < 0.8) r.particles.spawn({ x: head.headTiles.x + (Math.random() - 0.5) * 0.8, y: head.headTiles.y + (Math.random() - 0.5) * 0.8, vx: (e.tx - from.x) * 0.6, vy: (e.ty - 0.4 - from.y) * 0.6 - 1, maxLife: 0.35, color: e.color, size: 3 });
  },
  charge(r, ctx, e, p, state) {
    const from = anchor(r, state, e);
    const c = r.toPx(from.x, from.y);
    const rad = r.px(0.25 + 0.35 * p) * (0.75 + 0.25 * Math.sin(p * Math.PI * 8));
    ctx.save();
    const glow = ctx.createRadialGradient(c.x, c.y, rad * 0.2, c.x, c.y, rad * 2.2);
    glow.addColorStop(0, rgba("#ffffff", 0.9));
    glow.addColorStop(0.4, rgba(e.color, 0.8));
    glow.addColorStop(1, rgba(e.color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(c.x, c.y, rad * 2.2, 0, Math.PI * 2);
    ctx.fill();
    const t = r.toPx(e.tx, e.ty - 0.4);
    ctx.globalAlpha = 0.35 + 0.25 * p;
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = e.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();
    ctx.restore();
    if (Math.random() < 0.5) r.particles.spawn({ x: from.x + (Math.random() - 0.5) * 1.6, y: from.y + (Math.random() - 0.5) * 1.6, vx: 0, vy: 0, maxLife: 0.25, color: e.color, size: 2 });
  },
  beamLine(r, ctx, e, p, state) {
    const from = e.fixed ? { x: e.fx, y: e.fy } : anchor(r, state, e);
    drawBeam(r, ctx, from, { x: e.tx, y: e.ty }, e.color, ARCH.beam.widthPx * (1.2 - p * 0.7) * r.scalePx(), 1 - p);
  },
  lobArc(r, ctx, e, p) {
    const pos = { x: e.fx + (e.tx - e.fx) * p, y: e.fy + (e.ty - e.fy) * p };
    const lift = 0.4 + e.arcTiles * Math.sin(p * Math.PI);
    drawOrb(r, ctx, pos, lift, e.color, (ARCH.lob.orbPx / 2) * r.scalePx());
    if (Math.random() < 0.6) r.particles.spawn({ x: pos.x, y: pos.y - lift, vx: 0, vy: 0.5, maxLife: 0.25, color: e.color, size: 2.5 });
  },
  bolt(r, ctx, e, p) {
    if (!e.pts || Math.floor(p * 12) !== e.seg) {
      e.seg = Math.floor(p * 12);
      e.pts = [];
      const n = 7;
      for (let i = 0; i <= n; i++) e.pts.push({ x: e.x + (i === 0 || i === n ? 0 : (Math.random() - 0.5) * 1.4), y: e.y - 0.4 - ARCH.strike.dropTiles * (1 - i / n) });
    }
    const flicker = p < 0.55 ? (Math.floor(p * 20) % 3 === 0 ? 0.55 : 1) : (1 - p) / 0.45;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const [w, c, al] of [
      [10, e.color, 0.25],
      [4, e.color, 0.9],
      [1.6, "#ffffff", 1],
    ]) {
      ctx.globalAlpha = al * flicker;
      ctx.strokeStyle = c;
      ctx.lineWidth = w * r.scalePx();
      ctx.beginPath();
      e.pts.forEach((pt, i) => {
        const q = r.toPx(pt.x, pt.y);
        if (i === 0) ctx.moveTo(q.x, q.y);
        else ctx.lineTo(q.x, q.y);
      });
      ctx.stroke();
    }
    const g = r.toPx(e.x, e.y);
    ctx.globalAlpha = (1 - p) * 0.55;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.ellipse(g.x, g.y, r.px(1.1), r.px(0.5), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  fall(r, ctx, e, p) {
    for (const ch of e.chunks) {
      const q = clamp((p - ch.delay) / ch.dur);
      if (q <= 0) continue;
      const lift = ARCH.strike.dropTiles * (1 - q * q);
      const g = r.toPx(e.x + ch.ox, e.y + ch.oy);
      const size = r.px(ch.size);
      if (q < 1) {
        ctx.save();
        ctx.translate(g.x, g.y - r.px(lift) - size / 2);
        ctx.rotate(ch.rot + q * 3);
        ctx.fillStyle = e.color;
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(-size / 2, 0, size, size / 2);
        ctx.restore();
      } else if (!ch.landed) {
        ch.landed = true;
        r.particles.burst(e.x + ch.ox, e.y + ch.oy, 6, { color: e.color, speed: 3, maxLife: 0.35, size: 2.5, gravity: 8, spread: Math.PI, angle: -Math.PI });
      }
    }
    const g = r.toPx(e.x, e.y);
    ctx.save();
    ctx.globalAlpha = (1 - p) * 0.35;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.ellipse(g.x, g.y, r.px(1.2), r.px(0.5), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  ring(r, ctx, e, p) {
    const q = clamp((p - (e.delay || 0)) / (1 - (e.delay || 0)));
    if (q <= 0) return;
    const g = r.toPx(e.x, e.y);
    const rad = r.px(e.radiusTiles) * Math.sqrt(q);
    ctx.save();
    ctx.globalAlpha = (1 - q) * 0.9;
    ctx.strokeStyle = e.color;
    ctx.lineWidth = (5 * (1 - q) + 1) * r.scalePx();
    ctx.beginPath();
    ctx.ellipse(g.x, g.y, rad, rad * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = (1 - q) * 0.25;
    ctx.fillStyle = e.color;
    ctx.fill();
    ctx.restore();
    if (q < 0.8 && Math.random() < 0.7) {
      const a = Math.random() * Math.PI * 2;
      r.particles.spawn({ x: e.x + Math.cos(a) * e.radiusTiles * Math.sqrt(q), y: e.y + Math.sin(a) * e.radiusTiles * Math.sqrt(q) * 0.45, vx: 0, vy: -2.5, maxLife: 0.35, color: e.dust || "#d6d3d1", size: 2.5, gravity: 5 });
    }
  },
  cloud(r, ctx, e, p, state) {
    const from = anchor(r, state, e);
    const want = Math.floor(clamp(p / 0.45) * e.total);
    const dx = e.tx - from.x;
    const dy = e.ty - 0.4 - from.y;
    while (e.spawned < want) {
      e.spawned++;
      const n = 0.5;
      r.particles.spawn({ x: from.x + (Math.random() - 0.5) * 0.6, y: from.y + (Math.random() - 0.5) * 0.6, vx: dx / e.travelSec + (Math.random() - 0.5) * n, vy: dy / e.travelSec + (Math.random() - 0.5) * n, maxLife: e.travelSec + 0.25, color: e.color, size: 3 + Math.random() * 1.5, alpha: 0.75 });
    }
  },
  fog(r, ctx, e, p) {
    const g = r.toPx(e.x, e.y - 0.4);
    const rad = r.px(1.1);
    ctx.save();
    const glow = ctx.createRadialGradient(g.x, g.y, rad * 0.1, g.x, g.y, rad);
    glow.addColorStop(0, rgba(e.color, 0.55 * Math.sin(p * Math.PI)));
    glow.addColorStop(1, rgba(e.color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(g.x, g.y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  aura(r, ctx, e, p, state) {
    const from = anchor(r, state, e);
    const g = r.toPx(from.x, from.y);
    ctx.save();
    const glow = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, r.px(1.3));
    glow.addColorStop(0, rgba(e.color, 0.65 * (1 - p)));
    glow.addColorStop(1, rgba(e.color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(g.x, g.y, r.px(1.3), 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < ARCH.aura.rings; i++) {
      const q = clamp((p - i * 0.18) / 0.7);
      if (q <= 0) continue;
      ctx.globalAlpha = (1 - q) * 0.85;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = (3 * (1 - q) + 1) * r.scalePx();
      ctx.beginPath();
      ctx.ellipse(g.x, g.y + r.px(0.2), r.px(0.5 + ARCH.aura.ringTiles * q), r.px((0.5 + ARCH.aura.ringTiles * q) * 0.6), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    if (p < 0.6 && Math.random() < 0.6) r.particles.spawn({ x: from.x + (Math.random() - 0.5) * 1.2, y: from.y + 0.4, vx: 0, vy: -2.5, maxLife: 0.5, color: e.color, size: 2.5 });
  },
  pulse(r, ctx, e, p) {
    const g = r.toPx(e.x, e.y - 0.4);
    ctx.save();
    for (let i = 0; i < ARCH.pulse.rings; i++) {
      const q = clamp((p - i * 0.12) / 0.7);
      if (q <= 0 || q >= 1) continue;
      const rad = r.px(0.2 + ARCH.pulse.ringTiles * (1 - q));
      ctx.globalAlpha = 0.9 * Math.sin(q * Math.PI);
      ctx.strokeStyle = i % 2 ? "#ffffff" : e.color;
      ctx.lineWidth = (2 + 2 * q) * r.scalePx();
      ctx.beginPath();
      ctx.ellipse(g.x, g.y, rad, rad * 0.7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    const glow = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, r.px(0.9));
    glow.addColorStop(0, rgba(e.color, 0.55 * Math.sin(p * Math.PI)));
    glow.addColorStop(1, rgba(e.color, 0));
    ctx.globalAlpha = 1;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(g.x, g.y, r.px(0.9), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (p < 0.5 && Math.random() < 0.5) {
      const a = Math.random() * Math.PI * 2;
      r.particles.spawn({ x: e.x + Math.cos(a) * 1.2, y: e.y - 0.4 + Math.sin(a) * 0.8, vx: -Math.cos(a) * 3, vy: -Math.sin(a) * 2, maxLife: 0.3, color: "#ffffff", size: 2 });
    }
  },
  impact(r, ctx, e, p) {
    const g = r.toPx(e.x, e.y - 0.4);
    ctx.save();
    ctx.globalAlpha = (1 - p) * 0.9;
    ctx.strokeStyle = e.color;
    ctx.lineWidth = (4 * (1 - p) + 1) * r.scalePx();
    ctx.beginPath();
    ctx.arc(g.x, g.y, r.px(0.25 + (e.radiusTiles || 1.1) * p), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = (1 - p) * 0.5;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(g.x, g.y, r.px(0.5) * (1 - p * 0.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  flash(r, ctx, e, p) {
    const g = r.toPx(e.x, e.y - 0.4);
    ctx.save();
    ctx.globalAlpha = (1 - p) * 0.7;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(g.x, g.y, r.px(e.radiusTiles || 1), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
};

export const drawArchetypeEffect = (r, ctx, e, p, state) => {
  const d = drawers[e.kind];
  if (!d) return false;
  d(r, ctx, e, p, state);
  return true;
};

export function makeFallChunks() {
  return Array.from({ length: ARCH.strike.chunks }, (_, i) => ({ ox: (Math.random() - 0.5) * 1.6, oy: (Math.random() - 0.5) * 0.6, delay: i * 0.09, dur: 0.42, size: 0.3 + Math.random() * 0.25, rot: Math.random() * Math.PI, landed: false }));
}
