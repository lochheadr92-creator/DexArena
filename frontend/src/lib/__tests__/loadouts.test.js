import { addPreset, overwritePreset, renamePreset, deletePreset, loadPreset, presetIssues, canSavePreset, isCurrentTeam, PRESET_MAX } from "@/lib/presets";
import { addReplay, renameReplay, deleteReplay, parseReplayLink, REPLAY_MAX } from "@/lib/replays";
import { dailyStats, recordDaily, shiftDay } from "@/lib/daily";
import { defaultSave, normalizeSave } from "@/lib/save";

const TEAM = [1, 4, 7, 25, 133, 143];
const base = () => ({ ...defaultSave(), team: TEAM, abilities: { 1: 1, 25: 0 } });

describe("team presets", () => {
  test("save, load, rename, overwrite, delete", () => {
    let s = addPreset(base(), "  Rain squad  ");
    expect(s.presets).toHaveLength(1);
    expect(s.presets[0]).toMatchObject({ name: "Rain squad", team: TEAM, abilities: { 1: 1, 4: 0, 7: 0, 25: 0, 133: 0, 143: 0 } });
    const id = s.presets[0].id;
    s = renamePreset(s, id, "Sun squad");
    expect(s.presets[0].name).toBe("Sun squad");
    s = { ...s, team: [10, 13, 16, 19, 21, 23], abilities: { 10: 1 } };
    const loaded = loadPreset(s, s.presets[0]);
    expect(loaded.team).toEqual(TEAM);
    expect(loaded.abilities).toMatchObject({ 1: 1, 10: 1, 25: 0 });
    s = overwritePreset(s, id);
    expect(s.presets[0].team).toEqual([10, 13, 16, 19, 21, 23]);
    expect(s.presets[0].name).toBe("Sun squad");
    s = deletePreset(s, id);
    expect(s.presets).toEqual([]);
  });
  test("needs a full team and caps at PRESET_MAX; default names", () => {
    let s = { ...base(), team: [1, 4] };
    expect(canSavePreset(s)).toBe(false);
    expect(addPreset(s, "x")).toBe(s);
    s = base();
    for (let i = 0; i < PRESET_MAX + 2; i++) s = addPreset(s, "");
    expect(s.presets).toHaveLength(PRESET_MAX);
    expect(s.presets.map((p) => p.name)).toEqual(["Preset 1", "Preset 2", "Preset 3", "Preset 4", "Preset 5"]);
  });
  test("issues flag locked or unknown creatures", () => {
    const preset = { team: TEAM };
    const creatures = Object.fromEntries(TEAM.map((id) => [id, { id }]));
    expect(presetIssues(preset, new Set(TEAM), creatures)).toEqual([]);
    expect(presetIssues(preset, new Set([1, 4, 7]), creatures)).toEqual([25, 133, 143]);
    expect(presetIssues(preset, new Set(TEAM), { 1: {} })).toEqual([4, 7, 25, 133, 143]);
  });
  test("normalizeSave keeps only well-formed presets", () => {
    const s = normalizeSave({ ...defaultSave(), presets: [{ id: "a", name: "ok", team: TEAM, abilities: { 1: 1, x: 3 } }, { id: "b", name: "short", team: [1, 2] }, null] });
    expect(s.presets).toHaveLength(1);
    expect(s.presets[0]).toMatchObject({ id: "a", name: "ok", team: TEAM, abilities: { 1: 1 } });
  });
});

