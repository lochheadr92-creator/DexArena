import { KeyRound, Lock, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useGame } from "@/context/GameContext";
import { isSealed } from "@/lib/unlocks";
import { evolutionProgress, sealKeys, SEAL_KEY_WINS } from "@/lib/progression";

export const UnlockPanel = ({ creature }) => {
  const { creatures, save, unlockedIds, spendSealKey } = useGame();

  if (isSealed(creature)) {
    const keys = sealKeys(save, creatures);
    const onSpend = () => {
      if (spendSealKey(creature.id)) toast.success(`${creature.displayName} unsealed`, { description: "Added to your roster — pick it for your team." });
    };
    return (
      <div className="mt-4 rounded-lg border border-purple-900/60 bg-purple-950/30 px-3 py-2.5" data-testid="unlock-panel-sealed">
        <p className="flex items-center gap-1.5 text-xs text-purple-200">
          <Sparkles className="h-3.5 w-3.5" /> Sealed legendary · one Seal Key per {SEAL_KEY_WINS} arena wins
        </p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-purple-300/80" data-testid="seal-key-status">
          Keys available: {keys.available} · next key in {keys.nextIn} win{keys.nextIn === 1 ? "" : "s"}
        </p>
        <button
          type="button"
          data-testid="use-seal-key-button"
          disabled={keys.available <= 0}
          onClick={onSpend}
          className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-purple-600 font-display text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
        >
          <KeyRound className="h-4 w-4" /> {keys.available > 0 ? "Use a Seal Key" : "No Seal Key yet"}
        </button>
      </div>
    );
  }

  const prog = evolutionProgress(creature, creatures, save);
  if (!prog) return null;
  const preLocked = !unlockedIds.has(prog.pre.id);
  const pct = Math.min(100, (prog.have / prog.needed) * 100);
  return (
    <div className="mt-4 rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2.5" data-testid="unlock-panel-evolution">
      <p className="flex items-center gap-1.5 text-xs text-amber-200">
        <Lock className="h-3.5 w-3.5" /> Win {prog.needed} battles with {prog.pre.displayName} on your team
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-slate-800">
        <div className="h-full bg-amber-400 transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-amber-300/80" data-testid="evolution-progress">
        <Trophy className="h-3 w-3" /> {prog.have} / {prog.needed} wins
        {preLocked && " · unlock its earlier form first"}
      </p>
    </div>
  );
};
