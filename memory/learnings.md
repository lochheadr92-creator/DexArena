# Learnings
- 2026-06 Render effects that reference a unit by id (aura/cloud/buffStream) must carry a fallback position (fx/fy) — the unit can faint/bench in the same tick; a NaN into createRadialGradient throws inside rAF and freezes the whole battle. BattleCanvas now try/catches renderer.render so render bugs never stall the simulation.
- ESLint rules-of-hooks flags any function named use* called inside callbacks — never name context actions `useX` (renamed useEvolutionItem → applyEvolutionItem).
- Seed 9001 reference endTick depends on save.rivalLevel (AI slot): L2 → 6690, L3 → 7620, L4 → 7429.
