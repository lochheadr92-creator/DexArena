import { Link, useNavigate } from "react-router-dom";
import { Swords, AlertTriangle } from "lucide-react";
import { useGame } from "@/context/GameContext";
import { TERRAINS, terrainById } from "@/lib/terrains";
import { TEAM_SIZE } from "@/lib/save";
import { DEX } from "@/constants/testIds/dex";
import { TerrainCard } from "@/components/TerrainCard";
import { SpriteImg } from "@/components/SpriteImg";

export default function TerrainPage() {
  const { creatures, save, setTerrain } = useGame();
  const navigate = useNavigate();
  const terrain = terrainById(save.terrain);
  const ready = save.team.length === TEAM_SIZE;

  const startBattle = () => navigate("/battle");

  return (
    <div className="pb-36">
      <div className="mb-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-400">Step 2 of 2</p>
        <h2 className="font-display text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">Choose the arena</h2>
        <p className="mt-1 text-sm text-slate-400">Terrain bends the fight — pick ground that favours your six.</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
        {TERRAINS.map((t) => (
          <TerrainCard key={t.id} terrain={t} selected={save.terrain === t.id} onSelect={setTerrain} />
        ))}
      </div>

      <div data-testid="terrain-effect" className="mt-3 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
          {terrain.name} effect
        </p>
        <p className="mt-1 text-sm text-slate-200">{terrain.effect}</p>
      </div>

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Your team</h3>
          <Link to="/" className="font-mono text-[10px] uppercase tracking-wider text-cyan-400 hover:text-cyan-300" data-testid="edit-team-link">
            Edit roster
          </Link>
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {Array.from({ length: TEAM_SIZE }, (_, i) => {
            const c = creatures[save.team[i]];
            return (
              <div
                key={i}
                data-testid={DEX.arenaTeamSlot(i)}
                className="flex aspect-square items-center justify-center rounded-lg border border-slate-800 bg-slate-900/70"
              >
                {c ? <SpriteImg src={c.sprite} alt={c.displayName} className="h-12 w-12" /> : <span className="font-accent text-[8px] text-slate-700">{i + 1}</span>}
              </div>
            );
          })}
        </div>
        {!ready && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" /> Select {TEAM_SIZE - save.team.length} more creature{TEAM_SIZE - save.team.length === 1 ? "" : "s"} in the roster.
          </p>
        )}
      </section>

      <button
        type="button"
        data-testid={DEX.startBattle}
        disabled={!ready}
        onClick={startBattle}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 py-3.5 font-display text-base font-bold uppercase tracking-wider text-slate-950 shadow-[0_0_24px_rgba(6,182,212,0.35)] transition-[background-color,transform] hover:bg-cyan-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none"
      >
        <Swords className="h-5 w-5" /> Start battle
      </button>
    </div>
  );
}
