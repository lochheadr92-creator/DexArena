import { useNavigate } from "react-router-dom";
import { ArrowRight, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGame } from "@/context/GameContext";
import { TEAM_SIZE } from "@/lib/save";
import { DEX } from "@/constants/testIds/dex";
import { SpriteImg } from "@/components/SpriteImg";

export const TeamTray = () => {
  const { creatures, save, toggleTeam, clearTeam } = useGame();
  const navigate = useNavigate();
  const full = save.team.length === TEAM_SIZE;

  return (
    <div
      className="fixed left-0 right-0 z-40 border-t border-slate-800 bg-slate-950/95 px-3 py-2 shadow-2xl backdrop-blur-xl"
      style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-md items-center gap-2 md:max-w-2xl lg:max-w-4xl">
        <div className="flex flex-1 items-center gap-1.5">
          {Array.from({ length: TEAM_SIZE }, (_, i) => {
            const id = save.team[i];
            const c = id ? creatures[id] : null;
            return (
              <button
                key={i}
                type="button"
                data-testid={DEX.traySlot(i)}
                data-filled={!!id}
                disabled={!id}
                onClick={() => id && toggleTeam(id)}
                aria-label={c ? `Remove ${c.displayName}` : `Empty slot ${i + 1}`}
                className={cn(
                  "group relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border transition-[border-color,background-color] sm:h-14 sm:w-14",
                  id
                    ? "border-blue-500/50 bg-blue-950/30 hover:border-rose-500/60 hover:bg-rose-950/30"
                    : "border-dashed border-slate-800 bg-slate-900/50",
                )}
              >
                {c ? (
                  <>
                    <SpriteImg src={c.sprite} alt={c.displayName} className="h-11 w-11 sm:h-12 sm:w-12" />
                    <span className="absolute inset-0 flex items-center justify-center bg-rose-950/70 opacity-0 transition-opacity group-hover:opacity-100">
                      <X className="h-4 w-4 text-rose-200" />
                    </span>
                  </>
                ) : id ? (
                  <span className="font-accent text-[8px] text-slate-500">#{id}</span>
                ) : (
                  <span className="font-accent text-[8px] text-slate-700">{i + 1}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col items-end gap-1">
          <span data-testid={DEX.trayCount} className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
            Team <span className={full ? "text-emerald-400" : "text-cyan-300"}>{save.team.length}</span>/{TEAM_SIZE}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid={DEX.clearTeam}
              disabled={!save.team.length}
              onClick={clearTeam}
              aria-label="Clear team"
              className="rounded-lg border border-slate-800 p-2 text-slate-400 transition-colors hover:border-rose-700 hover:text-rose-300 disabled:opacity-30"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              data-testid={DEX.toArena}
              disabled={!full}
              onClick={() => navigate("/arena")}
              className="flex items-center gap-1 rounded-lg bg-cyan-500 px-3 py-2 font-display text-xs font-bold uppercase tracking-wider text-slate-950 transition-[background-color,transform] hover:bg-cyan-400 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
            >
              Arena <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
