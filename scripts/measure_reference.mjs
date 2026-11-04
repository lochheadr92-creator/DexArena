#!/usr/bin/env node
// Measures the Gen-IV-era distribution of the reference Pokémon roster (species 1..493)
// so the 150 original-creature roster can be scaled to match it.
// Caches raw PokeAPI JSON to /app/scripts/.refcache to avoid refetching.

import fs from "node:fs";
import path from "node:path";

const API = "https://pokeapi.co/api/v2";
const MAX_ID = 493;
const CONCURRENCY = 8;
const CACHE_DIR = path.join(process.cwd(), "scripts", ".refcache");
fs.mkdirSync(CACHE_DIR, { recursive: true });

const GEN_ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 };
const genNumber = (name) => GEN_ROMAN[name.replace("generation-", "")] || 99;
const idFromUrl = (url) => Number(url.replace(/\/$/, "").split("/").pop());

async function fetchJson(url, key) {
  const file = path.join(CACHE_DIR, key.replace(/[^a-z0-9_-]/gi, "_") + ".json");
  if (fs.existsSync(file)) {
    try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
  }
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      fs.writeFileSync(file, JSON.stringify(json));
      return json;
    } catch (e) {
      if (attempt >= 4) throw e;
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
}

function gen4Types(pokemon) {
  const past = (pokemon.past_types || [])
    .map((p) => ({ gen: genNumber(p.generation.name), types: p.types }))
    .filter((p) => p.gen >= 4)
    .sort((a, b) => a.gen - b.gen)[0];
  const source = past ? past.types : pokemon.types;
  return [...source].sort((a, b) => a.slot - b.slot).map((t) => t.type.name);
}

async function run() {
  const ids = Array.from({ length: MAX_ID }, (_, i) => i + 1);
  const results = [];
  const chainCache = new Map();
  let done = 0;

  const worker = async () => {
    while (ids.length) {
      const id = ids.shift();
      try {
        const [pokemon, species] = await Promise.all([
          fetchJson(`${API}/pokemon/${id}`, `pokemon_${id}`),
          fetchJson(`${API}/pokemon-species/${id}`, `species_${id}`),
        ]);
        const chainUrl = species.evolution_chain.url;
        const chainId = idFromUrl(chainUrl);
        if (!chainCache.has(chainId)) chainCache.set(chainId, fetchJson(chainUrl, `chain_${chainId}`));
        const chain = await chainCache.get(chainId);
        // walk chain to find evolvesFrom + stage
        const nodes = {};
        const walk = (node, fromId, depth) => {
          const nid = idFromUrl(node.species.url);
          nodes[nid] = { from: fromId, stage: depth };
          node.evolves_to.forEach((e) => walk(e, nid, depth + 1));
        };
        walk(chain.chain, null, 1);
        const stats = {};
        pokemon.stats.forEach((s) => (stats[s.stat.name] = s.base_stat));
        const bst = Object.values(stats).reduce((a, b) => a + b, 0);
        const node = nodes[id] || { from: null, stage: 1 };
        results.push({
          id,
          name: pokemon.name,
          types: gen4Types(pokemon),
          bst,
          stage: node.stage,
          evolvesFrom: node.from && node.from <= MAX_ID ? node.from : null,
          isBaby: !!species.is_baby,
          isLegendary: !!species.is_legendary,
          isMythical: !!species.is_mythical,
        });
      } catch (e) {
        console.error("fail", id, e.message);
      }
      done++;
      if (done % 50 === 0) console.error(`...${done}/${MAX_ID}`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  results.sort((a, b) => a.id - b.id);

  // ---- distribution analysis ----
  const n = results.length;
  const typeCount = {};
  results.forEach((c) => c.types.forEach((t) => (typeCount[t] = (typeCount[t] || 0) + 1)));
  const single = results.filter((c) => c.types.length === 1).length;
  const dual = results.filter((c) => c.types.length === 2).length;
  const legendary = results.filter((c) => c.isLegendary).length;
  const mythical = results.filter((c) => c.isMythical).length;
  const sealed = results.filter((c) => c.isLegendary || c.isMythical).length;
  const stageCount = {};
  results.forEach((c) => (stageCount[c.stage] = (stageCount[c.stage] || 0) + 1));
  const standalone = results.filter((c) => c.stage === 1 && c.evolvesFrom == null && !results.some((o) => o.evolvesFrom === c.id)).length;
  const bases = results.filter((c) => c.evolvesFrom == null && !(c.isLegendary || c.isMythical));
  // BST by stage/rarity
  const bstBy = {};
  const bucket = (k, v) => ((bstBy[k] ||= []).push(v));
  results.forEach((c) => {
    if (c.isLegendary || c.isMythical) bucket("rare", c.bst);
    else bucket(`stage${c.stage}`, c.bst);
  });
  const summary = (arr) => {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    return { n: s.length, min: s[0], max: s[s.length - 1], median: s[Math.floor(s.length / 2)], mean: Math.round(s.reduce((a, b) => a + b, 0) / s.length) };
  };

  const scale = 150 / n;
  const typeTable = Object.entries(typeCount)
    .sort((a, b) => b[1] - a[1])
    .map(([t, c]) => ({ type: t, refCount: c, refPct: +(100 * c / n).toFixed(1), target150: Math.round(c * scale) }));

  const report = {
    reference: { species: n, single, dual, singlePct: +(100 * single / n).toFixed(1), dualPct: +(100 * dual / n).toFixed(1), legendary, mythical, sealed, sealedPct: +(100 * sealed / n).toFixed(1), stageCount, standalone, baseNonSealed: bases.length },
    scaledTargets: {
      species: 150,
      single: Math.round(single * scale),
      dual: Math.round(dual * scale),
      sealed: 11,
      legendary: Math.round(legendary / sealed * 11),
      mythical: 11 - Math.round(legendary / sealed * 11),
      stageCount: Object.fromEntries(Object.entries(stageCount).map(([k, v]) => [k, Math.round(v * scale)])),
    },
    typeTable,
    bstByTier: Object.fromEntries(Object.entries(bstBy).map(([k, v]) => [k, summary(v)])),
  };

  fs.writeFileSync(path.join(process.cwd(), "scripts", "reference_distribution.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(process.cwd(), "scripts", "reference_species.json"), JSON.stringify(results, null, 2));
  console.error("DONE");
  console.log(JSON.stringify(report, null, 2));
}

run().catch((e) => { console.error(e); process.exit(1); });
