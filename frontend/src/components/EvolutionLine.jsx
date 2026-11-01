import { ChevronRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGame } from "@/context/GameContext";
import { DEX } from "@/constants/testIds/dex";
import { SpriteImg } from "@/components/SpriteImg";

function buildStages(creature, creatures) {
  let base = creature;
  const seen = new Set([creature.id]);
  while (base.evolvesFrom != null && creatures[base.evolvesFrom] && !seen.has(base.evolvesFrom)) {
    base = creatures[base.evolvesFrom];
    seen.add(base.id);
  }
  const stages = [[base.id]];
  let frontier = [base];
  while (frontier.length) {
    const nextIds = frontier.flatMap((c) => c.evolvesTo);
    if (!nextIds.length) break;
    stages.push(nextIds);
    frontier = nextIds.map((id) => creatures[id]).filter(Boolean);
  }
  return stages;
}

export const EvolutionLine = ({ creature, onPick }) => {
  const { creatures, unlockedIds } = useGame();
  const stages = buildStages(creature, creatures);
  if (stages.length === 1 && stages[0].length === 1) {
    return <p className="text-xs text-slate-500">Does not evolve.</p>;
  }
  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
      {stages.map((ids, idx) => (
        <div key={idx} className="flex items-center gap-1">
          {idx > 0 && <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />}
          <div className={cn("grid gap-1", ids.length > 3 ? "grid-cols-4" : "grid-cols-1")}>
            {ids.map((id) => {
              const c = creatures[id];
              const locked = !unlockedIds.has(id);
              const current = id === creature.id;
              return (
                <button
                  key={id}
                  type="button"
                  data-testid={DEX.evoNode(id)}
                  onClick={() => onPick(id)}
                  className={cn(
                    "relative flex h-14 w-14 flex-col items-center justify-center rounded-lg border transition-colors",
                    current ? "border-cyan-400/70 bg-cyan-500/10" : "border-slate-800 bg-slate-900/70 hover:border-slate-600",
                  )}
                >
                  {c ? (
                    <SpriteImg src={c.sprite} alt={c.displayName} locked={locked} className="h-10 w-10" />
                  ) : (
                    <span className="font-accent text-[7px] text-slate-500">#{id}</span>
                  )}
                  {locked && <Lock className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 text-slate-500" />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
