import { useState } from "react";
import { Bookmark, Check, Pencil, Trash2, Save, AlertTriangle, Download, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useGame } from "@/context/GameContext";
import { TEAM_SIZE } from "@/lib/save";
import { PRESET_MAX, NAME_MAX, canSavePreset, presetIssues, isCurrentTeam } from "@/lib/presets";
import { abilityName } from "@/game/abilities";
import { SpriteImg } from "@/components/SpriteImg";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const IconBtn = ({ testId, onClick, icon: Icon, label, danger, disabled }) => (
  <button
    type="button"
    data-testid={testId}
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className={cn("rounded-lg border border-slate-800 p-1.5 text-slate-400 transition-colors disabled:opacity-30", danger ? "hover:border-rose-700 hover:text-rose-300" : "hover:border-cyan-600 hover:text-cyan-200")}
  >
    <Icon className="h-3.5 w-3.5" />
  </button>
);

const NameInput = ({ value, onChange, placeholder, testId, onSubmit }) => (
  <input
    value={value}
    onChange={(e) => onChange(e.target.value)}
    onKeyDown={(e) => e.key === "Enter" && onSubmit()}
    maxLength={NAME_MAX}
    placeholder={placeholder}
    data-testid={testId}
    autoFocus
    className="h-9 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
  />
);

