export const titleCase = (s = "") =>
  s
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

export const dexNo = (id) => `#${String(id).padStart(3, "0")}`;

export const GEN_LABELS = { 1: "I", 2: "II", 3: "III", 4: "IV" };

export const formatDate = (ts) =>
  new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
