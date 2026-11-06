import { useCallback, useMemo, useState } from "react";
import { SearchX } from "lucide-react";
import { toast } from "sonner";
import { useGame } from "@/context/GameContext";
import { MAX_ID } from "@/lib/pokeapi";
import { DEX } from "@/constants/testIds/dex";
import { RosterFilters, EMPTY_FILTERS } from "@/components/RosterFilters";
import { AbilityFilterNote } from "@/components/AbilityFilter";
import { CreatureCard } from "@/components/CreatureCard";
import { SpeciesSpotlight } from "@/components/SpeciesSpotlight";
import { TeamTray } from "@/components/TeamTray";
import { CreatureDetailSheet } from "@/components/CreatureDetailSheet";
import { isShiny } from "@/lib/shiny";

const ALL_IDS = Array.from({ length: MAX_ID }, (_, i) => i + 1);

const Placeholder = ({ id }) => (
  <div data-testid={`creature-placeholder-${id}`} className="flex min-h-[118px] animate-pulse flex-col items-center justify-between rounded-xl border border-slate-900 bg-slate-950/60 p-2">
    <span className="font-accent text-[7px] text-slate-700">#{String(id).padStart(3, "0")}</span>
    <div className="h-12 w-12 rounded-full bg-slate-900" />
    <div className="h-2 w-14 rounded bg-slate-900" />
  </div>
);

const SortToggle = ({ value, onChange }) => {
  const Btn = ({ mode, label, testId }) => (
    <button
      type="button"
      data-testid={testId}
      data-active={value === mode}
      onClick={() => onChange(mode)}
      className={
        "rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors " +
        (value === mode ? "bg-cyan-500/20 text-cyan-200" : "text-slate-400 hover:text-slate-200")
      }
    >
      {label}
    </button>
  );
  return (
    <div className="mt-3 flex items-center justify-end gap-2">
      <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Order</span>
      <div data-testid="dex-sort-toggle" className="inline-flex rounded-full border border-slate-800 bg-slate-900/70 p-0.5">
        <Btn mode="variety" label="Variety" testId="dex-sort-variety" />
        <Btn mode="numeric" label="Numeric" testId="dex-sort-numeric" />
      </div>
    </div>
  );
};

export default function RosterPage() {
  const { creatures, list, loaded, total, roster, rosterId, dexSort, setDexSort, progress, unlockedIds, save, toggleTeam } = useGame();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [detailId, setDetailId] = useState(null);

  const hasFilters = !!(filters.query || filters.gen || filters.lot || filters.type || filters.onlyUnlocked || filters.ability);
  const q = filters.query.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      list.filter(
        (c) =>
          (!filters.gen || c.generation === filters.gen) &&
          (!filters.lot || (c.lot ?? 1) === filters.lot) &&
          (!filters.type || c.types.includes(filters.type)) &&
          (!filters.onlyUnlocked || unlockedIds.has(c.id)) &&
          (!filters.ability || (c.abilities || []).includes(filters.ability)) &&
          (!q || c.displayName.toLowerCase().includes(q) || c.name.includes(q) || String(c.id) === q.replace(/^#0*/, "") || String(c.displayOrder ?? c.dexNo ?? "") === q.replace(/^#0*/, "")),
      ),
    [list, filters.gen, filters.lot, filters.type, filters.onlyUnlocked, filters.ability, unlockedIds, q],
  );
  const abilityCount = useMemo(() => (filters.ability ? list.filter((c) => (c.abilities || []).includes(filters.ability)).length : 0), [list, filters.ability]);

  const slotOf = useMemo(() => new Map(save.team.map((id, i) => [id, i])), [save.team]);
  const shinyCount = useMemo(
    () => list.reduce((n, c) => n + (unlockedIds.has(c.id) && isShiny(c, save.shinySeed, save.shinyRate) ? 1 : 0), 0),
    [list, unlockedIds, save.shinySeed, save.shinyRate],
  );
  const isShinyCard = useCallback((c) => unlockedIds.has(c.id) && isShiny(c, save.shinySeed, save.shinyRate), [unlockedIds, save.shinySeed, save.shinyRate]);

  const handleSelect = useCallback(
    (id) => {
      const result = toggleTeam(id);
      if (result === "full") toast.warning("Team is full", { description: "Remove a creature from the tray first." });
      if (result === "locked") setDetailId(id);
    },
    [toggleTeam],
  );

  const closeDetails = useCallback(() => setDetailId(null), []);
  const showPlaceholders = progress.status !== "done" && !hasFilters;

  return (
    <div className="pb-48">
      <RosterFilters filters={filters} setFilters={setFilters} hasFilters={hasFilters} list={list} showGen={roster.hasGenerations} lots={roster.lots} />
      {rosterId === "original" && <SortToggle value={dexSort} onChange={setDexSort} />}
      {!hasFilters && list.length > 0 && <div className="mt-3"><SpeciesSpotlight onPick={setDetailId} /></div>}
      {filters.ability && (
        <div className="mt-2.5">
          <AbilityFilterNote value={filters.ability} count={abilityCount} />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-slate-500">
        <span data-testid={DEX.rosterCount}>
          {hasFilters ? `${filtered.length} match` : `${loaded} / ${total} creatures`}
        </span>
        <span>
          <span className="text-emerald-400">{unlockedIds.size}</span> unlocked
          {shinyCount > 0 && (
            <span className="ml-2 text-amber-300" data-testid="roster-shiny-count">✨ {shinyCount} shiny</span>
          )}
        </span>
      </div>

      {hasFilters && filtered.length === 0 ? (
        <div data-testid={DEX.rosterEmpty} className="mt-16 flex flex-col items-center gap-3 text-center">
          <SearchX className="h-10 w-10 text-slate-700" />
          <p className="text-sm text-slate-400">No creatures match these filters.</p>
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="rounded-full border border-slate-700 px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-300 hover:border-cyan-500"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <div data-testid={DEX.rosterGrid} className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-6 lg:grid-cols-8">
          {showPlaceholders
            ? ALL_IDS.map((id) =>
                creatures[id] ? (
                  <CreatureCard key={id} creature={creatures[id]} locked={!unlockedIds.has(id)} shiny={isShinyCard(creatures[id])} slot={slotOf.get(id)} onSelect={handleSelect} onDetails={setDetailId} numberMode={dexSort} />
                ) : (
                  <Placeholder key={id} id={id} />
                ),
              )
            : filtered.map((c) => (
                <CreatureCard key={c.id} creature={c} locked={!unlockedIds.has(c.id)} shiny={isShinyCard(c)} slot={slotOf.get(c.id)} onSelect={handleSelect} onDetails={setDetailId} numberMode={dexSort} />
              ))}
        </div>
      )}

      <TeamTray />
      <CreatureDetailSheet creatureId={detailId} onClose={closeDetails} onPick={setDetailId} onToggleTeam={handleSelect} />
    </div>
  );
}