const PresetRow = ({ preset, index, onClose }) => {
  const { creatures, unlockedIds, save, presets } = useGame();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(preset.name);
  const issues = presetIssues(preset, unlockedIds, creatures);
  const current = isCurrentTeam(save, preset);
  const full = save.team.length === TEAM_SIZE;

  const load = () => {
    presets.load(preset);
    toast.success(`Loaded "${preset.name}"`, { description: preset.team.map((id) => creatures[id]?.displayName).join(", ") });
    onClose();
  };
  const rename = () => {
    presets.rename(preset.id, name);
    setRenaming(false);
  };
  const overwrite = () => {
    presets.overwrite(preset.id);
    toast.success(`"${preset.name}" updated with your current team`);
  };

  return (
    <li data-testid={`preset-item-${index}`} data-current={current} data-issues={issues.length} className={cn("rounded-xl border p-3", current ? "border-cyan-700/60 bg-cyan-950/20" : "border-slate-800 bg-slate-950/60")}>
      <div className="flex items-center gap-2">
        {renaming ? (
          <>
            <NameInput value={name} onChange={setName} placeholder="Preset name" testId={`preset-rename-input-${index}`} onSubmit={rename} />
            <IconBtn testId={`preset-rename-save-${index}`} onClick={rename} icon={Check} label="Save name" />
            <IconBtn testId={`preset-rename-cancel-${index}`} onClick={() => setRenaming(false)} icon={X} label="Cancel" />
          </>
        ) : (
          <>
            <p className="min-w-0 flex-1 truncate font-display text-sm font-bold text-slate-50" data-testid={`preset-name-${index}`}>
              {preset.name}
              {current && <span className="ml-2 align-middle font-mono text-[9px] uppercase tracking-wider text-cyan-300">current</span>}
            </p>
            <IconBtn testId={`preset-rename-${index}`} onClick={() => setRenaming(true)} icon={Pencil} label="Rename" />
            <IconBtn testId={`preset-overwrite-${index}`} onClick={overwrite} icon={Save} label="Overwrite with current team" disabled={!full || current} />
            <IconBtn testId={`preset-delete-${index}`} onClick={() => presets.remove(preset.id)} icon={Trash2} label="Delete" danger />
          </>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex gap-1" data-testid={`preset-team-${index}`}>
          {preset.team.map((id) => {
            const c = creatures[id];
            const bad = issues.includes(id);
            return (
              <span key={id} className={cn("relative flex h-9 w-9 items-center justify-center rounded-lg border", bad ? "border-rose-700/70 bg-rose-950/40" : "border-slate-800 bg-slate-900")} title={c ? `${c.displayName} · ${abilityName(c.abilities?.[preset.abilities[id] ?? 0]) || ""}` : `#${id}`}>
                <SpriteImg src={c?.sprite} alt={c?.displayName || `#${id}`} className={cn("h-8 w-8", bad && "opacity-50 grayscale")} />
              </span>
            );
          })}
        </div>
        <button
          type="button"
          data-testid={`preset-load-${index}`}
          disabled={issues.length > 0 || current}
          onClick={load}
          className="ml-auto flex items-center gap-1 rounded-lg bg-cyan-500 px-3 py-2 font-display text-xs font-bold uppercase tracking-wider text-slate-950 transition-[background-color,transform] hover:bg-cyan-400 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
        >
          <Download className="h-3.5 w-3.5" /> Load
        </button>
      </div>
      {issues.length > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-rose-300" data-testid={`preset-issues-${index}`}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {issues.map((id) => creatures[id]?.displayName || `#${id}`).join(", ")} {issues.length === 1 ? "is" : "are"} locked — unlock or edit this preset before loading.
        </p>
      )}
    </li>
  );
};

const SaveCurrent = () => {
  const { save, presets, creatures } = useGame();
  const [name, setName] = useState("");
  const ok = canSavePreset(save);
  const submit = () => {
    if (!ok) return;
    const label = name.trim() || `Preset ${save.presets.length + 1}`;
    presets.add(label);
    setName("");
    toast.success(`Saved "${label}"`, { description: save.team.map((id) => creatures[id]?.displayName).join(", ") });
  };
  return (
    <div className="rounded-xl border border-dashed border-slate-700 p-3" data-testid="preset-save-panel">
      <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Save current team · {save.presets.length}/{PRESET_MAX}</p>
      <div className="mt-2 flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          maxLength={NAME_MAX}
          placeholder={`Preset ${save.presets.length + 1}`}
          disabled={!ok}
          data-testid="preset-name-input"
          className="h-10 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none disabled:opacity-40"
        />
        <button
          type="button"
          data-testid="preset-save-button"
          disabled={!ok}
          onClick={submit}
          className="flex h-10 items-center gap-1.5 rounded-lg border border-cyan-700/60 bg-cyan-950/40 px-3 font-mono text-[10px] uppercase tracking-wider text-cyan-200 transition-colors hover:bg-cyan-900/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Bookmark className="h-3.5 w-3.5" /> Save
        </button>
      </div>
      {!ok && (
        <p className="mt-2 text-[11px] text-slate-500" data-testid="preset-save-hint">
          {save.presets.length >= PRESET_MAX ? `All ${PRESET_MAX} slots used — overwrite or delete one.` : `Pick a full team of ${TEAM_SIZE} to save it.`}
        </p>
      )}
    </div>
  );
};

export const PresetsDialog = ({ trigger }) => {
  const { save } = useGame();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] w-[min(94vw,28rem)] overflow-y-auto border-slate-800 bg-slate-900 p-5 text-slate-100" data-testid="presets-dialog">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2 font-display text-xl text-slate-50">
            <Bookmark className="h-5 w-5 text-cyan-300" /> Team presets
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">Named six-creature loadouts with their ability picks. Load one before the Arena, Gauntlet or Daily.</DialogDescription>
        </DialogHeader>
        {save.presets.length === 0 ? (
          <p className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3 text-center font-mono text-[10px] uppercase tracking-wider text-slate-500" data-testid="presets-empty">
            No presets yet
          </p>
        ) : (
          <ul className="space-y-2" data-testid="presets-list">
            {save.presets.map((p, i) => (
              <PresetRow key={p.id} preset={p} index={i} onClose={() => setOpen(false)} />
            ))}
          </ul>
        )}
        <SaveCurrent />
      </DialogContent>
    </Dialog>
  );
};

export const PresetsButton = ({ className, compact = false }) => {
  const { save } = useGame();
  return (
    <PresetsDialog
      trigger={
        <button
          type="button"
          data-testid="presets-open-button"
          data-count={save.presets.length}
          aria-label="Team presets"
          className={cn(
            "relative flex items-center justify-center gap-1.5 rounded-lg border border-slate-800 text-slate-300 transition-colors hover:border-cyan-600 hover:text-cyan-200",
            compact ? "p-1.5 sm:p-2" : "px-3 py-2 font-mono text-[10px] uppercase tracking-wider",
            className,
          )}
        >
          <Bookmark className="h-4 w-4" />
          {!compact && <span>Presets</span>}
          {save.presets.length > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-500 px-1 font-mono text-[9px] font-bold text-slate-950">{save.presets.length}</span>}
        </button>
      }
    />
  );
};
