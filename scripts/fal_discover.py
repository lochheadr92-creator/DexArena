import os, json, requests
KEY = os.environ.get("EMERGENT_LLM_KEY", "sk-emergent-c1f86Be485d8d1d6a6")
BASE = os.environ.get("INTEGRATION_PROXY_URL", "https://integrations.emergentagent.com").rstrip("/") + "/api/v1/fal"
H = {"Authorization": f"Bearer {KEY}"}

def search(q):
    r = requests.get(f"{BASE}/catalog/models", headers=H, params={"q": q, "status": "active", "limit": 30}, timeout=30)
    r.raise_for_status()
    return r.json().get("models", [])

for term in ["nano-banana", "gemini", "nano banana", "birefnet", "rembg", "remove-background", "background"]:
    try:
        ms = search(term)
        print(f"\n### '{term}': {len(ms)} results")
        for m in ms:
            eid = m.get("endpoint_id")
            if not eid:
                continue
            print(f"  - {eid}  priceable={m.get('priceable')} denied={m.get('denied')}")
    except Exception as e:
        print(term, "ERR", e)
