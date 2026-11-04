import { TICK_RATE } from "@/game/config";
import { decodeReplay } from "@/lib/replay";
import { newId, cleanName } from "@/lib/presets";

export const REPLAY_MAX = 20;

export function replayMeta(state, mode) {
  const standing = (side) => state.teams[side].units.filter((u) => u.hp > 0).length;
  return {
    winner: state.winner,
    seconds: +(state.endTick / TICK_RATE).toFixed(1),
    terrainId: state.terrain.id,
    archetypeId: state.meta.archetype,
    slot: state.meta.slot,
    mode,
    playerIds: state.teams.player.units.map((u) => u.creatureId),
    npcIds: state.teams.npc.units.map((u) => u.creatureId),
    standing: standing("player"),
    rivalStanding: standing("npc"),
  };
}

export function addReplay(save, { name, code, meta }) {
  if (save.replays.some((r) => r.code === code)) return { save, status: "duplicate" };
  const entry = { id: newId(), name: cleanName(name, "Replay"), code, meta, savedAt: Date.now() };
  const replays = [entry, ...save.replays];
  return { save: { ...save, replays: replays.slice(0, REPLAY_MAX) }, status: replays.length > REPLAY_MAX ? "trimmed" : "saved" };
}

export const renameReplay = (save, id, name) => ({ ...save, replays: save.replays.map((r) => (r.id === id ? { ...r, name: cleanName(name, r.name) } : r)) });

export const deleteReplay = (save, id) => ({ ...save, replays: save.replays.filter((r) => r.id !== id) });

export function parseReplayLink(text) {
  const s = String(text ?? "").trim();
  const code = s.includes("#") ? s.slice(s.lastIndexOf("#") + 1) : s;
  if (!code) throw new Error("Paste a replay link first");
  const setup = decodeReplay(code);
  return { code, meta: { winner: null, seconds: null, terrainId: setup.terrainId, archetypeId: setup.archetypeId, slot: setup.slot, mode: "import", playerIds: setup.playerIds, npcIds: setup.npcIds, standing: null, rivalStanding: null } };
}

export const replayLink = (code) => `${window.location.origin}/replay#${code}`;
