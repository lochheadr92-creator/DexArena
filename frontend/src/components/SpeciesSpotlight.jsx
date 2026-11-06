import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Star } from "lucide-react";
import { useGame } from "@/context/GameContext";
import { typeColor } from "@/lib/types";
import { dexNo, displayNo, titleCase } from "@/lib/format";
import { dailyKey } from "@/lib/daily";
import { isShiny } from "@/lib/shiny";
import { TypeBadge } from "@/components/TypeBadge";
import { SpriteImg } from "@/components/SpriteImg";

const ROTATE_MS = 4200;

const STAT_FLAVOR = {
  hp: "prized for its sheer endurance",
  atk: "a relentless physical attacker",
  def: "an almost immovable wall",
  spa: "a devastating special attacker",
  spd: "serene and hard to break",
  spe: "blisteringly fast on the field",
};

const blurb = (c) => {
  const top = ["hp", "atk", "def", "spa", "spd", "spe"].reduce((a, b) => (c.stats[b] > c.stats[a] ? b : a), "hp");
  const t = c.types.map(titleCase).join(" / ");
  return `A ${t} ${c.genus} — ${STAT_FLAVOR[top]}.`;
};

// Stable per-day index so everyone sees the same featured creature each day.
const hashKey = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

export const SpeciesSpotlight = ({ onPick }) => {
  const { list, unlockedIds, save, rosterId } = useGame();

  const dailyId = useMemo(() => {
    if (!list.length) return null;
    return list[hashKey(`${dailyKey()}:${rosterId}`) % list.length].id;
  }, [list, rosterId]);

  // Daily pick first, then a shuffled tour of the rest.
  const order = useMemo(() => {
    const rest = list.map((c) => c.id).filter((id) => id !== dailyId);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    return dailyId != null ? [dailyId, ...rest] : rest;
  }, [list, dailyId]);

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
  // Avoid a cross-roster flash during the roster toggle.
  const rosterMatch = rosterId === "original" ? c.roster === "original" : c.roster !== "original";
  if (!rosterMatch) return null;
  const isDaily = id === dailyId && i === 0;
  const shiny = unlockedIds.has(c.id) && isShiny(c, save.shinySeed, save.shinyRate);
  const accent = typeColor(c.types[0]);

  return (
    <button
      type="button"
      data-testid="species-spotlight"
      data-daily={isDaily}
      onClick={() => onPick(c.id)}
      className="relative mb-3 flex min-h-[112px] w-full items-center gap-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-left transition-colors hover:border-slate-700"
    >
      <div className="pointer-events-none absolute inset-0 opacity-45" style={{ background: `radial-gradient(ellipse at 14% 50%, ${accent}, transparent 62%)` }} />
      <div className="pointer-events-none absolute right-3 top-2 flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.22em]" style={{ color: isDaily ? "#fbbf24" : undefined }}>
        {isDaily ? (
          <>
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> <span className="text-amber-300">Creature of the Day</span>
          </>
        ) : (
          <>
            <Sparkles className="h-3 w-3 text-cyan-400" /> <span className="text-slate-400">Species Spotlight</span>
          </>
        )}
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
          <div className="min-w-0 flex-1 pr-24">
            <span className="font-accent text-[8px] text-slate-500">{dexNo(displayNo(c))}</span>
            <h3 className="truncate font-display text-lg font-bold leading-tight tracking-tight text-slate-50" data-testid="spotlight-name">{c.displayName}</h3>
            {isDaily ? (
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-300" data-testid="spotlight-blurb">{blurb(c)}</p>
            ) : (
              <p className="truncate text-[11px] text-slate-400">{c.genus}</p>
            )}
            <div className="mt-1 flex gap-1">{c.types.map((t) => <TypeBadge key={t} type={t} />)}</div>
          </div>
        </motion.div>
      </AnimatePresence>
    </button>
  );
};
