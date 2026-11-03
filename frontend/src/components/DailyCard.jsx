import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Swords, Share2, Loader2, Timer, CloudRain, Snowflake, Trophy, Skull, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useGame } from "@/context/GameContext";
import { TEAM_SIZE } from "@/lib/save";
import { terrainById } from "@/lib/terrains";
import { archetypes as archetypeConfig } from "@/game/config";
import { WEATHER } from "@/game/abilities";
import { todaysDaily, msUntilReset, fmtTime, shareText } from "@/lib/daily";
import { SpriteImg } from "@/components/SpriteImg";

const WEATHER_ICON = { rain: CloudRain, hail: Snowflake };

const useResetCountdown = () => {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);
  const ms = msUntilReset();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const RivalRow = ({ daily, creatures, revealed }) => (
  <div className="grid grid-cols-6 gap-1.5" data-testid="daily-rival-team" data-revealed={revealed}>
    {daily.npcIds.map((id) => {
      const c = creatures[id];
      return (
        <div key={id} data-testid={`daily-rival-${id}`} className="flex aspect-square items-center justify-center rounded-lg border border-slate-800 bg-slate-950/60">
          {c ? <SpriteImg src={c.sprite} alt={revealed ? c.displayName : "Hidden rival"} locked={!revealed} className="h-11 w-11" /> : null}
        </div>
      );
    })}
  </div>
);

const Best = ({ today }) => {
  if (!today.best) {
    return (
      <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500" data-testid="daily-best-empty">
        No attempt yet today
      </p>
    );
  }
  const r = today.best;
  const Icon = r.win ? Trophy : Skull;
  return (
    <div className="flex items-center gap-2" data-testid="daily-best" data-score={r.score} data-win={r.win} data-attempts={today.attempts}>
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", r.win ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300")}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="font-display text-sm font-bold text-slate-50">
          {r.win ? "Win" : "Loss"} · score {r.score}
        </p>
        <p className="truncate font-mono text-[10px] uppercase tracking-wider text-slate-400">
          {fmtTime(r.seconds)} · {r.standing} standing · {r.kos} KOs · {today.attempts} attempt{today.attempts === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
};

export const DailyCard = () => {
  const { daily, save, creatures, progress } = useGame();
  const navigate = useNavigate();
  const resetIn = useResetCountdown();
  const ready = save.team.length === TEAM_SIZE;
  const today = daily ? todaysDaily(save, daily.key) : null;
  const terrain = daily ? terrainById(daily.terrainId) : null;
  const archetype = daily ? archetypeConfig.archetypes[daily.archetypeId] : null;
  const WIcon = daily?.weather ? WEATHER_ICON[daily.weather] || CloudRain : null;

  const share = async () => {
    const text = shareText(daily.key, today.best);
    const url = `${window.location.origin}/arena`;
    try {
      if (navigator.share) await navigator.share({ title: "Arena Dex Daily", text, url });
      else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        toast.success("Result copied", { description: "Paste it to a friend and compare." });
      }
    } catch {
      window.prompt("Copy your result", `${text}\n${url}`);
    }
  };

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-fuchsia-900/50 bg-slate-900/70" data-testid="daily-card" data-key={daily?.key}>
      <div className="flex items-center justify-between gap-2 border-b border-fuchsia-900/40 bg-fuchsia-950/30 px-4 py-2.5">
        <h3 className="flex min-w-0 items-center gap-2 truncate font-mono text-[10px] uppercase tracking-widest text-fuchsia-300">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Daily {daily ? `· ${daily.key}` : "challenge"}</span>
        </h3>
        <span className="flex shrink-0 items-center gap-1 whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-slate-400" data-testid="daily-reset">
          <Timer className="h-3 w-3" /> resets in {resetIn}
        </span>
      </div>
      <div className="space-y-3 p-4">
        {!daily ? (
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-slate-400" data-testid="daily-loading">
            {progress.status === "error" ? <AlertTriangle className="h-3.5 w-3.5 text-amber-300" /> : <Loader2 className="h-3.5 w-3.5 animate-spin text-fuchsia-300" />}
            {progress.status === "error" ? "Retry the Dex sync to draft today's rival" : "Drafting today's rival…"}
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-300">
              Same rival for everyone today: a Legend-tier <span className="font-semibold text-slate-50" data-testid="daily-archetype">{archetype.name}</span> on{" "}
              <span className="font-semibold" style={{ color: terrain.accent }} data-testid="daily-terrain">
                {terrain.name}
              </span>
              {daily.weather && (
                <span className="ml-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 align-middle font-mono text-[9px] uppercase tracking-wider" style={{ borderColor: `${WEATHER[daily.weather].color}66`, color: WEATHER[daily.weather].color }} data-testid="daily-weather" data-weather={daily.weather}>
                  <WIcon className="h-3 w-3" /> starts in {WEATHER[daily.weather].name}
                </span>
              )}
              . Fight with your six — best score of the day counts.
            </p>
            <RivalRow daily={daily} creatures={creatures} revealed={today.attempts > 0} />
            {today.attempts === 0 && <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Rival team is revealed after your first attempt</p>}
            <Best today={today} />
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <button
                type="button"
                data-testid="daily-fight-button"
                disabled={!ready}
                onClick={() => navigate("/battle?mode=daily")}
                className="flex items-center justify-center gap-2 rounded-xl bg-fuchsia-500 py-3 font-display text-sm font-bold uppercase tracking-wider text-slate-950 shadow-[0_0_24px_rgba(217,70,239,0.35)] transition-[background-color,transform] hover:bg-fuchsia-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none"
              >
                <Swords className="h-4 w-4" /> {today.attempts ? "Try again" : "Fight today's rival"}
              </button>
              <button
                type="button"
                data-testid="daily-share-button"
                disabled={!today.best}
                onClick={share}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 px-4 font-mono text-[10px] uppercase tracking-wider text-slate-200 hover:border-fuchsia-500 disabled:cursor-not-allowed disabled:text-slate-600"
              >
                <Share2 className="h-3.5 w-3.5" /> Share
              </button>
            </div>
            {!ready && (
              <p className="flex items-center gap-1.5 text-xs text-amber-300" data-testid="daily-team-warning">
                <AlertTriangle className="h-3.5 w-3.5" /> Pick a full team of {TEAM_SIZE} first.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
};
