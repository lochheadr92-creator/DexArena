import json, collections, pathlib

P = pathlib.Path(__file__).resolve().parent.parent / "frontend" / "src" / "content" / "original" / "creatures.json"
C = json.load(open(P))
ok = True


def check(cond, msg):
    global ok
    ok = ok and cond
    print(("PASS " if cond else "FAIL ") + msg)


check(len(C) == 150, f"150 creatures present (got {len(C)})")
ids = sorted(c["id"] for c in C)
check(ids == list(range(10001, 10151)), "permanent ids are exactly 10001..10150 (unchanged)")

orders = sorted(c.get("displayOrder") for c in C)
check(orders == list(range(1, 151)), "displayOrder is a complete 1..150 permutation")

# evolution linkage integrity
by_id = {c["id"]: c for c in C}
link_ok = True
for c in C:
    if c["evolvesFrom"] is not None:
        link_ok = link_ok and c["evolvesFrom"] in by_id and c["id"] in by_id[c["evolvesFrom"]]["evolvesTo"]
    for t in c["evolvesTo"]:
        link_ok = link_ok and t in by_id and by_id[t]["evolvesFrom"] == c["id"]
check(link_ok, "evolvesFrom/evolvesTo links are mutually consistent")

# families contiguous in displayOrder and base-first
fam = collections.defaultdict(list)
for c in C:
    fam[c["chainId"]].append(c)
contig = True
stage_ok = True
for cid, members in fam.items():
    members.sort(key=lambda x: x["displayOrder"])
    pos = [m["displayOrder"] for m in members]
    contig = contig and pos == list(range(pos[0], pos[0] + len(pos)))
    base = [m for m in members if m["evolvesFrom"] is None]
    if base:
        stage_ok = stage_ok and base[0]["displayOrder"] == pos[0]
check(contig, "every evolution family occupies a contiguous displayOrder block")
check(stage_ok, "each family's base stage comes first in its block")

leg = sorted(c["displayOrder"] for c in C if c.get("isLegendary") or c.get("isMythical"))
check(leg == list(range(140, 151)), f"legendaries/mythicals occupy the final positions (got {leg[:3]}..{leg[-1] if leg else '-'})")

# type totals (should be unchanged by reorder)
tot = collections.Counter(t for c in C for t in c["types"])
print("\nType totals (both slots):", dict(sorted(tot.items(), key=lambda kv: -kv[1])))

print("\n" + ("ALL VALIDATION PASSED" if ok else "VALIDATION FAILED"))
