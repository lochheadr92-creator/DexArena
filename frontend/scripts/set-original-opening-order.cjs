// Puts three three-stage "starter" lines at the front of the Original roster's default
// (Variety) display order: grass (Reedlet line), fire (Cindcub line), water (Rivpup line).
// dexNo (the Numeric order) already has them at #1-#9. Every other family keeps its previous
// relative order, so the type-variety spacing of the rest of the roster is untouched, and
// displayOrder stays unique and gapless across both lots.
//
// Run from frontend/ (idempotent; run after build-original-lot2.cjs):
//   node scripts/set-original-opening-order.cjs
const fs = require("node:fs");
const path = require("node:path");

const dir = path.resolve(__dirname, "../src/content/original");
const OPENING = ["Reedlet", "Cindcub", "Rivpup"]; // first stage of each opening line, in display order

const load = (f) => {
  const raw = fs.readFileSync(f, "utf8");
  return { file: f, data: JSON.parse(raw), eol: raw.includes("\r\n") ? "\r\n" : "\n" };
};
const files = [load(path.join(dir, "creatures.json")), load(path.join(dir, "lot2/creatures.json"))];
const all = files.flatMap((f) => f.data);

// Families are contiguous in displayOrder, so keep them as units in their current order.
const sorted = [...all].sort((a, b) => a.displayOrder - b.displayOrder);
const families = [];
const seen = new Map();
for (const c of sorted) {
  if (!seen.has(c.chainId)) { seen.set(c.chainId, []); families.push(seen.get(c.chainId)); }
  seen.get(c.chainId).push(c);
}
const opening = OPENING.map((name) => {
  const lead = all.find((c) => c.displayName === name);
  if (!lead) throw new Error(`opening family lead not found: ${name}`);
  const fam = seen.get(lead.chainId);
  if (fam.length !== 3) throw new Error(`${name}'s line is not three-stage`);
  return fam;
});
const rest = families.filter((f) => !opening.includes(f));
const sequence = [...opening, ...rest].flatMap((fam) => [...fam].sort((a, b) => a.dexNo - b.dexNo));
sequence.forEach((c, i) => { c.displayOrder = i + 1; });

let changed = 0;
for (const f of files) {
  const out = JSON.stringify(f.data, null, 2).replace(/\n/g, f.eol) + f.eol;
  if (out !== fs.readFileSync(f.file, "utf8")) { fs.writeFileSync(f.file, out); changed++; }
}
const first = [...all].sort((a, b) => a.displayOrder - b.displayOrder).slice(0, 9).map((c) => `${c.displayOrder} ${c.displayName}[${c.types[0]}]`);
console.log(`opening order set (${changed} file(s) rewritten): ${first.join(", ")}`);
