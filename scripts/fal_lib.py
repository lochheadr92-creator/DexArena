import os, io, time, requests
from PIL import Image

KEY = os.environ.get("EMERGENT_LLM_KEY", "sk-emergent-c1f86Be485d8d1d6a6")
PROXY = os.environ.get("INTEGRATION_PROXY_URL", "https://integrations.emergentagent.com").rstrip("/")
CONTROL = f"{PROXY}/api/v1/fal"
QUEUE_ORIGIN = "https://queue.fal.run"

NANO = "fal-ai/nano-banana-pro"
NANO_EDIT = "fal-ai/nano-banana-pro/edit"
BIREFNET = "fal-ai/birefnet/v2"


def _headers(extra=None):
    h = {"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
    jid = os.environ.get("job_id")
    if jid:
        h["X-App-ID"] = jid
        h["X-Job-ID"] = jid
    rid = os.environ.get("run_id")
    if rid:
        h["X-Environment-ID"] = rid
    if extra:
        h.update(extra)
    return h


def _get(url, timeout=30, tries=6):
    delay = 1
    last = None
    for i in range(tries):
        try:
            return requests.get(url, headers=_headers(), timeout=timeout)
        except (requests.ConnectTimeout, requests.ReadTimeout, requests.ConnectionError) as e:
            last = e
            time.sleep(delay)
            delay = min(delay * 2, 10)
    raise RuntimeError(f"GET failed after retries: {str(last)[:160]}")


def run_media(endpoint, payload, timeout=300):
    r = requests.post(f"{CONTROL}/proxy", headers=_headers({"X-Fal-Target-Url": f"{QUEUE_ORIGIN}/{endpoint}"}), json=payload, timeout=90)
    if r.status_code == 402:
        raise RuntimeError("INSUFFICIENT_CREDITS")
    if r.status_code != 200:
        raise RuntimeError(f"submit {r.status_code}: {r.text[:300]}")
    sub = r.json()
    status_url, response_url = sub["status_url"], sub["response_url"]
    deadline = time.time() + timeout
    while time.time() < deadline:
        st = _get(status_url, timeout=30).json()
        status = (st.get("status") or "").upper()
        if status in ("COMPLETED", "OK"):
            return _get(response_url, timeout=60).json()
        if status in ("FAILED", "CANCELLED", "CANCELED", "ERROR"):
            raise RuntimeError(f"gen failed: {str(st)[:300]}")
        time.sleep(2)
    raise RuntimeError("timeout")


def _img_url(res):
    for k in ("images", "image"):
        v = res.get(k)
        if isinstance(v, list) and v:
            return v[0]["url"] if isinstance(v[0], dict) else v[0]
        if isinstance(v, dict):
            return v.get("url")
    raise RuntimeError(f"no image in result keys={list(res.keys())}")


def _finalize(url, out_path, size, bg_remove):
    if bg_remove:
        cut = run_media(BIREFNET, {"image_url": url, "output_format": "png", "model": "General Use (Heavy)"})
        url = _img_url(cut)
    raw = None
    for i in range(5):
        try:
            raw = requests.get(url, timeout=120).content
            break
        except (requests.ConnectTimeout, requests.ReadTimeout, requests.ConnectionError):
            time.sleep(min(1 * (2 ** i), 10))
    if raw is None:
        raise RuntimeError("download failed after retries")
    im = Image.open(io.BytesIO(raw)).convert("RGBA")
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    im.thumbnail((size - 24, size - 24), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(im, ((size - im.width) // 2, (size - im.height) // 2), im)
    out = io.BytesIO()
    canvas.save(out, "PNG")
    data = out.getvalue()
    with open(out_path, "wb") as f:
        f.write(data)
    import numpy as np
    opaque = int((np.array(canvas)[..., 3] > 0).sum())
    return len(data), opaque


def _data_url(path):
    import base64
    with open(path, "rb") as f:
        b = f.read()
    return "data:image/png;base64," + base64.b64encode(b).decode("ascii")


def generate_frame(prompt, base_image_path, out_path, size=512, bg_remove=True):
    """Image-to-image repose of an existing sprite into an idle keyframe (nano-banana-pro edit)."""
    gen = run_media(NANO_EDIT, {"prompt": prompt, "image_urls": [_data_url(base_image_path)], "num_images": 1, "output_format": "png"})
    url = _img_url(gen)
    return _finalize(url, out_path, size, bg_remove)


def generate_sprite(prompt, out_path, size=512, bg_remove=True):
    gen = run_media(NANO, {"prompt": prompt, "num_images": 1, "aspect_ratio": "1:1", "output_format": "png"})
    url = _img_url(gen)
    return _finalize(url, out_path, size, bg_remove)


if __name__ == "__main__":
    import sys
    p = ("flat vector art illustration of an original fantasy monster: a slow moss-flecked water bear "
         "inspired by a tardigrade, plump rounded body, six stubby legs, a dark round tube mouth. "
         "Clean bold outlines, solid flat colors, minimal cel shading, modern mascot creature design, "
         "distinct silhouette, full body, centered, facing the viewer, plain solid white background, "
         "no text, no watermark, no drop shadow, no ground.")
    n, op = generate_sprite(p, "/tmp/mossplod_test.png")
    print(f"OK {n} bytes, {op} opaque px -> /tmp/mossplod_test.png")
