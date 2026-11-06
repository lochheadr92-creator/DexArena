import json, collections, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent / "frontend" / "src" / "content" / "original"
C = json.load(open(ROOT / "creatures.json"))
C_by_dex = sorted(C, key=lambda x: x["dexNo"])


def prim(c):
    return c["types"][0]


def sec(c):
    return c["types"][1] if len(c["types"]) > 1 else None


ALL_TYPES = sorted({t for c in C for t in c["types"]})


def report():
    print(f"TOTAL creatures: {len(C)}  | types present: {len(ALL_TYPES)}")
    dual = [c for c in C if len(c["types"]) == 2]
    print(f"single-type: {len(C)-len(dual)}  dual-type: {len(dual)}")

    primc = collections.Counter(prim(c) for c in C)
    secc = collections.Counter(sec(c) for c in C if sec(c))
    totc = collections.Counter(t for c in C for t in c["types"])
    print("\n%-10s %6s %6s %6s" % ("TYPE", "PRIM", "SEC", "TOTAL"))
    for t in sorted(ALL_TYPES, key=lambda t: -totc[t]):
        print("%-10s %6d %6d %6d" % (t, primc[t], secc[t], totc[t]))

    # thirds of the dex (by current dexNo)
    n = len(C_by_dex)
    thirds = [C_by_dex[:n // 3], C_by_dex[n // 3:2 * n // 3], C_by_dex[2 * n // 3:]]
    print("\nPRIMARY type across BEGIN / MID / END thirds:")
    for name, seg in zip(["BEGIN", "MID", "END"], thirds):
        cc = collections.Counter(prim(c) for c in seg)
        top = ", ".join(f"{t}:{n}" for t, n in cc.most_common(5))
        print(f"  {name:5} (dex {seg[0]['dexNo']}-{seg[-1]['dexNo']}): {top}")

    # consecutive identical primary-type runs (by dexNo)
    print("\nCONSECUTIVE same-primary runs (len>=3) by current dexNo:")
    runs = []
    i = 0
    seq = C_by_dex
    while i < len(seq):
        j = i
        while j + 1 < len(seq) and prim(seq[j + 1]) == prim(seq[i]):
            j += 1
        if j - i + 1 >= 3:
            runs.append((prim(seq[i]), seq[i]["dexNo"], seq[j]["dexNo"], j - i + 1))
        i = j + 1
    for t, a, b, L in runs:
        print(f"  {t}: dex {a}-{b} ({L} in a row)")
    if not runs:
        print("  none")

    # sliding windows: max count of a single primary type in any window
    print("\nSLIDING WINDOW worst primary-type concentration (current order):")
    for w in (10, 20, 30):
        worst = 0
        worst_at = None
        for s in range(0, len(seq) - w + 1):
            cc = collections.Counter(prim(c) for c in seq[s:s + w])
            t, cnt = cc.most_common(1)[0]
            if cnt > worst:
                worst, worst_at = cnt, (t, seq[s]["dexNo"], seq[s + w - 1]["dexNo"])
        print(f"  window {w}: worst {worst}/{w} = {worst_at[0]} (dex {worst_at[1]}-{worst_at[2]})")

    # first 30
    print("\nFIRST 30 primary types (current):")
    print("  " + " ".join(prim(c)[:3] for c in seq[:30]))

    # families
    fams = collections.defaultdict(list)
    for c in C:
        fams[c["chainId"]].append(c)
    print(f"\nEVOLUTION families: {len(fams)}  (sizes: {collections.Counter(len(v) for v in fams.values())})")
    leg = [c for c in C if c.get("isLegendary") or c.get("isMythical")]
    print(f"legendary/mythical: {len(leg)} -> dexNos {sorted(c['dexNo'] for c in leg)}")


report()
