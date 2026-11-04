import { engine } from "@/game/config";

const L = engine.LEVEL;

export function battleStats(base) {
  return {
    hp: Math.floor((2 * base.hp * L) / 100) + 60,
    atk: Math.floor((2 * base.atk * L) / 100) + 5,
    def: Math.floor((2 * base.def * L) / 100) + 5,
    spa: Math.floor((2 * base.spa * L) / 100) + 5,
    spd: Math.floor((2 * base.spd * L) / 100) + 5,
    spe: Math.floor((2 * base.spe * L) / 100) + 5,
  };
}

export const topSpeed = (spe) => engine.speed.base + spe / engine.speed.divisor;
