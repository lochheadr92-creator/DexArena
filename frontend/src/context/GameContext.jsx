import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MAX_ID } from "@/lib/pokeapi";
import { clearCreatureCache, fetchCreatures, loadCachedCreatures } from "@/lib/dex";
import { clearSave, defaultSave, loadSave, persistSave, TEAM_SIZE } from "@/lib/save";
import { computeStarterIds } from "@/lib/unlocks";

const GameContext = createContext(null);
const ALL_IDS = Array.from({ length: MAX_ID }, (_, i) => i + 1);

export function GameProvider({ children }) {
  const [creatures, setCreatures] = useState({});
  const [progress, setProgress] = useState({ status: "idle", failed: [] });
  const [save, setSave] = useState(loadSave);
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
    }),
    [creatures, list, progress, save, starterIds, unlockedIds, toggleTeam, clearTeam, setTerrain, resetSave, retryFailed, resyncDex],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used inside GameProvider");
  return ctx;
}
