import { TEAM_SIZE } from "@/lib/save";

export const PRESET_MAX = 5;
export const NAME_MAX = 20;

export const newId = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
export const cleanName = (name, fallback) => String(name ?? "").trim().slice(0, NAME_MAX) || fallback;

const snapshot = (save) => ({ team: [...save.team], abilities: Object.fromEntries(save.team.map((id) => [id, save.abilities[id] ?? 0])), savedAt: Date.now() });

export const canSavePreset = (save) => save.team.length === TEAM_SIZE && save.presets.length < PRESET_MAX;

export function addPreset(save, name) {
  if (!canSavePreset(save)) return save;
  return { ...save, presets: [...save.presets, { id: newId(), name: cleanName(name, `Preset ${save.presets.length + 1}`), ...snapshot(save) }] };
}

export function overwritePreset(save, id) {
  if (save.team.length !== TEAM_SIZE) return save;
  return { ...save, presets: save.presets.map((p) => (p.id === id ? { ...p, ...snapshot(save) } : p)) };
}

export const renamePreset = (save, id, name) => ({ ...save, presets: save.presets.map((p) => (p.id === id ? { ...p, name: cleanName(name, p.name) } : p)) });

export const deletePreset = (save, id) => ({ ...save, presets: save.presets.filter((p) => p.id !== id) });

export const presetIssues = (preset, unlockedIds, creatures) => preset.team.filter((id) => !creatures[id] || !unlockedIds.has(id));

export const loadPreset = (save, preset) => ({ ...save, team: [...preset.team], abilities: { ...save.abilities, ...preset.abilities } });

export const isCurrentTeam = (save, preset) => preset.team.length === save.team.length && preset.team.every((id, i) => save.team[i] === id && (preset.abilities?.[id] ?? 0) === (save.abilities[id] ?? 0));
