import { useEffect, useMemo, useState } from "react";
import { useGame } from "@/context/GameContext";
import { ensureMoves } from "@/game/moveData";
import { buildMoveset, toBattleMove, isDamaging, STRUGGLE_ID } from "@/game/moves";
import { defenseMatchups, offenseStrengths, superEffectiveTargets } from "@/lib/matchups";
import { TypeBadge } from "@/components/TypeBadge";

const Row = ({ label, tag, tagColor, types, testId }) => {
  if (!types || !types.length) return null;
  return (
    <div className="flex items-start gap-2" data-testid={testId}>
      <span className="mt-1 flex w-[88px] shrink-0 items-baseline gap-1 font-mono text-[9px] uppercase tracking-wider text-slate-500">
        {label} {tag && <span className={tagColor}>{tag}</span>}
      </span>
      <div className="flex flex-wrap gap-1">
        {types.map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
      </div>
    </div>
  );
};

export const TypeMatchups = ({ creature }) => {
  const { movesetOverrides } = useGame();
  const override = movesetOverrides[creature.id];
  const d = useMemo(() => defenseMatchups(creature.types), [creature]);
  const stab = useMemo(() => offenseStrengths(creature.types), [creature]);

  const [moveCoverage, setMoveCoverage] = useState(null);
  useEffect(() => {
    let alive = true;
    setMoveCoverage(null);
    const ids = [...creature.moves.map((m) => m.id), ...(override || []), STRUGGLE_ID];
    ensureMoves(ids).then((map) => {
      if (!alive) return;
      let set = override?.map((id) => map[id]).filter(Boolean).map(toBattleMove);
      if (!set || set.length !== 4) set = buildMoveset(creature, map);
      const moveTypes = [...new Set(set.filter(isDamaging).map((m) => m.type))];
      setMoveCoverage(superEffectiveTargets(moveTypes));
    });
    return () => {
      alive = false;
    };
  }, [creature, override]);

  return (
    <div className="space-y-2" data-testid="type-matchups">
      <Row label="Weak" tag="×4" tagColor="text-rose-300" types={d.weak4} testId="matchup-weak4" />
      <Row label="Weak" tag="×2" tagColor="text-rose-400" types={d.weak2} testId="matchup-weak2" />
      <Row label="Resists" tag="×¼" tagColor="text-emerald-300" types={d.resist4} testId="matchup-resist4" />
      <Row label="Resists" tag="×½" tagColor="text-emerald-400" types={d.resist2} testId="matchup-resist2" />
      <Row label="Immune" tag="×0" tagColor="text-slate-300" types={d.immune} testId="matchup-immune" />
      <Row label="Neutral" tag="×1" tagColor="text-slate-500" types={d.neutral} testId="matchup-neutral" />

      <div className="my-1 border-t border-slate-800/80" />

      <Row label="STAB hits" tag="×2" tagColor="text-amber-300" types={stab} testId="matchup-stab" />
      {stab.length === 0 && (
        <p className="pl-[96px] text-[11px] text-slate-500" data-testid="matchup-stab-none">No super-effective STAB coverage.</p>
      )}

      {moveCoverage === null ? (
        <p className="pl-[96px] text-[11px] text-slate-500" data-testid="matchup-moves-loading">Reading moveset coverage…</p>
      ) : moveCoverage.length ? (
        <Row label="Moves hit" tag="×2" tagColor="text-cyan-300" types={moveCoverage} testId="matchup-moves" />
      ) : (
        <p className="pl-[96px] text-[11px] text-slate-500" data-testid="matchup-moves-none">Current moveset has no super-effective coverage.</p>
      )}
    </div>
  );
};
