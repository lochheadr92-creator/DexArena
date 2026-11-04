import { Check, CircleOff, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGame } from "@/context/GameContext";
import { abilityDef, abilityName, abilityDescription, chosenSlot } from "@/game/abilities";

const GROUP_LABEL = { entry: "On entry", pinch: "Pinch", offense: "Offense", defense: "Defense", contact: "Contact", status: "Status", weather: "Weather" };

export const AbilityPicker = ({ creature }) => {
  const { save, setAbility } = useGame();
  const list = creature.abilities;
  if (!list) {
    return (
      <p className="rounded-lg border border-dashed border-slate-800 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-slate-500" data-testid="ability-syncing">
        Ability data is syncing from PokéAPI…
      </p>
    );
  }
  if (!list.length) return <p className="text-xs text-slate-500" data-testid="ability-none">No ability recorded for this species.</p>;
  const chosen = chosenSlot(creature, save.abilities);
  return (
    <div className="space-y-1.5" data-testid="ability-section" data-chosen={list[chosen]}>
      {list.map((id, i) => {
        const def = abilityDef(id);
        const active = i === chosen;
        return (
          <button
            key={id}
            type="button"
            data-testid={`ability-option-${id}`}
            data-active={active}
            disabled={list.length === 1}
            onClick={() => setAbility(creature.id, i)}
            className={cn(
              "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
              active ? "border-amber-400/60 bg-amber-400/10" : "border-slate-800 bg-slate-950/60 hover:border-slate-700",
              list.length === 1 && "cursor-default",
            )}
          >
            <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", active ? "border-amber-400 bg-amber-400 text-slate-950" : "border-slate-700 text-slate-600")}>
              {active ? <Check className="h-3 w-3" /> : def ? <Sparkles className="h-3 w-3" /> : <CircleOff className="h-3 w-3" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="font-display text-sm font-bold text-slate-50" data-testid={active ? "ability-chosen-name" : undefined}>
                  {abilityName(id)}
                </span>
                <span className={cn("rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider", def ? "border-slate-700 text-slate-400" : "border-slate-600 text-slate-400")} style={def ? { borderColor: `${def.color}66`, color: def.color } : undefined}>
                  {def ? GROUP_LABEL[def.group] || def.group : "No effect in Arena"}
                </span>
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-slate-400" data-testid={`ability-desc-${id}`}>
                {def ? abilityDescription(id) : "This ability relies on mechanics the Arena does not simulate (crits, flinches, sleep, items…), so it does nothing here."}
              </span>
            </span>
          </button>
        );
      })}
      {list.length > 1 && <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Tap to choose which ability this species brings into battle</p>}
    </div>
  );
};
