import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useGame } from "@/context/GameContext";
import { typeColor } from "@/lib/types";
import { dexNo } from "@/lib/format";
import { isShiny } from "@/lib/shiny";
import { TypeBadge } from "@/components/TypeBadge";
import { SpriteImg } from "@/components/SpriteImg";

const ROTATE_MS = 3800;

export const SpeciesSpotlight = ({ onPick }) => {
  const { list, unlockedIds, save } = useGame();
  const order = useMemo(() => {
    const arr = list.map((c) => c.id);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [list]);
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    if (order.length < 2) return undefined;
    const t = setInterval(() => setI((p) => (p + 1) % order.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [order]);

  if (!order.length) return null;
  const id = order[i % order.length];
  const c = list.find((x) => x.id === id);
  if (!c) return null;
  const shiny = unlockedIds.has(c.id) && isShiny(c, save.shinySeed);
  const accent = typeColor(c.types[0]);

  return (
    <button
      type="button"
      data-testid="species-spotlight"
      onClick={() => onPick(c.id)}
      className="relative mb-3 flex min-h-[104px] w-full items-center gap-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-left transition-colors hover:border-slate-700"
    >
      <div className="pointer-events-none absolute inset-0 opacity-45" style={{ background: `radial-gradient(ellipse at 14% 50%, ${accent}, transparent 62%)` }} />
      <div className="pointer-events-none absolute right-3 top-2 flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.22em] text-slate-400">
        <Sparkles className="h-3 w-3 text-cyan-400" /> Species Spotlight
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.38 }}
          className="relative flex min-w-0 flex-1 items-center gap-4"
        >
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/50">
            <SpriteImg src={c.artwork} alt={c.displayName} shiny={shiny} className="h-16 w-16" />
            {shiny && <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-amber-300 drop-shadow" data-testid="spotlight-shiny" />}
          </div>
          <div className="min-w-0 flex-1 pr-20">
            <span className="font-accent text-[8px] text-slate-500">{dexNo(c.dexNo ?? c.id)}</span>
            <h3 className="truncate font-display text-lg font-bold leading-tight tracking-tight text-slate-50" data-testid="spotlight-name">{c.displayName}</h3>
            <p className="truncate text-[11px] text-slate-400">{c.genus}</p>
            <div className="mt-1 flex gap-1">{c.types.map((t) => <TypeBadge key={t} type={t} />)}</div>
          </div>
        </motion.div>
      </AnimatePresence>
    </button>
  );
};
