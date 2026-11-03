# Learnings
- 2026-06 Render effects that reference a unit by id (aura/cloud/buffStream) must carry a fallback position (fx/fy) — the unit can faint/bench in the same tick; a NaN into createRadialGradient throws inside rAF and freezes the whole battle. BattleCanvas now try/catches renderer.render so render bugs never stall the simulation.
- ESLint rules-of-hooks flags any function named use* called inside callbacks — never name context actions `useX` (renamed useEvolutionItem → applyEvolutionItem).
- Seed 9001 reference endTick depends on save.rivalLevel (AI slot): L2 → 6690, L3 → 7620, L4 → 7429.
- 2026-06 The bash wrapper rejects python heredoc writes to .jsx files ("/app is owned by the regression harness") — use search_replace/create_file for .jsx; bash python is fine for .js/.json.
- 2026-06 Replay fallbacks in BattleCanvas must run every frame, not only in the paused branch: React autoPick state can differ from engine state.autoPick after recorded 'auto' inputs.
- 2026-06 abilities.js ↔ combat.js/state.js/damage.js are circular imports — safe because all cross-calls happen at call time (Jest + webpack verified). Never use imported values at module top level there.
