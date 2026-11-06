import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "frontend" / "public" / "original"
CPATH = ROOT / "frontend" / "src" / "content" / "original" / "creatures.json"
MAX_FRAMES = 3  # look for -2 .. -3 variants


def exists(name):
    p = OUT / name
    return p.exists() and p.stat().st_size > 2000


def frame_list(dexno, facing):
    base = f"o{str(dexno).zfill(3)}-{facing}.png"
    frames = [f"/original/{base}"]
    for idx in range(2, MAX_FRAMES + 1):
        name = f"o{str(dexno).zfill(3)}-{facing}-{idx}.png"
        if exists(name):
            frames.append(f"/original/{name}")
    return frames


def main():
    creatures = json.loads(CPATH.read_text())
    changed = 0
    animated = 0
    for c in creatures:
        front = frame_list(c["dexNo"], "front")
        back = frame_list(c["dexNo"], "back")
        new_front = front if len(front) > 1 else None
        new_back = back if len(back) > 1 else None
        if c.get("framesFront") != new_front or c.get("framesBack") != new_back:
            changed += 1
        if new_front:
            c["framesFront"] = new_front
        elif "framesFront" in c:
            del c["framesFront"]
        if new_back:
            c["framesBack"] = new_back
        elif "framesBack" in c:
            del c["framesBack"]
        if new_front or new_back:
            animated += 1
    CPATH.write_text(json.dumps(creatures, indent=2) + "\n")
    print(f"updated {changed} creatures; {animated}/{len(creatures)} now have frame animation")


if __name__ == "__main__":
    main()
