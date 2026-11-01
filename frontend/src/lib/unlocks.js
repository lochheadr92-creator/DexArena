export const isSealed = (c) => c.isLegendary || c.isMythical;

export function computeStarterIds(creatureMap) {
  const starters = new Set();
  for (const c of Object.values(creatureMap)) {
    if (isSealed(c) || c.evolvesFrom != null) continue;
    starters.add(c.id);
    if (c.isBaby) c.evolvesTo.forEach((id) => starters.add(id));
  }
  return starters;
}

export function lockReason(creature) {
  if (isSealed(creature)) return "Sealed — unlocked by total arena wins";
  return "Locked — win battles with its earlier form to evolve";
}
