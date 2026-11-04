import { useNavigate } from "react-router-dom";
import { Flag, Swords, Trophy, Crown, AlertTriangle, XCircle, Check, Lock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useGame } from "@/context/GameContext";
import { GAUNTLET_STAGES } from "@/lib/gauntlet";
import { TEAM_SIZE } from "@/lib/save";
import { terrainById } from "@/lib/terrains";
import { legendWeather } from "@/lib/rival";
import { WEATHER } from "@/game/abilities";
import { archetypes as archetypeConfig } from "@/game/config";
import { battleStats } from "@/game/stats";
import { SpriteImg } from "@/components/SpriteImg";
import { RunHistory } from "@/components/RunHistory";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const Stat = ({ icon: Icon, label, value, testId }) => (
  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
    <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-500">
      <Icon className="h-3.5 w-3.5 text-amber-400" /> {label}
    </div>
    <p data-testid={testId} className="mt-1.5 font-display text-2xl font-bold tabular-nums text-slate-50">
      {value}
    </p>
  </div>
);

const StageRow = ({ index, run }) => {
  const stage = index + 1;
  const status = !run ? "upcoming" : stage < run.stage ? "cleared" : stage === run.stage ? "current" : "upcoming";
  const archetype = run ? archetypeConfig.archetypes[run.archetypes[index]] : null;
  const terrain = run ? terrainById(run.terrains[index]) : null;
  const weather = terrain ? legendWeather(terrain.id, stage) : null;
  return (
    <div
      data-testid={`gauntlet-stage-${stage}`}
      data-status={status}
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2.5",
        status === "current" ? "border-amber-500/60 bg-amber-950/30" : status === "cleared" ? "border-emerald-900/60 bg-emerald-950/20" : "border-slate-800 bg-slate-900/60",
      )}
    >
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-display text-sm font-bold", status === "current" ? "bg-amber-500 text-slate-950" : status === "cleared" ? "bg-emerald-600/80 text-white" : "bg-slate-800 text-slate-400")}>
        {status === "cleared" ? <Check className="h-4 w-4" /> : stage}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-semibold", status === "upcoming" ? "text-slate-400" : "text-slate-100")}>
          {stage === GAUNTLET_STAGES && <Crown className="mr-1 inline h-3.5 w-3.5 text-amber-300" />}
          {archetype ? archetype.name : stage === GAUNTLET_STAGES ? "Champion" : "Hidden trainer"}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
          {terrain ? terrain.name : "Terrain revealed on start"} · difficulty slot {stage}
          {weather && (
            <span className="ml-1" style={{ color: WEATHER[weather].color }} data-testid={`gauntlet-stage-weather-${stage}`} data-weather={weather}>
              · starts in {WEATHER[weather].name}
            </span>
          )}
        </p>
      </div>
      {status === "upcoming" && run && <Lock className="h-4 w-4 text-slate-600" />}
    </div>
  );
};

const TeamHp = ({ run, creatures }) => (
  <div className="grid grid-cols-6 gap-1.5" data-testid="gauntlet-team">
    {run.team.map((id) => {
      const c = creatures[id];
      if (!c) return null;
      const max = battleStats(c.stats).hp;
      const hp = run.hp ? run.hp[id] ?? max : max;
      const pct = Math.max(0, Math.min(100, (hp / max) * 100));
      return (
        <div key={id} data-testid={`gauntlet-team-${id}`} data-hp={hp} className={cn("rounded-lg border border-slate-800 bg-slate-950/60 p-1", hp <= 0 && "opacity-50")}>
          <SpriteImg src={c.sprite} alt={c.displayName} className={cn("mx-auto h-10 w-10", hp <= 0 && "grayscale")} />
          <div className="mt-1 h-1 w-full overflow-hidden rounded bg-slate-800">
            <div className={cn("h-full", pct > 50 ? "bg-emerald-400" : pct > 20 ? "bg-amber-400" : "bg-rose-500")} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-0.5 text-center font-mono text-[8px] text-slate-400">
            {hp}/{max}
          </p>
        </div>
      );
    })}
  </div>
);

