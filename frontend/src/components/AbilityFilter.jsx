import { useMemo, useState } from "react";
import { Check, ChevronDown, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { abilityDef, abilityName, abilityDescription } from "@/game/abilities";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export function abilityOptions(list) {
  const counts = {};
  for (const c of list) for (const a of c.abilities || []) counts[a] = (counts[a] || 0) + 1;
  return Object.keys(counts)
    .map((id) => ({ id, name: abilityName(id), count: counts[id], def: abilityDef(id) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const Option = ({ o, selected, onPick }) => (
  <CommandItem value={o.name} keywords={[o.id]} onSelect={() => onPick(o.id)} data-testid={`ability-filter-option-${o.id}`} data-count={o.count} className="flex items-center gap-2 aria-selected:bg-slate-800">
    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: o.def ? o.def.color : "#475569" }} />
    <span className={cn("flex-1 truncate text-sm", o.def ? "text-slate-100" : "text-slate-400")}>{o.name}</span>
    <span className="font-mono text-[10px] text-slate-500">×{o.count}</span>
    {selected && <Check className="h-3.5 w-3.5 text-cyan-300" />}
  </CommandItem>
);

export const AbilityFilter = ({ value, onChange, list }) => {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => abilityOptions(list), [list]);
  const effective = options.filter((o) => o.def);
  const other = options.filter((o) => !o.def);
  const pick = (id) => {
    onChange(id === value ? null : id);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="ability-filter-button"
          data-active={!!value}
          data-ability={value || ""}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-[background-color,border-color,color,transform] duration-150 active:scale-95",
            value ? "border-amber-400/70 bg-amber-500/15 text-amber-200" : "border-slate-800 bg-slate-900/70 text-slate-400 hover:border-slate-600 hover:text-slate-200",
          )}
        >
          <Sparkles className="h-3 w-3" />
          {value ? abilityName(value) : "Ability"}
          <ChevronDown className="h-3 w-3 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,20rem)] border-slate-800 bg-slate-900 p-0 text-slate-100" data-testid="ability-filter-popover">
        <Command className="bg-slate-900 text-slate-100" loop>
          <CommandInput placeholder="Search abilities…" data-testid="ability-filter-search" className="text-slate-100 placeholder:text-slate-500" />
          <CommandList className="max-h-[55vh] [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[9px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-slate-500">
            <CommandEmpty className="py-6 text-center text-xs text-slate-500">No ability found.</CommandEmpty>
            {value && (
              <CommandGroup>
                <CommandItem value="__any" onSelect={() => pick(null)} data-testid="ability-filter-clear" className="gap-2 text-rose-300 aria-selected:bg-slate-800">
                  <X className="h-3.5 w-3.5" /> Any ability
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading={`Arena-effective · ${effective.length}`}>
              {effective.map((o) => (
                <Option key={o.id} o={o} selected={o.id === value} onPick={pick} />
              ))}
            </CommandGroup>
            <CommandGroup heading={`No effect in Arena · ${other.length}`}>
              {other.map((o) => (
                <Option key={o.id} o={o} selected={o.id === value} onPick={pick} />
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export const AbilityFilterNote = ({ value, count }) => {
  const def = abilityDef(value);
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-900/50 bg-amber-950/20 px-3 py-2" data-testid="ability-filter-desc" data-ability={value}>
      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: def?.color || "#94a3b8" }} />
      <p className="text-xs leading-snug text-slate-300">
        <span className="font-semibold text-slate-50">{abilityName(value)}</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500"> · {count} species</span>
        <br />
        {def ? abilityDescription(value) : "No effect in Arena battles — listed for completeness."}
      </p>
    </div>
  );
};
