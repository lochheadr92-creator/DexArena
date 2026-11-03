import { abilities as CFG, typeChart, engine, secToTicks, TICK_RATE } from "@/game/config";
import { pushEvent, logLine, activeUnit, enemyOf } from "@/game/state";
import { tileAt } from "@/game/terrain";
import { applyStatus } from "@/game/combat";

const P = CFG.params;
const DEFS = CFG.defs;
export const WEATHER = CFG.weather;

export const titleCase = (s = "") => s.split("-").map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
export const abilityDef = (id) => (id ? DEFS[id] || null : null);
export const abilityName = (id) => abilityDef(id)?.name || titleCase(id || "");
export const isImplemented = (id) => !!abilityDef(id);
export const has = (u, id) => !!u && u.ability === id;
const statused = (u) => !!(u.burn || u.paralysis);
const alive = (u) => !!u && u.hp > 0 && u.state !== "fainted" && u.state !== "fainting";
const effOf = (type, types) => types.reduce((m, t) => m * (typeChart.attack[type]?.[t] ?? 1), 1);
const onTile = (state, u, tiles) => tiles.includes(tileAt(state, u.pos.x, u.pos.y));
const slowStarting = (state, u) => (u.abilityState?.slowStartUntil ?? 0) > state.tick;
export const isLoafing = (state, u) => (u.abilityState?.loafUntil ?? 0) > state.tick;

export function defaultSlot(creature) {
  const list = creature?.abilities || [];
  const i = list.findIndex(isImplemented);
  return i < 0 ? 0 : i;
}

export function chosenSlot(creature, picks = {}) {
  const list = creature?.abilities || [];
  const raw = picks?.[creature?.id];
  const slot = raw == null ? defaultSlot(creature) : Number(raw) || 0;
  return Math.min(Math.max(0, slot), Math.max(0, list.length - 1));
}

export function abilityFor(creature, picks = {}) {
  const list = creature?.abilities || [];
  if (!list.length) return null;
  return list[chosenSlot(creature, picks)] || null;
}

export function randomAbility(creature, rng) {
  const list = creature?.abilities || [];
  if (!list.length) return null;
  const good = list.filter(isImplemented);
  return rng.pick(good.length ? good : list);
}

export function announce(state, u, text, extra = {}) {
  const def = abilityDef(u.ability);
  const ev = { kind: "ability", unitId: u.id, side: u.side, ability: u.ability, name: def?.name || titleCase(u.ability), text, fx: def?.fx || "aura", color: def?.color || "#e2e8f0", x: u.pos.x, y: u.pos.y, ...extra };
  pushEvent(state, ev);
  state.abilityLog.push({ tick: state.tick, unitId: u.id, side: u.side, ability: u.ability, text });
  logLine(state, `${u.name}'s ${ev.name}: ${text}`);
}

export function heal(state, u, amount, why) {
  const healed = Math.min(u.maxHp - u.hp, Math.max(0, amount));
  if (healed <= 0) return 0;
  u.hp += healed;
  pushEvent(state, { kind: "heal", unitId: u.id, amount: healed, x: u.pos.x, y: u.pos.y, why });
  logLine(state, `${u.name} restored ${healed} HP (${why})`);
  return healed;
}

function chip(state, u, fraction, why) {
  if (has(u, "magic-guard") || u.hp <= 0) return 0;
  const dealt = Math.min(u.hp, Math.max(1, Math.round(u.maxHp * fraction)));
  u.hp -= dealt;
  if (u.hp === 0) u.lastHitIndirect = true;
  pushEvent(state, { kind: "hit", targetId: u.id, damage: dealt, eff: 1, type: null, source: "chip", x: u.pos.x, y: u.pos.y, why });
  logLine(state, `${u.name} is hurt by ${why}: ${dealt} dmg`);
  return dealt;
}

function cure(state, u, why) {
  if (!statused(u)) return false;
  u.burn = null;
  u.paralysis = null;
  announce(state, u, `${why} cured its status!`, { fx: "cure" });
  return true;
}

// ---------- weather ----------
export function weatherActive(state) {
  const w = state.weather;
  if (!w) return null;
  for (const side of ["player", "npc"]) {
    const u = activeUnit(state.teams[side]);
    if (u && (u.state === "active" || u.state === "entering") && (has(u, "cloud-nine") || has(u, "air-lock"))) return null;
  }
  return w.kind;
}

