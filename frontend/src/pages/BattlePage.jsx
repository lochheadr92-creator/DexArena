import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Swords } from "lucide-react";
import { toast } from "sonner";
import { useGame } from "@/context/GameContext";
import { prepareBattle } from "@/game/prebattle";
import { playerHasLegendary } from "@/lib/progression";
import { stageSetup } from "@/lib/gauntlet";
import { dailySetup, attemptSeed, todaysDaily, shareText } from "@/lib/daily";
import { decodeReplay, replayUrl } from "@/lib/replay";
import { BattleCanvas } from "@/components/battle/BattleCanvas";
import { BattleHud } from "@/components/battle/BattleHud";
import { TeamStrip } from "@/components/battle/TeamStrip";
import { BagSheet } from "@/components/battle/BagSheet";
import { ResultScreen } from "@/components/battle/ResultScreen";
import { optionsFor, bagCount } from "@/lib/items";

function pickSeed() {
  const forced = typeof window.__seed === "number" && window.__seed !== window.__lastSeedUsed ? window.__seed : null;
  const seed = forced ?? ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
  window.__seed = seed;
  window.__lastSeedUsed = seed;
  return seed;
}

export default function BattlePage() {
  const { creatures, unlockedIds, save, progress, movesetOverrides, creditResult, finishGauntletStage, catalog, applyEvolutionItem, daily, recordDailyResult, saveReplay, rosterId, roster, setRoster } = useGame();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const mode = location.pathname === "/replay" ? "replay" : ["gauntlet", "daily"].includes(params.get("mode")) ? params.get("mode") : "quick";
  const stateRef = useRef(null);
  const rendererRef = useRef(null);
  const speedRef = useRef(1);
  const pausedRef = useRef(false);
  const [phase, setPhase] = useState("loading");
  const [status, setStatus] = useState("Preparing arena");
  const [error, setError] = useState(null);
  const [snap, setSnap] = useState(null);
  const [speed, setSpeedState] = useState(1);
  const [paused, setPausedState] = useState(false);
  const [autoPick, setAutoPickState] = useState(false);
  const [stripOpen, setStripOpen] = useState(false);
  const [bagOpen, setBagOpen] = useState(false);
  const [ended, setEnded] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [replaySaved, setReplaySaved] = useState(false);
  const lastSetup = useRef(null);

  const setSpeed = (s) => {
    speedRef.current = s;
    setSpeedState(s);
  };
  const pendingPick = !!snap?.player.pendingPick && !autoPick;
  const effectivePaused = paused || stripOpen || bagOpen || pendingPick || phase !== "battle";
  pausedRef.current = effectivePaused;

  const bagOptions = mode === "replay" || !snap ? 0 : optionsFor(snap.player.creatureId, catalog).filter((o) => bagCount(save, o.itemId) > 0).length;

  const setPaused = useCallback((p) => setPausedState(p), []);
  const setAutoPick = (v) => {
    setAutoPickState(v);
    if (stateRef.current) stateRef.current.inputs.push({ type: "auto", side: "player", value: v });
  };
  useEffect(() => {
    window.__setPaused = setPaused;
    window.__setSpeed = setSpeed;
    window.__setAutoPick = setAutoPick;
  });

  const start = useCallback(
    async (setup) => {
      setPhase("loading");
      setEnded(false);
      setOutcome(null);
      setReplaySaved(false);
      setStripOpen(false);
      setBagOpen(false);
      setError(null);
      try {
        const state = await prepareBattle({ movesetOverrides, abilityPicks: save.abilities, ...setup, creatures, unlockedIds, playerHasLegendary: playerHasLegendary(unlockedIds, creatures), roster: rosterId, contentVersion: roster.contentVersion, onProgress: setStatus });
        state.mode = mode;
        stateRef.current = state;
        window.__battle = state;
        lastSetup.current = { ...setup, npcIds: state.teams.npc.units.map((u) => u.creatureId), archetypeId: state.meta.archetype };
        setAutoPickState(state.autoPick);
        setPhase("battle");
      } catch (e) {
        console.error(e);
        setError(e.message || String(e));
        setPhase("error");
      }
    },
    [creatures, unlockedIds, movesetOverrides, mode, save.abilities, rosterId, roster.contentVersion],
  );

  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current || phase !== "loading" || stateRef.current || (progress.status !== "done" && progress.status !== "error")) return;
    let setup;
    if (mode === "replay") {
      try {
        setup = decodeReplay(location.hash.slice(1));
      } catch (e) {
        setError(e.message);
        setPhase("error");
        return;
      }
      if (setup.roster && setup.roster !== rosterId) {
        setRoster(setup.roster);
        return;
      }
    } else if (mode === "gauntlet") {
      if (!save.gauntlet.active) {
        navigate("/gauntlet", { replace: true });
        return;
      }
      setup = { ...stageSetup(save.gauntlet.active), seed: pickSeed(), totalWins: save.totalWins };
    } else if (mode === "daily") {
      if (!daily) {
        if (progress.status === "error") navigate("/arena", { replace: true });
        return;
      }
      setup = dailySetup(daily, save);
    } else {
      const override = window.__battleOverride || {};
      setup = { playerIds: override.playerIds || save.team, terrainId: override.terrainId || save.terrain, seed: override.seed ?? pickSeed(), archetypeId: override.archetypeId || null, npcIds: override.npcIds || null, autoPick: override.autoPick ?? false, rivalLevel: override.rivalLevel ?? save.rivalLevel, totalWins: save.totalWins };
      if (override.movesetOverrides) setup.movesetOverrides = override.movesetOverrides;
      if (override.npcMovesetOverrides) setup.npcMovesetOverrides = override.npcMovesetOverrides;
    }
    if (setup.playerIds.length !== 6 || [...setup.playerIds, ...(setup.npcIds || [])].some((id) => !creatures[id])) {
      if (mode === "replay") {
        setError("This replay references creatures that are not in the Dex yet");
        setPhase("error");
      } else navigate("/", { replace: true });
      return;
    }
    startedRef.current = true;
    start(setup);
  }, [phase, progress.status, save, creatures, start, navigate, mode, location.hash, daily, rosterId, setRoster]);

  const onSnapshot = useCallback((s) => {
    setSnap(s);
    if (s.phase === "ended") setEnded(true);
  }, []);

  useEffect(() => {
    const state = stateRef.current;
    if (!snap || !state || mode === "replay") return;
    for (const ev of state.evolved) {
      if (ev.persisted) continue;
      ev.persisted = true;
      const err = applyEvolutionItem({ itemId: ev.itemId, fromId: ev.from, toId: ev.to });
      const to = creatures[ev.to];
      if (!err) toast.success(`${creatures[ev.from]?.displayName} evolved into ${to?.displayName}!`, { description: `${to?.displayName} is now part of your roster.`, duration: 1600 });
    }
  }, [snap, mode, applyEvolutionItem, creatures]);

  useEffect(() => {
    const state = stateRef.current;
    if (!ended || !state || state.credited) return;
    state.credited = true;
    if (mode === "replay") return;
    const stage = state.meta.slot;
    const credit = creditResult(state, { drop: mode === "gauntlet" ? { guaranteed: true, rare: stage >= 6 } : null });
    const gauntlet = mode === "gauntlet" ? finishGauntletStage(state, credit.drop) : null;
    const dailyOut = mode === "daily" ? recordDailyResult(state) : null;
    setOutcome({ ...credit, gauntlet, daily: dailyOut });
  }, [ended, mode, creditResult, finishGauntletStage, recordDailyResult]);

  const pick = (index) => {
    const state = stateRef.current;
    if (!state) return;
    const team = state.teams.player;
    state.inputs.push({ type: team.pendingPick ? "pick" : "switch", side: "player", index });
    setStripOpen(false);
  };

  const useItem = (option) => {
    const state = stateRef.current;
    if (!state) return;
    if (bagCount(save, option.itemId) <= 0) {
      toast.error(`No ${option.item.name} left in your bag`);
      setBagOpen(false);
      return;
    }
    state.inputs.push({ type: "item", side: "player", index: state.teams.player.activeIndex, itemId: option.itemId });
    setBagOpen(false);
  };

  const restart = (setup) => {
    stateRef.current = null;
    setSnap(null);
    startedRef.current = true;
    start(setup);
  };
  const rematch = () => restart({ ...lastSetup.current, seed: mode === "daily" ? attemptSeed(daily.seed, todaysDaily(save, daily.key).attempts) : pickSeed(), autoPick });
  const nextTrainer = () => {
    const run = outcome?.gauntlet?.run;
    if (run) restart({ ...stageSetup(run), seed: pickSeed(), autoPick, totalWins: save.totalWins });
  };
  const copyOrShare = async (title, text, url) => {
    try {
      if (navigator.share) await navigator.share({ title, text, url });
      else {
        await navigator.clipboard.writeText(text ? `${text}\n${url}` : url);
        toast.success(text ? "Result copied" : "Replay link copied", { description: text ? "Paste it to a friend and compare." : "Anyone opening it watches this exact battle." });
      }
    } catch {
      window.prompt("Copy this", text ? `${text}\n${url}` : url);
    }
  };
  const share = () => copyOrShare("Arena Dex replay", null, replayUrl(stateRef.current));
  const shareDaily = () => copyOrShare("Arena Dex Daily", shareText(outcome.daily.key, outcome.daily.result), `${window.location.origin}/arena`);
  const onSaveReplay = (name) => {
    const status = saveReplay(stateRef.current, name, mode);
    setReplaySaved(true);
    if (status === "duplicate") toast.info("This replay is already in your gallery");
    else toast.success(`Saved "${name}" to your replay gallery`, { description: status === "trimmed" ? "The oldest replay was removed to make room." : "Find it on the Save tab." });
  };
  const back = () => navigate(mode === "gauntlet" ? "/gauntlet" : mode === "daily" ? "/arena" : "/");

  if (phase === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center" data-testid="battle-error">
        <p className="text-sm text-rose-300">Could not start the battle: {error}</p>
        <button type="button" data-testid="battle-error-back" onClick={() => navigate("/")} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200">
          Back to roster
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#05070c]" data-testid="battle-screen" data-mode={mode}>
      {phase === "battle" && <BattleCanvas stateRef={stateRef} speedRef={speedRef} pausedRef={pausedRef} onSnapshot={onSnapshot} rendererRef={rendererRef} onForcePause={setPaused} />}
      {phase === "battle" && (
        <BattleHud snap={snap} speed={speed} setSpeed={setSpeed} paused={paused} setPaused={setPaused} autoPick={autoPick} setAutoPick={setAutoPick} onSwitch={() => setStripOpen(true)} onBag={mode === "replay" ? null : () => setBagOpen(true)} bagOptions={bagOptions} readOnly={mode === "replay"} stage={mode === "gauntlet" ? stateRef.current?.meta.slot : null} />
      )}
      {phase === "battle" && mode !== "replay" && snap && bagOpen && !ended && <BagSheet creatureId={snap.player.creatureId} unitName={snap.player.name} onUse={useItem} onClose={() => setBagOpen(false)} />}
      {phase === "battle" && mode !== "replay" && snap && (stripOpen || pendingPick) && !ended && (
        <TeamStrip bench={snap.player.bench} forced={pendingPick} onPick={pick} onClose={() => setStripOpen(false)} onAuto={() => setAutoPick(true)} />
      )}
      {phase === "battle" && ended && stateRef.current && (mode === "replay" || outcome) && (
        <ResultScreen state={stateRef.current} mode={mode} outcome={outcome} creatures={creatures} onRematch={rematch} onNext={nextTrainer} onShare={share} onShareDaily={shareDaily} onBack={back} onSaveReplay={onSaveReplay} replaySaved={replaySaved} />
      )}
      {phase === "loading" && (
        <div className="flex h-full flex-col items-center justify-center gap-4" data-testid="battle-loading">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
            <Swords className="h-7 w-7" />
          </span>
          <p className="font-display text-lg font-bold uppercase tracking-widest text-slate-100">{mode === "replay" ? "Loading replay" : mode === "gauntlet" ? `Gauntlet · Trainer ${save.gauntlet.active?.stage ?? ""}` : mode === "daily" ? `Daily challenge · ${daily?.key ?? ""}` : "Entering arena"}</p>
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-cyan-400" data-testid="battle-loading-status">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {status}
          </p>
        </div>
      )}
    </div>
  );
}
