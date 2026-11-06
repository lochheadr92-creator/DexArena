import { parseGIF, decompressFrames } from "gifuct-js";
import { idbGet, idbPut, STORE_SPRITES } from "@/lib/idb";
import { animations } from "@/game/config";

const cache = new Map();
export const spriteReport = { fallbacks: [], decoded: [] };
const IDLE_FRAME_MS = animations.idleFrameMs || 520;

export const spriteKey = (creatureId, facing) => `${creatureId}:${facing}`;
export const getSprite = (key) => cache.get(key);

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image failed ${url}`));
    img.src = url;
  });
}

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function composeFrames(buffer) {
  const gif = parseGIF(buffer);
  const frames = decompressFrames(gif, true);
  const W = gif.lsd.width;
  const H = gif.lsd.height;
  const work = makeCanvas(W, H);
  const wctx = work.getContext("2d", { willReadFrequently: true });
  const temp = makeCanvas(W, H);
  const tctx = temp.getContext("2d");
  const out = [];
  const delays = [];
  let prev = null;
  for (const f of frames) {
    if (prev && prev.disposalType === 2) wctx.clearRect(prev.dims.left, prev.dims.top, prev.dims.width, prev.dims.height);
    const img = new ImageData(new Uint8ClampedArray(f.patch), f.dims.width, f.dims.height);
    temp.width = f.dims.width;
    temp.height = f.dims.height;
    tctx.putImageData(img, 0, 0);
    wctx.drawImage(temp, f.dims.left, f.dims.top);
    out.push(new Uint8ClampedArray(wctx.getImageData(0, 0, W, H).data));
    delays.push(f.delay > 0 ? f.delay : 100);
    prev = f;
  }
  return { width: W, height: H, frames: out, delays };
}

function entryFromStored(stored) {
  const canvases = stored.frames.map((data) => {
    const c = makeCanvas(stored.width, stored.height);
    c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(data), stored.width, stored.height), 0, 0);
    return c;
  });
  const total = stored.delays.reduce((a, b) => a + b, 0);
  return { kind: "anim", frames: canvases, delays: stored.delays, total, width: stored.width, height: stored.height };
}

export async function ensureSprite(creature, facing) {
  const key = spriteKey(creature.id, facing);
  if (cache.has(key)) return cache.get(key);
  const t0 = performance.now();
  const animUrl = facing === "front" ? creature.animFront : creature.animBack;
  const staticUrl = facing === "front" ? creature.sprite : creature.spriteBack;
  let entry = null;
  let source = "static";
  const frameUrls = facing === "front" ? creature.framesFront : creature.framesBack;
  if (animations.animatedSprites && Array.isArray(frameUrls) && frameUrls.length > 1) {
    try {
      const imgs = await Promise.all(frameUrls.map(loadImage));
      // ping-pong a 3+ frame set so the loop never jumps (A,B,C -> A,B,C,B)
      const seq = imgs.length >= 3 ? [...imgs, ...imgs.slice(1, -1).reverse()] : imgs;
      const delays = seq.map(() => IDLE_FRAME_MS);
      entry = { kind: "anim", frames: seq, delays, total: delays.reduce((a, b) => a + b, 0), width: imgs[0].naturalWidth, height: imgs[0].naturalHeight };
      source = "png-frames";
    } catch (err) {
      spriteReport.fallbacks.push({ id: creature.id, name: creature.name, facing, reason: `png-frames: ${err.message}` });
    }
  }
  if (!entry && animations.animatedSprites && animUrl) {
    try {
      let stored = await idbGet(STORE_SPRITES, key).catch(() => null);
      if (stored) source = "idb";
      else {
        const res = await fetch(animUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        stored = { key, creatureId: creature.id, url: animUrl, ...composeFrames(await res.arrayBuffer()), cachedAt: Date.now() };
        idbPut(STORE_SPRITES, stored).catch(() => {});
        source = "network";
      }
      entry = entryFromStored(stored);
    } catch (err) {
      spriteReport.fallbacks.push({ id: creature.id, name: creature.name, facing, reason: err.message });
    }
  }
  if (!entry) {
    try {
      const img = await loadImage(staticUrl);
      entry = { kind: "static", img, width: img.naturalWidth, height: img.naturalHeight, frames: [img], delays: [1000], total: 1000 };
      if (animations.animatedSprites && animUrl && !spriteReport.fallbacks.some((f) => f.id === creature.id && f.facing === facing)) {
        spriteReport.fallbacks.push({ id: creature.id, name: creature.name, facing, reason: "no animated url" });
      }
    } catch {
      entry = { kind: "none", frames: [], delays: [], total: 1, width: 1, height: 1 };
    }
  }
  entry.key = key;
  entry.ms = performance.now() - t0;
  entry.source = source;
  entry.smooth = !!(staticUrl && staticUrl.includes("/original/"));
  cache.set(key, entry);
  spriteReport.decoded.push({ id: creature.id, name: creature.name, facing, frames: entry.frames.length, ms: +entry.ms.toFixed(1), source, size: `${entry.width}x${entry.height}` });
  return entry;
}

export function frameFor(entry, timeMs) {
  if (!entry || !entry.frames.length) return null;
  if (entry.frames.length === 1 || !animations.animationsEnabled) return entry.frames[0];
  let t = timeMs % entry.total;
  for (let i = 0; i < entry.delays.length; i++) {
    t -= entry.delays[i];
    if (t < 0) return entry.frames[i];
  }
  return entry.frames[entry.frames.length - 1];
}

export function clearSpriteMemory() {
  cache.clear();
  spriteReport.fallbacks.length = 0;
  spriteReport.decoded.length = 0;
}
