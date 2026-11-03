import { Trophy, Skull, RotateCcw, Grid3x3, Share2, ChevronRight, Sparkles, KeyRound, Flag, CalendarDays, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import { TICK_RATE } from "@/game/config";
import { GAUNTLET_STAGES } from "@/lib/gauntlet";
import { fmtTime } from "@/lib/daily";
import { KO_BONUS, STANDING_BONUS } from "@/lib/progression";
import { itemInfo } from "@/lib/items";
import { ItemIcon } from "@/components/ItemIcon";

const Table = ({ title, units, testId }) => (
  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3" data-testid={testId}>
    <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">{title}</p>
    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1 text-[11px]">
      <span className="text-slate-500">Creature</span>
      <span className="text-right text-slate-500">HP</span>
      <span className="text-right text-slate-500">KOs</span>
      <span className="text-right text-slate-500">Dmg</span>
      {units.map((u) => (
        <div key={u.id} className="contents" data-testid={`result-row-${u.id}`}>
          <span className={cn("truncate", u.hp <= 0 ? "text-slate-500 line-through" : "text-slate-100")}>{u.name}</span>
          <span className="text-right font-mono text-slate-300">{u.hp}/{u.maxHp}</span>
          <span className="text-right font-mono text-slate-300">{u.kills}</span>
          <span className="text-right font-mono text-slate-300">{u.damageDealt}</span>
        </div>
      ))}
    </div>
  </div>
);

const Rewards = ({ outcome, creatures }) => {
  if (!outcome || (!outcome.newUnlocks.length && !outcome.keysEarned && !outcome.drop)) return null;
  const drop = outcome.drop ? itemInfo(outcome.drop) : null;
  return (
    <div className="space-y-1.5 rounded-xl border border-emerald-900/60 bg-emerald-950/30 p-3" data-testid="result-rewards">
      {drop && (
        <p className="flex items-center gap-2 text-xs text-amber-200" data-testid="result-item-drop" data-item={drop.id}>
          <ItemIcon item={drop} className="h-7 w-7 shrink-0" />
          <span>
            Found <span className="font-semibold">{drop.name}</span>{drop.rare ? " (rare)" : ""} — it's in your bag
          </span>
        </p>
      )}
      {outcome.newUnlocks.length > 0 && (
        <p className="flex items-start gap-2 text-xs text-emerald-200" data-testid="result-unlocks">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Unlocked: <span className="font-semibold">{outcome.newUnlocks.map((id) => creatures[id]?.displayName || `#${id}`).join(", ")}</span>
          </span>
        </p>
      )}
      {outcome.keysEarned > 0 && (
        <p className="flex items-center gap-2 text-xs text-purple-200" data-testid="result-seal-key">
          <KeyRound className="h-3.5 w-3.5 shrink-0" /> Seal Key earned — spend it on any legendary in the roster
        </p>
      )}
    </div>
  );
};

const CreditBreakdown = ({ outcome, win }) => {
  if (!outcome || outcome.credited === false) return null;
  if (!win) {
    return (
      <p className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-[11px] text-slate-400" data-testid="result-credit-none">
        No species credit — wins, KO and standing bonuses go to the winning side only.
      </p>
    );
  }
  return (
    <div className="rounded-xl border border-emerald-900/50 bg-slate-950/70 p-3" data-testid="result-credit">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">Species credit · win +1 · KO +{KO_BONUS} each · standing +{STANDING_BONUS}</p>
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 gap-y-1 text-[11px]">
        <span className="text-slate-500">Creature</span>
        <span className="text-right text-slate-500">Win</span>
        <span className="text-right text-slate-500">KO</span>
        <span className="text-right text-slate-500">Stand</span>
        <span className="text-right text-slate-500">Total</span>
        {outcome.rows.map((r) => (
          <div key={r.speciesId} className="contents" data-testid={`result-credit-${r.speciesId}`} data-ko={r.ko} data-standing={r.standing} data-total={r.total}>
            <span className="truncate text-slate-100">{r.name}</span>
            <span className="text-right font-mono text-slate-300">+{r.win}</span>
            <span className={cn("text-right font-mono", r.ko ? "text-amber-300" : "text-slate-500")}>+{r.ko}</span>
            <span className={cn("text-right font-mono", r.standing ? "text-emerald-300" : "text-slate-500")}>+{r.standing}</span>
            <span className="text-right font-mono font-semibold text-slate-100">+{r.total}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const GauntletNote = ({ g }) => {
  if (!g) return null;
  const text = g.outcome === "cleared" ? `Gauntlet cleared — all ${GAUNTLET_STAGES} trainers beaten` : g.outcome === "lost" ? `Run over — fell at trainer ${g.stageReached} of ${GAUNTLET_STAGES}` : `Trainer ${g.stageReached} of ${GAUNTLET_STAGES} beaten — HP carries over`;
  return (
    <p className={cn("flex items-center gap-2 rounded-xl border px-3 py-2 text-xs", g.outcome === "lost" ? "border-rose-900/60 bg-rose-950/30 text-rose-200" : "border-amber-900/60 bg-amber-950/30 text-amber-100")} data-testid="result-gauntlet" data-outcome={g.outcome}>
      <Flag className="h-3.5 w-3.5 shrink-0" /> {text}
    </p>
  );
};

const DailyNote = ({ d }) => {
  if (!d) return null;
  const r = d.result;
  return (
    <div className="rounded-xl border border-fuchsia-900/60 bg-fuchsia-950/30 px-3 py-2 text-xs text-fuchsia-100" data-testid="result-daily" data-score={r.score} data-best={d.isBest} data-attempt={d.attempts}>
      <p className="flex items-center gap-2">
        <CalendarDays className="h-3.5 w-3.5 shrink-0" /> Daily challenge {d.key} · attempt {d.attempts}
      </p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-fuchsia-300" data-testid="result-daily-score">
        Score {r.score} · {fmtTime(r.seconds)} · {r.standing} standing · {r.kos} KOs · {d.isBest ? "new best" : `best ${d.best.score}`}
      </p>
    </div>
  );
};

const Btn = ({ primary, testId, onClick, icon: Icon, children }) => (
  <button
    type="button"
    data-testid={testId}
    onClick={onClick}
    className={cn(
      "flex min-h-[48px] items-center justify-center gap-2 rounded-xl font-display text-sm font-bold uppercase tracking-wider",
      primary ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : "border border-slate-700 text-slate-200 hover:border-slate-500",
    )}
  >
    <Icon className="h-4 w-4" /> {children}
  </button>
);

export const ResultScreen = ({ state, mode = "quick", outcome, creatures = {}, onRematch, onNext, onShare, onShareDaily, onBack }) => {
  const win = state.winner === "player";
  const remaining = (side) => state.teams[side].units.filter((u) => u.hp > 0).length;
  const seconds = (state.endTick / TICK_RATE).toFixed(1);
  const g = outcome?.gauntlet;
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center overflow-y-auto bg-black/80 p-4 backdrop-blur-md" data-testid="result-screen">
      <div className="my-auto w-full max-w-md shrink-0 space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-center gap-3">
          <span className={cn("flex h-12 w-12 items-center justify-center rounded-xl", win ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300")}>
            {win ? <Trophy className="h-6 w-6" /> : <Skull className="h-6 w-6" />}
          </span>
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-slate-50" data-testid="result-title">
              {win ? "Win" : "Loss"}
              {mode === "replay" && <span className="ml-2 align-middle font-mono text-[10px] uppercase tracking-widest text-cyan-400">Replay</span>}
              {mode === "daily" && <span className="ml-2 align-middle font-mono text-[10px] uppercase tracking-widest text-fuchsia-400">Daily</span>}
            </h2>
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400" data-testid="result-meta">
              {seconds}s · you {remaining("player")}/6 · rival {remaining("npc")}/6 · seed {state.seed}
            </p>
          </div>
        </div>
        <GauntletNote g={g} />
        <DailyNote d={outcome?.daily} />
        <Rewards outcome={outcome} creatures={creatures} />
        {mode !== "replay" && <CreditBreakdown outcome={outcome} win={win} />}
        <Table title="Your team" units={state.teams.player.units} testId="result-table-player" />
        <Table title={`Rival — ${state.teams.npc.name}`} units={state.teams.npc.units} testId="result-table-npc" />
        <div className="grid grid-cols-2 gap-2 pt-1">
          {mode === "quick" && (
            <Btn primary testId="rematch-button" onClick={onRematch} icon={RotateCcw}>
              Rematch
            </Btn>
          )}
          {mode === "daily" && (
            <Btn primary testId="daily-retry-button" onClick={onRematch} icon={RotateCcw}>
              Retry daily
            </Btn>
          )}
          {mode === "daily" && (
            <Btn testId="share-daily-button" onClick={onShareDaily} icon={CalendarDays}>
              Share result
            </Btn>
          )}
          {mode === "gauntlet" && g?.outcome === "advance" && (
            <Btn primary testId="next-trainer-button" onClick={onNext} icon={ChevronRight}>
              Next trainer
            </Btn>
          )}
          {mode === "gauntlet" && g?.outcome !== "advance" && (
            <Btn primary testId="gauntlet-finish-button" onClick={onBack} icon={Flag}>
              Gauntlet
            </Btn>
          )}
          {mode === "replay" && (
            <Btn primary testId="replay-roster-button" onClick={onBack} icon={Grid3x3}>
              Roster
            </Btn>
          )}
          <Btn testId="share-replay-button" onClick={onShare} icon={Share2}>
            Share replay
          </Btn>
          {mode !== "replay" && (
            <Btn testId="back-to-roster-button" onClick={onBack} icon={mode === "daily" ? Swords : Grid3x3}>
              {mode === "gauntlet" ? "Leave" : mode === "daily" ? "Arena" : "Roster"}
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
};
