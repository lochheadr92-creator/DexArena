import { Slider } from "@/components/ui/slider";
import { RIVAL_LEVELS, rivalPlan } from "@/lib/rival";

export const RivalLevelPicker = ({ level, onChange, teamCreatures, totalWins }) => {
  const plan = rivalPlan(teamCreatures, totalWins, level);
  return (
    <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3" data-testid="rival-level-picker">
      <div className="flex items-baseline justify-between">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Rival level</h3>
        <span className="font-display text-sm font-bold text-cyan-300" data-testid="rival-level-label">
          Lv.{plan.level} · {plan.name}
        </span>
      </div>
      <Slider
        className="mt-3 [&_[role=slider]]:h-5 [&_[role=slider]]:w-5 [&_[role=slider]]:border-cyan-400 [&_[role=slider]]:bg-slate-950 [&_.bg-primary]:bg-cyan-400 [&_.bg-primary\/20]:bg-slate-700"
        min={RIVAL_LEVELS[0].level}
        max={RIVAL_LEVELS[RIVAL_LEVELS.length - 1].level}
        step={1}
        value={[plan.level]}
        onValueChange={([v]) => onChange(v)}
        aria-label="Rival level"
        data-testid="rival-level-slider"
      />
      <div className="mt-1.5 flex justify-between font-mono text-[10px] uppercase tracking-wider text-slate-400">
        {RIVAL_LEVELS.map((l) => (
          <button key={l.level} type="button" onClick={() => onChange(l.level)} className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${l.level === plan.level ? "bg-cyan-400/15 font-bold text-cyan-300" : "hover:bg-slate-800 hover:text-slate-200"}`} aria-label={`Rival level ${l.level}`} data-testid={`rival-level-${l.level}`}>
            {l.level}
          </button>
        ))}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-slate-950/60 py-2">
          <dt className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Your power</dt>
          <dd className="font-display text-base font-bold text-slate-100" data-testid="rival-self-power">{plan.power || "—"}</dd>
        </div>
        <div className="rounded-lg bg-slate-950/60 py-2">
          <dt className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Rival budget</dt>
          <dd className="font-display text-base font-bold text-amber-300" data-testid="rival-budget">{plan.power ? `~${plan.budget}` : "—"}</dd>
        </div>
        <div className="rounded-lg bg-slate-950/60 py-2">
          <dt className="font-mono text-[9px] uppercase tracking-wider text-slate-500">AI skill</dt>
          <dd className="font-display text-base font-bold text-slate-100" data-testid="rival-ai-slot">{plan.slot}/6</dd>
        </div>
      </dl>
      <p className="mt-2 text-[11px] leading-snug text-slate-500">
        Power = your team's average base-stat total + 2 per win (max +150). The rival drafts creatures around {Math.round(plan.budget ? (plan.budget / Math.max(1, plan.power)) * 100 : 100)}% of your power
        {plan.nextTier ? ", including evolutions you haven't unlocked" : ", from your unlocked pool only"}
        {plan.legendary ? ", and may bring a legendary if you own one" : ""}.
      </p>
    </section>
  );
};
