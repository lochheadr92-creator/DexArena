import { X, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGame } from "@/context/GameContext";
import { SpriteImg } from "@/components/SpriteImg";
import { TypeBadge } from "@/components/TypeBadge";

export const TeamStrip = ({ bench, forced, onPick, onClose, onAuto }) => {
  const { creatures } = useGame();
  return (
    <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/70 backdrop-blur-sm" data-testid="team-strip">
      <div className="w-full rounded-t-2xl border border-slate-800 bg-slate-900 p-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-400">{forced ? "Your creature fainted" : "Switch creature"}</p>
            <h3 className="font-display text-lg font-bold text-slate-50">{forced ? "Choose who goes next" : "Pick a replacement"}</h3>
          </div>
          {!forced && (
            <button type="button" data-testid="team-strip-close" onClick={onClose} aria-label="Close" className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-700 text-slate-300">
              <X className="h-5 w-5" />
            </button>
          )}
          {forced && onAuto && (
            <button type="button" data-testid="team-strip-auto" onClick={onAuto} className="flex min-h-[48px] items-center gap-1.5 rounded-lg border border-emerald-700/70 bg-emerald-950/40 px-3 font-mono text-[10px] uppercase tracking-wider text-emerald-200 hover:border-emerald-400">
              <Wand2 className="h-4 w-4" /> Auto pick
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {bench.map((b) => {
            const c = creatures[b.creatureId];
            const pickable = b.state === "bench" && b.hp > 0;
            const pct = Math.max(0, (b.hp / b.maxHp) * 100);
            return (
              <button
                key={b.index}
                type="button"
                data-testid={`team-strip-slot-${b.index}`}
                data-pickable={pickable}
                disabled={!pickable}
                onClick={() => onPick(b.index)}
                className={cn(
                  "flex min-h-[96px] flex-col items-center gap-1 rounded-xl border p-2 text-center transition-colors",
                  pickable ? "border-slate-700 bg-slate-950/70 hover:border-cyan-400" : "border-slate-900 bg-slate-950/40 opacity-50",
                  b.state === "active" && "border-cyan-500/60",
                )}
              >
                <SpriteImg src={c?.sprite} alt={b.name} className="h-12 w-12" locked={b.hp <= 0} />
                <span className="w-full truncate text-[11px] font-semibold text-slate-100">{b.name}</span>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: pct > 50 ? "#10B981" : pct > 20 ? "#F59E0B" : "#EF4444" }} />
                </div>
                <span className="font-mono text-[9px] text-slate-400">
                  {b.hp}/{b.maxHp} {b.state === "active" ? "· out" : b.hp <= 0 ? "· fainted" : ""}
                </span>
                <span className="flex gap-0.5">
                  {b.types.map((t) => (
                    <TypeBadge key={t} type={t} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
