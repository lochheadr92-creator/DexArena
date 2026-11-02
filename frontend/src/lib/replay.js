const b64 = (s) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s) => atob(s.replace(/-/g, "+").replace(/_/g, "/"));

export function encodeReplay(state) {
  const sets = (side) => state.teams[side].units.map((u) => u.moves.map((m) => m.id));
  const payload = {
    v: 1,
    seed: state.seed,
    t: state.terrain.id,
    a: state.meta.archetype,
    s: state.meta.slot,
    p: state.teams.player.units.map((u) => u.creatureId),
    n: state.teams.npc.units.map((u) => u.creatureId),
    pm: sets("player"),
    nm: sets("npc"),
    ap: state.autoPick ? 1 : 0,
    i: state.inputLog.map((x) => [x.tick, x.type === "pick" ? 1 : 0, x.index]),
  };
  if (state.meta.initialHp) payload.hp = state.meta.initialHp;
  return b64(JSON.stringify(payload));
}

export function decodeReplay(code) {
  let d;
  try {
    d = JSON.parse(unb64(code));
  } catch {
    throw new Error("This replay link is not valid");
  }
  if (d.v !== 1 || !Array.isArray(d.p) || d.p.length !== 6 || !Array.isArray(d.n) || d.n.length !== 6 || !Array.isArray(d.i)) throw new Error("This replay link is not valid");
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
    replayInputs: d.i.map(([tick, pick, index]) => ({ tick, type: pick ? "pick" : "switch", side: "player", index })),
  };
}

export const replayUrl = (state) => `${window.location.origin}/replay#${encodeReplay(state)}`;