export function setWeather(state, kind, u) {
  if (state.weather?.kind === kind) return false;
  state.weather = { kind, byId: u.id, since: state.tick };
  pushEvent(state, { kind: "weather", weather: kind, name: WEATHER[kind].name, text: WEATHER[kind].start, unitId: u.id, side: u.side });
  logLine(state, `weather: ${WEATHER[kind].name} (${u.name})`);
  for (const side of ["player", "npc"]) applyForecast(state, activeUnit(state.teams[side]));
  return true;
}

export const weatherTypeMult = (state, type) => {
  const k = weatherActive(state);
  return k ? (WEATHER[k].typeMult[type] ?? 1) : 1;
};

function applyForecast(state, u) {
  if (!has(u, "forecast") || !alive(u)) return;
  const k = weatherActive(state);
  const t = k === "sun" ? "fire" : k === "rain" ? "water" : k === "hail" ? "ice" : null;
  const types = t ? [t] : u.baseTypes;
  if (types.join() === u.types.join()) return;
  u.types = [...types];
  announce(state, u, `transformed into its ${t ? titleCase(t) : "Normal"} form!`, { fx: "transform", type: t || "normal" });
}

// ---------- entry / exit ----------
function trapsUnit(trapper, u) {
  switch (trapper.ability) {
    case "shadow-tag":
      return !has(u, "shadow-tag");
    case "arena-trap":
      return !u.types.includes("flying") && !has(u, "levitate");
    case "magnet-pull":
      return u.types.includes("steel");
    default:
      return false;
  }
}

export function isTrapped(state, team) {
  const u = activeUnit(team);
  const e = activeUnit(enemyOf(state, team.side));
  return !!(u && e && e.hp > 0 && (e.state === "active" || e.state === "entering") && e.ability && trapsUnit(e, u));
}

export function onEntry(state, u) {
  if (!u.ability) return;
  const enemy = activeUnit(enemyOf(state, u.side));
  const foe = enemy && enemy.hp > 0 && enemy.state !== "fainted" && enemy.state !== "fainting" ? enemy : null;
  const target = foe ? { targetId: foe.id, tx: foe.pos.x, ty: foe.pos.y } : {};
  switch (u.ability) {
    case "intimidate": {
      if (!foe) break;
      const blocker = ["hyper-cutter", "clear-body", "white-smoke"].find((b) => has(foe, b));
      if (blocker) {
        announce(state, u, "Intimidate!", { fx: "intimidate", ...target });
        announce(state, foe, `${abilityName(blocker)} prevents stat loss!`, { fx: "immune" });
      } else {
        foe.abilityState.intimidated = true;
        announce(state, u, `Intimidate! ${foe.name}'s Attack fell`, { fx: "intimidate", ...target });
      }
      break;
    }
    case "download": {
      if (!foe) break;
      const stat = foe.stats.def < foe.stats.spd ? "atk" : "spa";
      u.abilityState.download = stat;
      announce(state, u, `Download: ${stat === "atk" ? "Attack" : "Sp. Atk"} rose!`, { fx: "boost" });
      break;
    }
    case "pressure":
      announce(state, u, "is exerting its Pressure!");
      break;
    case "frisk": {
      let n = 0;
      enemyOf(state, u.side).units.forEach((x) => {
        if (!x.revealed) {
          x.revealed = true;
          n++;
        }
      });
      announce(state, u, n ? "Frisk revealed the rival's team!" : "Frisk found nothing new", { fx: "reveal" });
      break;
    }
    case "slow-start":
      u.abilityState.slowStartUntil = state.tick + secToTicks(P.slowStartSec);
      announce(state, u, "can't get it going!", { fx: "debuff" });
      break;
    case "arena-trap":
    case "shadow-tag":
    case "magnet-pull":
      if (foe && trapsUnit(u, foe)) announce(state, u, `${foe.name} can no longer escape!`, { fx: "trap", ...target });
      break;
    case "drizzle":
      if (setWeather(state, "rain", u)) announce(state, u, WEATHER.rain.start, { fx: "weather", weather: "rain" });
      break;
    case "drought":
      if (setWeather(state, "sun", u)) announce(state, u, WEATHER.sun.start, { fx: "weather", weather: "sun" });
      break;
    case "sand-stream":
      if (setWeather(state, "sand", u)) announce(state, u, WEATHER.sand.start, { fx: "weather", weather: "sand" });
      break;
    case "snow-warning":
      if (setWeather(state, "hail", u)) announce(state, u, WEATHER.hail.start, { fx: "weather", weather: "hail" });
      break;
    case "forecast":
      applyForecast(state, u);
      break;
    case "cloud-nine":
    case "air-lock":
      if (state.weather) announce(state, u, "the weather's effects disappeared!");
      break;
    default:
      break;
  }
}

