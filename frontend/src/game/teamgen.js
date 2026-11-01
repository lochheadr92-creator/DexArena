import { archetypes as archetypeConfig } from "@/game/config";
import { isSealed } from "@/lib/unlocks";
import { ensureMoves } from "@/game/moveData";
import { buildMoveset } from "@/game/moves";

const TB = archetypeConfig.teamBuilding;

const scorers = {
  physical: (c) => c.stats.atk * 2 + (c.stats.atk > c.stats.spa ? 40 : 0) + c.bst * 0.2,
  bulk: (c) => c.stats.hp + c.stats.def + c.stats.spd + c.bst * 0.1,
  kiter: (c) => c.stats.spe + c.stats.spa * 1.5 + c.bst * 0.1,
  coverage: (c) => c.bst,
  mono: (c) => c.bst,
  strongest: (c) => c.bst,
};

const byScore = (fn) => (a, b) => fn(b) - fn(a) || a.id - b.id;

function pickWeighted(rng, ranked, n, topN = TB.pickFromTop) {
  const top = ranked.slice(0, Math.max(n, topN));
  const out = [];
  while (out.length < n && top.length) {
    const idx = Math.min(top.length - 1, Math.floor(Math.abs(rng.next() - rng.next()) * top.length));
    out.push(top.splice(idx, 1)[0]);
  }
  return out;
}

async function movesetBias(candidates, predicate) {
  const ids = [...new Set(candidates.flatMap((c) => c.moves.map((m) => m.id)))];
  const moveMap = await ensureMoves(ids);
  return candidates.map((c) => ({ c, bonus: buildMoveset(c, moveMap).filter(predicate).length }));
}

function coveragePick(ranked, n) {
  const covered = new Set();
  const out = [];
  for (const c of ranked) {
    if (out.length >= n) break;
    if (c.types.some((t) => !covered.has(t))) {
      out.push(c);
      c.types.forEach((t) => covered.add(t));
    }
  }
  for (const c of ranked) if (out.length < n && !out.includes(c)) out.push(c);
  return out;
}

export async function generateNpcTeam({ rng, creatures, unlockedIds, archetype, playerHasLegendary = false, log = [] }) {
  const all = Object.values(creatures);
  const pool = all.filter((c) => unlockedIds.has(c.id) && !isSealed(c));
  const nextTier = all.filter((c) => !unlockedIds.has(c.id) && !isSealed(c) && c.evolvesFrom != null && unlockedIds.has(c.evolvesFrom));
  const legends = playerHasLegendary ? all.filter((c) => isSealed(c) && unlockedIds.has(c.id)) : [];
  const kind = archetype.team;
  let score = scorers[kind] || scorers.strongest;
  let poolRanked = [...pool].sort(byScore(score));
  let tierRanked = [...nextTier].sort(byScore(score));

  if (kind === "mono") {
    const counts = {};
    [...pool, ...nextTier].forEach((c) => c.types.forEach((t) => (counts[t] = (counts[t] || 0) + 1)));
    const eligible = Object.keys(counts).filter((t) => counts[t] >= TB.minMonoCandidates).sort();
    const type = rng.pick(eligible);
    poolRanked = poolRanked.filter((c) => c.types.includes(type));
    tierRanked = tierRanked.filter((c) => c.types.includes(type));
    log.push(`Specialist mono-type: ${type} (${poolRanked.length} pool / ${tierRanked.length} next-tier candidates)`);
  }

  if (kind === "kiter" || kind === "bulk") {
    const predicate = kind === "kiter" ? (m) => m.shape === "projectile" : (m) => m.shape === "shield" || m.shape === "buff";
    const biased = await movesetBias(poolRanked.slice(0, TB.candidatePool), predicate);
    poolRanked = [...biased.sort((a, b) => b.bonus - a.bonus || score(b.c) - score(a.c)).map((x) => x.c), ...poolRanked.slice(TB.candidatePool)];
    log.push(`${archetype.name} candidate bias (${kind === "kiter" ? "projectile" : "shield/buff"} moves): ${biased.map((x) => `${x.c.name}:${x.bonus}`).join(", ")}`);
  }

  const fromTier = tierRanked.length ? pickWeighted(rng, tierRanked, 1, 5) : [];
  const need = 6 - fromTier.length;
  const fromPool = kind === "coverage" ? coveragePick(poolRanked, need) : pickWeighted(rng, poolRanked, need);
  let team = [...fromPool, ...fromTier];
  if (legends.length && kind === "strongest") team[team.length - 1] = rng.pick(legends);
  team = rng.shuffle(team);
  log.push(`NPC team (${archetype.name}): ${team.map((c) => `${c.displayName}#${c.id}`).join(", ")} | next-tier pick: ${fromTier.map((c) => c.displayName).join(", ") || "none"}`);
  return team;
}
