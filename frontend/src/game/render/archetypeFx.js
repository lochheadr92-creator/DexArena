import { moveVisuals, animations as A } from "@/game/config";
import { typeBurst, typeStyle, typeAccent } from "@/game/render/typeFx";

const ARCH = moveVisuals.archetypes;
const TAU = Math.PI * 2;
const clamp = (t) => Math.min(1, Math.max(0, t));
const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const additive = (r, ctx) => {
  if (r.gfx?.additive) ctx.globalCompositeOperation = "lighter";
};

function anchor(r, state, e) {
  const u = e.fromId ? r.findUnit(state, e.fromId) : null;
  if (u && u.state !== "bench" && u.state !== "fainted") {
    e.lastAnchor = { x: u.pos.x, y: u.pos.y - 0.4 };
    return e.lastAnchor;
  }
  if (e.lastAnchor) return e.lastAnchor;
  const x = Number.isFinite(e.fx) ? e.fx : u?.pos.x ?? 0;
  const y = Number.isFinite(e.fy) ? e.fy : u?.pos.y ?? 0;
  e.lastAnchor = { x, y: y - 0.4 };
  return e.lastAnchor;
}

function conePath(ctx, a, b, len, baseW, headW) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 1;
  const nx = -dy / d;
  const ny = dx / d;
  const hx = a.x + dx * len;
  const hy = a.y + dy * len;
  ctx.beginPath();
  ctx.moveTo(a.x + nx * baseW, a.y + ny * baseW);
  ctx.lineTo(hx + nx * headW, hy + ny * headW);
  ctx.quadraticCurveTo(hx + dx * 0.08, hy + dy * 0.08, hx - nx * headW, hy - ny * headW);
  ctx.lineTo(a.x - nx * baseW, a.y - ny * baseW);
  ctx.closePath();
  return { hx, hy, dx, dy, nx, ny };
}

export function drawCone(r, ctx, from, to, color, len, alpha, type = null, wobble = 0) {
  const a = r.toPx(from.x, from.y);
  const b = r.toPx(to.x, to.y);
  const base = r.px(ARCH.spread.coneBaseTiles) / 2;
  const head = (r.px(ARCH.spread.coneWidthTiles) / 2) * len;
  const accent = type ? typeAccent(type) : "#ffffff";
  ctx.save();
  additive(r, ctx);
  const layers = [
    [1, 1, color, 0.85],
    [0.82 + 0.06 * Math.sin(wobble * 17), 0.6, accent, 0.55],
    [0.62 + 0.05 * Math.sin(wobble * 23 + 1), 0.3, "#ffffff", 0.45],
  ];
  let headInfo = null;
  for (const [lenK, widthK, c, al] of layers) {
    const info = conePath(ctx, a, b, len * lenK, base * widthK, head * widthK);
    if (!headInfo) headInfo = info;
    const grad = ctx.createLinearGradient(a.x, a.y, info.hx, info.hy);
    grad.addColorStop(0, rgba(c === "#ffffff" ? "#ffffff" : c, 0.95 * alpha * al));
    grad.addColorStop(0.65, rgba(c === "#ffffff" ? "#ffffff" : c, 0.55 * alpha * al));
    grad.addColorStop(1, rgba(c === "#ffffff" ? "#ffffff" : c, 0.04 * alpha * al));
    ctx.fillStyle = grad;
    ctx.fill();
  }
  ctx.restore();
  return { hx: headInfo.hx, hy: headInfo.hy, headTiles: { x: from.x + (to.x - from.x) * len, y: from.y + (to.y - from.y) * len } };
}