export function onExit(state, u) {
  if (has(u, "natural-cure") && statused(u)) cure(state, u, "Natural Cure");
  u.abilityState = {};
  if (u.baseTypes && u.types.join() !== u.baseTypes.join()) u.types = [...u.baseTypes];
}

export function onFaint(state, u, killer) {
  if (has(u, "aftermath") && killer && alive(killer) && (u.lastHitSource === "melee" || u.lastHitSource === "dash")) {
    announce(state, u, `Aftermath! ${killer.name} is hurt`, { fx: "contact", targetId: killer.id, tx: killer.pos.x, ty: killer.pos.y });
    chip(state, killer, P.aftermathFraction, "Aftermath");
  }
}

// ---------- stat & move modifiers ----------
export function statMult(state, u, key) {
  let m = 1;
  const s = u.abilityState || {};
  const sun = () => weatherActive(state) === "sun";
  if (key === "atk") {
    if (s.intimidated) m *= P.intimidateAtkMult;
    if (has(u, "huge-power") || has(u, "pure-power")) m *= P.hugePowerMult;
    if (has(u, "hustle")) m *= P.hustleAtkMult;
    if (has(u, "guts") && statused(u)) m *= P.gutsMult;
    if (has(u, "slow-start") && slowStarting(state, u)) m *= P.slowStartMult;
    if (s.download === "atk") m *= P.downloadMult;
    if (has(u, "flower-gift") && sun()) m *= P.flowerGiftMult;
  } else if (key === "spa") {
    if (s.download === "spa") m *= P.downloadMult;
    if (has(u, "solar-power") && sun()) m *= P.solarPowerMult;
  } else if (key === "def") {
    if (has(u, "marvel-scale") && statused(u)) m *= P.marvelScaleMult;
  } else if (key === "spd") {
    if (has(u, "flower-gift") && sun()) m *= P.flowerGiftMult;
  }
  return m;
}

export function speedMult(state, u) {
  let m = 1;
  const s = u.abilityState || {};
  const w = weatherActive(state);
  if (s.speedBoost) m *= 1 + P.speedBoostPerStack * s.speedBoost;
  if (has(u, "quick-feet") && statused(u)) m *= P.quickFeetMult;
  if (has(u, "slow-start") && slowStarting(state, u)) m *= P.slowStartMult;
  if (s.motorDrive) m *= P.motorDriveSpeedMult;
  if (has(u, "swift-swim")) m *= w === "rain" ? P.weatherSpeedMult : onTile(state, u, ["water"]) ? P.tileSpeedMult : 1;
  if (has(u, "chlorophyll")) m *= w === "sun" ? P.weatherSpeedMult : state.terrain.id === "pitch" ? P.tileSpeedMult : 1;
  return m;
}

export function accuracyFor(state, u, enemy, move) {
  if (has(u, "no-guard") || has(enemy, "no-guard")) return null;
  if (move.accuracy == null) return null;
  let acc = move.accuracy;
  if (has(u, "compound-eyes")) acc *= P.compoundEyesMult;
  if (has(u, "hustle") && move.damageClass === "physical") acc *= P.hustleAccMult;
  return Math.min(100, acc);
}

export const cooldownMult = (state, u, enemy) => (has(enemy, "pressure") ? P.pressureCooldownMult : 1);
export const statusChanceMult = (u) => (has(u, "serene-grace") ? P.sereneGraceMult : 1);
export const stabFor = (u) => (has(u, "adaptability") ? P.adaptabilityStab : engine.STAB);
export const ignoresKnockback = (u) => has(u, "suction-cups");
export const ignoresChip = (u) => has(u, "magic-guard");

