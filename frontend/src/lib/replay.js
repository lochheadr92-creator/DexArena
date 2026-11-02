const b64 = (s) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s) => atob(s.replace(/-/g, "+").replace(/_/g, "/"));

export function encodeReplay(state) {
  const sets = (side) => state.teams[side].units.map((u) => (u.originalMoves || u.moves).map((m) => m.id));
  const payload = {
    v: 1,
    seed: state.seed,
    t: state.terrain.id,
    a: state.meta.archetype,
    s: state.meta.slot,
    p: state.teams.player.units.map((u) => u.evolvedFrom ?? u.creatureId),
    n: state.teams.npc.units.map((u) => u.creatureId),
    pm: sets("player"),
    nm: sets("npc"),
    ap: state.initialAutoPick ? 1 : 0,
    i: state.inputLog.map((x) => (x.type === "auto" ? [x.tick, 2, x.value ? 1 : 0] : x.type === "item" ? [x.tick, 3, x.index, x.itemId] : [x.tick, x.type === "pick" ? 1 : 0, x.index])),
  };
  if (state.meta.initialHp) payload.hp = state.meta.initialHp;
  return b64(JSON.stringify(payload));
}

const isMovesetList = (sets) => Array.isArray(sets) && sets.length === 6 && sets.every((s) => Array.isArray(s) && s.every((id) => Number.isInteger(id)));

export function decodeReplay(code) {
  let d;
  try {
    d = JSON.parse(unb64(code));
  } catch {
    throw new Error("This replay link is not valid");
  }
  const okIds = (arr) => Array.isArray(arr) && arr.length === 6 && arr.every((id) => Number.isInteger(id));
  if (d.v !== 1 || !okIds(d.p) || !okIds(d.n) || !isMovesetList(d.pm) || !isMovesetList(d.nm) || !Array.isArray(d.i)) throw new Error("This replay link is not valid");
  const overrides = (ids, sets) => Object.fromEntries(ids.map((id, k) => [id, sets[k]]));
  return {
    seed: d.seed >>> 0,
    terrainId: d.t,
    archetypeId: d.a,
    slot: d.s,
    playerIds: d.p,
    npcIds: d.n,
    movesetOverrides: overrides(d.p, d.pm),
    npcMovesetOverrides: overrides(d.n, d.nm),
    autoPick: !!d.ap,
    initialHp: d.hp || null,
    replayInputs: d.i.map(([tick, kind, v, item]) => (kind === 2 ? { tick, type: "auto", side: "player", value: !!v } : kind === 3 ? { tick, type: "item", side: "player", index: v, itemId: String(item) } : { tick, type: kind === 1 ? "pick" : "switch", side: "player", index: v })),
  };
}

export const replayUrl = (state) => `${window.location.origin}/replay#${encodeReplay(state)}`;
