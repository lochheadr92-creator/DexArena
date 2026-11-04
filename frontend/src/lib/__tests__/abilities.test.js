import { createBattle, playerParams, activeUnit } from "@/game/state";
import { applyHit, applyStatus, unitTopSpeed } from "@/game/combat";
import { computeDamage, expectedDamage, effectiveStat } from "@/game/damage";
import { step } from "@/game/step";
import { onEntry, abilityFor, isTrapped, weatherActive, abilityStatus, statMult } from "@/game/abilities";
import { gen4Abilities } from "@/lib/pokeapi";
import { encodeReplay, decodeReplay } from "@/lib/replay";
import { normalizeSave } from "@/lib/save";

const base = { hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 };
const mk = (id, name, types, abilities, stats = base) => ({ id, name: name.toLowerCase(), displayName: name, types, abilities, stats, bst: 480 });
const move = (name, type, power, damageClass = "physical", shape = "melee", extra = {}) => ({ id: 1, name, type, power, accuracy: 100, damageClass, shape, cooldownSec: 2, status: null, ...extra });
const set = (m) => [m, m, m, m];

function battle({ player, npc, playerAbility, npcAbility, playerMove, npcMove, abilitiesEnabled = true, terrainId = "pitch" }) {
  const six = (c) => Array.from({ length: 6 }, () => c);
  const state = createBattle({
    seed: 7,
    terrainId,
    autoPick: true,
    abilitiesEnabled,
    player: { creatures: six(player), movesets: six(set(playerMove)), params: playerParams(), abilities: six(playerAbility) },
    npc: { creatures: six(npc), movesets: six(set(npcMove)), params: playerParams(), abilities: six(npcAbility) },
  });
  const p = activeUnit(state.teams.player);
  const n = activeUnit(state.teams.npc);
  p.state = "active";
  n.state = "active";
  return { state, p, n };
}

describe("ability data", () => {
  test("gen4Abilities prefers past (gen ≥ 4) abilities and drops hidden ones", () => {
    const gengar = { abilities: [{ is_hidden: false, slot: 1, ability: { name: "cursed-body" } }], past_abilities: [{ generation: { name: "generation-vi" }, abilities: [{ is_hidden: false, slot: 1, ability: { name: "levitate" } }] }] };
    expect(gen4Abilities(gengar)).toEqual(["levitate"]);
    const two = { abilities: [{ is_hidden: false, slot: 1, ability: { name: "blaze" } }, { is_hidden: true, slot: 3, ability: { name: "solar-power" } }] };
    expect(gen4Abilities(two)).toEqual(["blaze"]);
    const pair = { abilities: [{ is_hidden: false, slot: 2, ability: { name: "static" } }, { is_hidden: false, slot: 1, ability: { name: "lightning-rod" } }] };
    expect(gen4Abilities(pair)).toEqual(["lightning-rod", "static"]);
  });

  test("abilityFor honours the saved slot and clamps", () => {
    const c = mk(1, "Ab", ["normal"], ["intimidate", "static"]);
    expect(abilityFor(c, {})).toBe("intimidate");
    expect(abilityFor(c, { 1: 1 })).toBe("static");
    expect(abilityFor(c, { 1: 5 })).toBe("static");
    expect(abilityFor(mk(2, "None", ["normal"], []), {})).toBeNull();
  });

  test("normalizeSave keeps only valid ability picks", () => {
    const s = normalizeSave({ version: 1, team: [], unlocked: [], totalWins: 0, totalBattles: 0, speciesWins: {}, abilities: { 25: 1, 1: 0, x: 1, 7: 4 } });
    expect(s.abilities).toEqual({ 25: 1, 1: 0 });
  });
});

