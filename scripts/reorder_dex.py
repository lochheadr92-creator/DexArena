import json, collections, pathlib, heapq

ROOT = pathlib.Path(__file__).resolve().parent.parent / "frontend" / "src" / "content" / "original"
PATH = ROOT / "creatures.json"
SEED = 1337  # fixed -> reproducible ordering


def mulberry32(a):
    def rnd():
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = a
        t = (t ^ (t >> 15)) * (t | 1) & 0xFFFFFFFF
        t ^= (t + ((t ^ (t >> 7)) * (t | 61) & 0xFFFFFFFF)) & 0xFFFFFFFF
        t &= 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296
    return rnd


def seeded_shuffle(lst, rnd):
    a = list(lst)
    for i in range(len(a) - 1, 0, -1):
        j = int(rnd() * (i + 1))
        a[i], a[j] = a[j], a[i]
    return a


def prim(c):
    return c["types"][0]


def windows_report(order, label):
    seq = order
    print(f"\n[{label}] sliding-window worst primary concentration:")
    for w in (10, 20, 30):
        worst, at = 0, None
        for s in range(0, len(seq) - w + 1):
            cc = collections.Counter(prim(c) for c in seq[s:s + w])
            t, cnt = cc.most_common(1)[0]
            if cnt > worst:
                worst, at = cnt, (t, s + 1, s + w)
        print(f"  window {w}: worst {worst}/{w} = {at[0]} (pos {at[1]}-{at[2]})")
    # longest consecutive same-primary run
    longest, cur = 1, 1
    for i in range(1, len(seq)):
        cur = cur + 1 if prim(seq[i]) == prim(seq[i - 1]) else 1
        longest = max(longest, cur)
    print(f"  longest same-primary run: {longest}")
    print(f"  first 30: " + " ".join(prim(c)[:3] for c in seq[:30]))


def main():
    C = json.load(open(PATH))
    by_dex = sorted(C, key=lambda x: x["dexNo"])
    windows_report(by_dex, "BEFORE")

    rnd = mulberry32(SEED)

    # 1) family units (keep evolutionary order via dexNo within a chain)
    fam = collections.defaultdict(list)
    for c in C:
        fam[c["chainId"]].append(c)
    families = []
    for cid, members in fam.items():
        members.sort(key=lambda x: x["dexNo"])
        is_leg = any(m.get("isLegendary") or m.get("isMythical") for m in members)
        families.append({"id": cid, "members": members, "prim": prim(members[0]), "leg": is_leg, "firstDex": members[0]["dexNo"]})

    legendary = sorted([f for f in families if f["leg"]], key=lambda f: f["firstDex"])
    normal = [f for f in families if not f["leg"]]

    # 2) bucket normal families by primary type; seeded-shuffle within each bucket
    buckets = collections.defaultdict(list)
    for f in normal:
        buckets[f["prim"]].append(f)
    for t in buckets:
        buckets[t] = seeded_shuffle(buckets[t], rnd)

    # 3) even fractional-spacing: spread EACH type uniformly across [0,1) so common
    #    types (Water, Normal) never front-load or cluster. Tiny seeded jitter breaks ties.
    entries = []
    for t in sorted(buckets.keys()):
        fams = buckets[t]
        n = len(fams)
        for i, f in enumerate(fams):
            key = (i + 0.5) / n + (rnd() - 0.5) * 0.0005
            entries.append((key, f))
    entries.sort(key=lambda e: e[0])
    spread = [f for _, f in entries]

    ordered_families = spread + legendary

    # 4) assign displayOrder across members, family by family
    order_seq = []
    pos = 0
    for f in ordered_families:
        for m in f["members"]:
            pos += 1
            m["displayOrder"] = pos
            order_seq.append(m)

    assert pos == len(C), f"expected {len(C)} got {pos}"
    windows_report(order_seq, "AFTER")

    # write back (preserve everything else; just add displayOrder)
    by_id = {c["id"]: c for c in order_seq}
    for c in C:
        c["displayOrder"] = by_id[c["id"]]["displayOrder"]
    json.dump(C, open(PATH, "w"), ensure_ascii=False, indent=2)
    print(f"\nWROTE displayOrder for {len(C)} creatures (seed={SEED}).")
    print("legendaries now at positions:", sorted(c["displayOrder"] for c in C if c.get("isLegendary") or c.get("isMythical")))


if __name__ == "__main__":
    main()
