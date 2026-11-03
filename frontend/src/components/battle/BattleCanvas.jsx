import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { step, processInputs, replayInputsDue } from "@/game/step";
import { BattleRenderer } from "@/game/render/renderer";
import { FpsGovernor, subscribeGfx, getGfx, gfxConfig } from "@/game/render/quality";
import { TICK_SEC, terrains } from "@/game/config";
import { abilityStatus, isTrapped, weatherStatus } from "@/game/abilities";

export function makeSnapshot(state, fps) {
  const side = (s) => {
    const team = state.teams[s];
    const u = team.units[team.activeIndex];
    return {
      name: u.name,
      hp: u.hp,
      maxHp: u.maxHp,
      types: u.types,
      state: u.state,
      burn: !!u.burn,
      paralysis: !!u.paralysis,
      buff: u.buff ? u.buff.stat : null,
      shield: !!u.shield,
      intimidated: !!u.abilityState?.intimidated,
      ability: abilityStatus(state, u),
      trapped: isTrapped(state, team),
      moves: u.moves.map((m) => ({ name: m.name, type: m.type, shape: m.shape, cd: Math.max(0, m.cdUntil - state.tick) / (m.cooldownSec / TICK_SEC) })),
      dots: team.units.map((x, i) => (x.state === "fainted" || x.state === "fainting" || x.hp <= 0 ? "fainted" : i === team.activeIndex && x.state !== "bench" ? "active" : !x.revealed && s === "npc" ? "unknown" : "alive")),
      bench: team.units.map((x) => ({ index: x.index, name: x.name, hp: x.hp, maxHp: x.maxHp, state: x.state, creatureId: x.creatureId, types: x.types, burn: !!x.burn, paralysis: !!x.paralysis })),
      pendingPick: team.pendingPick,
      creatureId: u.creatureId,
      index: u.index,
      label: s === "npc" && state.meta?.rival ? `${team.name} · Lv.${state.meta.rival.level}` : team.name,
    };
  };
  return { tick: state.tick, phase: state.phase, winner: state.winner, player: side("player"), npc: side("npc"), weather: weatherStatus(state), fps };
}

export const BattleCanvas = ({ stateRef, speedRef, pausedRef, onSnapshot, rendererRef, onForcePause }) => {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const renderer = new BattleRenderer(canvas);
    rendererRef.current = renderer;
    window.__renderer = renderer;
    renderer.setQuality(getGfx().level);
    const unsubGfx = subscribeGfx((g) => renderer.setQuality(g.level));
    const governor = new FpsGovernor();
    let lastFpsCheck = performance.now() + 2500;
    const fit = () => {
      if (!wrapRef.current) return;
      const box = wrapRef.current.getBoundingClientRect();
      const aspect = terrains.cols / terrains.rows;
      let h = box.height;
      let w = h * aspect;
      if (w > box.width) {
        w = box.width;
        h = w / aspect;
      }
      renderer.resize(Math.floor(w), Math.floor(h), Math.min(2, window.devicePixelRatio || 1));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrapRef.current);

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let lastSnap = 0;
    let frozenNow = null;
    const frame = (now) => {
      const state = stateRef.current;
      if (state) {
        const dt = Math.min(0.25, (now - last) / 1000);
        if (state.replayInputs && state.phase === "running" && state.teams.player.pendingPick && !state.autoPick) {
          if (!state.replayInputs.length) state.autoPick = true;
          else if (!replayInputsDue(state)) {
            const i = state.replayInputs.findIndex((x) => x.type === "pick");
            if (i >= 0) state.inputs.push({ ...state.replayInputs.splice(i, 1)[0], tick: state.tick });
            else state.autoPick = true;
          }
        }
        if (!pausedRef.current && state.phase === "running") {
          acc += dt * speedRef.current;
          let n = 0;
          while (acc >= TICK_SEC && n < 240) {
            step(state);
            acc -= TICK_SEC;
            n++;
          }
        } else {
          acc = 0;
          if ((state.inputs.length || replayInputsDue(state)) && state.phase === "running") {
            processInputs(state);
            lastSnap = 0;
          }
        }
        const hook = window.__pauseOnEvent;
        if (hook && !hook.done) {
          if (hook.armedAt == null) {
            const ev = state.events.find((e) => e.id > (hook.afterId || 0) && e.kind === hook.kind && (!hook.status || e.status === hook.status) && (!hook.side || e.side === hook.side) && (!hook.move || e.move === hook.move) && (!hook.ability || e.ability === hook.ability));
            if (ev) {
              hook.armedAt = now + (hook.delayMs || 0);
              hook.eventTick = ev.tick;
            }
          }
          if (hook.armedAt != null && now >= hook.armedAt) {
            hook.done = true;
            onForcePause?.(true);
          }
        }
        if (pausedRef.current) {
          if (frozenNow == null) frozenNow = now;
        } else frozenNow = null;
        try {
          renderer.render(state, frozenNow ?? now);
        } catch (err) {
          if (!renderer.renderErrors) renderer.renderErrors = 0;
          renderer.renderErrors++;
          if (renderer.renderErrors <= 3) console.error("render error (simulation continues)", err);
          renderer.effects = [];
          renderer.particles.items = [];
        }
        if (now - lastFpsCheck > 1000) {
          lastFpsCheck = now;
          if (state.phase === "running" && !pausedRef.current && document.visibilityState === "visible") {
            const dropped = governor.sample(renderer.fps.value);
            if (dropped) toast.info(`Graphics lowered to ${gfxConfig(dropped).label}`, { description: "Frame rate dipped — change it any time on the Save page.", duration: 2500 });
          }
        }
        if (now - lastSnap > 100) {
          lastSnap = now;
          onSnapshot(makeSnapshot(state, renderer.fps.value));
        }
      }
      last = now;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      unsubGfx();
    };
  }, [stateRef, speedRef, pausedRef, onSnapshot, rendererRef, onForcePause]);

  return (
    <div className="absolute inset-0" style={{ paddingTop: "calc(92px + env(safe-area-inset-top))", paddingBottom: "calc(130px + env(safe-area-inset-bottom))" }}>
      <div ref={wrapRef} className="flex h-full w-full items-center justify-center">
        <canvas ref={canvasRef} data-testid="battle-canvas" className="block rounded-lg" style={{ touchAction: "none" }} />
      </div>
    </div>
  );
};
