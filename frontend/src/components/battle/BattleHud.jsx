import { Flame, Zap, Shield, ArrowUp, Pause, Play, Repeat, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { typeColor } from "@/lib/types";
import { TypeBadge } from "@/components/TypeBadge";

const CooldownRing = ({ move }) => {
  const r = 7;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex h-5 w-5 items-center justify-center" title={move.name} data-testid={`cooldown-ring-${move.name}`}>
      <svg viewBox="0 0 20 20" className="h-5 w-5 -rotate-90">
        <circle cx="10" cy="10" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
        <circle cx="10" cy="10" r={r} fill="none" stroke={typeColor(move.type)} strokeWidth="3" strokeDasharray={c} strokeDashoffset={c * move.cd} strokeLinecap="round" />
      </svg>
    </span>
  );
};

const Dots = ({ dots, testId }) => (
  <div className="flex gap-1" data-testid={testId}>
    {dots.map((d, i) => (
      <span
        key={i}
        data-dot={d}
        className={cn(
          "h-2.5 w-2.5 rounded-full border",
          d === "unknown" && "border-slate-500 bg-slate-800",
          d === "alive" && "border-emerald-400 bg-emerald-500",
          d === "active" && "border-cyan-200 bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.9)]",
          d === "fainted" && "border-rose-900 bg-rose-950",
        )}
      />
    ))}
  </div>
);

const HpBar = ({ hp, maxHp, numeric, side }) => {
  const pct = Math.max(0, (hp / maxHp) * 100);
  const color = pct > 50 ? "#10B981" : pct > 20 ? "#F59E0B" : "#EF4444";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full border border-slate-700/70 bg-slate-800" data-testid={`hp-bar-${side}`}>
        <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      {numeric && (
        <span className="font-mono text-[11px] font-bold tabular-nums text-slate-100" data-testid={`hp-text-${side}`}>
          {hp}/{maxHp}
        </span>
      )}
    </div>
  );
};

const StatusIcons = ({ u }) => (
  <span className="flex items-center gap-1">
    {u.burn && <Flame className="h-3.5 w-3.5 text-orange-400" data-testid="status-icon-burn" />}
    {u.paralysis && <Zap className="h-3.5 w-3.5 text-yellow-300" data-testid="status-icon-paralysis" />}
    {u.shield && <Shield className="h-3.5 w-3.5 text-cyan-300" />}
    {u.buff && <ArrowUp className="h-3.5 w-3.5 text-emerald-300" />}
  </span>
);

const SideBar = ({ u, side, label, numeric, children }) => (
  <div className="rounded-xl border border-slate-800 bg-slate-950/85 px-3 py-2 backdrop-blur-md" data-testid={`hud-${side}`}>
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate font-display text-sm font-bold text-slate-50" data-testid={`hud-${side}-name`}>
          {u.name}
        </span>
        <span className="flex gap-1">
          {u.types.map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </span>
        <StatusIcons u={u} />
      </div>
      <span className="shrink-0 font-mono text-[9px] uppercase tracking-widest text-slate-400">{label}</span>
    </div>
    <div className="mt-1.5 flex items-center gap-2">
      <div className="flex-1">
        <HpBar hp={u.hp} maxHp={u.maxHp} numeric={numeric} side={side} />
      </div>
      <span className="flex gap-0.5">
        {u.moves.map((m, i) => (
          <CooldownRing key={i} move={m} />
        ))}
      </span>
    </div>
    <div className="mt-1.5 flex items-center justify-between">
      <Dots dots={u.dots} testId={`team-dots-${side}`} />
      {children}
    </div>
  </div>
);

export const BattleHud = ({ snap, speed, setSpeed, paused, setPaused, autoPick, setAutoPick, onSwitch }) => {
  if (!snap) return null;
  const canSwitch = snap.phase === "running" && snap.player.state === "active" && snap.player.bench.some((b) => b.state === "bench" && b.hp > 0);
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 p-2" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
        <div className="pointer-events-auto">
          <SideBar u={snap.npc} side="npc" label={snap.npc.label} numeric={false} />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-2" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
        <div className="pointer-events-auto">
          <SideBar u={snap.player} side="player" label="You" numeric>
            <button
              type="button"
              data-testid="switch-button"
              disabled={!canSwitch}
              onClick={onSwitch}
              className="flex min-h-[48px] min-w-[48px] items-center gap-1.5 rounded-lg bg-cyan-500 px-3 font-display text-xs font-bold uppercase tracking-wider text-slate-950 transition-colors hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500"
            >
              <Repeat className="h-4 w-4" /> Switch
            </button>
          </SideBar>
        </div>
      </div>

      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 flex-col gap-1.5" data-testid="battle-controls">
        {[1, 2, 4].map((s) => (
          <button
            key={s}
            type="button"
            data-testid={`speed-control-${s}x`}
            data-active={speed === s}
            onClick={() => setSpeed(s)}
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-lg border font-mono text-xs font-bold backdrop-blur-md transition-colors",
              speed === s ? "border-cyan-400 bg-cyan-500/20 text-cyan-200" : "border-slate-700 bg-slate-950/80 text-slate-300",
            )}
          >
            {s}x
          </button>
        ))}
        <button
          type="button"
          data-testid="speed-control-pause"
          data-active={paused}
          onClick={() => setPaused(!paused)}
          aria-label={paused ? "Resume" : "Pause"}
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-lg border backdrop-blur-md transition-colors",
            paused ? "border-amber-400 bg-amber-500/20 text-amber-200" : "border-slate-700 bg-slate-950/80 text-slate-300",
          )}
        >
          {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
        </button>
        <button
          type="button"
          data-testid="auto-pick-toggle"
          data-active={autoPick}
          onClick={() => setAutoPick(!autoPick)}
          aria-label="Toggle auto pick"
          className={cn(
            "flex h-12 w-12 flex-col items-center justify-center rounded-lg border font-mono text-[8px] uppercase backdrop-blur-md transition-colors",
            autoPick ? "border-emerald-400 bg-emerald-500/20 text-emerald-200" : "border-slate-700 bg-slate-950/80 text-slate-400",
          )}
        >
          <Wand2 className="h-4 w-4" />
          Auto
        </button>
      </div>
    </>
  );
};
