import typeColors from "@/game/config/typeColors.json";

export const TYPE_COLORS = typeColors;

export const TYPES = Object.keys(TYPE_COLORS).filter((t) => t !== "fairy");

export const typeColor = (type) => TYPE_COLORS[type]?.bg || "#64748B";
