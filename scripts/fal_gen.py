import os, sys, json, pathlib, threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from fal_lib import generate_sprite

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "frontend" / "public" / "original"
OUT.mkdir(parents=True, exist_ok=True)
CREATURES = json.loads((ROOT / "frontend" / "src" / "content" / "original" / "creatures.json").read_text())

TYPE_HINT = {
    "normal": "earthy tan and cream tones",
    "fire": "fiery orange and red, small flames or embers",
    "water": "aquatic blues and teal, sleek wet look",
    "grass": "leafy greens, vines or petals",
    "electric": "bright yellow with crackling energy accents",
    "ice": "pale cyan and white, crystalline frost",
    "fighting": "muscular build, bold red and brown",
    "poison": "toxic purple and magenta, dripping accents",
    "ground": "sandy brown, rocky earthen body",
    "flying": "feathered wings, airy sky-blue palette",
    "psychic": "vivid violet and pink, mystic glowing eyes",
    "bug": "chitinous green and amber, insectoid segments",
    "rock": "rugged grey stone plating",
    "ghost": "ethereal indigo, wispy translucent smoke",
    "dragon": "regal scales, deep blue and gold",
    "dark": "shadowy black and charcoal, sharp menacing look",
    "steel": "metallic silver plating, riveted armor",
    "fairy": "soft pastel pink, sparkles",
}

# PDF-accurate art notes for the hero evolution line (dex 1-3).
SPECIAL = {
    "Mossplod": "a slow moss-flecked water bear inspired by a tardigrade, plump rounded segmented body, "
                "six stubby legs, a dark round tube mouth with tiny stylets, olive-green and tan with green moss speckles",
    "Mosshull": "an evolved armored water bear, skin hardened into rows of arched overlapping plates with green moss "
                "rooted in the seams, segmented six-legged body, dark round tube mouth, olive and tan",
    "Bathyward": "a walking deep-sea diving-bell creature, riveted steel hull plates over a bulky six-legged body, "
                 "a round brass porthole ring framing its mouth, a vent cowl pipe on top, sturdy steel boots, "
                 "teal-green patina with brass highlights",
}

STYLE = ("flat vector art illustration, clean bold even outlines, solid flat colors, minimal cel shading, "
         "modern mascot creature design, strong distinct silhouette, full body in frame, centered, "
         "plain solid pure white background, no text, no watermark, no signature, no drop shadow, no ground, no border")

VIEW = {
    "front": "front three-quarter view, facing the viewer, whole body and face clearly visible",
    "back": "rear view seen from directly behind, the creature is facing away from the viewer, we see only its back and the back of its head, no face visible",
}

_log_lock = threading.Lock()
_done = {"n": 0}


def prompt_for(c, facing):
    name = c["displayName"]
    types = c["types"]
    tdesc = " / ".join(t.capitalize() for t in types)
    hints = ", ".join(TYPE_HINT.get(t, "") for t in types if TYPE_HINT.get(t))
    if name in SPECIAL:
        body = SPECIAL[name]
    else:
        body = f"a {tdesc}-type creature resembling a {c.get('genus') or 'fantastical beast'}, {hints}"
    return (f"An original fantasy monster named {name}: {body}. {VIEW[facing]}. {STYLE}.")


def path_for(c, facing):
    return OUT / f"o{str(c['dexNo']).zfill(3)}-{facing}.png"


def task(c, facing, total):
    p = path_for(c, facing)
    if p.exists() and p.stat().st_size > 2000:
        with _log_lock:
            _done["n"] += 1
            print(f"[{_done['n']}/{total}] skip {p.name}", flush=True)
        return
    try:
        nbytes, opaque = generate_sprite(prompt_for(c, facing), str(p))
        with _log_lock:
            _done["n"] += 1
            print(f"[{_done['n']}/{total}] OK  {p.name} {nbytes}b {opaque}px", flush=True)
    except Exception as e:
        with _log_lock:
            _done["n"] += 1
            print(f"[{_done['n']}/{total}] ERR {p.name}: {str(e)[:160]}", flush=True)


def main():
    args = sys.argv[1:]
    only = None
    if args and args[0].startswith("--limit="):
        only = int(args[0].split("=")[1]); args = args[1:]
    facings = args or ["front", "back"]
    creatures = CREATURES[:only] if only else CREATURES
    # front-first ordering so a partial run still covers every creature's front
    jobs = [(c, f) for f in facings for c in creatures]
    total = len(jobs)
    print(f"START {len(creatures)} creatures x {facings} = {total} sprites", flush=True)
    with ThreadPoolExecutor(max_workers=5) as ex:
        futs = [ex.submit(task, c, f, total) for (c, f) in jobs]
        for _ in as_completed(futs):
            pass
    print("DONE", flush=True)


if __name__ == "__main__":
    main()