export default function GauntletPage() {
  const { save, creatures, startGauntlet, abandonGauntlet } = useGame();
  const navigate = useNavigate();
  const run = save.gauntlet.active;
  const ready = save.team.length === TEAM_SIZE;

  const onStart = () => {
    startGauntlet();
    toast.success("Gauntlet run started", { description: "Six trainers. No healing between fights." });
    navigate("/battle?mode=gauntlet");
  };

  return (
    <div className="space-y-5 pb-28">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-amber-400">Six trainers · one team</p>
        <h2 className="font-display text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">Gauntlet</h2>
        <p className="mt-1 text-sm text-slate-400">Beat six rival trainers in a row with the same six creatures. Damage and faints carry over — nobody heals until the run ends.</p>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <Stat icon={Flag} label="Runs" value={save.gauntlet.runs} testId="gauntlet-runs" />
        <Stat icon={Trophy} label="Clears" value={save.gauntlet.clears} testId="gauntlet-clears" />
        <Stat icon={Crown} label="Best stage" value={`${save.gauntlet.bestStage}/${GAUNTLET_STAGES}`} testId="gauntlet-best" />
      </div>

      {run && (
        <section className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/70 p-4" data-testid="gauntlet-active">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Your team · trainer {run.stage} next</h3>
            <span className="font-mono text-[10px] uppercase tracking-wider text-amber-300">run #{save.gauntlet.runs}</span>
          </div>
          <TeamHp run={run} creatures={creatures} />
        </section>
      )}

      <section className="space-y-2">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Trainer lineup</h3>
        {Array.from({ length: GAUNTLET_STAGES }, (_, i) => (
          <StageRow key={i} index={i} run={run} />
        ))}
      </section>

      <section className="space-y-2">
        <RunHistory history={save.gauntlet.history || []} runs={save.gauntlet.runs} hasActive={!!run} creatures={creatures} />
      </section>

      {run ? (
        <div className="space-y-2">
          <button
            type="button"
            data-testid="gauntlet-fight-button"
            onClick={() => navigate("/battle?mode=gauntlet")}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3.5 font-display text-base font-bold uppercase tracking-wider text-slate-950 shadow-[0_0_24px_rgba(245,158,11,0.35)] transition-[background-color,transform] hover:bg-amber-400 active:scale-[0.98]"
          >
            <Swords className="h-5 w-5" /> Fight trainer {run.stage}
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button type="button" data-testid="gauntlet-abandon-button" className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-800 py-2.5 font-mono text-[10px] uppercase tracking-wider text-slate-400 hover:border-rose-700 hover:text-rose-300">
                <XCircle className="h-3.5 w-3.5" /> Abandon run
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-slate-800 bg-slate-900">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display">Abandon this run?</AlertDialogTitle>
                <AlertDialogDescription>Progress through the six trainers is lost. Wins already credited stay.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="gauntlet-abandon-cancel">Keep fighting</AlertDialogCancel>
                <AlertDialogAction data-testid="gauntlet-abandon-confirm" onClick={abandonGauntlet} className="bg-rose-600 text-white hover:bg-rose-500">
                  Abandon
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : (
        <div>
          <button
            type="button"
            data-testid="gauntlet-start-button"
            disabled={!ready}
            onClick={onStart}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3.5 font-display text-base font-bold uppercase tracking-wider text-slate-950 shadow-[0_0_24px_rgba(245,158,11,0.35)] transition-[background-color,transform] hover:bg-amber-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none"
          >
            <Flag className="h-5 w-5" /> Start gauntlet run
          </button>
          {!ready && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-300" data-testid="gauntlet-team-warning">
              <AlertTriangle className="h-3.5 w-3.5" /> Pick a full team of {TEAM_SIZE} in the roster first.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
