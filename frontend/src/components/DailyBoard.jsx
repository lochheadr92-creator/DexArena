import { useState } from "react";
import { ChevronDown, Flame, Trophy, Skull, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGame } from "@/context/GameContext";
import { dailyKey, dailyStats, fmtTime } from "@/lib/daily";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const StatChip = ({ label, value, accent, testId }) => (
  <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-2">
    <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">{label}</p>
    <p className="mt-0.5 font-display text-lg font-bold tabular-nums leading-none" style={{ color: accent }} data-testid={testId}>
      {value}
    </p>
  </div>
);

const dayLabel = (key) => new Date(`${key}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

const Row = ({ e, today }) => {
  const Icon = e.best.win ? Trophy : Skull;
  return (
    <li data-testid={`daily-board-entry-${e.key}`} data-score={e.best.score} data-win={e.best.win} className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5", e.key === today ? "bg-fuchsia-950/30" : "odd:bg-slate-950/40")}>
      <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", e.best.win ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300")}>
        <Icon className="h-3 w-3" />
      </span>
      <span className="w-24 shrink-0 font-mono text-[10px] uppercase tracking-wider text-slate-300">{dayLabel(e.key)}</span>
      <span className="flex-1 truncate font-mono text-[10px] text-slate-500">
        {fmtTime(e.best.seconds)} · {e.best.standing} standing · {e.attempts} att.
      </span>
      <span className="font-display text-sm font-bold tabular-nums text-slate-50">{e.best.score}</span>
    </li>
  );
};

export const DailyBoard = () => {
  const { save } = useGame();
  const [open, setOpen] = useState(false);
  const history = save.daily.history || [];
  const today = dailyKey();
  const s = dailyStats(history, today);
  return (
    <Collapsible open={open} onOpenChange={setOpen} data-testid="daily-board" className="mt-2 rounded-2xl border border-slate-800 bg-slate-900/70">
      <CollapsibleTrigger asChild>
        <button type="button" data-testid="daily-board-toggle" data-open={open} className="flex w-full items-center justify-between px-4 py-2.5 text-left">
          <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-slate-400">
            <CalendarRange className="h-3.5 w-3.5 text-fuchsia-300" /> Your month
          </span>
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-amber-300" data-testid="daily-board-streak" data-streak={s.streak}>
              <Flame className="h-3.5 w-3.5" /> {s.streak} day{s.streak === 1 ? "" : "s"}
            </span>
            <ChevronDown className={cn("h-4 w-4 text-slate-500 transition-transform", open && "rotate-180")} />
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 border-t border-slate-800 px-4 py-3">
          <div className="grid grid-cols-4 gap-1.5">
            <StatChip label="Streak" value={s.streak} accent="#FBBF24" testId="daily-board-stat-streak" />
            <StatChip label="Best" value={s.bestStreak} accent="#F472B6" testId="daily-board-stat-best-streak" />
            <StatChip label="Wins" value={`${s.monthWins}/${s.monthPlayed}`} accent="#34D399" testId="daily-board-stat-wins" />
            <StatChip label="Top" value={s.monthBest} accent="#22D3EE" testId="daily-board-stat-top" />
          </div>
          {history.length === 0 ? (
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500" data-testid="daily-board-empty">
              Play today's challenge to start your log
            </p>
          ) : (
            <ul className="max-h-72 space-y-0.5 overflow-y-auto" data-testid="daily-board-list">
              {history.map((e) => (
                <Row key={e.key} e={e} today={today} />
              ))}
            </ul>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
