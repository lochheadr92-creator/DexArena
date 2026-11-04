import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Film, Play, Link2, Pencil, Trash2, Check, X, Plus, Trophy, Skull, Eye } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useGame } from "@/context/GameContext";
import { REPLAY_MAX, parseReplayLink, replayLink } from "@/lib/replays";
import { NAME_MAX } from "@/lib/presets";
import { fmtTime } from "@/lib/daily";
import { formatDate } from "@/lib/format";
import { terrainById } from "@/lib/terrains";
import { archetypes as archetypeConfig } from "@/game/config";
import { SpriteImg } from "@/components/SpriteImg";

const IconBtn = ({ testId, onClick, icon: Icon, label, danger }) => (
  <button type="button" data-testid={testId} onClick={onClick} aria-label={label} title={label} className={cn("rounded-lg border border-slate-800 p-1.5 text-slate-400 transition-colors", danger ? "hover:border-rose-700 hover:text-rose-300" : "hover:border-cyan-600 hover:text-cyan-200")}>
    <Icon className="h-3.5 w-3.5" />
  </button>
);

const MODE_LABEL = { quick: "Quick battle", gauntlet: "Gauntlet", daily: "Daily", replay: "Shared", import: "Imported" };

const copy = async (text, title) => {
  try {
    if (navigator.share) await navigator.share({ title, url: text });
    else {
      await navigator.clipboard.writeText(text);
      toast.success("Replay link copied");
    }
  } catch {
    window.prompt("Copy this replay link", text);
  }
};

const Entry = ({ r, index }) => {
  const { creatures, replays } = useGame();
  const navigate = useNavigate();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(r.name);
  const m = r.meta;
  const terrain = terrainById(m.terrainId);
  const rival = archetypeConfig.archetypes[m.archetypeId]?.name || "Rival";
  const Icon = m.winner === "player" ? Trophy : m.winner === "npc" ? Skull : Eye;
  const rename = () => {
    replays.rename(r.id, name);
    setRenaming(false);
  };
  return (
    <li data-testid={`replay-item-${index}`} data-mode={m.mode} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <div className="flex items-center gap-2">
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", m.winner === "player" ? "bg-emerald-500/20 text-emerald-300" : m.winner === "npc" ? "bg-rose-500/20 text-rose-300" : "bg-slate-800 text-slate-300")}>
          <Icon className="h-4 w-4" />
        </span>
        {renaming ? (
          <>
            <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && rename()} maxLength={NAME_MAX} autoFocus data-testid={`replay-rename-input-${index}`} className="h-9 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none" />
            <IconBtn testId={`replay-rename-save-${index}`} onClick={rename} icon={Check} label="Save name" />
            <IconBtn testId={`replay-rename-cancel-${index}`} onClick={() => setRenaming(false)} icon={X} label="Cancel" />
          </>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-bold text-slate-50" data-testid={`replay-name-${index}`}>
                {r.name}
              </p>
              <p className="font-mono text-[9px] uppercase leading-relaxed tracking-wider text-slate-500" data-testid={`replay-meta-${index}`}>
                {m.winner ? (m.winner === "player" ? "Win" : "Loss") : "Unwatched"}
                {m.seconds != null ? ` · ${fmtTime(m.seconds)}` : ""} · <span style={{ color: terrain?.accent }}>{terrain?.name || m.terrainId}</span> · vs {rival} L{m.slot} · {MODE_LABEL[m.mode] || m.mode} · {formatDate(r.savedAt)}
              </p>
            </div>
            <IconBtn testId={`replay-copy-${index}`} onClick={() => copy(replayLink(r.code), r.name)} icon={Link2} label="Copy link" />
            <IconBtn testId={`replay-rename-${index}`} onClick={() => setRenaming(true)} icon={Pencil} label="Rename" />
            <IconBtn testId={`replay-delete-${index}`} onClick={() => replays.remove(r.id)} icon={Trash2} label="Delete" danger />
          </>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex gap-0.5">
          {m.playerIds?.map((id, i) => (
            <SpriteImg key={`${id}-${i}`} src={creatures[id]?.sprite} alt={creatures[id]?.displayName || `#${id}`} className="h-7 w-7" />
          ))}
        </div>
        <button
          type="button"
          data-testid={`replay-watch-${index}`}
          onClick={() => navigate(`/replay#${r.code}`)}
          className="ml-auto flex items-center gap-1 rounded-lg bg-cyan-500 px-3 py-2 font-display text-xs font-bold uppercase tracking-wider text-slate-950 transition-[background-color,transform] hover:bg-cyan-400 active:scale-95"
        >
          <Play className="h-3.5 w-3.5" /> Watch
        </button>
      </div>
    </li>
  );
};

const AddFromLink = () => {
  const { replays } = useGame();
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const add = () => {
    try {
      const parsed = parseReplayLink(text);
      const status = replays.add({ name: name.trim() || "Shared replay", ...parsed });
      if (status === "duplicate") toast.info("That replay is already in your gallery");
      else toast.success("Replay added", { description: status === "trimmed" ? "The oldest replay was removed to make room." : "Tap Watch to play it." });
      setText("");
      setName("");
    } catch (e) {
      toast.error("Could not add replay", { description: e.message });
    }
  };
  return (
    <div className="rounded-xl border border-dashed border-slate-700 p-3" data-testid="replay-add-panel">
      <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Add from link</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a replay link or code" data-testid="replay-add-input" className="h-10 min-w-0 flex-none rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none sm:flex-1" />
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} placeholder="Name (optional)" data-testid="replay-add-name" className="h-10 w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none sm:w-36" />
          <button type="button" data-testid="replay-add-button" disabled={!text.trim()} onClick={add} className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-cyan-700/60 bg-cyan-950/40 px-3 font-mono text-[10px] uppercase tracking-wider text-cyan-200 transition-colors hover:bg-cyan-900/40 disabled:cursor-not-allowed disabled:opacity-40">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
      </div>
    </div>
  );
};

export const ReplayGallery = () => {
  const { save } = useGame();
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4" data-testid="replay-gallery">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-500">
          <Film className="h-3.5 w-3.5 text-cyan-400" /> Replay gallery
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500" data-testid="replay-gallery-count">
          {save.replays.length}/{REPLAY_MAX}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-400">Save a battle from the result screen, or paste a friend's link. Replays live in your save file.</p>
      {save.replays.length === 0 ? (
        <p className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3 text-center font-mono text-[10px] uppercase tracking-wider text-slate-500" data-testid="replay-gallery-empty">
          No saved replays yet
        </p>
      ) : (
        <ul className="mt-3 space-y-2" data-testid="replay-gallery-list">
          {save.replays.map((r, i) => (
            <Entry key={r.id} r={r} index={i} />
          ))}
        </ul>
      )}
      <div className="mt-3">
        <AddFromLink />
      </div>
    </section>
  );
};
