import { Backpack, Lock } from "lucide-react";
import { useGame } from "@/context/GameContext";
import { ITEM_CATEGORIES, itemInfo, bagTotal } from "@/lib/items";
import { ItemIcon } from "@/components/ItemIcon";
import { SpriteImg } from "@/components/SpriteImg";

export const BagPanel = () => {
  const { save, catalog, creatures } = useGame();
  const owned = Object.entries(save.items || {})
    .filter(([, n]) => n > 0)
    .map(([id, n]) => ({ ...itemInfo(id), count: n, targets: catalog.find((c) => c.id === id)?.targets || [] }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <section className="mt-6" data-testid="bag-panel">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-500">
          <Backpack className="h-3.5 w-3.5 text-amber-300" /> Bag · {bagTotal(save)} item{bagTotal(save) === 1 ? "" : "s"}
        </h3>
      </div>
      {Object.entries(ITEM_CATEGORIES).map(([key, cat]) => (
        <div key={key} className="mb-2 rounded-xl border border-slate-800 bg-slate-900/70 p-3" data-testid={`bag-category-${key}`}>
          <p className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-slate-400">
            {cat.name}
            {!cat.enabled && (
              <span className="flex items-center gap-1 text-slate-600">
                <Lock className="h-3 w-3" /> soon
              </span>
            )}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">{cat.description}</p>
          {cat.enabled && owned.length === 0 && (
            <p className="mt-2 text-xs text-slate-400" data-testid="bag-empty-state">
              Nothing yet — items drop after wins (≈35%), every gauntlet stage guarantees one, and the Champion drops a rare one.
            </p>
          )}
          {cat.enabled && owned.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {owned.map((it) => (
                <li key={it.id} className="flex items-center gap-2.5 rounded-lg bg-slate-950/60 px-2.5 py-2" data-testid={`bag-item-${it.id}`} data-count={it.count}>
                  <ItemIcon item={it} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-100">
                      {it.name} <span className="font-mono text-[10px] text-amber-300">×{it.count}</span>
                    </p>
                    <p className="truncate font-mono text-[10px] uppercase tracking-wider text-slate-500">
                      {it.targets.length ? it.targets.map((t) => `${creatures[t.from]?.displayName} → ${creatures[t.to]?.displayName}`).join(" · ") : "No known use yet"}
                    </p>
                  </div>
                  <span className="flex -space-x-2">
                    {it.targets.slice(0, 3).map((t) => (
                      <SpriteImg key={t.to} src={creatures[t.to]?.sprite} alt={creatures[t.to]?.displayName} className="h-8 w-8" />
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
};
