import { Search, X, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPES, TYPE_COLORS } from "@/lib/types";
import { GEN_LABELS, titleCase } from "@/lib/format";
import { DEX } from "@/constants/testIds/dex";
import { AbilityFilter } from "@/components/AbilityFilter";

export const EMPTY_FILTERS = { query: "", gen: 0, type: null, onlyUnlocked: false, ability: null };

const Chip = ({ active, onClick, children, testId, style, className }) => (
  <button
    type="button"
    data-testid={testId}
    data-active={active}
    onClick={onClick}
    style={style}
    className={cn(
      "shrink-0 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-[background-color,border-color,color,transform] duration-150 active:scale-95",
      active
        ? "border-cyan-400/70 bg-cyan-500/15 text-cyan-200"
        : "border-slate-800 bg-slate-900/70 text-slate-400 hover:border-slate-600 hover:text-slate-200",
      className,
    )}
  >
    {children}
  </button>
);

export const RosterFilters = ({ filters, setFilters, hasFilters, list = [], showGen = true }) => {
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          data-testid={DEX.searchInput}
          value={filters.query}
          onChange={(e) => set({ query: e.target.value })}
          placeholder="Search name or dex number"
          className="h-10 w-full rounded-xl border border-slate-800 bg-slate-900/80 pl-9 pr-9 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
        />
        {filters.query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => set({ query: "" })}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-500 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
        {showGen && (
          <>
            <Chip testId={DEX.genFilter("all")} active={filters.gen === 0} onClick={() => set({ gen: 0 })}>
              All Gens
            </Chip>
            {[1, 2, 3, 4].map((g) => (
              <Chip key={g} testId={DEX.genFilter(g)} active={filters.gen === g} onClick={() => set({ gen: filters.gen === g ? 0 : g })}>
                Gen {GEN_LABELS[g]}
              </Chip>
            ))}
            <span className="mx-1 h-4 w-px shrink-0 bg-slate-800" />
          </>
        )}
        <Chip
          testId={DEX.unlockedFilter}
          active={filters.onlyUnlocked}
          onClick={() => set({ onlyUnlocked: !filters.onlyUnlocked })}
          className="flex items-center gap-1"
        >
          <Unlock className="h-3 w-3" /> Unlocked
        </Chip>
        <AbilityFilter value={filters.ability} onChange={(ability) => set({ ability })} list={list} />
        {hasFilters && (
          <Chip
            testId={DEX.clearFilters}
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="flex items-center gap-1 border-rose-900/60 text-rose-300"
          >
            <X className="h-3 w-3" /> Clear
          </Chip>
        )}
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide md:flex-wrap md:overflow-visible">
        {TYPES.map((t) => {
          const active = filters.type === t;
          return (
            <Chip
              key={t}
              testId={DEX.typeFilter(t)}
              active={active}
              onClick={() => set({ type: active ? null : t })}
              style={active ? { backgroundColor: TYPE_COLORS[t].bg, color: TYPE_COLORS[t].text, borderColor: TYPE_COLORS[t].bg } : undefined}
              className="flex items-center gap-1.5"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: active ? TYPE_COLORS[t].text : TYPE_COLORS[t].bg }} />
              {titleCase(t)}
            </Chip>
          );
        })}
      </div>
    </div>
  );
};
