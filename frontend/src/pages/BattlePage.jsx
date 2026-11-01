import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Swords } from "lucide-react";
import { useGame } from "@/context/GameContext";
import { prepareBattle } from "@/game/prebattle";
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

// Phase 3 hook: credit lineage wins / unlocks / next trainer from a finished battle state. Intentionally a no-op in Phase 2.
export function applyResultHooks() {}

export default function BattlePage() {
  const { creatures, unlockedIds, save, progress, movesetOverrides } = useGame();
  const navigate = useNavigate();
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
    if (stateRef.current) stateRef.current.autoPick = v;
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
      setStripOpen(false);
      setError(null);
      try {
        const state = await prepareBattle({ ...setup, creatures, unlockedIds, movesetOverrides, onProgress: setStatus });
        state.autoPick = setup.autoPick ?? false;
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
    [creatures, unlockedIds, movesetOverrides],
  );

  useEffect(() => {
    if (phase !== "loading" || stateRef.current || (progress.status !== "done" && progress.status !== "error")) return;
    const override = window.__battleOverride || {};
    const playerIds = override.playerIds || save.team;
    if (playerIds.length !== 6 || playerIds.some((id) => !creatures[id])) {
      navigate("/", { replace: true });
      return;
    }
    start({ playerIds, terrainId: override.terrainId || save.terrain, seed: override.seed ?? pickSeed(), archetypeId: override.archetypeId || null, npcIds: override.npcIds || null, autoPick: override.autoPick ?? false });
  }, [phase, progress.status, save.team, save.terrain, creatures, start, navigate]);

  const onSnapshot = useCallback((s) => {
    setSnap(s);
    if (s.phase === "ended") setEnded(true);
  }, []);

  useEffect(() => {
    if (ended && stateRef.current) applyResultHooks(stateRef.current);
  }, [ended]);

  const pick = (index) => {
    const state = stateRef.current;
    if (!state) return;
    const team = state.teams.player;
    state.inputs.push({ type: team.pendingPick ? "pick" : "switch", side: "player", index });
    setStripOpen(false);
  };

  const rematch = () => {
    stateRef.current = null;
    setSnap(null);
    start({ ...lastSetup.current, seed: pickSeed(), autoPick });
  };

  if (phase === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center" data-testid="battle-error">
        <p className="text-sm text-rose-300">Could not start the battle: {error}</p>
        <button type="button" onClick={() => navigate("/")} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200">
          Back to roster
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#05070c]" data-testid="battle-screen">
      {phase === "battle" && <BattleCanvas stateRef={stateRef} speedRef={speedRef} pausedRef={pausedRef} onSnapshot={onSnapshot} rendererRef={rendererRef} onForcePause={setPaused} />}
      {phase === "battle" && (
        <BattleHud snap={snap} speed={speed} setSpeed={setSpeed} paused={paused} setPaused={setPaused} autoPick={autoPick} setAutoPick={setAutoPick} onSwitch={() => setStripOpen(true)} />
      )}
      {phase === "battle" && snap && (stripOpen || pendingPick) && !ended && (
        <TeamStrip bench={snap.player.bench} forced={pendingPick} onPick={pick} onClose={() => setStripOpen(false)} />
      )}
      {phase === "battle" && ended && stateRef.current && <ResultScreen state={stateRef.current} onRematch={rematch} onBack={() => navigate("/")} />}
      {phase === "loading" && (
        <div className="flex h-full flex-col items-center justify-center gap-4" data-testid="battle-loading">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
            <Swords className="h-7 w-7" />
          </span>
          <p className="font-display text-lg font-bold uppercase tracking-widest text-slate-100">Entering arena</p>
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-cyan-400" data-testid="battle-loading-status">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {status}
          </p>
        </div>
      )}
    </div>
  );
}
