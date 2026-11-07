// Balance simulation harness for the Original roster (both lots). NOT picked up by Jest where it lives.
//
// How to use: copy this file to frontend/src/lib/__tests__/zz_tmp_balance_sim.test.js, then from frontend/:
//   $env:CI="true"; $env:BAL_OUT="C:\path\sim_run.json"; $env:BAL_PER="12"
//   npx craco test --watchAll=false --testPathPattern=zz_tmp_balance
//   node scripts/balance-sim-summary.cjs C:\path\sim_run.json
// Delete the copy afterwards (without BAL_OUT it would fail the normal suite).
// It plays seeded 1v1 battles on Pitch (abilities off, opponents within 12% BST, both side
// orders) between default loadouts and reports win rates by composition, style, role, lot and type.
// Tuning knobs live in scripts/balance-original-movesets.cjs (--proj-acc, --area-acc, templates, effects).
import fs from "node:fs";
import { createBattle, playerParams } from "@/game/state";
import { runHeadless } from "@/game/step";
import { buildMoveset } from "@/game/moves";
import { expectedDamage } from "@/game/damage";
import { makeRng } from "@/game/rng";
import { ORIGINAL_CREATURES, ORIGINAL_MOVES, installOriginalContent } from "@/content/original";

jest.setTimeout(3 * 60 * 60 * 1000);

const OUT = process.env.BAL_OUT;
const PER = Number(process.env.BAL_PER || 12);
const BAND = Number(process.env.BAL_BAND || 0.12);
const MAXSEC = 300;
const RANGED = new Set(["projectile", "area"]);
const CLOSE = new Set(["melee", "dash"]);

test("original roster 1v1 balance sample", () => {
  installOriginalContent();
  const moveMap = Object.fromEntries(ORIGINAL_MOVES.map((m) => [m.id, m]));
  const sets = {};
  const info = {};
  const dummy = { types: [], stats: { hp: 70, atk: 70, def: 70, spa: 70, spd: 70, spe: 70 }, buff: null };
  for (const c of ORIGINAL_CREATURES) {
    const set = buildMoveset(c, moveMap, []);
    sets[c.id] = set;
    const dmg = set.filter((m) => m.power > 0);
    const nR = dmg.filter((m) => RANGED.has(m.shape)).length;
    const nC = dmg.filter((m) => CLOSE.has(m.shape)).length;
    const top = [...dmg].sort((a, b) => expectedDamage({ types: c.types, stats: c.stats, buff: null }, dummy, b) - expectedDamage({ types: c.types, stats: c.stats, buff: null }, dummy, a))[0];
    info[c.id] = {
      name: c.displayName, dex: c.dexNo, lot: c.lot, types: c.types, role: c.role, bst: c.bst,
      nR, nC, nS: set.filter((m) => m.power === 0).length,
      cls: nR === 0 ? "close-only" : nC === 0 ? "ranged-only" : "mixed",
      style: top && RANGED.has(top.shape) ? "kiter" : "brawler",
      stabR: dmg.filter((m) => RANGED.has(m.shape) && c.types.includes(m.type)).length,
      stabC: dmg.filter((m) => CLOSE.has(m.shape) && c.types.includes(m.type)).length,
      moves: set.map((m) => `${m.name}:${m.shape}`),
    };
  }
  const rng = makeRng(424242);
  const results = [];
  const usage = { battles: 0, buff: 0, shield: 0, burned: 0, paralysed: 0, battlesStatus: 0, battlesBuff: 0, battlesShield: 0 };
  let seed = 9000;
  const t0 = Date.now();
  for (const a of ORIGINAL_CREATURES) {
    const pool = ORIGINAL_CREATURES.filter((b) => b.id !== a.id && Math.abs(b.bst - a.bst) / Math.max(a.bst, b.bst) <= BAND);
    const bag = [...pool];
    const picks = [];
    while (picks.length < PER && bag.length) picks.push(bag.splice(Math.floor(rng.next() * bag.length), 1)[0]);
    for (const b of picks) {
      for (const flip of [false, true]) {
        const [pa, pb] = flip ? [b, a] : [a, b];
        const state = createBattle({ seed: seed++, terrainId: "pitch", autoPick: true, abilitiesEnabled: false, player: { creatures: [pa], movesets: [sets[pa.id]], params: playerParams() }, npc: { creatures: [pb], movesets: [sets[pb.id]], params: playerParams() } });
        const s = runHeadless(state, 60 * MAXSEC);
        const winnerId = s.winner === "player" ? pa.id : s.winner === "npc" ? pb.id : null;
        results.push({ a: a.id, b: b.id, flip, winner: winnerId, sec: s.durationSec });
        const log = state.log.join("\n");
        const bf = (log.match(/: (SPE|ATK) x1\.5/g) || []).length;
        const sh = (log.match(/shield up for/g) || []).length;
        const bu = (log.match(/is burned/g) || []).length;
        const pa2 = (log.match(/is paralysed/g) || []).length;
        usage.battles++; usage.buff += bf; usage.shield += sh; usage.burned += bu; usage.paralysed += pa2;
        if (bf) usage.battlesBuff++;
        if (sh) usage.battlesShield++;
        if (bu + pa2) usage.battlesStatus++;
      }
    }
  }
  fs.writeFileSync(OUT, JSON.stringify({ info, results, usage, ms: Date.now() - t0, per: PER, band: BAND }));
  expect(results.length).toBeGreaterThan(0);
});