describe("ability hooks", () => {
  test("Levitate blocks Ground moves and the AI values them at 0", () => {
    const { state, p, n } = battle({ player: mk(50, "Digger", ["ground"], ["sand-veil"]), npc: mk(94, "Gengar", ["ghost", "poison"], ["levitate"]), playerAbility: "sand-veil", npcAbility: "levitate", playerMove: move("earthquake", "ground", 100), npcMove: move("lick", "ghost", 30) });
    const hpBefore = n.hp;
    expect(applyHit(state, p, n, p.moves[0], "melee")).toBe(false);
    expect(n.hp).toBe(hpBefore);
    expect(state.abilityLog.some((e) => e.ability === "levitate")).toBe(true);
    expect(expectedDamage(p, n, p.moves[0], 1, state)).toBe(0);
    expect(n.hover).toBe(true);
  });

  test("Intimidate lowers the foe's Attack on entry unless Clear Body", () => {
    const gyarados = mk(130, "Gyarados", ["water", "flying"], ["intimidate"]);
    const { state, p, n } = battle({ player: gyarados, npc: mk(68, "Machamp", ["fighting"], ["guts"]), playerAbility: "intimidate", npcAbility: "guts", playerMove: move("bite", "dark", 60), npcMove: move("cross-chop", "fighting", 100) });
    const before = effectiveStat(n, "atk", state);
    onEntry(state, p);
    expect(n.abilityState.intimidated).toBe(true);
    expect(effectiveStat(n, "atk", state)).toBeCloseTo(before * 0.67, 3);
    const blocked = battle({ player: gyarados, npc: mk(376, "Metagross", ["steel", "psychic"], ["clear-body"]), playerAbility: "intimidate", npcAbility: "clear-body", playerMove: move("bite", "dark", 60), npcMove: move("meteor-mash", "steel", 100) });
    onEntry(blocked.state, blocked.p);
    expect(blocked.n.abilityState.intimidated).toBeUndefined();
    expect(blocked.state.abilityLog.some((e) => e.ability === "clear-body")).toBe(true);
  });

  test("Blaze boosts Fire moves only below a third of HP; Huge Power doubles Attack", () => {
    const { state, p, n } = battle({ player: mk(6, "Charizard", ["fire", "flying"], ["blaze"]), npc: mk(143, "Snorlax", ["normal"], ["thick-fat"]), playerAbility: "blaze", npcAbility: "immunity", playerMove: move("flamethrower", "fire", 95, "special", "projectile"), npcMove: move("body-slam", "normal", 85) });
    const full = computeDamage(p, n, p.moves[0], 1, 1, state).damage;
    p.hp = Math.floor(p.maxHp / 4);
    const pinch = computeDamage(p, n, p.moves[0], 1, 1, state).damage;
    expect(pinch).toBeGreaterThan(full * 1.4);
    expect(abilityStatus(state, p)).toMatchObject({ id: "blaze", active: true });
    const az = battle({ player: mk(184, "Azumarill", ["water"], ["huge-power"]), npc: mk(143, "Snorlax", ["normal"], []), playerAbility: "huge-power", npcAbility: null, playerMove: move("aqua-tail", "water", 90), npcMove: move("body-slam", "normal", 85) });
    expect(statMult(az.state, az.p, "atk")).toBe(2);
  });

  test("Thick Fat halves Fire damage and Water Absorb heals instead of hurting", () => {
    const { state, p, n } = battle({ player: mk(6, "Charizard", ["fire", "flying"], ["blaze"]), npc: mk(143, "Snorlax", ["normal"], ["thick-fat"]), playerAbility: "blaze", npcAbility: "thick-fat", playerMove: move("flamethrower", "fire", 95, "special", "projectile"), npcMove: move("body-slam", "normal", 85) });
    const noAbility = battle({ player: mk(6, "Charizard", ["fire", "flying"], ["blaze"]), npc: mk(143, "Snorlax", ["normal"], []), playerAbility: "blaze", npcAbility: null, playerMove: move("flamethrower", "fire", 95, "special", "projectile"), npcMove: move("body-slam", "normal", 85) });
    const halved = computeDamage(p, n, p.moves[0], 1, 1, state).damage;
    const normal = computeDamage(noAbility.p, noAbility.n, noAbility.p.moves[0], 1, 1, noAbility.state).damage;
    expect(halved).toBeLessThanOrEqual(Math.ceil(normal / 2) + 1);
    const wa = battle({ player: mk(9, "Blastoise", ["water"], ["torrent"]), npc: mk(134, "Vaporeon", ["water"], ["water-absorb"]), playerAbility: "torrent", npcAbility: "water-absorb", playerMove: move("surf", "water", 95, "special", "area"), npcMove: move("bite", "dark", 60) });
    wa.n.hp = 10;
    expect(applyHit(wa.state, wa.p, wa.n, wa.p.moves[0], "area")).toBe(false);
    expect(wa.n.hp).toBe(10 + Math.round(wa.n.maxHp * 0.25));
    expect(wa.state.events.some((e) => e.kind === "heal")).toBe(true);
  });

  test("Sturdy survives a lethal hit from full HP with 1 HP", () => {
    const { state, p, n } = battle({ player: mk(68, "Machamp", ["fighting"], ["guts"]), npc: mk(74, "Geodude", ["rock", "ground"], ["sturdy"], { hp: 10, atk: 10, def: 10, spa: 10, spd: 10, spe: 10 }), playerAbility: "guts", npcAbility: "sturdy", playerMove: move("cross-chop", "fighting", 100), npcMove: move("tackle", "normal", 40) });
    expect(n.hp).toBe(n.maxHp);
    applyHit(state, p, n, p.moves[0], "melee");
    expect(n.hp).toBe(1);
    expect(state.abilityLog.some((e) => e.ability === "sturdy")).toBe(true);
  });

  test("Limber blocks paralysis, Synchronize bounces burn back", () => {
    const { state, p, n } = battle({ player: mk(25, "Pikachu", ["electric"], ["static"]), npc: mk(53, "Persian", ["normal"], ["limber"]), playerAbility: "static", npcAbility: "limber", playerMove: move("thunderbolt", "electric", 95, "special", "projectile"), npcMove: move("slash", "normal", 70) });
    expect(applyStatus(state, p, n, "paralysis", { fromMove: true })).toBe(false);
    expect(n.paralysis).toBeNull();
    const sync = battle({ player: mk(6, "Charizard", ["fire", "flying"], ["blaze"]), npc: mk(65, "Alakazam", ["psychic"], ["synchronize"]), playerAbility: "blaze", npcAbility: "synchronize", playerMove: move("flamethrower", "fire", 95, "special", "projectile"), npcMove: move("psychic", "psychic", 90, "special", "area") });
    applyStatus(sync.state, sync.p, sync.n, "burn", { fromMove: true });
    expect(sync.n.burn).toBeTruthy();
    expect(sync.p.burn).toBeTruthy();
  });

  test("Shadow Tag traps the foe; Pressure stretches cooldowns; Speed Boost ramps speed", () => {
    const { state, p, n } = battle({ player: mk(202, "Wobbuffet", ["psychic"], ["shadow-tag"]), npc: mk(150, "Mewtwo", ["psychic"], ["pressure"]), playerAbility: "shadow-tag", npcAbility: "pressure", playerMove: move("counter", "fighting", 50), npcMove: move("psychic", "psychic", 90, "special", "area") });
    expect(isTrapped(state, state.teams.npc)).toBe(true);
    expect(isTrapped(state, state.teams.player)).toBe(false);
    const sb = battle({ player: mk(291, "Ninjask", ["bug", "flying"], ["speed-boost"]), npc: mk(143, "Snorlax", ["normal"], []), playerAbility: "speed-boost", npcAbility: null, playerMove: move("x-scissor", "bug", 80), npcMove: move("body-slam", "normal", 85) });
    const v0 = unitTopSpeed(sb.p, sb.state);
    sb.p.abilityState.speedBoost = 2;
    expect(unitTopSpeed(sb.p, sb.state)).toBeCloseTo(v0 * 1.4, 5);
  });

  test("Drizzle sets rain on entry, boosting Water and weakening Fire; Cloud Nine suppresses it", () => {
    const { state, p, n } = battle({ player: mk(382, "Kyogre", ["water"], ["drizzle"]), npc: mk(6, "Charizard", ["fire", "flying"], ["blaze"]), playerAbility: "drizzle", npcAbility: "blaze", playerMove: move("surf", "water", 95, "special", "area"), npcMove: move("flamethrower", "fire", 95, "special", "projectile") });
    const dry = computeDamage(p, n, p.moves[0], 1, 1, state).damage;
    onEntry(state, p);
    expect(state.weather?.kind).toBe("rain");
    expect(weatherActive(state)).toBe("rain");
    expect(computeDamage(p, n, p.moves[0], 1, 1, state).damage).toBeGreaterThan(dry * 1.2);
    n.ability = "cloud-nine";
    expect(weatherActive(state)).toBeNull();
  });

  test("abilities disabled (legacy replay) means no hooks fire, and v2 replays round-trip ability ids", () => {
    const { state, p } = battle({ player: mk(130, "Gyarados", ["water", "flying"], ["intimidate"]), npc: mk(68, "Machamp", ["fighting"], ["guts"]), playerAbility: "intimidate", npcAbility: "guts", playerMove: move("bite", "dark", 60), npcMove: move("cross-chop", "fighting", 100), abilitiesEnabled: false });
    expect(p.ability).toBeNull();
    for (let i = 0; i < 120; i++) step(state);
    expect(state.abilityLog).toHaveLength(0);
    const live = battle({ player: mk(130, "Gyarados", ["water", "flying"], ["intimidate"]), npc: mk(68, "Machamp", ["fighting"], ["guts"]), playerAbility: "intimidate", npcAbility: "guts", playerMove: move("bite", "dark", 60), npcMove: move("cross-chop", "fighting", 100) });
    live.state.meta = { archetype: "brawler", slot: 2 };
    live.state.terrain.id = "pitch";
    const decoded = decodeReplay(encodeReplay(live.state));
    expect(decoded.abilitiesEnabled).toBe(true);
    expect(decoded.playerAbilityIds).toEqual(Array(6).fill("intimidate"));
    expect(decoded.npcAbilityIds).toEqual(Array(6).fill("guts"));
  });
});
