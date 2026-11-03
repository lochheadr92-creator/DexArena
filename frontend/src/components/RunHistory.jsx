import { useState } from "react";
import { ChevronDown, Crown, Skull, XCircle, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { GAUNTLET_STAGES } from "@/lib/gauntlet";
import { itemInfo } from "@/lib/items";
import { formatDate } from "@/lib/format";
import { archetypes as archetypeConfig } from "@/game/config";
import { SpriteImg } from "@/components/SpriteImg";
import { ItemIcon } from "@/components/ItemIcon";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const OUTCOME = {
  cleared: { label: "Cleared", icon: Crown, className: "border-amber-500/50 bg-amber-500/15 text-amber-200" },
  lost: { label: "Fell", icon: Skull, className: "border-rose-800/60 bg-rose-950/40 text-rose-200" },
  abandoned: { label: "Abandoned", icon: XCircle, className: "border-slate-700 bg-slate-800/60 text-slate-300" },
};

const Entry = ({ entry, number, creatures, index }) => {
  const o = OUTCOME[entry.outcome] || OUTCOME.abandoned;
  const Icon = o.icon;
  const detail = entry.outcome === "cleared" ? `all ${GAUNTLET_STAGES} trainers beaten` : `${entry.outcome === "lost" ? "fell to" : "left before"} trainer ${entry.stageReached} · ${archetypeConfig.archetypes[entry.archetypes?.[entry.stageReached - 1]]?.name || "Hidden trainer"}`;
  return (
    <li data-testid={`gauntlet-history-entry-${index}`} data-outcome={entry.outcome} data-cleared={entry.cleared} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <div className="flex items-center gap-2">
        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider", o.className)}>
          <Icon className="h-3 w-3" /> {o.label}
        </span>
        <span className="font-display text-sm font-bold text-slate-50" data-testid={`gauntlet-history-stage-${index}`}>
          Stage {entry.cleared}/{GAUNTLET_STAGES}
        </span>
        <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-slate-500">
          run #{number} · {formatDate(entry.endedAt || entry.startedAt)}
        </span>
      </div>
      <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-slate-500">{detail}</p>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex gap-1" data-testid={`gauntlet-history-team-${index}`}>
          {entry.team.map((id, i) => {
            const c = creatures[id];
            return <SpriteImg key={`${id}-${i}`} src={c?.sprite} alt={c?.displayName || `#${id}`} className="h-8 w-8" />;
          })}
        </div>
        <div className="ml-auto flex items-center gap-1" data-testid={`gauntlet-history-items-${index}`} data-count={entry.items.length}>
          {entry.items.length === 0 ? (
            <span className="font-mono text-[9px] uppercase tracking-wider text-slate-600">no items</span>
          ) : (
            entry.items.map((id, i) => <ItemIcon key={`${id}-${i}`} item={itemInfo(id)} className="h-6 w-6" />)
          )}
        </div>
      </div>
    </li>
  );
};

export const RunHistory = ({ history, runs, hasActive, creatures }) => {
  const [open, setOpen] = useState(true);
  if (!history.length) {
    return (
      <p className="rounded-xl border border-dashed border-slate-800 px-3 py-2.5 font-mono text-[10px] uppercase tracking-wider text-slate-500" data-testid="gauntlet-history-empty">
        Finished runs show up here — team, stage reached and items earned
      </p>
    );
  }
  const first = runs - (hasActive ? 1 : 0);
  return (
    <Collapsible open={open} onOpenChange={setOpen} data-testid="gauntlet-history">
      <CollapsibleTrigger asChild>
        <button type="button" data-testid="gauntlet-history-toggle" data-open={open} className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2.5 text-left">
          <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-slate-400">
            <History className="h-3.5 w-3.5 text-amber-400" /> Run history · {history.length}
          </span>
          <ChevronDown className={cn("h-4 w-4 text-slate-500 transition-transform", open && "rotate-180")} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="mt-2 space-y-2" data-testid="gauntlet-history-list">
          {history.map((entry, i) => (
            <Entry key={`${entry.seed}-${entry.startedAt}`} entry={entry} number={Math.max(1, first - i)} creatures={creatures} index={i} />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
};