export function drawBeam(r, ctx, from, to, color, width, alpha, now = 0) {
  const a = r.toPx(from.x, from.y);
  const b = r.toPx(to.x, to.y);
  ctx.save();
  additive(r, ctx);
  ctx.lineCap = "round";
  for (const [w, c, al] of [
    [width * 3.4, color, 0.2],
    [width * 1.6, color, 0.45],
    [width, color, 0.95],
    [width * 0.38, "#ffffff", 0.95],
  ]) {
    ctx.globalAlpha = al * alpha;
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  if (now) {
    ctx.globalAlpha = 0.55 * alpha;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = width * 0.7;
    ctx.setLineDash([r.px(0.25), r.px(0.55)]);
    ctx.lineDashOffset = -(now / 6) % r.px(0.8);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawOrb(r, ctx, pos, lift, color, radiusPx, alpha = 1, rot = 0, type = null) {
  const g = r.toPx(pos.x, pos.y);
  const y = g.y - r.px(lift);
  ctx.save();
  ctx.globalAlpha = 0.3 * alpha * (1 - Math.min(0.7, lift / 2));
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(g.x, g.y, radiusPx * 0.9, radiusPx * 0.4, 0, 0, TAU);
  ctx.fill();
  additive(r, ctx);
  const glow = ctx.createRadialGradient(g.x, y, radiusPx * 0.4, g.x, y, radiusPx * 2.6);
  glow.addColorStop(0, rgba(color, 0.85));
  glow.addColorStop(1, rgba(color, 0));
  ctx.globalAlpha = alpha;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(g.x, y, radiusPx * 2.6, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(g.x, y, radiusPx, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(g.x, y);
  ctx.rotate(rot);
  ctx.strokeStyle = rgba(type ? typeAccent(type) : "#ffffff", 0.55);
  ctx.lineWidth = Math.max(1, radiusPx * 0.18);
  ctx.beginPath();
  ctx.ellipse(0, 0, radiusPx * 0.85, radiusPx * 0.35, 0, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 0, radiusPx * 0.35, radiusPx * 0.85, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(g.x - radiusPx * 0.25, y - radiusPx * 0.25, radiusPx * 0.45, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function forkBolt(x, y, dx, dy, n, spread) {
  const pts = [{ x, y }];
  for (let i = 1; i <= n; i++) pts.push({ x: x + (dx * i) / n + (Math.random() - 0.5) * spread, y: y + (dy * i) / n + (Math.random() - 0.5) * spread * 0.6 });
  return pts;
}

function strokePolyline(r, ctx, pts) {
  ctx.beginPath();
  pts.forEach((pt, i) => {
    const q = r.toPx(pt.x, pt.y);
    if (i === 0) ctx.moveTo(q.x, q.y);
    else ctx.lineTo(q.x, q.y);
  });
  ctx.stroke();
}

const drawers = {
  plume(r, ctx, e, p, state) {
    const from = anchor(r, state, e);
    const len = e.fixedLen ?? Math.min(1, p / 0.55);
    const alpha = e.fadeOnly ? 1 - p : p < 0.65 ? 1 : (1 - p) / 0.35;
    const head = drawCone(r, ctx, from, { x: e.tx, y: e.ty - 0.4 }, e.color, len, alpha, e.type, p);
    if (!e.fadeOnly && p < 0.65 && Math.random() < 0.85) {
      const st = typeStyle(e.type);
      r.particles.spawn({ ...st, x: head.headTiles.x + (Math.random() - 0.5) * 0.9, y: head.headTiles.y + (Math.random() - 0.5) * 0.9, vx: (e.tx - from.x) * 0.7, vy: (e.ty - 0.4 - from.y) * 0.7 - 1, maxLife: 0.4, size: 3 });
    }
  },
  charge(r, ctx, e, p, state) {
    const from = anchor(r, state, e);
    const c = r.toPx(from.x, from.y);
    const rad = r.px(0.25 + 0.4 * p) * (0.75 + 0.25 * Math.sin(p * Math.PI * 8));
    ctx.save();
    additive(r, ctx);
    const glow = ctx.createRadialGradient(c.x, c.y, rad * 0.2, c.x, c.y, rad * 2.4);
    glow.addColorStop(0, rgba("#ffffff", 0.95));
    glow.addColorStop(0.4, rgba(e.color, 0.85));
    glow.addColorStop(1, rgba(e.color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(c.x, c.y, rad * 2.4, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    const t = r.toPx(e.tx, e.ty - 0.4);
    ctx.globalAlpha = 0.35 + 0.3 * p;
    ctx.setLineDash([4, 6]);
    ctx.lineDashOffset = -p * 60;
    ctx.strokeStyle = e.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.5 + 0.4 * p;
    ctx.lineWidth = 2 * r.scalePx();
    ctx.beginPath();
    ctx.arc(t.x, t.y, r.px(0.5 + 0.3 * Math.sin(p * Math.PI * 6)), 0, TAU);
    ctx.stroke();
    ctx.restore();
    if (Math.random() < 0.9) {
      const a = Math.random() * TAU;
      const d = 1.2 + Math.random() * 0.6;
      const st = typeStyle(e.type);
      r.particles.spawn({ ...st, x: from.x + Math.cos(a) * d, y: from.y + Math.sin(a) * d * 0.7, vx: -Math.cos(a) * d * 4, vy: -Math.sin(a) * d * 0.7 * 4, gravity: 0, maxLife: 0.25, size: 2, drag: 0 });
    }
  },
  beamLine(r, ctx, e, p, state) {
    const from = e.fixed ? { x: e.fx, y: e.fy } : anchor(r, state, e);
    drawBeam(r, ctx, from, { x: e.tx, y: e.ty }, e.color, ARCH.beam.widthPx * (1.3 - p * 0.8) * r.scalePx(), 1 - p, r.lastNow);
    if (p < 0.4) {
      const g = r.toPx(e.tx, e.ty);
      ctx.save();
      additive(r, ctx);
      ctx.globalAlpha = (1 - p / 0.4) * 0.9;
      const flare = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, r.px(1.1));
      flare.addColorStop(0, "rgba(255,255,255,0.95)");
      flare.addColorStop(0.35, rgba(e.color, 0.7));
      flare.addColorStop(1, rgba(e.color, 0));
      ctx.fillStyle = flare;
      ctx.beginPath();
      ctx.arc(g.x, g.y, r.px(1.1), 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  },
  lobArc(r, ctx, e, p) {
    const pos = { x: e.fx + (e.tx - e.fx) * p, y: e.fy + (e.ty - e.fy) * p };
    const lift = 0.4 + e.arcTiles * Math.sin(p * Math.PI);
    const ghosts = r.gfx?.trailGhosts || 0;
    if (ghosts) {
      e.trail ||= [];
      e.trail.push({ ...pos, lift });
      if (e.trail.length > ghosts * 2) e.trail.splice(0, e.trail.length - ghosts * 2);
      e.trail.forEach((g, i) => i % 2 === 0 && drawOrb(r, ctx, g, g.lift, e.color, (ARCH.lob.orbPx / 2) * r.scalePx() * (0.5 + (0.4 * i) / e.trail.length), (0.12 + (0.25 * i) / e.trail.length) * 0.8));
    }
    drawOrb(r, ctx, pos, lift, e.color, (ARCH.lob.orbPx / 2) * r.scalePx(), 1, p * 14, e.type);
    if (Math.random() < 0.7) {
      const st = typeStyle(e.type);
      r.particles.spawn({ ...st, x: pos.x, y: pos.y - lift, vx: 0, vy: 0.5, gravity: 0, maxLife: 0.3, size: 2.5 });
    }
  },
  bolt(r, ctx, e, p) {
    if (!e.pts || Math.floor(p * 12) !== e.seg) {
      e.seg = Math.floor(p * 12);
      e.pts = forkBolt(e.x, e.y - 0.4 - ARCH.strike.dropTiles, 0, ARCH.strike.dropTiles, 7, 1.4);
      e.forks = [];
      for (let k = 0; k < 2; k++) {
        const base = e.pts[2 + k * 2];
        const dir = Math.random() < 0.5 ? -1 : 1;
        e.forks.push(forkBolt(base.x, base.y, dir * (0.8 + Math.random()), 1.2 + Math.random(), 3, 0.5));
      }
    }
    const flicker = p < 0.55 ? (Math.floor(p * 20) % 3 === 0 ? 0.55 : 1) : (1 - p) / 0.45;
    ctx.save();
    additive(r, ctx);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const [w, c, al] of [
      [12, e.color, 0.25],
      [4.5, e.color, 0.9],
      [1.6, "#ffffff", 1],
    ]) {
      ctx.globalAlpha = al * flicker;
      ctx.strokeStyle = c;
      ctx.lineWidth = w * r.scalePx();
      strokePolyline(r, ctx, e.pts);
      ctx.lineWidth = w * 0.45 * r.scalePx();
      for (const f of e.forks) strokePolyline(r, ctx, f);
    }
    const g = r.toPx(e.x, e.y);
    ctx.globalAlpha = (1 - p) * 0.6;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.ellipse(g.x, g.y, r.px(1.2), r.px(0.55), 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    if (p < 0.5 && Math.random() < 0.8) typeBurst(r.particles, "electric", e.x, e.y - 0.3, 1, { speed: 6, maxLife: 0.25, size: 2 });
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
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.fillRect(-size / 2, -size / 2, size, size * 0.3);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = 0.25 * (1 - lift / ARCH.strike.dropTiles);
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.ellipse(g.x, g.y, size * 0.7, size * 0.3, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      } else if (!ch.landed) {
        ch.landed = true;
        typeBurst(r.particles, e.type || "rock", e.x + ch.ox, e.y + ch.oy, 5, { speed: 3.5, maxLife: 0.45, size: 2.5, spread: Math.PI, angle: -Math.PI });
        r.particles.burst(e.x + ch.ox, e.y + ch.oy, 4, { color: "#a8a29e", shape: "smoke", speed: 1.2, maxLife: 0.6, size: 3.5, gravity: -1.5 });
      }
    }
    const g = r.toPx(e.x, e.y);
    ctx.save();
    ctx.globalAlpha = (1 - p) * 0.35;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.ellipse(g.x, g.y, r.px(1.2), r.px(0.5), 0, 0, TAU);
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
    ctx.lineWidth = (6 * (1 - q) + 1) * r.scalePx();
    ctx.beginPath();
    ctx.ellipse(g.x, g.y, rad, rad * 0.45, 0, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = (1 - q) * 0.5;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = (2 * (1 - q) + 0.5) * r.scalePx();
    ctx.stroke();
    ctx.globalAlpha = (1 - q) * 0.25;
    ctx.fillStyle = e.color;
    ctx.fill();
    ctx.restore();
    if (q < 0.8 && Math.random() < 0.85) {
      const a = Math.random() * TAU;
      const x = e.x + Math.cos(a) * e.radiusTiles * Math.sqrt(q);
      const y = e.y + Math.sin(a) * e.radiusTiles * Math.sqrt(q) * 0.45;
      r.particles.spawn({ x, y, vx: Math.cos(a) * 0.6, vy: -3 - Math.random() * 2, maxLife: 0.6, color: e.dust || "#d6d3d1", size: 3, gravity: 4, shape: "smoke" });
      if (Math.random() < 0.5) typeBurst(r.particles, e.type || "ground", x, y, 1, { speed: 3, maxLife: 0.45, size: 2.2, spread: Math.PI, angle: -Math.PI });
    }
  },
  cloud(r, ctx, e, p, state) {
    const from = anchor(r, state, e);
    const want = Math.floor(clamp(p / 0.45) * e.total * (r.particles.mult || 1));
    const dx = e.tx - from.x;
    const dy = e.ty - 0.4 - from.y;
    const st = typeStyle(e.type);
    const shape = st.shape === "bubble" || st.shape === "smoke" || st.shape === "wisp" ? st.shape : "smoke";
    while (e.spawned < want) {
      e.spawned++;
      const n = 0.5;
      r.particles.spawn({ x: from.x + (Math.random() - 0.5) * 0.6, y: from.y + (Math.random() - 0.5) * 0.6, vx: dx / e.travelSec + (Math.random() - 0.5) * n, vy: dy / e.travelSec + (Math.random() - 0.5) * n, maxLife: e.travelSec + 0.3, color: e.color, color2: st.color2, size: 3 + Math.random() * 1.5, alpha: 0.8, shape, additive: st.additive });
    }
  },
  fog(r, ctx, e, p) {
    const g = r.toPx(e.x, e.y - 0.4);
    const rad = r.px(1.1);
    const k = Math.sin(p * Math.PI);
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const a = p * 4 + (i * TAU) / 3;
      const ox = Math.cos(a) * rad * 0.35;
      const oy = Math.sin(a) * rad * 0.2;
      const glow = ctx.createRadialGradient(g.x + ox, g.y + oy, rad * 0.05, g.x + ox, g.y + oy, rad * 0.85);
      glow.addColorStop(0, rgba(e.color, 0.5 * k));
      glow.addColorStop(1, rgba(e.color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(g.x + ox, g.y + oy, rad * 0.85, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  },
  aura(r, ctx, e, p, state) {
    const from = anchor(r, state, e);
    const g = r.toPx(from.x, from.y);
    ctx.save();
    additive(r, ctx);
    const glow = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, r.px(1.4));
    glow.addColorStop(0, rgba(e.color, 0.7 * (1 - p)));
    glow.addColorStop(1, rgba(e.color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(g.x, g.y, r.px(1.4), 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < ARCH.aura.rings; i++) {
      const q = clamp((p - i * 0.18) / 0.7);
      if (q <= 0) continue;
      ctx.globalAlpha = (1 - q) * 0.85;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = (3 * (1 - q) + 1) * r.scalePx();
      ctx.beginPath();
      ctx.ellipse(g.x, g.y + r.px(0.2), r.px(0.5 + ARCH.aura.ringTiles * q), r.px((0.5 + ARCH.aura.ringTiles * q) * 0.6), 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = (1 - p) * 0.9;
    ctx.strokeStyle = e.color;
    ctx.lineWidth = 2 * r.scalePx();
    ctx.setLineDash([r.px(0.18), r.px(0.14)]);
    ctx.lineDashOffset = -p * r.px(3);
    ctx.beginPath();
    ctx.ellipse(g.x, g.y + r.px(0.2), r.px(0.9), r.px(0.4), 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
    if (p < 0.6 && Math.random() < 0.8) r.particles.spawn({ x: from.x + (Math.random() - 0.5) * 1.2, y: from.y + 0.4, vx: 0, vy: -2.5, maxLife: 0.55, color: e.color, color2: "#ffffff", size: 2.5, shape: "sparkle", additive: true });
  },
  pulse(r, ctx, e, p) {
    const g = r.toPx(e.x, e.y - 0.4);
    ctx.save();
    additive(r, ctx);
    for (let i = 0; i < ARCH.pulse.rings; i++) {
      const q = clamp((p - i * 0.12) / 0.7);
      if (q <= 0 || q >= 1) continue;
      const rad = r.px(0.2 + ARCH.pulse.ringTiles * (1 - q));
      ctx.globalAlpha = 0.9 * Math.sin(q * Math.PI);
      ctx.strokeStyle = i % 2 ? "#ffffff" : e.color;
      ctx.lineWidth = (2 + 2 * q) * r.scalePx();
      ctx.beginPath();
      ctx.ellipse(g.x, g.y, rad, rad * 0.7, 0, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha *= 0.5;
      ctx.lineWidth *= 0.5;
      ctx.beginPath();
      ctx.ellipse(g.x, g.y, rad * 1.18, rad * 0.7 * 1.18, 0, 0, TAU);
      ctx.stroke();
    }
    const glow = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, r.px(1));
    glow.addColorStop(0, rgba(e.color, 0.6 * Math.sin(p * Math.PI)));
    glow.addColorStop(1, rgba(e.color, 0));
    ctx.globalAlpha = 1;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(g.x, g.y, r.px(1), 0, TAU);
    ctx.fill();
    ctx.restore();
    if (p < 0.5 && Math.random() < 0.8) {
      const a = Math.random() * TAU;
      r.particles.spawn({ x: e.x + Math.cos(a) * 1.3, y: e.y - 0.4 + Math.sin(a) * 0.9, vx: -Math.cos(a) * 3, vy: -Math.sin(a) * 2, maxLife: 0.35, color: e.color, color2: "#ffffff", size: 2.2, shape: "sparkle", additive: true });
    }
  },
  impact(r, ctx, e, p) {
    const g = r.toPx(e.x, e.y - 0.4);
    ctx.save();
    additive(r, ctx);
    ctx.globalAlpha = (1 - p) * 0.9;
    ctx.strokeStyle = e.color;
    ctx.lineWidth = (4 * (1 - p) + 1) * r.scalePx();
    ctx.beginPath();
    ctx.arc(g.x, g.y, r.px(0.25 + (e.radiusTiles || 1.1) * p), 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = (1 - p) * 0.5;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(g.x, g.y, r.px(0.5) * (1 - p * 0.5), 0, TAU);
    ctx.fill();
    if (p < 0.5) {
      ctx.globalAlpha = (1 - p / 0.5) * 0.8;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5 * r.scalePx();
      for (let i = 0; i < 6; i++) {
        const a = (i * TAU) / 6 + (e.rot || 0);
        const r0 = r.px(0.3 + p * 0.8);
        const r1 = r0 + r.px(0.35) * (1 - p);
        ctx.beginPath();
        ctx.moveTo(g.x + Math.cos(a) * r0, g.y + Math.sin(a) * r0);
        ctx.lineTo(g.x + Math.cos(a) * r1, g.y + Math.sin(a) * r1);
        ctx.stroke();
      }
    }
    ctx.restore();
  },
  flash(r, ctx, e, p) {
    const g = r.toPx(e.x, e.y - 0.4);
    ctx.save();
    ctx.globalAlpha = (1 - p) * 0.7;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(g.x, g.y, r.px(e.radiusTiles || 1), 0, TAU);
    ctx.fill();
    ctx.restore();
  },
  crack(r, ctx, e, p) {
    if (!e.lines) {
      e.lines = Array.from({ length: e.count || 7 }, () => {
        const a = Math.random() * TAU;
        const len = e.radiusTiles * (0.55 + Math.random() * 0.6);
        const pts = [];
        const segs = 4;
        for (let i = 1; i <= segs; i++) pts.push({ x: (Math.cos(a) * len * i) / segs + (Math.random() - 0.5) * 0.25, y: (Math.sin(a) * len * i * 0.5) / segs + (Math.random() - 0.5) * 0.12 });
        return pts;
      });
    }
    const g = r.toPx(e.x, e.y);
    const grow = clamp(p / 0.12);
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const [w, c, al] of [
      [2.6, "rgba(8,8,12,0.95)", 0.85],
      [0.9, e.color, 0.7],
    ]) {
      ctx.globalAlpha = (1 - p) * al;
      ctx.strokeStyle = c;
      ctx.lineWidth = w * r.scalePx();
      for (const pts of e.lines) {
        ctx.beginPath();
        ctx.moveTo(g.x, g.y);
        const n = Math.max(1, Math.round(pts.length * grow));
        for (let i = 0; i < n; i++) {
          const q = r.toPx(e.x + pts[i].x, e.y + pts[i].y);
          ctx.lineTo(q.x, q.y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  },
  scorch(r, ctx, e, p) {
    const g = r.toPx(e.x, e.y);
    ctx.save();
    ctx.globalAlpha = (1 - p) * 0.4;
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.beginPath();
    ctx.ellipse(g.x, g.y, r.px(e.radiusTiles), r.px(e.radiusTiles) * 0.45, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = (1 - p) * 0.35;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.ellipse(g.x, g.y, r.px(e.radiusTiles) * 0.6, r.px(e.radiusTiles) * 0.27, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  },
  slash(r, ctx, e, p) {
    const g = r.toPx(e.x, e.y - 0.5);
    const n = e.count || 3;
    const len = r.px(1.3);
    const reveal = clamp(p / 0.35);
    const alpha = p < 0.55 ? 1 : (1 - p) / 0.45;
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(e.angle || 0);
    ctx.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * r.px(0.3);
      const x0 = -len / 2 + (i % 2) * r.px(0.1);
      const x1 = x0 + len * reveal;
      ctx.globalAlpha = alpha * 0.4;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = (6 - i * 0.6) * r.scalePx();
      ctx.beginPath();
      ctx.moveTo(x0, off);
      ctx.lineTo(x1, off + r.px(0.12) * (i % 2 ? 1 : -1) * reveal);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.95;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = (2.4 - i * 0.3) * r.scalePx();
      ctx.stroke();
    }
    ctx.restore();
  },
  speedlines(r, ctx, e, p) {
    if (!e.rays) e.rays = Array.from({ length: e.count || 10 }, () => ({ a: Math.random() * TAU, len: 0.6 + Math.random() * 0.9, w: 0.6 + Math.random() }));
    const g = r.toPx(e.x, e.y - 0.4);
    ctx.save();
    ctx.globalAlpha = (1 - p) * 0.8;
    ctx.strokeStyle = e.color || "#ffffff";
    ctx.lineCap = "round";
    for (const ray of e.rays) {
      const r0 = r.px(0.6 + p * 1.4);
      const r1 = r0 + r.px(ray.len) * (1 - p * 0.5);
      ctx.lineWidth = ray.w * r.scalePx();
      ctx.beginPath();
      ctx.moveTo(g.x + Math.cos(ray.a) * r0, g.y + Math.sin(ray.a) * r0 * 0.7);
      ctx.lineTo(g.x + Math.cos(ray.a) * r1, g.y + Math.sin(ray.a) * r1 * 0.7);
      ctx.stroke();
    }
    ctx.restore();
  },
  starburst(r, ctx, e, p) {
    const g = r.toPx(e.x, e.y - 0.5);
    const n = e.spokes || 10;
    const rad = r.px(e.radiusTiles || 1.6) * Math.sqrt(p);
    ctx.save();
    additive(r, ctx);
    ctx.translate(g.x, g.y);
    ctx.rotate(e.rot || 0);
    ctx.globalAlpha = (1 - p) * 0.95;
    for (let i = 0; i < n; i++) {
      const a = (i * TAU) / n;
      const w = (i % 2 ? 0.55 : 1) * rad;
      ctx.fillStyle = i % 2 ? e.color : "#ffffff";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a - 0.14) * w * 0.35, Math.sin(a - 0.14) * w * 0.35);
      ctx.lineTo(Math.cos(a) * w, Math.sin(a) * w);
      ctx.lineTo(Math.cos(a + 0.14) * w * 0.35, Math.sin(a + 0.14) * w * 0.35);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, r.px(0.28) * (1 - p), 0, TAU);
    ctx.fill();
    ctx.restore();
  },
  vignette(r, ctx, e, p) {
    ctx.save();
    ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
    const k = e.hold ? 1 - p : Math.sin(p * Math.PI);
    ctx.globalAlpha = k * (e.alpha ?? 0.25);
    if (e.inner) {
      ctx.fillStyle = e.color;
      ctx.fillRect(0, 0, r.cssW, r.cssH);
    } else {
      const cx = r.cssW / 2;
      const cy = r.cssH / 2;
      const grad = ctx.createRadialGradient(cx, cy, Math.min(cx, cy) * 0.35, cx, cy, Math.max(cx, cy) * 0.95);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, e.color);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, r.cssW, r.cssH);
    }
    ctx.restore();
  },
  lightColumn(r, ctx, e, p) {
    const g = r.toPx(e.x, e.y);
    const w = r.px(1) * (1 - p * 0.6);
    ctx.save();
    additive(r, ctx);
    ctx.globalAlpha = p < 0.3 ? p / 0.3 : (1 - p) / 0.7;
    const grad = ctx.createLinearGradient(0, 0, 0, g.y);
    grad.addColorStop(0, rgba(e.color, 0));
    grad.addColorStop(0.7, rgba(e.color, 0.5));
    grad.addColorStop(1, "rgba(255,255,255,0.9)");
    ctx.fillStyle = grad;
    ctx.fillRect(g.x - w / 2, 0, w, g.y);
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = e.color;
    ctx.lineWidth = 2 * r.scalePx();
    ctx.beginPath();
    ctx.ellipse(g.x, g.y, r.px(0.4 + p * 1), r.px(0.4 + p * 1) * 0.45, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
    if (p < 0.6 && Math.random() < 0.8) r.particles.spawn({ x: e.x + (Math.random() - 0.5) * 0.9, y: e.y, vx: 0, vy: -3 - Math.random() * 2, maxLife: 0.5, color: e.color, color2: "#ffffff", size: 2, shape: "sparkle", additive: true });
  },
};

export const drawArchetypeEffect = (r, ctx, e, p, state) => {
  const d = drawers[e.kind];
  if (!d) return false;
  d(r, ctx, e, p, state);
  return true;
};

export const GROUND_EFFECTS = new Set(["crack", "scorch", "areaFlash"]);
export const DECAL_SEC = A.decal;

export function makeFallChunks() {
  return Array.from({ length: ARCH.strike.chunks }, (_, i) => ({ ox: (Math.random() - 0.5) * 1.6, oy: (Math.random() - 0.5) * 0.6, delay: i * 0.09, dur: 0.42, size: 0.3 + Math.random() * 0.25, rot: Math.random() * Math.PI, landed: false }));
}