describe("replay gallery", () => {
  const entry = (n) => ({ name: `R${n}`, code: `code${n}`, meta: { winner: "player", terrainId: "pitch" } });
  test("add newest first, dedupe by code, cap at REPLAY_MAX", () => {
    let s = defaultSave();
    s = addReplay(s, entry(1)).save;
    const dup = addReplay(s, entry(1));
    expect(dup.status).toBe("duplicate");
    expect(dup.save.replays).toHaveLength(1);
    for (let i = 2; i <= REPLAY_MAX + 1; i++) s = addReplay(s, entry(i)).save;
    expect(s.replays).toHaveLength(REPLAY_MAX);
    expect(s.replays[0].name).toBe(`R${REPLAY_MAX + 1}`);
    expect(s.replays.some((r) => r.code === "code1")).toBe(false);
  });
  test("rename and delete", () => {
    let s = addReplay(defaultSave(), entry(1)).save;
    const id = s.replays[0].id;
    s = renameReplay(s, id, "  Epic comeback ");
    expect(s.replays[0].name).toBe("Epic comeback");
    expect(deleteReplay(s, id).replays).toEqual([]);
  });
  test("parseReplayLink accepts URLs and bare codes, rejects junk", () => {
    const payload = { v: 2, seed: 9001, t: "cavern", a: "tactician", s: 3, p: TEAM, n: [10, 13, 16, 19, 21, 23], pm: Array(6).fill([33]), nm: Array(6).fill([33]), pa: Array(6).fill(null), na: Array(6).fill(null), ab: 1, ap: 1, i: [] };
    const code = btoa(JSON.stringify(payload)).replace(/=+$/, "");
    const parsed = parseReplayLink(`https://example.test/replay#${code}`);
    expect(parsed.code).toBe(code);
    expect(parsed.meta).toMatchObject({ terrainId: "cavern", archetypeId: "tactician", slot: 3, mode: "import", winner: null, playerIds: TEAM });
    expect(parseReplayLink(code).code).toBe(code);
    expect(() => parseReplayLink("not a replay")).toThrow();
    expect(() => parseReplayLink("")).toThrow();
  });
  test("normalizeSave drops malformed replays", () => {
    const s = normalizeSave({ ...defaultSave(), replays: [{ id: "a", name: "ok", code: "abc", meta: {} }, { id: "b", name: "no code", meta: {} }, { id: "c", name: "no meta", code: "x" }] });
    expect(s.replays.map((r) => r.id)).toEqual(["a"]);
  });
});

describe("daily leaderboard", () => {
  const res = (score, win = true) => ({ score, win, seconds: 60, standing: 3, kos: 6 });
  test("recordDaily keeps a per-day history, newest first", () => {
    let s = defaultSave();
    s = recordDaily(s, "2026-06-10", res(500, false)).save;
    s = recordDaily(s, "2026-06-10", res(900)).save;
    s = recordDaily(s, "2026-06-11", res(700)).save;
    expect(s.daily.history.map((e) => e.key)).toEqual(["2026-06-11", "2026-06-10"]);
    expect(s.daily.history[1]).toMatchObject({ attempts: 2, best: { score: 900 } });
  });
  test("streaks and month stats", () => {
    const h = ["2026-06-14", "2026-06-13", "2026-06-12", "2026-06-09", "2026-06-08", "2026-05-30"].map((key, i) => ({ key, attempts: 1, best: res(100 * (i + 1), i % 2 === 0) }));
    expect(dailyStats(h, "2026-06-14")).toEqual({ streak: 3, bestStreak: 3, monthPlayed: 5, monthWins: 3, monthBest: 500 });
    expect(dailyStats(h, "2026-06-15").streak).toBe(3);
    expect(dailyStats(h, "2026-06-16").streak).toBe(0);
    expect(dailyStats([], "2026-06-16")).toEqual({ streak: 0, bestStreak: 0, monthPlayed: 0, monthWins: 0, monthBest: 0 });
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
  });
  test("normalizeSave migrates an old daily block into history", () => {
    const s = normalizeSave({ ...defaultSave(), daily: { key: "2026-06-14", attempts: 2, best: res(800) } });
    expect(s.daily.history).toEqual([{ key: "2026-06-14", attempts: 2, best: res(800) }]);
    const bad = normalizeSave({ ...defaultSave(), daily: { key: "nope", attempts: 1, best: res(5), history: [{ key: "2026-01-01", best: { score: 1 } }, { key: "x" }] } });
    expect(bad.daily.key).toBeNull();
    expect(bad.daily.history).toEqual([{ key: "2026-01-01", attempts: 1, best: { score: 1 } }]);
    const dup = normalizeSave({ ...defaultSave(), daily: { key: null, attempts: 0, best: null, history: [{ key: "2026-01-02", best: { score: 2 } }, { key: "2026-01-02", best: { score: 9 } }] } });
    expect(dup.daily.history).toHaveLength(1);
  });
  test("isCurrentTeam compares ability picks too", () => {
    const s = { ...defaultSave(), team: [1, 4, 7, 25, 133, 143], abilities: { 133: 1 } };
    const preset = { team: [1, 4, 7, 25, 133, 143], abilities: { 133: 0 } };
    expect(isCurrentTeam(s, preset)).toBe(false);
    expect(isCurrentTeam(s, { ...preset, abilities: { 133: 1 } })).toBe(true);
  });
});
