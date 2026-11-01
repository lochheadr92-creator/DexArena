import { animations as A, engine, terrains as terrainConfig, typeColors, TICK_RATE, secToTicks } from "@/game/config";
import { tileAt } from "@/game/terrain";
import { getSprite, spriteKey, frameFor } from "@/game/render/sprites";
import { ParticleSystem } from "@/game/render/particles";

const tcolor = (t) => typeColors[t]?.bg || "#94a3b8";
const ease = (t) => Math.min(1, Math.max(0, t));

export class BattleRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.lastEventId = 0;
    this.particles = new ParticleSystem();
    this.effects = [];
    this.texts = [];
    this.unitFx = {};
    this.terrainCache = null;
    this.clock0 = performance.now();
    this.lastNow = this.clock0;
    this.ts = 20;
    this.ox = 0;
    this.oy = 0;
    this.scratch = document.createElement("canvas");
    this.fps = { frames: 0, last: performance.now(), value: 0 };
  }

  resize(cssW, cssH, dpr) {
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.dpr = dpr;
    this.cssW = cssW;
    this.cssH = cssH;
    const { cols, rows } = terrainConfig;
    this.ts = Math.min(cssW / cols, cssH / rows);
    this.ox = (cssW - this.ts * cols) / 2;
    this.oy = (cssH - this.ts * rows) / 2;
    this.terrainCache = null;
  }

  toPx = (x, y) => ({ x: this.ox + x * this.ts, y: this.oy + y * this.ts });
  px = (tiles) => tiles * this.ts;
  scalePx = () => this.ts / 22.5;

  render(state, now = performance.now()) {
    const ctx = this.ctx;
    const dt = Math.min(0.1, (now - this.lastNow) / 1000);
    this.lastNow = now;
    this.tickFps(now);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssW, this.cssH);
    this.consumeEvents(state, now);
    this.drawTerrain(state);
    this.drawAreaWindups(state);
    const units = ["player", "npc"].map((s) => state.teams[s].units[state.teams[s].activeIndex]).filter((u) => u.state !== "bench" && u.state !== "fainted");
    units.sort((a, b) => a.pos.y - b.pos.y);
    for (const u of units) this.drawUnit(state, u, now);
    this.drawEffects(state, now, dt);
    this.drawProjectiles(state, now);
    if (A.animationsEnabled) {
      this.particles.update(dt);
      this.particles.draw(ctx, this.toPx, this.ts);
      this.drawTexts(now);
    }
  }

  tickFps(now) {
    this.fps.frames++;
    if (now - this.fps.last >= 1000) {
      this.fps.value = this.fps.frames;
      this.fps.frames = 0;
      this.fps.last = now;
    }
  }

  drawTerrain(state) {
    const ctx = this.ctx;
    const t = state.terrain;
    if (!this.terrainCache) {
      const c = document.createElement("canvas");
      c.width = this.canvas.width;
      c.height = this.canvas.height;
      const g = c.getContext("2d");
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.fillStyle = "#05070c";
      g.fillRect(0, 0, this.cssW, this.cssH);
      for (let r = 0; r < t.rows; r++) for (let col = 0; col < t.cols; col++) this.paintTile(g, col, r, t.tiles[r][col], t.palette, (r + col) % 2 === 0);
      this.terrainCache = c;
    }
    ctx.drawImage(this.terrainCache, 0, 0, this.cssW, this.cssH);
    for (const key of Object.keys(state.tileOverrides)) {
      const o = state.tileOverrides[key];
      if (o.untilTick <= state.tick) continue;
      const [c, r] = key.split(",").map(Number);
      this.paintTile(ctx, c, r, o.tile, t.palette, (r + c) % 2 === 0);
      const remain = (o.untilTick - state.tick) / TICK_RATE;
      if (remain < 2) {
        ctx.globalAlpha = (2 - remain) / 2 * 0.6;
        this.paintTile(ctx, c, r, o.from, t.palette, (r + c) % 2 === 0);
        ctx.globalAlpha = 1;
      }
    }
  }

  paintTile(g, col, r, tile, palette, alt) {
    const base = palette[tile] || terrainConfig.tileColors[tile];
    const color = alt && palette[`${tile}Alt`] ? palette[`${tile}Alt`] : base;
    const { x, y } = this.toPx(col, r);
    g.fillStyle = color;
    g.fillRect(x, y, this.ts + 0.5, this.ts + 0.5);
    if (tile === "rock" || tile === "wall") {
      g.fillStyle = "rgba(255,255,255,0.12)";
      g.fillRect(x, y, this.ts, 2);
      g.fillStyle = "rgba(0,0,0,0.35)";
      g.fillRect(x, y + this.ts - 3, this.ts, 3);
    }
    if (tile === "ice") {
      g.strokeStyle = "rgba(255,255,255,0.45)";
      g.beginPath();
      g.moveTo(x + 3, y + this.ts - 3);
      g.lineTo(x + this.ts - 3, y + 3);
      g.stroke();
    }
    if (tile === "water") {
      g.fillStyle = "rgba(255,255,255,0.08)";
      g.fillRect(x + 2, y + this.ts * 0.4, this.ts * 0.5, 1.5);
    }
  }

  spriteFor(u) {
    return getSprite(spriteKey(u.creatureId, u.side === "player" ? "back" : "front"));
  }

  drawUnit(state, u, now) {
    const ctx = this.ctx;
    const fx = (this.unitFx[u.id] ||= {});
    const entry = this.spriteFor(u);
    const frame = frameFor(entry, now - this.clock0);
    const { x, y } = this.toPx(u.pos.x, u.pos.y);
    const anim = A.animationsEnabled;
    let sx = 1;
    let sy = 1;
    let dx = 0;
    let dy = 0;
    let alpha = 1;
    let tint = null;

    const ticksSinceCast = state.tick - u.lastCastTick;
    const ticksSinceRelease = u.releaseTick != null ? state.tick - u.releaseTick : 999;
    if (anim) {
      if (u.cast || ticksSinceCast < secToTicks(A.windup.sec)) {
        sx = sy = A.windup.scale;
        const m = u.cast ? u.moves[u.cast.idx] : u.moves[fx.lastMoveIdx ?? 0];
        tint = { color: tcolor(m?.type), alpha: 0.45 };
      } else if (ticksSinceRelease >= 0 && ticksSinceRelease < secToTicks(A.recovery.sec)) {
        sy = A.recovery.scale;
        sx = 1 / A.recovery.scale;
      }
      if (fx.lunge && now < fx.lunge.until) {
        const p = 1 - (fx.lunge.until - now) / (A.melee.sweepSec * 1000);
        const k = Math.sin(p * Math.PI) * this.px(A.melee.lungeTiles);
        dx += fx.lunge.dx * k;
        dy += fx.lunge.dy * k;
      }
      if (fx.hitUntil && now < fx.hitUntil) tint = { color: "#ffffff", alpha: 0.85 };
      if (fx.recoil && now < fx.recoil.until) {
        const p = (fx.recoil.until - now) / (A.recoil.sec * 1000);
        dx += fx.recoil.dx * this.px(A.recoil.tiles) * p;
        dy += fx.recoil.dy * this.px(A.recoil.tiles) * p;
      }
      if (u.paralysis && Math.floor(now / (A.paralysis.intervalSec * 1000)) % 2 === 0 && now % (A.paralysis.intervalSec * 1000) < A.paralysis.jitterSec * 1000) {
        dx += (Math.random() - 0.5) * A.paralysis.jitterPx * 2;
      }
      const speed = Math.hypot(u.vel.x, u.vel.y);
      if (speed < 0.1 && u.state === "active") dy += Math.sin((now / (A.idleBob.periodSec * 1000)) * Math.PI * 2) * A.idleBob.px;
      this.statusParticles(u, now, fx);
    }
    if (u.state === "fainting") {
      const p = ease(1 - (u.faintUntil - state.tick) / secToTicks(engine.switching.faintPuffSec));
      alpha = 1 - p;
      dy += A.faint.dropPx * p;
      tint = { color: "#6b7280", alpha: 0.9 };
    }
    if (u.state === "entering") {
      const elapsed = secToTicks(engine.switching.sec) - (u.entryUntil - state.tick);
      const p = ease(elapsed / secToTicks(A.switch.inSec));
      sx *= p;
      sy *= p;
      if (p < 1) this.drawLightPoint(x, y, 1 - p, u.side === "player" ? "#67e8f9" : "#fca5a5");
    }

    if (u.shield) this.drawShield(x, y, u);
    if (frame) {
      const scale = this.spriteScale(entry);
      const w = entry.width * scale;
      const h = entry.height * scale;
      const flip = u.side === "player" ? u.facingX < 0 : u.facingX > 0;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x + dx, y + dy + this.px(u.radius) * 0.5);
      ctx.scale(flip ? -sx : sx, sy);
      ctx.imageSmoothingEnabled = false;
      if (tint && anim) this.drawTinted(frame, -w / 2, -h, w, h, tint.color, tint.alpha);
      else ctx.drawImage(frame, -w / 2, -h, w, h);
      ctx.restore();
    } else {
      ctx.fillStyle = u.side === "player" ? "#38bdf8" : "#f87171";
      ctx.beginPath();
      ctx.arc(x, y, this.px(u.radius), 0, Math.PI * 2);
      ctx.fill();
    }
    if (u.buff && anim) this.drawBuffArrow(x, y - this.spriteHeight(entry) - 6, u.buff);
    ctx.globalAlpha = 1;
  }

  spriteScale(entry) {
    const base = A.spritePx / 64;
    let scale = base * this.scalePx();
    const maxDim = Math.max(entry?.width || 64, entry?.height || 64) * scale;
    const cap = 72 * this.scalePx();
    const floor = 32 * this.scalePx();
    if (maxDim > cap) scale *= cap / maxDim;
    if (maxDim < floor) scale *= floor / maxDim;
    return scale;
  }

  spriteHeight(entry) {
    return (entry?.height || 64) * this.spriteScale(entry);
  }

  drawTinted(frame, x, y, w, h, color, alpha) {
    const s = this.scratch;
    const fw = frame.width || frame.naturalWidth;
    const fh = frame.height || frame.naturalHeight;
    if (s.width !== fw || s.height !== fh) {
      s.width = fw;
      s.height = fh;
    }
    const g = s.getContext("2d");
    g.clearRect(0, 0, fw, fh);
    g.globalCompositeOperation = "source-over";
    g.drawImage(frame, 0, 0);
    g.globalCompositeOperation = "source-atop";
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.fillRect(0, 0, fw, fh);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    this.ctx.drawImage(s, x, y, w, h);
  }

  drawLightPoint(x, y, strength, color) {
    const ctx = this.ctx;
    const r = 4 + 10 * strength;
    ctx.save();
    ctx.globalAlpha = 0.9 * strength;
    const glow = ctx.createRadialGradient(x, y - this.px(0.6), r * 0.3, x, y - this.px(0.6), r * 2.5);
    glow.addColorStop(0, color);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y - this.px(0.6), r * 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y - this.px(0.6), r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawShield(x, y, u) {
    const ctx = this.ctx;
    const r = this.px(u.radius) * 1.9;
    ctx.save();
    ctx.globalAlpha = A.shield.alpha;
    ctx.fillStyle = tcolor(u.shield.type);
    ctx.beginPath();
    ctx.arc(x, y - this.px(0.5), r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = tcolor(u.shield.type);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  drawBuffArrow(x, y, buff) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = tcolor(buff.type);
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x + 6, y);
    ctx.lineTo(x + 2, y);
    ctx.lineTo(x + 2, y + 5);
    ctx.lineTo(x - 2, y + 5);
    ctx.lineTo(x - 2, y);
    ctx.lineTo(x - 6, y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  statusParticles(u, now, fx) {
    if (u.burn) {
      const every = A.burn.intervalSec * 1000;
      if (!fx.burnAt || now - fx.burnAt >= every) {
        fx.burnAt = now;
        this.particles.burst(u.pos.x, u.pos.y - 0.6, A.burn.particles, { color: "#f97316", speed: 1.5, maxLife: 0.5, size: 2.5, gravity: -3, spread: Math.PI / 2, angle: -Math.PI / 2 - Math.PI / 4 });
      }
    }
    if (u.paralysis) {
      const every = A.paralysis.intervalSec * 1000;
      if (!fx.paraAt || now - fx.paraAt >= every) {
        fx.paraAt = now;
        this.particles.burst(u.pos.x, u.pos.y - 0.8, A.paralysis.particles, { color: "#facc15", speed: 2.5, maxLife: 0.3, size: 2 });
      }
    }
  }

  drawAreaWindups(state) {
    const ctx = this.ctx;
    for (const side of ["player", "npc"]) {
      const u = state.teams[side].units[state.teams[side].activeIndex];
      if (!u.cast) continue;
      const m = u.moves[u.cast.idx];
      if (m.shape !== "area") continue;
      const total = u.cast.releaseTick - u.cast.startTick;
      const p = total > 0 ? ease((state.tick - u.cast.startTick) / total) : 1;
      const { x, y } = this.toPx(u.cast.target.x, u.cast.target.y);
      ctx.save();
      ctx.strokeStyle = tcolor(m.type);
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, this.px(engine.shapes.area.radius) * p, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = tcolor(m.type);
      ctx.fill();
      ctx.restore();
    }
  }

  drawProjectiles(state, now) {
    const ctx = this.ctx;
    for (const p of state.projectiles) {
      const { x, y } = this.toPx(p.pos.x, p.pos.y);
      const color = tcolor(p.type);
      const r = (A.projectile.px / 2) * this.scalePx();
      ctx.save();
      if (A.animationsEnabled) {
        const glow = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 2.2);
        glow.addColorStop(0, color);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = p.hit ? 0.55 : 0.3;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = p.hit ? 1 : 0.5;
        this.particles.spawn({ x: p.pos.x, y: p.pos.y, vx: -p.dir.x * 1.5, vy: -p.dir.y * 1.5, maxLife: A.projectile.trailSec, color, size: 2.5 });
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  consumeEvents(state, now) {
    for (const ev of state.events) {
      if (ev.id <= this.lastEventId) continue;
      this.lastEventId = ev.id;
      if (ev.kind === "switch-in") this.texts.push({ kind: "splash", text: `GO ${ev.name.toUpperCase()}!`, x: ev.x, y: ev.y - 2.2, until: now + A.switch.goSplashSec * 1000, start: now, side: ev.side });
      if (!A.animationsEnabled) continue;
      const color = tcolor(ev.type);
      switch (ev.kind) {
        case "cast":
          (this.unitFx[ev.unitId] ||= {}).lastMoveIdx = null;
          break;
        case "hit": {
          const fx = (this.unitFx[ev.targetId] ||= {});
          fx.hitUntil = now + A.hitFlash.sec * 1000;
          if (ev.source === "projectile" && ev.attackerId) {
            const att = this.findUnit(state, ev.attackerId);
            if (att) {
              const d = Math.hypot(ev.x - att.pos.x, ev.y - att.pos.y) || 1;
              fx.recoil = { dx: (ev.x - att.pos.x) / d, dy: (ev.y - att.pos.y) / d, until: now + A.recoil.sec * 1000 };
            }
          }
          const sup = ev.eff >= 2;
          this.texts.push({ kind: "dmg", text: ev.blocked === "entry" ? "0" : String(ev.damage), x: ev.x, y: ev.y - 1.4, until: now + A.damageNumber.sec * 1000, start: now, big: sup, color: sup ? "#fde047" : ev.eff === 0 ? "#94a3b8" : "#ffffff" });
          if (ev.eff >= 2) this.texts.push({ kind: "popup", text: "Super effective!", x: ev.x, y: ev.y - 2.4, until: now + A.popup.sec * 1000, start: now, color: "#fde047" });
          else if (ev.eff > 0 && ev.eff < 1) this.texts.push({ kind: "popup", text: "Not very effective", x: ev.x, y: ev.y - 2.4, until: now + A.popup.sec * 1000, start: now, color: "#94a3b8" });
          else if (ev.eff === 0) this.texts.push({ kind: "popup", text: "No effect", x: ev.x, y: ev.y - 2.4, until: now + A.popup.sec * 1000, start: now, color: "#94a3b8" });
          break;
        }
        case "projectile-hit":
          this.particles.burst(ev.x, ev.y, A.projectile.burstParticles, { color, speed: 4, maxLife: A.projectile.burstSec, size: 3 });
          break;
        case "projectile-blocked":
          this.particles.burst(ev.x, ev.y, 6, { color, speed: 2.5, maxLife: 0.3, size: 2.5 });
          break;
        case "area-detonate":
          this.effects.push({ kind: "areaFlash", x: ev.x, y: ev.y, r: ev.radius, color, until: now + A.area.flashSec * 1000, start: now });
          this.particles.burst(ev.x, ev.y, A.area.detonateParticles, { color, speed: 5, maxLife: A.area.detonateSec, size: 3 });
          break;
        case "melee-swing": {
          this.effects.push({ kind: "arc", x: ev.x, y: ev.y, dx: ev.dx, dy: ev.dy, color, until: now + A.melee.sweepSec * 1000, start: now, unitId: ev.unitId });
          (this.unitFx[ev.unitId] ||= {}).lunge = { dx: ev.dx, dy: ev.dy, until: now + A.melee.sweepSec * 1000 };
          break;
        }
        case "dash-end":
          this.effects.push({ kind: "dash", path: ev.path, color, unitId: ev.unitId, until: now + A.dash.streakSec * 1000, start: now });
          break;
        case "shield-break":
          this.particles.burst(ev.x, ev.y - 0.5, A.shield.fragments, { color, speed: 3.5, maxLife: A.shield.shatterSec, size: 4, gravity: 6 });
          break;
        case "buff":
          this.effects.push({ kind: "buffStream", unitId: ev.unitId, color, until: now + A.buff.streamSec * 1000, start: now, spawned: 0 });
          break;
        case "status":
          this.particles.burst(ev.x, ev.y - 0.6, 6, { color: ev.status === "burn" ? "#f97316" : "#facc15", speed: 2.5, maxLife: 0.4, size: 3 });
          break;
        case "faint":
          this.particles.burst(ev.x, ev.y - 0.5, A.faint.particles, { color: "#9ca3af", speed: 2.5, maxLife: A.faint.sec, size: 4, gravity: -2 });
          break;
        case "switch-out": {
          const u = this.findUnit(state, ev.unitId);
          const entry = u ? this.spriteFor(u) : null;
          this.effects.push({ kind: "shrink", x: ev.x, y: ev.y, entry, until: now + A.switch.outSec * 1000, start: now, side: ev.side, facingX: u?.facingX ?? 1 });
          break;
        }
        case "dodge":
          this.particles.burst(ev.x, ev.y, 5, { color: "#e2e8f0", speed: 2, maxLife: 0.25, size: 2 });
          break;
        default:
          break;
      }
    }
  }

  findUnit(state, id) {
    for (const side of ["player", "npc"]) for (const u of state.teams[side].units) if (u.id === id) return u;
    return null;
  }

  drawEffects(state, now) {
    const ctx = this.ctx;
    const keep = [];
    for (const e of this.effects) {
      if (now >= e.until) continue;
      const p = ease((now - e.start) / (e.until - e.start));
      switch (e.kind) {
        case "areaFlash": {
          const { x, y } = this.toPx(e.x, e.y);
          ctx.save();
          ctx.globalAlpha = (1 - p) * 0.6;
          ctx.fillStyle = e.color;
          ctx.beginPath();
          ctx.arc(x, y, this.px(e.r), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;
        }
        case "arc": {
          const u = this.findUnit(state, e.unitId);
          const { x, y } = this.toPx(u ? u.pos.x : e.x, u ? u.pos.y : e.y);
          const base = Math.atan2(e.dy, e.dx);
          const half = (A.melee.arcDeg / 2) * (Math.PI / 180);
          const sweep = -half + 2 * half * p;
          ctx.save();
          ctx.strokeStyle = e.color;
          ctx.lineWidth = 4;
          ctx.globalAlpha = 0.9 - p * 0.5;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.arc(x, y - this.px(0.3), this.px(engine.shapes.melee.reach), base - half, base + sweep);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case "dash": {
          const u = this.findUnit(state, e.unitId);
          const entry = u ? this.spriteFor(u) : null;
          const path = e.path;
          if (path.length > 1) {
            const a = this.toPx(path[0].x, path[0].y);
            const b = this.toPx(path[path.length - 1].x, path[path.length - 1].y);
            ctx.save();
            ctx.strokeStyle = e.color;
            ctx.globalAlpha = (1 - p) * 0.7;
            ctx.lineWidth = 6;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            ctx.restore();
            const frame = entry ? frameFor(entry, 0) : null;
            if (frame) {
              const scale = this.spriteScale(entry);
              const w = entry.width * scale;
              const h = entry.height * scale;
              A.dash.afterimageAlphas.forEach((alpha, i) => {
                const idx = Math.max(0, Math.floor((path.length - 1) * (1 - (i + 1) / (A.dash.afterimages + 1))));
                const pt = this.toPx(path[idx].x, path[idx].y);
                ctx.save();
                ctx.globalAlpha = alpha * (1 - p);
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(frame, pt.x - w / 2, pt.y + this.px(0.45) * 0.5 - h, w, h);
                ctx.restore();
              });
            }
          }
          break;
        }
        case "buffStream": {
          const u = this.findUnit(state, e.unitId);
          if (u) {
            const want = Math.floor(p * A.buff.streamParticles);
            while (e.spawned < want) {
              e.spawned++;
              this.particles.spawn({ x: u.pos.x + (Math.random() - 0.5) * 0.8, y: u.pos.y, vx: 0, vy: -3, maxLife: 0.5, color: e.color, size: 2.5 });
            }
          }
          break;
        }
        case "shrink": {
          const frame = e.entry ? frameFor(e.entry, 0) : null;
          const { x, y } = this.toPx(e.x, e.y);
          if (frame) {
            const scale = this.spriteScale(e.entry) * (1 - p);
            const w = e.entry.width * scale;
            const h = e.entry.height * scale;
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            ctx.globalAlpha = 1 - p * 0.5;
            ctx.drawImage(frame, x - w / 2, y + this.px(0.45) * 0.5 - h, w, h);
            ctx.restore();
          }
          this.drawLightPoint(x, y, p, e.side === "player" ? "#67e8f9" : "#fca5a5");
          break;
        }
        default:
          break;
      }
      keep.push(e);
    }
    this.effects = keep;
  }

  drawTexts(now) {
    const ctx = this.ctx;
    const keep = [];
    for (const t of this.texts) {
      if (now >= t.until) continue;
      const p = ease((now - t.start) / (t.until - t.start));
      const { x, y } = this.toPx(t.x, t.y);
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (t.kind === "splash") {
        ctx.globalAlpha = p < 0.15 ? p / 0.15 : p > 0.8 ? (1 - p) / 0.2 : 1;
        ctx.font = `700 ${Math.round(20 * this.scalePx())}px 'Chakra Petch', sans-serif`;
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(0,0,0,0.8)";
        ctx.strokeText(t.text, x, y);
        ctx.fillStyle = t.side === "player" ? "#67e8f9" : "#fca5a5";
        ctx.fillText(t.text, x, y);
      } else {
        const rise = A.damageNumber.risePx * p * this.scalePx();
        const shake = t.big && p < 0.25 ? Math.sin(p * 40) * A.damageNumber.shakePx : 0;
        ctx.globalAlpha = 1 - p * p;
        const size = t.kind === "popup" ? 11 : t.big ? A.damageNumber.superFontPx : A.damageNumber.fontPx;
        ctx.font = `${t.kind === "popup" ? 600 : 700} ${Math.round(size * this.scalePx())}px 'Chakra Petch', sans-serif`;
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.strokeText(t.text, x + shake, y - rise);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, x + shake, y - rise);
      }
      ctx.restore();
      keep.push(t);
    }
    this.texts = keep;
  }
}

export const tileLabelAt = (state, x, y) => tileAt(state, x, y);
