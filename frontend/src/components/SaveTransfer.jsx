import { useRef, useState } from "react";
import { Download, Upload, FileJson } from "lucide-react";
import { toast } from "sonner";
import { useGame } from "@/context/GameContext";
import { validateSave } from "@/lib/save";
import { formatDate } from "@/lib/format";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const SaveTransfer = () => {
  const { save, importSave } = useGame();
  const fileRef = useRef(null);
  const [pending, setPending] = useState(null);

  const onExport = () => {
    const blob = new Blob([JSON.stringify(save, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `arenadex-save-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Save exported", { description: a.download });
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const error = validateSave(parsed);
      if (error) {
        toast.error("Import failed", { description: error });
        return;
      }
      setPending(parsed);
    } catch {
      toast.error("Import failed", { description: "That file is not valid JSON." });
    }
  };

  const confirmImport = () => {
    const error = importSave(pending);
    setPending(null);
    if (error) toast.error("Import failed", { description: error });
    else toast.success("Save imported", { description: "Your progress has been replaced with the file." });
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-500">
        <FileJson className="h-3.5 w-3.5 text-cyan-400" /> Move between devices
      </div>
      <p className="mt-2 text-xs text-slate-400">Export your progress as a JSON file and import it on another device. Importing replaces the save on this device.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" data-testid="export-save-button" onClick={onExport} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-3 font-mono text-[10px] uppercase tracking-wider text-slate-200 transition-colors hover:border-cyan-500 hover:text-cyan-200">
          <Download className="h-3.5 w-3.5" /> Export JSON
        </button>
        <button type="button" data-testid="import-save-button" onClick={() => fileRef.current?.click()} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-3 font-mono text-[10px] uppercase tracking-wider text-slate-200 transition-colors hover:border-cyan-500 hover:text-cyan-200">
          <Upload className="h-3.5 w-3.5" /> Import JSON
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" data-testid="import-save-input" onChange={onFile} />
      </div>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent className="border-slate-800 bg-slate-900" data-testid="import-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Replace this save?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending && `The file has ${pending.totalWins} wins, ${pending.unlocked.length} unlocks and was created ${formatDate(pending.createdAt || Date.now())}. Your current progress on this device will be overwritten.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="import-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="import-confirm" onClick={confirmImport} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
              Import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};
