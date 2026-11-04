import { useEffect, useMemo, useState } from "react";
import { Loader2, RotateCcw, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGame } from "@/context/GameContext";
import { titleCase } from "@/lib/format";
import { typeColor } from "@/lib/types";
import { ensureMoves } from "@/game/moveData";
import { buildMoveset, toBattleMove, learnableMoveIds, STRUGGLE_ID } from "@/game/moves";

const SHAPE_LABEL = { projectile: "PROJ", area: "AREA", melee: "MELEE", dash: "DASH", shield: "SHIELD", buff: "BUFF" };

export const MovesetEditor = ({ creature }) => {
  const { movesetOverrides, setMovesetOverride } = useGame();
  const [moveMap, setMoveMap] = useState(null);
  const [editing, setEditing] = useState(null);
  const [loadingAll, setLoadingAll] = useState(false);
  const override = movesetOverrides[creature.id];

  useEffect(() => {
    let alive = true;
    setMoveMap(null);
    setEditing(null);
    const ids = [...creature.moves.map((m) => m.id), ...(override || []), STRUGGLE_ID];
    ensureMoves(ids).then((map) => alive && setMoveMap(map));
    return () => {
      alive = false;
    };
  }, [creature, override]);

  const auto = useMemo(() => (moveMap ? buildMoveset(creature, moveMap) : null), [creature, moveMap]);
  const current = useMemo(() => {
    if (!moveMap) return null;
    if (override) {
      const set = override.map((id) => moveMap[id]).filter(Boolean).map(toBattleMove);
      if (set.length === 4) return set;
    }
    return auto;
  }, [moveMap, override, auto]);

  const openSlot = async (slot) => {
    setEditing(slot);
    const ids = learnableMoveIds(creature).filter((id) => !moveMap[id]);
    if (ids.length) {
      setLoadingAll(true);
      const more = await ensureMoves(ids);
      setMoveMap((m) => ({ ...m, ...more }));
      setLoadingAll(false);
    }
  };

  const choose = (moveId) => {
    const ids = current.map((m) => m.id);
    ids[editing] = moveId;
    setMovesetOverride(creature.id, ids);
    setEditing(null);
  };

  if (!current) {
    return (
      <p className="flex items-center gap-2 text-xs text-slate-500" data-testid="moveset-loading">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading move data
      </p>
    );
  }

  const learnable = learnableMoveIds(creature)
    .map((id) => moveMap[id])
    .filter(Boolean)
    .filter((m) => !current.some((c) => c.id === m.id))
    .sort((a, b) => (b.power || 0) - (a.power || 0) || a.name.localeCompare(b.name));

  return (
    <div data-testid="moveset-editor">
      <div className="grid grid-cols-2 gap-1.5">
        {current.map((m, i) => (
          <button
            key={`${m.id}-${i}`}
            type="button"
            data-testid={`moveset-slot-${i}`}
            onClick={() => openSlot(i)}
            className={cn("flex min-h-[48px] items-center gap-2 rounded-lg border bg-slate-950/60 px-2 py-1.5 text-left transition-colors hover:border-cyan-500/60", editing === i ? "border-cyan-400" : "border-slate-800")}
          >
            <span className="h-8 w-1 rounded-full" style={{ backgroundColor: typeColor(m.type) }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-semibold text-slate-100">{titleCase(m.name)}</span>
              <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500">
                {m.type} · {m.power || "—"} pow · {SHAPE_LABEL[m.shape]}
              </span>
            </span>
            <ArrowLeftRight className="h-3 w-3 text-slate-600" />
          </button>
        ))}
      </div>
      {override && (
        <button type="button" data-testid="moveset-reset" onClick={() => setMovesetOverride(creature.id, null)} className="mt-2 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-cyan-400">
          <RotateCcw className="h-3 w-3" /> Reset to auto picks
        </button>
      )}
      {editing != null && (
        <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/80 p-1.5" data-testid="moveset-picker">
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="font-mono text-[9px] uppercase tracking-widest text-slate-500">Replace slot {editing + 1} · {learnable.length} learnable</span>
            {loadingAll && <Loader2 className="h-3 w-3 animate-spin text-cyan-400" />}
          </div>
          <div className="grid grid-cols-2 gap-1">
            {learnable.map((m) => {
              const bm = toBattleMove(m);
              return (
                <button key={m.id} type="button" data-testid={`moveset-option-${m.id}`} onClick={() => choose(m.id)} className="flex items-center gap-1.5 rounded-md border border-slate-800 px-1.5 py-1 text-left hover:border-cyan-500/60">
                  <span className="h-5 w-1 rounded-full" style={{ backgroundColor: typeColor(m.type) }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[10px] text-slate-100">{titleCase(m.name)}</span>
                    <span className="block font-mono text-[8px] uppercase text-slate-500">{m.power || "—"} · {SHAPE_LABEL[bm.shape]}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
