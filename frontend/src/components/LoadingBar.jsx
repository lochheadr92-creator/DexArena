import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw, WifiOff } from "lucide-react";
import { useGame } from "@/context/GameContext";
import { DEX } from "@/constants/testIds/dex";

export const LoadingBar = () => {
  const { loaded, total, progress, retryFailed } = useGame();
  const patching = progress.status === "done" && !!progress.patch;
  const visible = progress.status === "cache" || progress.status === "fetching" || progress.status === "error" || patching;
  const pct = patching ? Math.round((progress.patch.done / progress.patch.total) * 100) : Math.round((loaded / total) * 100);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          data-testid={DEX.loadingBar}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md"
        >
          <div className="mx-auto max-w-md px-4 py-2 md:max-w-2xl lg:max-w-4xl">
            <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-cyan-400">
              <span className="flex items-center gap-1.5">
                {progress.status === "error" ? (
                  <WifiOff className="h-3 w-3 text-amber-400" />
                ) : (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                )}
                {progress.status === "cache" && "Reading local Dex cache"}
                {progress.status === "fetching" && "Syncing Dex from PokéAPI"}
                {progress.status === "error" && `${progress.failed.length} entries failed`}
                {patching && <span data-testid="ability-patch-status">Syncing abilities from PokéAPI</span>}
              </span>
              <span>
                {patching ? `${progress.patch.done}/${progress.patch.total}` : `${loaded}/${total}`} · {pct}%
              </span>
            </div>
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 transition-[width] duration-300 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            {progress.status === "error" && (
              <button
                data-testid={DEX.loadingRetry}
                onClick={retryFailed}
                className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-amber-300 transition-colors hover:bg-amber-500/20"
              >
                Retry failed entries
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
