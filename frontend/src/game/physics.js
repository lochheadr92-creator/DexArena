export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const len = (v) => Math.hypot(v.x, v.y);
export const norm = (v) => {
  const l = len(v);
  return l < 1e-9 ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l };
};
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const scale = (v, s) => ({ x: v.x * s, y: v.y * s });
export const perp = (v, sign = 1) => ({ x: -v.y * sign, y: v.x * sign });
export const dot = (a, b) => a.x * b.x + a.y * b.y;
export const cross = (a, b) => a.x * b.y - a.y * b.x;
export const angleOf = (v) => Math.atan2(v.y, v.x);
export const fromAngle = (a) => ({ x: Math.cos(a), y: Math.sin(a) });
export const rotate = (v, rad) => ({ x: v.x * Math.cos(rad) - v.y * Math.sin(rad), y: v.x * Math.sin(rad) + v.y * Math.cos(rad) });
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export function rotateToward(current, target, maxDelta) {
  const d = angleDiff(current, target);
  if (Math.abs(d) <= maxDelta) return target;
  return current + Math.sign(d) * maxDelta;
}

export function moveToward(v, target, maxDelta) {
  const d = sub(target, v);
  const l = len(d);
  if (l <= maxDelta) return { ...target };
  return add(v, scale(d, maxDelta / l));
}

export const overlaps = (a, b) => dist(a.pos, b.pos) < a.radius + b.radius;
