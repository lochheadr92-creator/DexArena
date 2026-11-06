import os, json, requests

KEY = os.environ.get("EMERGENT_LLM_KEY", "sk-emergent-c1f86Be485d8d1d6a6")
BASE = os.environ.get("INTEGRATION_PROXY_URL", "https://integrations.emergentagent.com").rstrip("/") + "/api/v1/fal"
H = {"Authorization": f"Bearer {KEY}"}


def catalog(q):
    r = requests.get(f"{BASE}/catalog/models", headers=H, params={"q": q, "status": "active", "limit": 10}, timeout=30)
    r.raise_for_status()
    return r.json().get("models", [])


def input_schema(model):
    oa = model.get("openapi")
    if not isinstance(oa, dict):
        return None
    paths = oa.get("paths", {})
    for path, ops in paths.items():
        if "/requests/" in path:
            continue
        post = ops.get("post") if isinstance(ops, dict) else None
        if isinstance(post, dict):
            sch = post.get("requestBody", {}).get("content", {}).get("application/json", {}).get("schema")
            if sch:
                return sch, oa.get("components", {}).get("schemas", {})
    return None


for q in ["nano-banana-pro", "nano-banana"]:
    print(f"\n===== query '{q}' =====")
    for m in catalog(q):
        eid = m.get("endpoint_id")
        if not eid:
            continue
        print(f"- {eid}  priceable={m.get('priceable')} denied={m.get('denied')}")

for eid in ["fal-ai/nano-banana-pro/edit", "fal-ai/nano-banana/edit", "fal-ai/nano-banana-pro"]:
    print(f"\n##### schema for {eid} #####")
    ms = [m for m in catalog(eid) if m.get("endpoint_id") == eid]
    if not ms:
        print("  (no exact match)")
        continue
    res = input_schema(ms[0])
    if not res:
        print("  (no openapi schema)")
        continue
    sch, comps = res
    props = sch.get("properties", sch)
    print("  required:", sch.get("required"))
    print("  props:", json.dumps(props, indent=2)[:1800])
