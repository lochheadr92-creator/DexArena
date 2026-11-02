import { Gauge } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { GFX_LEVELS, GFX_STEP_DOWN_FPS, gfxConfig, setGfx, useGfx } from "@/game/render/quality";

export const GraphicsSettings = () => {
  const gfx = useGfx();
  const cfg = gfxConfig(gfx.level);
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4" data-testid="gfx-settings">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-500">
          <Gauge className="h-3.5 w-3.5 text-cyan-400" /> Battle graphics
        </h3>
        <span className="font-display text-xs font-bold text-cyan-300" data-testid="gfx-current" data-level={gfx.level}>
          {cfg.label}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Graphics quality">
        {GFX_LEVELS.map((level) => {
          const active = level === gfx.level;
          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={active}
              data-testid={`gfx-quality-${level}`}
              onClick={() => setGfx({ level })}
              className={`min-h-[44px] rounded-lg border font-display text-xs font-bold uppercase tracking-wider transition-colors ${active ? "border-cyan-400 bg-cyan-400/15 text-cyan-200" : "border-slate-700 text-slate-300 hover:border-slate-500 hover:text-slate-100"}`}
            >
              {gfxConfig(level).label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-slate-500" data-testid="gfx-blurb">
        {cfg.blurb}
      </p>
      <label className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-300">
        <span>Auto-lower when the frame rate stays under {GFX_STEP_DOWN_FPS} fps</span>
        <Switch checked={gfx.auto} onCheckedChange={(auto) => setGfx({ auto })} data-testid="gfx-auto-toggle" aria-label="Auto-lower graphics" />
      </label>
    </section>
  );
};
