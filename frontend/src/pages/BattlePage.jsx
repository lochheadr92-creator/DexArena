import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Swords } from "lucide-react";
import { toast } from "sonner";
import { useGame } from "@/context/GameContext";
import { prepareBattle } from "@/game/prebattle";
import { playerHasLegendary } from "@/lib/progression";
import { stageSetup } from "@/lib/gauntlet";
import { decodeReplay, replayUrl } from "@/lib/replay";
import { BattleCanvas } from "@/components/battle/BattleCanvas";
import { BattleHud } from "@/components/battle/BattleHud";
import { TeamStrip } from "@/components/battle/TeamStrip";
import { ResultScreen } from "@/components/battle/ResultScreen";

function pickSeed() {
  const forced = typeof window.__seed === "number" && window.__seed !== window.__lastSeedUsed ? window.__seed : null;
  const seed = forced ?? ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
  window.__seed = seed;
  window.__lastSeedUsed = seed;
  return seed;
}

export default function BattlePage() {
  const { creatures, unlockedIds, save, progress, movesetOverrides, creditResult, finishGauntletStage } = useGame();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const mode = location.pathname === "/replay" ? "replay" : params.get("mode") === "gauntlet" ? "gauntlet" : "quick";
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
  const [ended, setEnded] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const lastSetup = useRef(null);

  const setSpeed = (s) => {
    speedRef.current = s;
    setSpeedState(s);
  };
  const pendingPick = !!snap?.player.pendingPick && !autoPick;
  const effectivePaused = paused || stripOpen || pendingPick || phase !== "battle";
  pausedRef.current = effectivePaused;

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
      setStripOpen(false);
      setError(null);
      try {
        const state = await prepareBattle({ movesetOverrides, ...setup, creatures, unlockedIds, playerHasLegendary: playerHasLegendary(unlockedIds, creatures), onProgress: setStatus });
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
    [creatures, unlockedIds, movesetOverrides, mode],
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
    } else if (mode === "gauntlet") {
      if (!save.gauntlet.active) {
        navigate("/gauntlet", { replace: true });
        return;
      }
      setup = { ...stageSetup(save.gauntlet.active), seed: pickSeed() };
    } else {
      const override = window.__battleOverride || {};
      setup = { playerIds: override.playerIds || save.team, terrainId: override.terrainId || save.terrain, seed: override.seed ?? pickSeed(), archetypeId: override.archetypeId || null, npcIds: override.npcIds || null, autoPick: override.autoPick ?? false };
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
  }, [phase, progress.status, save, creatures, start, navigate, mode, location.hash]);

  const onSnapshot = useCallback((s) => {
    setSnap(s);
    if (s.phase === "ended") setEnded(true);
  }, []);

  useEffect(() => {
    const state = stateRef.current;
    if (!ended || !state || state.credited) return;
    state.credited = true;
    if (mode === "replay") return;
    const credit = creditResult(state);
    const gauntlet = mode === "gauntlet" ? finishGauntletStage(state) : null;
    setOutcome({ ...credit, gauntlet });
  }, [ended, mode, creditResult, finishGauntletStage]);

  const pick = (index) => {
    const state = stateRef.current;
    if (!state) return;
    const team = state.teams.player;
    state.inputs.push({ type: team.pendingPick ? "pick" : "switch", side: "player", index });
    setStripOpen(false);
  };

  const restart = (setup) => {
    stateRef.current = null;
    setSnap(null);
    startedRef.current = true;
    start(setup);
  };
  const rematch = () => restart({ ...lastSetup.current, seed: pickSeed(), autoPick });
  const nextTrainer = () => {
    const run = outcome?.gauntlet?.run;
    if (run) restart({ ...stageSetup(run), seed: pickSeed(), autoPick });
  };
  const share = async () => {
    const url = replayUrl(stateRef.current);
    try {
      if (navigator.share) await navigator.share({ title: "Arena Dex replay", url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Replay link copied", { description: "Anyone opening it watches this exact battle." });
      }
    } catch {
      window.prompt("Copy this replay link", url);
    }
  };
  const back = () => navigate(mode === "gauntlet" ? "/gauntlet" : "/");

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
        <BattleHud snap={snap} speed={speed} setSpeed={setSpeed} paused={paused} setPaused={setPaused} autoPick={autoPick} setAutoPick={setAutoPick} onSwitch={() => setStripOpen(true)} readOnly={mode === "replay"} stage={mode === "gauntlet" ? stateRef.current?.meta.slot : null} />
      )}
      {phase === "battle" && mode !== "replay" && snap && (stripOpen || pendingPick) && !ended && (
        <TeamStrip bench={snap.player.bench} forced={pendingPick} onPick={pick} onClose={() => setStripOpen(false)} onAuto={() => setAutoPick(true)} />
      )}
      {phase === "battle" && ended && stateRef.current && (mode === "replay" || outcome) && (
        <ResultScreen state={stateRef.current} mode={mode} outcome={outcome} creatures={creatures} onRematch={rematch} onNext={nextTrainer} onShare={share} onBack={back} />
      )}
      {phase === "loading" && (
        <div className="flex h-full flex-col items-center justify-center gap-4" data-testid="battle-loading">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
            <Swords className="h-7 w-7" />
          </span>
          <p className="font-display text-lg font-bold uppercase tracking-widest text-slate-100">{mode === "replay" ? "Loading replay" : mode === "gauntlet" ? `Gauntlet · Trainer ${save.gauntlet.active?.stage ?? ""}` : "Entering arena"}</p>
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-cyan-400" data-testid="battle-loading-status">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {status}
          </p>
        </div>
      )}
    </div>
  );
}
