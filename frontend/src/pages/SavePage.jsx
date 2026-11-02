import { Trophy, Swords, Unlock, Sparkles, Database, RotateCcw, Trash2, KeyRound, Flag } from "lucide-react";
import { toast } from "sonner";
import { useGame } from "@/context/GameContext";
import { formatDate } from "@/lib/format";
import { terrainById } from "@/lib/terrains";
import { isSealed } from "@/lib/unlocks";
import { sealKeys } from "@/lib/progression";
import { MAX_ID } from "@/lib/pokeapi";
import { DEX } from "@/constants/testIds/dex";
import { SpriteImg } from "@/components/SpriteImg";
import { SaveTransfer } from "@/components/SaveTransfer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const Stat = ({ icon: Icon, label, value, accent, testId }) => (
  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
    <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-500">
      <Icon className="h-3.5 w-3.5" style={{ color: accent }} /> {label}
    </div>
    <p data-testid={testId} className="mt-1.5 font-display text-2xl font-bold tabular-nums text-slate-50">
      {value}
    </p>
  </div>
);

export default function SavePage() {
  const { creatures, list, loaded, save, unlockedIds, resetSave, resyncDex, progress } = useGame();
  const sealed = list.filter(isSealed).length;
  const keys = sealKeys(save, creatures);
  const terrain = terrainById(save.terrain);

  const onReset = () => {
    resetSave();
    toast.success("Save file reset", { description: "Back to the starter roster." });
  };

  const onResync = () => {
    toast.info("Re-syncing Dex", { description: "Clearing the 30-day cache and refetching from PokéAPI." });
    resyncDex();
  };

  return (
    <div className="space-y-5 pb-28">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-400">Device-local progress</p>
        <h2 className="font-display text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">Save file</h2>
        <p className="mt-1 text-xs text-slate-500">
          Created {formatDate(save.createdAt)} · v{save.version} · stored in this browser only
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Stat icon={Trophy} label="Arena wins" value={save.totalWins} accent="#10B981" testId={DEX.saveWins} />
        <Stat icon={Swords} label="Battles" value={save.totalBattles} accent="#3B82F6" testId={DEX.saveBattles} />
        <Stat icon={Unlock} label="Unlocked" value={`${unlockedIds.size} / ${MAX_ID}`} accent="#06B6D4" testId={DEX.saveUnlocked} />
        <Stat icon={Sparkles} label="Sealed legends" value={sealed} accent="#A855F7" testId={DEX.saveSealed} />
        <Stat icon={KeyRound} label="Seal keys" value={`${keys.available} · next in ${keys.nextIn}`} accent="#C084FC" testId="save-seal-keys" />
        <Stat icon={Flag} label={`Gauntlet · ${save.gauntlet.clears} clear${save.gauntlet.clears === 1 ? "" : "s"}`} value={`best ${save.gauntlet.bestStage}/6`} accent="#F59E0B" testId="save-gauntlet" />
      </div>

      <SaveTransfer />

      <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Current loadout</h3>
          <span className="rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider" style={{ color: terrain.accent, borderColor: `${terrain.accent}55` }}>
            {terrain.name}
          </span>
        </div>
        <div className="mt-3 flex gap-1.5">
          {Array.from({ length: 6 }, (_, i) => {
            const c = creatures[save.team[i]];
            return (
              <div key={i} className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-800 bg-slate-950/60">
                {c ? <SpriteImg src={c.sprite} alt={c.displayName} className="h-11 w-11" /> : <span className="font-accent text-[8px] text-slate-700">{i + 1}</span>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-500">
          <Database className="h-3.5 w-3.5 text-cyan-400" /> Dex cache
        </div>
        <p className="mt-2 text-sm text-slate-300">
          <span className="font-bold text-slate-50">{loaded}</span> of {MAX_ID} entries cached in IndexedDB · refreshes every 30 days
        </p>
        <button
          type="button"
          data-testid={DEX.resyncDex}
          disabled={progress.status === "fetching" || progress.status === "cache"}
          onClick={onResync}
          className="mt-3 flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-slate-200 transition-colors hover:border-cyan-500 hover:text-cyan-200 disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Re-sync from PokéAPI
        </button>
      </section>

      <section className="rounded-xl border border-rose-900/50 bg-rose-950/20 p-4">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Danger zone</h3>
        <p className="mt-1 text-xs text-slate-400">Wipes wins, unlocks and your team. The Dex cache is kept.</p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              data-testid={DEX.resetSave}
              className="mt-3 flex items-center gap-1.5 rounded-lg bg-rose-600/90 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-white transition-colors hover:bg-rose-500"
            >
              <Trash2 className="h-3.5 w-3.5" /> Reset save file
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="border-slate-800 bg-slate-900">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display">Reset save file?</AlertDialogTitle>
              <AlertDialogDescription>This clears all progression on this device. There is no undo.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="reset-save-cancel">Keep it</AlertDialogCancel>
              <AlertDialogAction data-testid={DEX.resetConfirm} onClick={onReset} className="bg-rose-600 text-white hover:bg-rose-500">
                Reset
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
}
