import { archetypes as archetypeConfig, difficulty as difficultyConfig } from "@/game/config";
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

function withinBudget(list, budget, need) {
  if (!budget) return list;
  let band = difficultyConfig.budgetBand;
  let out = list.filter((c) => Math.abs(c.bst - budget) <= budget * band);
  while (out.length < Math.max(need, difficultyConfig.minCandidates) && band < 1) {
    band += difficultyConfig.bandWidenStep;
    out = list.filter((c) => Math.abs(c.bst - budget) <= budget * band);
  }
  return out;
}

function lineStarted(c, creatures, unlockedIds) {
  let cur = c;
  const seen = new Set();
  while (cur && cur.evolvesFrom != null && !seen.has(cur.id)) {
    seen.add(cur.id);
    if (unlockedIds.has(cur.evolvesFrom)) return true;
    cur = creatures[cur.evolvesFrom];
  }
  return false;
}

export function tierCandidates(all, creatures, unlockedIds, pool) {
  const locked = all.filter((c) => !unlockedIds.has(c.id) && !isSealed(c));
  if (pool === "nextTier") return locked.filter((c) => c.evolvesFrom != null && unlockedIds.has(c.evolvesFrom));
  if (pool === "line") return locked.filter((c) => lineStarted(c, creatures, unlockedIds));
  if (pool === "all") return locked;
  return [];
}

export async function generateNpcTeam({ rng, creatures, unlockedIds, archetype, playerHasLegendary = false, budget = null, pool: poolMode = "nextTier", tierPicks = 1, allowLegendary = true, log = [] }) {
  const all = Object.values(creatures);
  const owned = all.filter((c) => unlockedIds.has(c.id) && !isSealed(c));
  const extra = tierCandidates(all, creatures, unlockedIds, poolMode);
  const merged = poolMode === "all";
  const pool = withinBudget(merged ? [...owned, ...extra] : owned, budget, 6);
  const picks = merged ? 0 : Math.min(tierPicks, 6);
  const nextTier = picks ? withinBudget(extra, budget, picks) : [];
  const legends = allowLegendary && playerHasLegendary ? all.filter((c) => isSealed(c) && unlockedIds.has(c.id)) : [];
  if (budget) log.push(`Rival budget ${budget} BST (${poolMode} pool): ${pool.length} pool / ${nextTier.length} tier candidates in band, up to ${picks} tier picks`);
  const kind = archetype.team;
  let score = scorers[kind] || scorers.strongest;
  let poolRanked = [...pool].sort(byScore(score));
  let tierRanked = [...nextTier].sort(byScore(score));

  if (kind === "mono") {
    const counts = {};
    [...pool, ...nextTier].forEach((c) => c.types.forEach((t) => (counts[t] = (counts[t] || 0) + 1)));
    const typesByCount = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
    const eligible = typesByCount.filter((t) => counts[t] >= TB.minMonoCandidates).sort();
    const type = eligible.length ? rng.pick(eligible) : typesByCount[0];
    const monoPool = poolRanked.filter((c) => c.types.includes(type));
    const monoTier = tierRanked.filter((c) => c.types.includes(type));
    if (monoPool.length + monoTier.length >= 6) {
      poolRanked = monoPool;
      tierRanked = monoTier;
    } else {
      poolRanked = [...monoPool, ...poolRanked.filter((c) => !monoPool.includes(c))];
      tierRanked = [...monoTier, ...tierRanked.filter((c) => !monoTier.includes(c))];
    }
    log.push(`Specialist mono-type: ${type} (${monoPool.length} pool / ${monoTier.length} tier candidates${monoPool.length + monoTier.length < 6 ? ", topped up with other types" : ""})`);
  }

  if (kind === "kiter" || kind === "bulk") {
    const predicate = kind === "kiter" ? (m) => m.shape === "projectile" : (m) => m.shape === "shield" || m.shape === "buff";
    const biased = await movesetBias(poolRanked.slice(0, TB.candidatePool), predicate);
    poolRanked = [...biased.sort((a, b) => b.bonus - a.bonus || score(b.c) - score(a.c)).map((x) => x.c), ...poolRanked.slice(TB.candidatePool)];
    log.push(`${archetype.name} candidate bias (${kind === "kiter" ? "projectile" : "shield/buff"} moves): ${biased.map((x) => `${x.c.name}:${x.bonus}`).join(", ")}`);
  }

  const tierCount = Math.min(picks, tierRanked.length);
  const fromTier = tierCount ? pickWeighted(rng, tierRanked, tierCount, Math.max(5, tierCount * 3)) : [];
  const need = 6 - fromTier.length;
  const fromPool = kind === "coverage" ? coveragePick(poolRanked, need) : pickWeighted(rng, poolRanked, need);
  let team = [...fromPool, ...fromTier];
  if (team.length < 6) {
    const used = new Set(team.map((c) => c.id));
    const target = budget || 0;
    const rest = [...owned, ...extra].filter((c) => !used.has(c.id)).sort((a, b) => Math.abs(a.bst - target) - Math.abs(b.bst - target) || a.id - b.id);
    for (const c of rest) {
      if (team.length >= 6) break;
      if (!used.has(c.id)) {
        used.add(c.id);
        team.push(c);
      }
    }
    log.push(`Rival pool too small: topped up to ${team.length} from the wider pool`);
  }
  if (legends.length && kind === "strongest") team[team.length - 1] = rng.pick(legends);
  team = rng.shuffle(team);
  log.push(`NPC team (${archetype.name}): ${team.map((c) => `${c.displayName}#${c.id}`).join(", ")} | tier picks: ${fromTier.map((c) => c.displayName).join(", ") || "none"}`);
  return team;
}
