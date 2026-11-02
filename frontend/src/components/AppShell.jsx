import { NavLink, Outlet } from "react-router-dom";
import { Grid3x3, Swords, Save, Check, Loader2, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGame } from "@/context/GameContext";
import { DEX } from "@/constants/testIds/dex";
import { LoadingBar } from "@/components/LoadingBar";

const TABS = [
  { to: "/", label: "Roster", icon: Grid3x3, testId: DEX.tabRoster },
  { to: "/arena", label: "Arena", icon: Swords, testId: DEX.tabArena },
  { to: "/gauntlet", label: "Gauntlet", icon: Flag, testId: DEX.tabGauntlet },
  { to: "/save", label: "Save", icon: Save, testId: DEX.tabSave },
];

const SyncChip = () => {
  const { loaded, total, progress } = useGame();
  const done = progress.status === "done";
  return (
    <span
      data-testid={DEX.syncStatus}
      data-status={progress.status}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider",
        done ? "border-emerald-800/60 bg-emerald-950/40 text-emerald-300" : "border-slate-800 bg-slate-900 text-slate-400",
      )}
    >
      {done ? <Check className="h-3 w-3" /> : <Loader2 className="h-3 w-3 animate-spin" />}
      {done ? "Dex synced" : `${loaded}/${total}`}
    </span>
  );
};

export const AppShell = () => (
  <div className="min-h-screen bg-background text-foreground">
    <header data-testid={DEX.appHeader} className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4 md:max-w-2xl lg:max-w-4xl">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-7 w-7 items-center justify-center rounded-md bg-cyan-500 shadow-[0_0_16px_rgba(6,182,212,0.6)]">
            <Swords className="h-4 w-4 text-slate-950" />
          </span>
          <div className="leading-none">
            <h1 className="font-display text-lg font-bold uppercase tracking-[0.18em] text-slate-50">Arena Dex</h1>
            <p className="font-accent text-[6px] tracking-widest text-cyan-400">GEN I–IV · 1V1 AUTO-BATTLER</p>
          </div>
        </div>
        <SyncChip />
      </div>
      <LoadingBar />
    </header>

    <main className="mx-auto max-w-md px-3 pt-4 md:max-w-2xl lg:max-w-4xl">
      <Outlet />
    </main>

    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-4 md:max-w-2xl lg:max-w-4xl">
        {TABS.map(({ to, label, icon: Icon, testId }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            data-testid={testId}
            className={({ isActive }) =>
              cn(
                "relative flex flex-col items-center justify-center gap-1 font-mono text-[10px] uppercase tracking-widest transition-colors",
                isActive ? "text-cyan-300" : "text-slate-500 hover:text-slate-300",
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute top-0 h-0.5 w-10 rounded-b bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />}
                <Icon className="h-5 w-5" />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  </div>
);
