import { memo, useRef } from "react";
import { Info, Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { dexNo, displayNo } from "@/lib/format";
import { isSealed } from "@/lib/unlocks";
import { DEX } from "@/constants/testIds/dex";
import { TypeBadge } from "@/components/TypeBadge";
import { SpriteImg } from "@/components/SpriteImg";

const LONG_PRESS_MS = 450;

export const CreatureCard = memo(function CreatureCard({ creature, locked, slot, onSelect, onDetails, shiny, numberMode }) {
  const timer = useRef(null);
  const longPressed = useRef(false);
  const selected = slot != null;

  const startPress = () => {
    longPressed.current = false;
    timer.current = setTimeout(() => {
      longPressed.current = true;
      onDetails(creature.id);
    }, LONG_PRESS_MS);
  };
  const cancelPress = () => clearTimeout(timer.current);
  const handleClick = () => {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    onSelect(creature.id);
  };

  return (
    <div
      data-testid={DEX.creatureCard(creature.id)}
      data-locked={locked}
      data-selected={selected}
      role="button"
      tabIndex={0}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      onContextMenu={(e) => e.preventDefault()}
      onClick={handleClick}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
      className={cn(
        "group relative flex min-h-[118px] select-none flex-col items-center justify-between rounded-xl border p-2 transition-[transform,border-color,background-color,box-shadow] duration-200 active:scale-95",
        locked
          ? "border-slate-900 bg-slate-950/90 opacity-75"
          : "cursor-pointer border-slate-800 bg-slate-900/80 hover:border-blue-500/50 hover:bg-slate-800/90",
        selected && "border-blue-400/80 bg-blue-950/40 shadow-[0_0_14px_rgba(59,130,246,0.35)] ring-1 ring-blue-500",
      )}
    >
      <div className="flex w-full items-center justify-between">
        <span className="font-accent text-[7px] text-slate-500">{dexNo(displayNo(creature, numberMode))}</span>
        <button
          type="button"
          data-testid={DEX.creatureInfo(creature.id)}
          aria-label={`Details for ${creature.displayName}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDetails(creature.id);
          }}
          className="rounded-full p-0.5 text-slate-500 transition-colors hover:bg-slate-700 hover:text-cyan-300"
        >
          <Info className="h-3 w-3" />
        </button>
      </div>

      <div className="relative flex h-14 w-14 items-center justify-center">
        <SpriteImg src={creature.sprite} alt={creature.displayName} locked={locked} shiny={shiny} className="h-14 w-14" />
        {shiny && (
          <span className="absolute -right-1 -top-1 rounded-full bg-amber-400/90 p-0.5 text-slate-900 shadow" data-testid={`creature-shiny-${creature.id}`}>
            <Sparkles className="h-3 w-3" />
          </span>
        )}
        {locked && (
          <span className="absolute -bottom-1 -right-1 rounded-full border border-slate-700 bg-slate-900 p-1 text-slate-400">
            {isSealed(creature) ? <Sparkles className="h-3 w-3 text-purple-400" /> : <Lock className="h-3 w-3" />}
          </span>
        )}
        {selected && (
          <span className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 font-accent text-[8px] text-white shadow">
            {slot + 1}
          </span>
        )}
      </div>

      <div className="flex w-full flex-col items-center gap-1">
        <span
          className={cn(
            "w-full truncate text-center text-[11px] font-semibold leading-tight",
            locked ? "text-slate-500" : "text-slate-100",
          )}
        >
          {creature.displayName}
        </span>
        <div className="flex gap-1">
          {creature.types.map((t) => (
            <TypeBadge key={t} type={t} className={locked ? "opacity-50 grayscale" : undefined} />
          ))}
        </div>
      </div>
    </div>
  );
});
