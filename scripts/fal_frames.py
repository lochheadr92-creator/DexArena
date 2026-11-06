import os, sys, json, pathlib, threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from fal_lib import generate_frame

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "frontend" / "public" / "original"
CREATURES = json.loads((ROOT / "frontend" / "src" / "content" / "original" / "creatures.json").read_text())

# Extra idle keyframes to generate per facing (base frame o###-{facing}.png already exists).
# Frame index 2 = subtle shift; index 3 = opposite shift (for a 3-frame ping-pong idle).
POSE = {
    ("front", 2): "Only make a small natural idle shift: the body leaning a touch forward as if mid-breath, limbs slightly raised.",
    ("front", 3): "Only make a small natural idle shift: the body settling back and down slightly as if exhaling, limbs a touch lowered.",
    ("back", 2): "Only make a small natural idle shift: the body leaning a touch forward as if mid-breath, limbs slightly raised.",
    ("back", 3): "Only make a small natural idle shift: the body settling back and down slightly as if exhaling, limbs a touch lowered.",
}
VIEW = {
    "front": "front three-quarter view facing the viewer",
    "back": "rear view, the creature facing away from the viewer, only its back and the back of its head visible, no face",
}

_lock = threading.Lock()
_done = {"n": 0}
_stop = threading.Event()


def prompt_for(facing, idx):
    return (
        "Edit this exact creature sprite into a subtle idle-animation keyframe. "
        "Keep the identical character, same colors, same bold outlines, same flat vector art style, "
        f"same {VIEW[facing]}, and roughly the same size and position. "
        f"{POSE[(facing, idx)]} "
        "Plain solid pure white background, full body centered, no text, no watermark, no drop shadow, no ground."
    )


def base_path(c, facing):
    return OUT / f"o{str(c['dexNo']).zfill(3)}-{facing}.png"


def frame_path(c, facing, idx):
    return OUT / f"o{str(c['dexNo']).zfill(3)}-{facing}-{idx}.png"


def task(c, facing, idx, total):
    if _stop.is_set():
        return
    out = frame_path(c, facing, idx)
    base = base_path(c, facing)
    if out.exists() and out.stat().st_size > 2000:
        with _lock:
            _done["n"] += 1
            print(f"[{_done['n']}/{total}] skip {out.name}", flush=True)
        return
    if not base.exists():
        with _lock:
            _done["n"] += 1
            print(f"[{_done['n']}/{total}] MISS base {base.name}", flush=True)
        return
    try:
        nbytes, opaque = generate_frame(prompt_for(facing, idx), str(base), str(out))
        with _lock:
            _done["n"] += 1
            print(f"[{_done['n']}/{total}] OK  {out.name} {nbytes}b {opaque}px", flush=True)
    except Exception as e:
        msg = str(e)[:160]
        if "INSUFFICIENT_CREDITS" in msg:
            _stop.set()
        with _lock:
            _done["n"] += 1
            print(f"[{_done['n']}/{total}] ERR {out.name}: {msg}", flush=True)


def main():
    args = sys.argv[1:]
    limit = None
    frames = [2]  # default: one extra frame per facing (2-frame idle)
    facings = ["front", "back"]
    workers = 5
    for a in args:
        if a.startswith("--limit="):
            limit = int(a.split("=")[1])
        elif a.startswith("--frames="):
            frames = [int(x) for x in a.split("=")[1].split(",")]
        elif a.startswith("--facings="):
            facings = a.split("=")[1].split(",")
        elif a.startswith("--workers="):
            workers = int(a.split("=")[1])
    creatures = CREATURES[:limit] if limit else CREATURES
    jobs = [(c, f, idx) for idx in frames for f in facings for c in creatures]
    total = len(jobs)
    print(f"START frames={frames} facings={facings} creatures={len(creatures)} workers={workers} -> {total} edits", flush=True)
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = [ex.submit(task, c, f, idx, total) for (c, f, idx) in jobs]
        for _ in as_completed(futs):
            pass
    print("STOPPED (credits)" if _stop.is_set() else "DONE", flush=True)


if __name__ == "__main__":
    main()
