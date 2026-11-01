const STAT_LABELS = { hp: "HP", atk: "ATK", def: "DEF", spa: "SP.A", spd: "SP.D", spe: "SPE" };

const barColor = (v) => {
  if (v < 50) return "#EF4444";
  if (v < 80) return "#F59E0B";
  if (v < 110) return "#84CC16";
  if (v < 140) return "#10B981";
  return "#06B6D4";
};

export const StatBar = ({ statKey, value }) => (
  <div className="flex items-center gap-2" data-testid={`stat-bar-${statKey}`}>
    <span className="w-9 text-[10px] font-mono tracking-wider text-slate-400">{STAT_LABELS[statKey]}</span>
    <span className="w-8 text-right text-xs font-mono font-bold text-slate-100">{value}</span>
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${Math.min(100, (value / 200) * 100)}%`, backgroundColor: barColor(value) }}
      />
    </div>
  </div>
);
