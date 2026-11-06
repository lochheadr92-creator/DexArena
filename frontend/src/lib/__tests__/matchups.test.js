import { typeChart } from "@/game/config";
import { effectiveness, computeDamage } from "@/game/damage";
import { defenseMatchups, multiplierAgainst, superEffectiveTargets, offenseStrengths, allTypes } from "@/lib/matchups";

const TYPES = allTypes();
const base = { hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 };
const unit = (types) => ({ types, stats: base });
const dmgMove = (type) => ({ id: 1, name: "t", type, power: 80, accuracy: 100, damageClass: "physical" });

describe("type chart is the single authoritative matrix", () => {
  test("17 attacking types exist and UI reads the same matrix combat does", () => {
    expect(TYPES.length).toBe(17);
    // UI's multiplierAgainst must equal the engine's effectiveness for every single-type matchup.
    for (const a of TYPES) {
      for (const d of TYPES) {
        expect(multiplierAgainst(a, [d])).toBe(effectiveness(a, [d]));
      }
    }
  });

  test("every single-type multiplier matches the raw chart value (default 1)", () => {
    for (const a of TYPES) {
      for (const d of TYPES) {
        expect(effectiveness(a, [d])).toBe(typeChart.attack[a][d] ?? 1);
      }
    }
  });
});

describe("dual-type multipliers multiply both defensive values", () => {
  test("all attacking types vs all dual-type combos = product of the two", () => {
    for (const a of TYPES) {
      for (const x of TYPES) {
        for (const y of TYPES) {
          const expected = (typeChart.attack[a][x] ?? 1) * (typeChart.attack[a][y] ?? 1);
          expect(effectiveness(a, [x, y])).toBe(expected);
        }
      }
    }
  });

  test("×4 stacks (Ice vs Dragon/Flying) and ×¼ stacks (Fire vs Fire/Water)", () => {
    expect(effectiveness("ice", ["dragon", "flying"])).toBe(4);
    expect(effectiveness("fire", ["fire", "water"])).toBe(0.25);
  });

  test("an immune component zeroes the whole combo (Electric vs Ground/Water)", () => {
    expect(effectiveness("electric", ["ground", "water"])).toBe(0);
  });
});

describe("immunity interactions (×0)", () => {
  const immunities = [
    ["normal", "ghost"],
    ["ghost", "normal"],
    ["fighting", "ghost"],
    ["ground", "flying"],
    ["electric", "ground"],
    ["psychic", "dark"],
    ["poison", "steel"],
  ];
  test.each(immunities)("%s does no damage to %s", (atk, def) => {
    expect(effectiveness(atk, [def])).toBe(0);
  });
});

describe("regression: pure Dragon defender", () => {
  test("Water deals ×0.5 to pure Dragon", () => {
    expect(effectiveness("water", ["dragon"])).toBe(0.5);
  });
  test("Ice deals ×2 to pure Dragon", () => {
    expect(effectiveness("ice", ["dragon"])).toBe(2);
  });
  test("computeDamage reflects the ×0.5 / ×2 split (Ice hits ~4x harder than Water here)", () => {
    const atk = unit(["normal"]); // non-STAB for both so only type eff differs
    const def = unit(["dragon"]);
    const water = computeDamage(atk, def, dmgMove("water"), 1, 0.5);
    const ice = computeDamage(atk, def, dmgMove("ice"), 1, 0.5);
    expect(water.eff).toBe(0.5);
    expect(ice.eff).toBe(2);
    expect(ice.damage).toBeGreaterThan(water.damage);
  });
});

describe("computeDamage applies STAB, immunity and dual multipliers", () => {
  test("STAB (×1.5) applied only when the move type matches the attacker type", () => {
    const def = unit(["normal"]);
    const stabHit = computeDamage(unit(["water"]), def, dmgMove("water"), 1, 0.5);
    const noStab = computeDamage(unit(["grass"]), def, dmgMove("water"), 1, 0.5);
    expect(stabHit.stab).toBeCloseTo(1.5, 5);
    expect(noStab.stab).toBe(1);
    expect(stabHit.damage).toBeGreaterThan(noStab.damage);
  });

  test("type immunity yields 0 damage", () => {
    const res = computeDamage(unit(["electric"]), unit(["ground"]), dmgMove("electric"), 1, 0.5);
    expect(res.eff).toBe(0);
    expect(res.damage).toBe(0);
  });

  test("dual-type weakness doubles effectiveness vs the single-type case", () => {
    const single = computeDamage(unit(["normal"]), unit(["dragon"]), dmgMove("ice"), 1, 0.5);
    const dual = computeDamage(unit(["normal"]), unit(["dragon", "flying"]), dmgMove("ice"), 1, 0.5);
    expect(single.eff).toBe(2);
    expect(dual.eff).toBe(4);
  });
});

describe("UI panel categories agree with engine effectiveness for every type", () => {
  test("defenseMatchups buckets match effectiveness for all single & dual combos", () => {
    const bucketFor = (m) => (m === 4 ? "weak4" : m === 2 ? "weak2" : m === 1 ? "neutral" : m === 0.5 ? "resist2" : m === 0.25 ? "resist4" : m === 0 ? "immune" : "other");
    const combos = [];
    for (const x of TYPES) combos.push([x]);
    for (const x of TYPES) for (const y of TYPES) if (x < y) combos.push([x, y]);
    for (const combo of combos) {
      const d = defenseMatchups(combo);
      for (const a of TYPES) {
        const m = effectiveness(a, combo);
        const bucket = bucketFor(m);
        if (bucket !== "other") expect(d[bucket]).toContain(a);
      }
    }
  });

  test("superEffectiveTargets is sound and complete for each type combo", () => {
    for (const x of TYPES) {
      for (const y of TYPES) {
        const types = x === y ? [x] : [x, y];
        const targets = superEffectiveTargets(types);
        // sound: every listed target is hit ×2 by at least one of the types
        for (const d of targets) {
          expect(types.some((t) => (typeChart.attack[t][d] ?? 1) === 2)).toBe(true);
        }
        // complete: every type hit ×2 appears
        for (const d of TYPES) {
          const hits = types.some((t) => (typeChart.attack[t][d] ?? 1) === 2);
          expect(targets.includes(d)).toBe(hits);
        }
      }
    }
  });

  test("offenseStrengths equals superEffectiveTargets of the creature types", () => {
    expect(offenseStrengths(["water", "steel"])).toEqual(superEffectiveTargets(["water", "steel"]));
  });
});
