import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MAX_ID } from "@/lib/pokeapi";
import { clearCreatureCache, fetchCreatures, loadCachedCreatures } from "@/lib/dex";
import { clearSave, defaultSave, loadSave, normalizeSave, persistSave, validateSave, TEAM_SIZE } from "@/lib/save";
import { computeStarterIds, isSealed } from "@/lib/unlocks";
import { creditBattle, sealKeys } from "@/lib/progression";
import { applyRunToSave, newRun, runAfterBattle } from "@/lib/gauntlet";
import { registerDex, installHarness } from "@/game/tests/harness";

const GameContext = createContext(null);
const ALL_IDS = Array.from({ length: MAX_ID }, (_, i) => i + 1);
installHarness();

export function GameProvider({ children }) {
  const [creatures, setCreatures] = useState({});
  const [progress, setProgress] = useState({ status: "idle", failed: [] });
  const [save, setSave] = useState(loadSave);
  const [movesetOverrides, setMovesetOverrides] = useState({});
  const saveRef = useRef(save);
  saveRef.current = save;
  const pendingRef = useRef({});
  const flushTimer = useRef(null);
  const startedRef = useRef(false);
  const unlockedRef = useRef(new Set());

  const flush = useCallback(() => {
    flushTimer.current = null;
    const batch = pendingRef.current;
    pendingRef.current = {};
    setCreatures((prev) => ({ ...prev, ...batch }));
  }, []);

  const queueCreature = useCallback(
    (c) => {
      pendingRef.current[c.id] = c;
      if (!flushTimer.current) flushTimer.current = setTimeout(flush, 120);
    },
    [flush],
  );

  const sync = useCallback(
    async (ids) => {
      setProgress({ status: "fetching", failed: [] });
      const failed = [];
      await fetchCreatures(ids, { onCreature: queueCreature, onError: (id) => failed.push(id) });
      flush();
      setProgress({ status: failed.length ? "error" : "done", failed });
    },
    [queueCreature, flush],
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      setProgress({ status: "cache", failed: [] });
      const cached = await loadCachedCreatures();
      const map = {};
      cached.forEach((c) => {
        map[c.id] = c;
      });
      setCreatures(map);
      const missing = ALL_IDS.filter((id) => !map[id]);
      if (missing.length) await sync(missing);
      else setProgress({ status: "done", failed: [] });
    })();
  }, [sync]);

  const retryFailed = useCallback(() => sync(progress.failed), [sync, progress.failed]);

  const resyncDex = useCallback(async () => {
    await clearCreatureCache();
    setCreatures({});
    await sync(ALL_IDS);
  }, [sync]);

  const updateSave = useCallback((fn) => {
    setSave((prev) => persistSave(fn(prev)));
  }, []);

  const list = useMemo(() => Object.values(creatures).sort((a, b) => a.id - b.id), [creatures]);
  const starterIds = useMemo(() => computeStarterIds(creatures), [creatures]);
  const unlockedIds = useMemo(() => {
    const s = new Set(starterIds);
    save.unlocked.forEach((id) => s.add(id));
    return s;
  }, [starterIds, save.unlocked]);
  unlockedRef.current = unlockedIds;
  useEffect(() => {
    registerDex({ creatures, unlockedIds });
  }, [creatures, unlockedIds]);

  const setMovesetOverride = useCallback((creatureId, ids) => {
    setMovesetOverrides((prev) => {
      const next = { ...prev };
      if (ids) next[creatureId] = ids;
      else delete next[creatureId];
      return next;
    });
  }, []);

  const toggleTeam = useCallback(
    (id) => {
      if (!unlockedRef.current.has(id)) return "locked";
      const team = saveRef.current.team;
      if (team.includes(id)) {
        updateSave((prev) => ({ ...prev, team: prev.team.filter((x) => x !== id) }));
        return "removed";
      }
      if (team.length >= TEAM_SIZE) return "full";
      updateSave((prev) => (prev.team.length >= TEAM_SIZE || prev.team.includes(id) ? prev : { ...prev, team: [...prev.team, id] }));
      return "added";
    },
    [updateSave],
  );

  const clearTeam = useCallback(() => updateSave((prev) => ({ ...prev, team: [] })), [updateSave]);
  const setTerrain = useCallback((terrain) => updateSave((prev) => ({ ...prev, terrain })), [updateSave]);
  const resetSave = useCallback(() => {
    clearSave();
    setSave(persistSave(defaultSave()));
  }, []);

  const creaturesRef = useRef(creatures);
  creaturesRef.current = creatures;

  const importSave = useCallback((obj) => {
    const error = validateSave(obj);
    if (error) return error;
    setSave(persistSave(normalizeSave(obj)));
    return null;
  }, []);

  const creditResult = useCallback(
    (state) => {
      const res = creditBattle(saveRef.current, { win: state.winner === "player", playerIds: state.teams.player.units.map((u) => u.creatureId) }, creaturesRef.current, unlockedRef.current);
      setSave(persistSave(res.save));
      saveRef.current = res.save;
      return { newUnlocks: res.newUnlocks, keysEarned: res.keysEarned };
    },
    [],
  );

  const spendSealKey = useCallback((id) => {
    const c = creaturesRef.current[id];
    if (!c || !isSealed(c) || unlockedRef.current.has(id) || sealKeys(saveRef.current, creaturesRef.current).available <= 0) return false;
    updateSave((prev) => ({ ...prev, unlocked: [...prev.unlocked, id] }));
    return true;
  }, [updateSave]);

  const startGauntlet = useCallback(() => {
    const run = newRun(saveRef.current.team);
    updateSave((prev) => ({ ...prev, gauntlet: { ...prev.gauntlet, runs: prev.gauntlet.runs + 1, active: run } }));
    return run;
  }, [updateSave]);

  const finishGauntletStage = useCallback((state) => {
    const run = saveRef.current.gauntlet.active;
    if (!run) return null;
    const result = runAfterBattle(run, state);
    const next = applyRunToSave(saveRef.current, result);
    setSave(persistSave(next));
    saveRef.current = next;
    return result;
  }, []);

  const abandonGauntlet = useCallback(() => updateSave((prev) => ({ ...prev, gauntlet: { ...prev.gauntlet, active: null } })), [updateSave]);

  const value = useMemo(
    () => ({
      creatures,
      list,
      loaded: list.length,
      total: MAX_ID,
      progress,
      save,
      starterIds,
      unlockedIds,
      toggleTeam,
      clearTeam,
      setTerrain,
      resetSave,
      retryFailed,
      resyncDex,
      movesetOverrides,
      setMovesetOverride,
      importSave,
      creditResult,
      spendSealKey,
      startGauntlet,
      finishGauntletStage,
      abandonGauntlet,
    }),
    [creatures, list, progress, save, starterIds, unlockedIds, toggleTeam, clearTeam, setTerrain, resetSave, retryFailed, resyncDex, movesetOverrides, setMovesetOverride, importSave, creditResult, spendSealKey, startGauntlet, finishGauntletStage, abandonGauntlet],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used inside GameProvider");
  return ctx;
}
