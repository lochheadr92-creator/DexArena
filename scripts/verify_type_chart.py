import json, sys, urllib.request

GEN = {"i":1,"ii":2,"iii":3,"iv":4,"v":5,"vi":6,"vii":7,"viii":8,"ix":9}
chart = json.load(open("/app/frontend/src/game/config/typeChart.json"))
TYPES = chart["types"]

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "arena-dex-verify/1.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)

def gen4_relations(t):
    d = get(f"https://pokeapi.co/api/v2/type/{t}")
    past = sorted(
        [(GEN[p["generation"]["name"].split("-")[1]], p["damage_relations"]) for p in d.get("past_damage_relations", [])],
        key=lambda x: x[0],
    )
    chosen = next((rel for g, rel in past if g >= 4), None)
    src = "past_damage_relations(gen-%s)" % next((g for g, _ in past if g >= 4), "") if chosen else "damage_relations(current)"
    return (chosen or d["damage_relations"]), src

api = {}
for t in TYPES:
    rel, src = gen4_relations(t)
    row = {}
    for x in rel["double_damage_to"]:
        if x["name"] in TYPES: row[x["name"]] = 2
    for x in rel["half_damage_to"]:
        if x["name"] in TYPES: row[x["name"]] = 0.5
    for x in rel["no_damage_to"]:
        if x["name"] in TYPES: row[x["name"]] = 0
    api[t] = row
    print(f"{t:9s} <- {src}")

mismatch = 0
for atk in TYPES:
    for dfn in TYPES:
        a = chart["attack"][atk].get(dfn, 1)
        b = api[atk].get(dfn, 1)
        if a != b:
            mismatch += 1
            print(f"MISMATCH {atk}->{dfn}: json={a} pokeapi={b}")

print("\ntypes in chart:", len(TYPES), "| fairy present:", "fairy" in TYPES)
print("ghost->steel:", chart["attack"]["ghost"]["steel"], "| dark->steel:", chart["attack"]["dark"]["steel"])
print("cells compared:", len(TYPES) ** 2, "| mismatches:", mismatch)
sys.exit(1 if mismatch else 0)