export function dodgeChanceFor(state, u, team, enemy) {
  if (has(u, "no-guard") || has(enemy, "no-guard")) return 0;
  let c = team.params.dodgeChance;
  const w = weatherActive(state);
  if (has(u, "sand-veil") && (w === "sand" || state.terrain.id === "cavern")) c += P.veilDodgeBonus;
  if (has(u, "snow-cloak") && (w === "hail" || onTile(state, u, ["snow", "ice"]))) c += P.veilDodgeBonus;
  return Math.min(0.95, c);
}

const PUNCH_EXTRA = new Set(["sky-uppercut", "meteor-mash", "hammer-arm"]);

export function powerMult(state, att, def, move, eff) {
  let m = 1;
  const d = abilityDef(att.ability);
  if (d?.group === "pinch" && move.type === d.type && att.hp <= att.maxHp * P.pinchHpFraction) m *= P.pinchMult;
  if (has(att, "technician") && move.power <= P.technicianMaxPower) m *= P.technicianMult;
  if (has(att, "iron-fist") && (move.name.includes("punch") || PUNCH_EXTRA.has(move.name))) m *= P.ironFistMult;
  if (att.abilityState?.flashFire && move.type === "fire") m *= P.flashFireMult;
  if (has(att, "tinted-lens") && eff > 0 && eff < 1) m *= P.tintedLensMult;
  m *= weatherTypeMult(state, move.type);
  return m;
}

export function damageTakenMult(state, att, def, move, eff) {
  if (has(att, "mold-breaker")) return 1;
  let m = 1;
  if (has(def, "thick-fat") && (move.type === "fire" || move.type === "ice")) m *= P.thickFatMult;
  if (has(def, "heatproof") && move.type === "fire") m *= P.heatproofMult;
  if ((has(def, "solid-rock") || has(def, "filter")) && eff > 1) m *= P.solidRockMult;
  if (has(def, "dry-skin") && move.type === "fire") m *= P.drySkinFireMult;
  return m;
}

export function immunity(state, att, def, move) {
  if (!def.ability || has(att, "mold-breaker")) return null;
  const t = move.type;
  switch (def.ability) {
    case "levitate":
      return t === "ground" ? { text: "floats over the attack!", fx: "immune" } : null;
    case "wonder-guard":
      return move.power > 0 && effOf(t, def.types) <= 1 ? { text: "Wonder Guard blocks it!", fx: "immune" } : null;
    case "water-absorb":
      return t === "water" ? { text: "absorbed the Water move!", heal: P.absorbHealFraction, fx: "heal" } : null;
    case "volt-absorb":
      return t === "electric" ? { text: "absorbed the Electric move!", heal: P.absorbHealFraction, fx: "heal" } : null;
    case "dry-skin":
      return t === "water" ? { text: "soaked up the Water move!", heal: P.absorbHealFraction, fx: "heal" } : null;
    case "flash-fire":
      return t === "fire" ? { text: "Flash Fire powered up its Fire moves!", set: "flashFire", fx: "boost" } : null;
    case "motor-drive":
      return t === "electric" ? { text: "Motor Drive raised its Speed!", set: "motorDrive", fx: "boost" } : null;
    default:
      return null;
  }
}

export function resolveImmunity(state, att, def, move, source) {
  const im = immunity(state, att, def, move);
  if (!im) return false;
  if (im.heal) heal(state, def, Math.round(def.maxHp * im.heal), abilityName(def.ability));
  if (im.set) def.abilityState[im.set] = true;
  announce(state, def, im.text, { fx: im.fx });
  pushEvent(state, { kind: "hit", targetId: def.id, attackerId: att.id, damage: 0, eff: 0, type: move.type, source, x: def.pos.x, y: def.pos.y, blocked: "ability" });
  logLine(state, `${att.name} ${move.name} → ${def.name}: no effect (${abilityName(def.ability)})`);
  return true;
}

export function sturdyCheck(state, att, def, damage) {
  if (has(def, "sturdy") && !has(att, "mold-breaker") && def.hp === def.maxHp && damage >= def.hp) {
    announce(state, def, "endured the hit!", { fx: "endure" });
    return def.hp - 1;
  }
  return damage;
}

