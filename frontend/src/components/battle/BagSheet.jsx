import { X, ArrowRight } from "lucide-react";
import { useGame } from "@/context/GameContext";
import { SpriteImg } from "@/components/SpriteImg";
import { ItemIcon } from "@/components/ItemIcon";
import { optionsFor, bagCount } from "@/lib/items";

export const BagSheet = ({ creatureId, unitName, onUse, onClose }) => {
  const { creatures, save, catalog } = useGame();
  const options = optionsFor(creatureId, catalog).map((o) => ({ ...o, have: bagCount(save, o.itemId), target: creatures[o.to] }));
  const base = creatures[creatureId];
  return (
    <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/70 backdrop-blur-sm" data-testid="bag-sheet">
      <div className="w-full rounded-t-2xl border border-slate-800 bg-slate-900 p-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-400">Bag · evolution items</p>
            <h3 className="font-display text-lg font-bold text-slate-50">Evolve {unitName} now?</h3>
          </div>
          <button type="button" data-testid="bag-close" onClick={onClose} aria-label="Close" className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-700 text-slate-300">
            <X className="h-5 w-5" />
          </button>
        </div>
        {options.length === 0 && <p className="text-sm text-slate-400" data-testid="bag-empty">{unitName} has no item evolution.</p>}
        <div className="space-y-2">
          {options.map((o) => (
            <button
              key={o.itemId}
              type="button"
              data-testid={`bag-use-${o.itemId}`}
              disabled={o.have <= 0}
              onClick={() => onUse(o)}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/70 p-2.5 text-left transition-colors hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ItemIcon item={o.item} className="h-10 w-10 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-100">{o.item.name}</p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  {o.have > 0 ? `In bag ×${o.have}` : "Not in bag"}
                </p>
              </div>
              <span className="flex items-center gap-1 text-slate-300">
                <SpriteImg src={base?.sprite} alt={base?.displayName} className="h-9 w-9" />
                <ArrowRight className="h-4 w-4 text-cyan-400" />
                <SpriteImg src={o.target?.sprite} alt={o.target?.displayName} className="h-9 w-9" />
              </span>
              <div className="w-20 text-right">
                <p className="truncate text-xs font-semibold text-slate-100">{o.target?.displayName}</p>
                <p className="font-mono text-[10px] text-emerald-300">BST {o.target?.bst}</p>
              </div>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-snug text-slate-500">Evolving keeps HP %, cooldowns and status; stats, types, sprite and moves switch to the new form. The item is used up and the form joins your roster for good.</p>
      </div>
    </div>
  );
};
