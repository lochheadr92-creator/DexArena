import { Trophy, Skull, RotateCcw, Grid3x3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TICK_RATE } from "@/game/config";

const Table = ({ title, units, testId }) => (
  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3" data-testid={testId}>
    <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">{title}</p>
    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1 text-[11px]">
      <span className="text-slate-500">Creature</span>
      <span className="text-right text-slate-500">HP</span>
      <span className="text-right text-slate-500">KOs</span>
      <span className="text-right text-slate-500">Dmg</span>
      {units.map((u) => (
        <div key={u.id} className="contents" data-testid={`result-row-${u.id}`}>
          <span className={cn("truncate", u.hp <= 0 ? "text-slate-500 line-through" : "text-slate-100")}>{u.name}</span>
          <span className="text-right font-mono text-slate-300">{u.hp}/{u.maxHp}</span>
          <span className="text-right font-mono text-slate-300">{u.kills}</span>
          <span className="text-right font-mono text-slate-300">{u.damageDealt}</span>
        </div>
      ))}
    </div>
  </div>
);

export const ResultScreen = ({ state, onRematch, onBack }) => {
  const win = state.winner === "player";
  const remaining = (side) => state.teams[side].units.filter((u) => u.hp > 0).length;
  const seconds = (state.endTick / TICK_RATE).toFixed(1);
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-md" data-testid="result-screen">
      <div className="w-full max-w-md space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-center gap-3">
          <span className={cn("flex h-12 w-12 items-center justify-center rounded-xl", win ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300")}>
            {win ? <Trophy className="h-6 w-6" /> : <Skull className="h-6 w-6" />}
          </span>
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-slate-50" data-testid="result-title">
              {win ? "Win" : "Loss"}
            </h2>
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400" data-testid="result-meta">
              {seconds}s · you {remaining("player")}/6 · rival {remaining("npc")}/6 · seed {state.seed}
            </p>
          </div>
        </div>
        <Table title="Your team" units={state.teams.player.units} testId="result-table-player" />
        <Table title={`Rival — ${state.teams.npc.name}`} units={state.teams.npc.units} testId="result-table-npc" />
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button type="button" data-testid="rematch-button" onClick={onRematch} className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-cyan-500 font-display text-sm font-bold uppercase tracking-wider text-slate-950 hover:bg-cyan-400">
            <RotateCcw className="h-4 w-4" /> Rematch
          </button>
          <button type="button" data-testid="back-to-roster-button" onClick={onBack} className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-700 font-display text-sm font-bold uppercase tracking-wider text-slate-200 hover:border-slate-500">
            <Grid3x3 className="h-4 w-4" /> Roster
          </button>
        </div>
      </div>
    </div>
  );
};
