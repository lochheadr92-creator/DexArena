import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lock, Minus, Plus, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGame } from "@/context/GameContext";
import { typeColor } from "@/lib/types";
import { dexNo, GEN_LABELS, titleCase } from "@/lib/format";
import { isSealed } from "@/lib/unlocks";
import { isShiny } from "@/lib/shiny";
import { DEX } from "@/constants/testIds/dex";
import { TypeBadge } from "@/components/TypeBadge";
import { SpriteImg } from "@/components/SpriteImg";
import { StatBar } from "@/components/StatBar";
import { EvolutionLine } from "@/components/EvolutionLine";
import { MovesetEditor } from "@/components/MovesetEditor";
import { UnlockPanel } from "@/components/UnlockPanel";
import { AbilityPicker } from "@/components/AbilityPicker";
import { speciesCredit } from "@/lib/progression";

const SpeciesRecord = ({ save, id }) => {
  const c = speciesCredit(save, id);
  const cell = (label, value, testId, cls) => (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1.5 text-center">
      <p className={cn("font-mono text-base font-semibold", cls)} data-testid={testId}>{value}</p>
      <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
  return (
    <section className="mt-5" data-testid="species-record">
      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">Arena record · total credit = wins + KO + standing</h3>
      <div className="grid grid-cols-4 gap-1.5">
        {cell("Wins", c.wins, "species-record-wins", "text-slate-100")}
        {cell("KO credit", c.koCredit, "species-record-ko", "text-amber-300")}
        {cell("Standing", c.standingCredit, "species-record-standing", "text-emerald-300")}
        {cell("Total", c.totalCredit, "species-record-total", "text-cyan-300")}
      </div>
    </section>
  );
};

const STAT_ORDER = ["hp", "atk", "def", "spa", "spd", "spe"];

export const CreatureDetailSheet = ({ creatureId, onClose, onPick, onToggleTeam }) => {
  const { creatures, unlockedIds, save } = useGame();
  const creature = creatureId ? creatures[creatureId] : null;

  useEffect(() => {
    if (!creature) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [creature, onClose]);

  const locked = creature ? !unlockedIds.has(creature.id) : false;
  const shiny = creature ? !locked && isShiny(creature, save.shinySeed, save.shinyRate) : false;
  const inTeam = creature ? save.team.includes(creature.id) : false;
  const accent = creature ? typeColor(creature.types[0]) : "#3B82F6";

  return (
    <AnimatePresence>
      {creature && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            key={`sheet-${creature.id}`}
            data-testid={DEX.detailPopover}
            initial={{ y: 48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 48, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-2xl border border-slate-800 bg-slate-900 shadow-2xl sm:max-w-lg sm:rounded-2xl"
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-44 opacity-40"
              style={{ background: `radial-gradient(ellipse at 30% 0%, ${accent}, transparent 65%)` }}
            />
            <button
              type="button"
              data-testid={DEX.detailClose}
              onClick={onClose}
              aria-label="Close details"
              className="absolute right-3 top-3 z-10 rounded-full border border-slate-700 bg-slate-900/80 p-1.5 text-slate-300 transition-colors hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="relative p-5 pb-6 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/60">
                  <SpriteImg src={creature.artwork} alt={creature.displayName} locked={locked} pixelated={false} shiny={shiny} className="h-24 w-24" />
                  {locked && (
                    <span className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-slate-300">
                      {isSealed(creature) ? <Sparkles className="h-3 w-3 text-purple-400" /> : <Lock className="h-3 w-3" />}
                      {isSealed(creature) ? "Sealed" : "Locked"}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="font-accent text-[9px] text-slate-500">{dexNo(creature.dexNo ?? creature.id)}</span>
                    <span className="rounded border border-slate-800 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-slate-400">
                      Gen {GEN_LABELS[creature.generation]}
                    </span>
                    {shiny && (
                      <span className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-300" data-testid="creature-detail-shiny">
                        <Sparkles className="h-3 w-3" /> Shiny
                      </span>
                    )}
                  </div>
                  <h2 className="mt-1 truncate font-display text-2xl font-bold tracking-tight text-slate-50" data-testid="creature-detail-name">
                    {creature.displayName}
                  </h2>
                  <p className="text-xs text-slate-400">{creature.genus}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {creature.types.map((t) => (
                      <TypeBadge key={t} type={t} size="md" />
                    ))}
                  </div>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    {(creature.height / 10).toFixed(1)} m · {(creature.weight / 10).toFixed(1)} kg · BST {creature.bst}
                  </p>
                </div>
              </div>

              {locked && <UnlockPanel creature={creature} />}

              <SpeciesRecord save={save} id={creature.id} />

              <section className="mt-5">
                <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">Ability · Gen IV</h3>
                <AbilityPicker creature={creature} />
              </section>

              <section className="mt-5">
                <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">Base stats</h3>
                <div className="space-y-1.5">
                  {STAT_ORDER.map((k) => (
                    <StatBar key={k} statKey={k} value={creature.stats[k]} />
                  ))}
                </div>
              </section>

              <section className="mt-5">
                <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">Evolution line</h3>
                <EvolutionLine creature={creature} onPick={onPick} />
              </section>

              <section className="mt-5">
                <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">Battle moveset · tap a slot to swap</h3>
                <MovesetEditor creature={creature} />
              </section>

              <section className="mt-5">
                <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">Level-up moves · {creature.moves.length}</h3>
                <div className="flex flex-wrap gap-1.5" data-testid="creature-detail-moves">
                  {creature.moves.map((m) => (
                    <span key={`${m.id}-${m.level}`} className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-950/60 px-2 py-1 text-[11px] text-slate-200">
                      <span className="font-mono text-[9px] text-cyan-400">L{m.level}</span>
                      {titleCase(m.name)}
                    </span>
                  ))}
                </div>
              </section>

              <button
                type="button"
                data-testid={DEX.detailToggleTeam}
                disabled={locked}
                onClick={() => onToggleTeam(creature.id)}
                className={cn(
                  "mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-sm font-bold uppercase tracking-wider transition-[background-color,transform] active:scale-[0.98]",
                  locked
                    ? "cursor-not-allowed bg-slate-800 text-slate-500"
                    : inTeam
                      ? "bg-rose-600/90 text-white hover:bg-rose-500"
                      : "bg-cyan-500 text-slate-950 hover:bg-cyan-400",
                )}
              >
                {locked ? <Lock className="h-4 w-4" /> : inTeam ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {locked ? "Not available yet" : inTeam ? "Remove from team" : "Add to team"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
