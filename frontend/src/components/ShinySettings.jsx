import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGame } from "@/context/GameContext";
import { SHINY_PRESETS } from "@/lib/shiny";

export const ShinySettings = () => {
  const { save, setShinyRate } = useGame();
  const active = SHINY_PRESETS.find((p) => p.value === save.shinyRate) || SHINY_PRESETS.find((p) => p.value === 14);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4" data-testid="shiny-settings">
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-500">
        <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Shiny odds
      </div>
      <p className="mt-2 text-xs text-slate-400">
        How often a creature family turns out shiny. Changing this reshuffles which of your creatures are shiny.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SHINY_PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            data-testid={`shiny-rate-${p.value}`}
            aria-pressed={active?.value === p.value}
            onClick={() => setShinyRate(p.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors",
              active?.value === p.value
                ? "border-amber-400/70 bg-amber-400/15 text-amber-200"
                : "border-slate-700 text-slate-300 hover:border-amber-400/50 hover:text-amber-200",
            )}
          >
            {p.label}
            {p.value > 0 && <span className="ml-1 text-slate-500">1/{p.value}</span>}
          </button>
        ))}
      </div>
    </section>
  );
};
