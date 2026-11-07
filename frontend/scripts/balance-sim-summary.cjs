const path = require("path");
// Usage: node scripts/balance-sim-summary.cjs <path to sim json>
const sp = __dirname;
const simFile = process.argv[2];
const r = require(path.resolve(simFile));
const info = r.info;
const recs = [];
let draws = 0, timeouts = 0;
const secs = [];
for (const x of r.results) {
  secs.push(x.sec);
  if (x.sec >= 299.9) timeouts++;
  if (x.winner == null) { draws++; continue; }
  recs.push([x.a, x.b, x.winner === x.a ? 1 : 0]);
  recs.push([x.b, x.a, x.winner === x.b ? 1 : 0]);
}
secs.sort((a, b) => a - b);
const pct = (n, d) => (d ? (100 * n / d).toFixed(1) + "%" : "-");
const tag = path.basename(simFile);
console.log(`[${tag}] creatures ${Object.keys(info).length} battles ${r.results.length} (${(r.ms / 60000).toFixed(1)} min) timeouts ${timeouts} | duration median ${secs[Math.floor(secs.length / 2)]}s p90 ${secs[Math.floor(secs.length * 0.9)]}s`);
const grp = (keyFn, sortFn) => {
  const g = {};
  for (const [a, , w] of recs) { const k = keyFn(info[a]); (g[k] ||= [0, 0]); g[k][0] += w; g[k][1]++; }
  return g;
};
const show = (title, g) => console.log(title + ": " + Object.entries(g).sort((x, y) => y[1][0] / y[1][1] - x[1][0] / x[1][1]).map(([k, v]) => `${k} ${pct(v[0], v[1])}`).join(" | "));
const counts = (key) => { const c = {}; Object.values(info).forEach((i) => { c[key(i)] = (c[key(i)] || 0) + 1; }); return JSON.stringify(c); };
console.log("composition counts:", counts((i) => i.cls), "| style counts:", counts((i) => i.style));
show("win% by composition", grp((i) => i.cls));
show("win% by style (top move)", grp((i) => i.style));
show("win% by role", grp((i) => i.role));
show("win% by lot", grp((i) => "lot" + i.lot));
show("win% by primary type", grp((i) => i.types[0]));
// style matchups
const M = {};
for (const [a, b, w] of recs) { const k = info[a].style + " vs " + info[b].style; (M[k] ||= [0, 0]); M[k][0] += w; M[k][1]++; }
console.log("style matchups (row win%):", Object.entries(M).map(([k, v]) => `${k} ${pct(v[0], v[1])} [${v[1]}]`).join(" | "));
const M2 = {};
for (const [a, b, w] of recs) { const k = info[a].cls + " vs " + info[b].cls; (M2[k] ||= [0, 0]); M2[k][0] += w; M2[k][1]++; }
console.log("composition matchups:", Object.entries(M2).map(([k, v]) => `${k} ${pct(v[0], v[1])} [${v[1]}]`).join(" | "));
const per = {};
for (const [a, , w] of recs) { (per[a] ||= [0, 0]); per[a][0] += w; per[a][1]++; }
const arr = Object.entries(per).map(([id, v]) => ({ id: +id, wr: v[0] / v[1] })).sort((x, y) => x.wr - y.wr);
const mean = arr.reduce((a, x) => a + x.wr, 0) / arr.length;
const sd = Math.sqrt(arr.reduce((a, x) => a + (x.wr - mean) ** 2, 0) / arr.length);
console.log(`per-creature win-rate sd ${(sd * 100).toFixed(1)} | <30%: ${arr.filter((x) => x.wr < 0.3).length} | >70%: ${arr.filter((x) => x.wr > 0.7).length}`);
const nm = (x) => `#${info[x.id].dex} ${info[x.id].name}[${info[x.id].types.join("/")}] ${info[x.id].style[0]} ${(x.wr * 100).toFixed(0)}%`;
console.log("worst 12:", arr.slice(0, 12).map(nm).join("; "));
console.log("best 12:", arr.slice(-12).reverse().map(nm).join("; "));
console.log("usage:", JSON.stringify(r.usage), "| battles with buff", pct(r.usage.battlesBuff, r.usage.battles), "shield", pct(r.usage.battlesShield, r.usage.battles), "status", pct(r.usage.battlesStatus, r.usage.battles));
const stat = { stabR0: Object.values(info).filter((i) => i.stabR === 0).length, stabC0: Object.values(info).filter((i) => i.stabC === 0).length, withStatus: Object.values(info).filter((i) => i.nS > 0).length };
console.log("no STAB ranged:", stat.stabR0, "| no STAB close:", stat.stabC0, "| with shield/buff slot:", stat.withStatus);

