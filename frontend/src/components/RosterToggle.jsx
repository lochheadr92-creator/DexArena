import { useGame } from "@/context/GameContext";
import { ROSTERS } from "@/lib/rosters";
import { cn } from "@/lib/utils";

const SUBTITLE = { pokemon: "Gen I–IV · PokéAPI", original: "150 original species" };

export const RosterToggle = () => {
  const { rosterId, setRoster } = useGame();
  return (
    <div
      data-testid="roster-toggle"
      data-roster={rosterId}
      className="flex items-center gap-0.5 rounded-full border border-slate-800 bg-slate-900/70 p-0.5"
    >
      {Object.values(ROSTERS).map((r) => {
        const active = rosterId === r.id;
        return (
          <button
            key={r.id}
            type="button"
            data-testid={`roster-toggle-${r.id}`}
            data-active={active}
            onClick={() => setRoster(r.id)}
            title={SUBTITLE[r.id]}
            className={cn(
              "rounded-full px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider transition-[background-color,color,transform] duration-150 active:scale-95",
              active ? "bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.5)]" : "text-slate-400 hover:text-slate-200",
            )}
          >
            {r.name}
          </button>
        );
      })}
    </div>
  );
};