export function afterHit(state, att, def, move, damage, source) {
  if (damage <= 0) return;
  if (has(def, "color-change") && !(def.types.length === 1 && def.types[0] === move.type)) {
    def.types = [move.type];
    announce(state, def, `became ${titleCase(move.type)} type!`, { fx: "transform", type: move.type });
  }
  const contact = source === "melee" || source === "dash";
  if (!contact || !alive(att)) return;
  const hit = { targetId: att.id, tx: att.pos.x, ty: att.pos.y, fx: "contact" };
  if (has(def, "static") && state.rng.chance(P.contactChance)) {
    announce(state, def, `Static zapped ${att.name}!`, hit);
    applyStatus(state, def, att, "paralysis", { byAbility: true });
  } else if (has(def, "flame-body") && state.rng.chance(P.contactChance)) {
    announce(state, def, `Flame Body scorched ${att.name}!`, hit);
    applyStatus(state, def, att, "burn", { byAbility: true });
  } else if (has(def, "effect-spore") && state.rng.chance(P.contactChance)) {
    const kind = state.rng.chance(0.5) ? "paralysis" : "burn";
    announce(state, def, `Effect Spore dusted ${att.name}!`, hit);
    applyStatus(state, def, att, kind, { byAbility: true });
  }
  if (has(def, "rough-skin")) {
    announce(state, def, `Rough Skin hurt ${att.name}!`, hit);
    chip(state, att, P.roughSkinFraction, "Rough Skin");
  }
}

export function statusBlocker(state, att, def, kind, opts = {}) {
  if (has(att, "mold-breaker") && !opts.byAbility) return null;
  if (has(def, "limber") && kind === "paralysis") return "limber";
  if (has(def, "water-veil") && kind === "burn") return "water-veil";
  if (has(def, "leaf-guard") && (weatherActive(state) === "sun" || state.terrain.id === "pitch")) return "leaf-guard";
  if (has(def, "shield-dust") && opts.fromMove) return "shield-dust";
  return null;
}

export function afterStatus(state, att, def, kind, opts = {}) {
  if (has(def, "synchronize") && att && att !== def && alive(att) && !opts.synced) {
    announce(state, def, `Synchronize passed the ${kind} back!`, { fx: "contact", targetId: att.id, tx: att.pos.x, ty: att.pos.y });
    applyStatus(state, def, att, kind, { synced: true, byAbility: true });
  }
}

export function afterRelease(state, u) {
  if (!has(u, "truant")) return;
  u.abilityState.loafUntil = state.tick + secToTicks(P.truantLoafSec);
  announce(state, u, "is loafing around…", { fx: "loaf" });
}

// ---------- per-second tick ----------
export function abilityTick(state) {
  if (state.tick % TICK_RATE !== 0) return;
  const sec = state.tick / TICK_RATE;
  const w = weatherActive(state);
  for (const side of ["player", "npc"]) {
    const u = activeUnit(state.teams[side]);
    if (!u || u.state !== "active" || u.hp <= 0) continue;
    if (w) {
      const cfg = WEATHER[w];
      if (cfg.chipFraction && sec % cfg.chipEverySec === 0 && !u.types.some((t) => cfg.immuneTypes.includes(t)) && !cfg.immuneAbilities.includes(u.ability)) chip(state, u, cfg.chipFraction, cfg.name);
    }
    if (!u.ability || u.hp <= 0) continue;
    const s = u.abilityState;
    const regen = sec % P.regenEverySec === 0;
    switch (u.ability) {
      case "speed-boost":
        if (sec % P.speedBoostEverySec === 0 && (s.speedBoost || 0) < P.speedBoostMaxStacks) {
          s.speedBoost = (s.speedBoost || 0) + 1;
          announce(state, u, `Speed Boost! Speed +${Math.round(P.speedBoostPerStack * 100 * s.speedBoost)}%`, { fx: "boost" });
        }
        break;
      case "shed-skin":
        if (statused(u) && sec % P.shedSkinEverySec === 0 && state.rng.chance(P.shedSkinChance)) cure(state, u, "Shed Skin");
        break;
      case "hydration":
        if (statused(u) && (w === "rain" || onTile(state, u, ["water"]))) cure(state, u, "Hydration");
        break;
      case "ice-body":
        if (regen && (w === "hail" || onTile(state, u, ["snow", "ice"]))) heal(state, u, Math.max(1, Math.round(u.maxHp * P.regenFraction)), "Ice Body");
        break;
      case "rain-dish":
        if (regen && (w === "rain" || onTile(state, u, ["water"]))) heal(state, u, Math.max(1, Math.round(u.maxHp * P.regenFraction)), "Rain Dish");
        break;
      case "dry-skin":
        if (regen && w === "rain") heal(state, u, Math.max(1, Math.round(u.maxHp * P.drySkinFraction)), "Dry Skin");
        else if (regen && w === "sun") chip(state, u, P.drySkinFraction, "Dry Skin");
        break;
      case "solar-power":
        if (regen && w === "sun") chip(state, u, P.drySkinFraction, "Solar Power");
        break;
      case "slow-start":
        if (s.slowStartUntil && state.tick >= s.slowStartUntil) {
          s.slowStartUntil = 0;
          announce(state, u, "finally got its act together!", { fx: "boost" });
        }
        break;
      default:
        break;
    }
  }
}

