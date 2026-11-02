import typeChart from "./typeChart.json";
import typeColors from "./typeColors.json";
import engine from "./engine.json";
import shapeMapping from "./shapeMapping.json";
import terrains from "./terrains.json";
import modifiers from "./modifiers.json";
import archetypes from "./archetypes.json";
import difficulty from "./difficulty.json";
import animations from "./animations.json";
import moveVisuals from "./moveVisuals.json";

export const CONFIG = { typeChart, typeColors, engine, shapeMapping, terrains, modifiers, archetypes, difficulty, animations, moveVisuals };
export { typeChart, typeColors, engine, shapeMapping, terrains, modifiers, archetypes, difficulty, animations, moveVisuals };

export const TICK_RATE = engine.TICK_RATE;
export const TICK_SEC = 1 / TICK_RATE;
export const secToTicks = (sec) => Math.round(sec * TICK_RATE);
