import { Leaf, Waves, Mountain, Snowflake } from "lucide-react";

export const TERRAINS = [
  {
    id: "pitch",
    name: "Pitch",
    tagline: "Open grassland",
    accent: "#22C55E",
    gradient: "from-emerald-950/80 to-green-900/30",
    icon: Leaf,
    boosts: ["grass", "bug"],
    effect: "+15% Grass & Bug damage · open lanes, everyone moves a touch faster",
  },
  {
    id: "shoreline",
    name: "Shoreline",
    tagline: "Tidal beach",
    accent: "#06B6D4",
    gradient: "from-cyan-950/80 to-blue-900/30",
    icon: Waves,
    boosts: ["water", "electric"],
    effect: "+15% Water & Electric damage · wet sand slows heavy creatures",
  },
  {
    id: "cavern",
    name: "Cavern",
    tagline: "Rocky depths",
    accent: "#D97706",
    gradient: "from-amber-950/80 to-stone-900/30",
    icon: Mountain,
    boosts: ["rock", "ground"],
    effect: "+15% Rock & Ground damage · tight walls, Flying loses its edge",
  },
  {
    id: "snowfield",
    name: "Snowfield",
    tagline: "Frozen tundra",
    accent: "#38BDF8",
    gradient: "from-sky-950/80 to-slate-900/30",
    icon: Snowflake,
    boosts: ["ice", "steel"],
    effect: "+15% Ice & Steel damage · periodic hail chips non-Ice creatures",
  },
];

export const terrainById = (id) => TERRAINS.find((t) => t.id === id) || TERRAINS[0];