// ---------- presentation helpers (read-only) ----------
export function passiveVisual(state, u) {
  const d = abilityDef(u.ability);
  if (!d) return null;
  const s = u.abilityState || {};
  if (d.group === "pinch" && u.hp <= u.maxHp * P.pinchHpFraction) return { kind: "aura", color: d.color, type: d.type };
  if (s.flashFire) return { kind: "aura", color: "#f97316", type: "fire" };
  if (s.motorDrive) return { kind: "aura", color: "#facc15", type: "electric" };
  if (s.speedBoost) return { kind: "speed", color: "#22d3ee", stacks: s.speedBoost };
  if (isLoafing(state, u)) return { kind: "loaf", color: "#94a3b8" };
  if (has(u, "slow-start") && slowStarting(state, u)) return { kind: "drowsy", color: "#94a3b8" };
  if ((has(u, "guts") || has(u, "marvel-scale") || has(u, "quick-feet")) && statused(u)) return { kind: "aura", color: d.color, type: null };
  if (s.download) return { kind: "aura", color: d.color, type: null, soft: true };
  return null;
}

export function abilityStatus(state, u) {
  if (!u.ability) return null;
  const d = abilityDef(u.ability);
  const name = d?.name || titleCase(u.ability);
  if (!d) return { id: u.ability, name, active: false, label: "no effect" };
  const s = u.abilityState || {};
  const w = weatherActive(state);
  let label = null;
  if (d.group === "pinch" && u.hp <= u.maxHp * P.pinchHpFraction) label = `×${P.pinchMult}`;
  else if (s.speedBoost) label = `SPE +${Math.round(s.speedBoost * P.speedBoostPerStack * 100)}%`;
  else if (s.flashFire) label = "charged";
  else if (s.motorDrive) label = "SPE ×1.5";
  else if (s.download) label = `${s.download.toUpperCase()} ×1.5`;
  else if (isLoafing(state, u)) label = "loafing";
  else if (has(u, "slow-start") && slowStarting(state, u)) label = "warming up";
  else if ((has(u, "guts") || has(u, "marvel-scale") || has(u, "quick-feet")) && statused(u)) label = "active";
  else if ((has(u, "swift-swim") || has(u, "rain-dish") || has(u, "hydration")) && (w === "rain" || onTile(state, u, ["water"]))) label = "active";
  else if ((has(u, "chlorophyll") || has(u, "leaf-guard")) && (w === "sun" || state.terrain.id === "pitch")) label = "active";
  else if ((has(u, "solar-power") || has(u, "flower-gift")) && w === "sun") label = "active";
  else if ((has(u, "snow-cloak") || has(u, "ice-body")) && (w === "hail" || onTile(state, u, ["snow", "ice"]))) label = "active";
  else if (has(u, "sand-veil") && (w === "sand" || state.terrain.id === "cavern")) label = "active";
  else if ((has(u, "arena-trap") || has(u, "shadow-tag") || has(u, "magnet-pull")) && isTrapped(state, enemyOf(state, u.side))) label = "trapping";
  return { id: u.ability, name, active: !!label, label };
}

export function weatherStatus(state) {
  if (!state.weather) return null;
  const k = state.weather.kind;
  return { kind: k, name: WEATHER[k].name, suppressed: weatherActive(state) !== k };
}
