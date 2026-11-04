import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEX } from "@/constants/testIds/dex";
import { TypeBadge } from "@/components/TypeBadge";

export const TerrainCard = ({ terrain, selected, onSelect }) => {
  const Icon = terrain.icon;
  return (
    <button
      type="button"
      data-testid={DEX.terrainCard(terrain.id)}
      data-selected={selected}
      onClick={() => onSelect(terrain.id)}
      style={{ "--accent": terrain.accent }}
      className={cn(
        "group relative flex min-h-[150px] flex-col justify-between overflow-hidden rounded-2xl border bg-gradient-to-br p-4 text-left transition-[border-color,transform,box-shadow] duration-200 active:scale-[0.98]",
        terrain.gradient,
        selected
          ? "border-[var(--accent)] shadow-[0_0_24px_-6px_var(--accent)]"
          : "border-slate-800 hover:border-slate-600",
      )}
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
        style={{ backgroundColor: terrain.accent }}
      />
      <div className="flex items-start justify-between">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-slate-950/50"
          style={{ color: terrain.accent }}
        >
          <Icon className="h-5 w-5" />
        </span>
        {selected && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full text-slate-950" style={{ backgroundColor: terrain.accent }}>
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        )}
      </div>
      <div>
        <p className="font-mono text-[9px] uppercase tracking-widest text-slate-400">{terrain.tagline}</p>
        <h3 className="font-display text-xl font-bold tracking-tight text-slate-50">{terrain.name}</h3>
        <div className="mt-2 flex gap-1">
          {terrain.boosts.map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </div>
      </div>
    </button>
  );
};
