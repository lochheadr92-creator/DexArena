# Original creatures — first implementation checkpoint

**Later checkpoint (5 November 2026):** the selected twelve now have front/rear
sprites and animations, an integrated exhibition and 82 passing tests. See
[batch-01/REVIEW.md](batch-01/REVIEW.md) for the current evidence and limits.
The original checkpoint below is retained as historical evidence; its all-assets-
missing and browser-disabled statements describe that earlier run.

Branch: `possible-designs`, created from clean `main` at `bccbff7` on 5 November
2026 (Australia/Brisbane). The requested branch text contained spaces, which Git
does not allow. No commit or push was made.

## Status and authority

**COMPONENT_VERIFIED** for the design catalogue, local draft-content loading and
headless combat/replay paths. **The full original-creature release is incomplete.**
The owner's attached 150-creature brief governs this new work, including its
permission to add original application assets. Earlier SPEC restrictions on extra
assets and phased stopping points describe the legacy implementation, not a ban
on the newly requested roster. The legacy combat rules remain unchanged.

Inspected `SPEC.md`, `memory/PRD.md`, `memory/learnings.md`, design/data/loading,
move classification, combat preparation, NPC drafting, sprite decoding/rendering,
save normalization, replay encoding and the existing tests. No repository-local
AGENTS.md files were present; the owner supplied the applicable instructions in chat.

## What is implemented

- `/designs`: a local catalogue of all 150 draft species, the first twelve-design
  front/rear concept study, search by name/animal/habitat/number, type/rarity/role
  filters, stats, ability labels, automatic move loadouts and family navigation.
  Reach it through “Original Creatures” in the normal app shell. The route is
  outside GameProvider, so opening it does not fetch Pokémon or write progress.
- `frontend/src/content/originals/`: authored family concepts, compiled species,
  104 local moves, 25 ability presentation labels, distribution report, asset
  manifest and data audits. Existing supported ability IDs remain the mechanics.
- IDs `100001–100150` for creatures; original move IDs start at `200001`.
  Display numbers remain `001–150`. Keep published row order and identities stable.
- Original move lookup happens locally before legacy cache/network lookup.
  Unknown reserved IDs fail; original loadout overrides must be distinct and
  learnable. All intended shapes and supported status effects are checked through
  the existing engine classifier. No damage, cooldown, AI or type-chart tuning.
- Headless preparation accepts a separate original roster. Mixed rosters and
  rendered original battles with incomplete art are rejected. This is development
  groundwork, not the final playable roster switch.
- Original development replays use v3 with `{rosterId:"originals",version:1}`.
  Foreign species/moves, invalid loadouts and unknown versions are rejected. Legacy
  recordings still encode as v2 and legacy v1/v2 decoding is retained. Development
  replay content version 1 must be bumped if its released gameplay data changes.
- Reproducible captured legacy fixture and baseline, distribution/catalogue
  generation, plan validation and headless sample commands.

## Data and design findings

The live reference was captured through the repository's normalizer: 493 species,
232 starters, 223 dual-type species, 26 legendary and 9 mythical. Targets and actuals
are in [DISTRIBUTION.md](DISTRIBUTION.md). Every rounded type target matches exactly.
Originals have 82 single types, 68 dual types, 71 starters, 139 ordinary species,
8 legendary and 3 mythical species. There are 18 three-stage and 34 two-stage
families, five additional branching evolutions, and 23 standalone species.

[CATALOGUE.md](CATALOGUE.md) lists all species, stats, abilities, loadouts and visual
briefs. [ART-DIRECTION.md](ART-DIRECTION.md) records the art specification and the
concept study's quality limits. The study is a single 1536×1024 opaque image;
it is not split runtime art and contains no animation. All 150 manifest entries
remain planned, with missing assets explicitly null.

Stats are preliminary. The evolution floor makes the draft middle-stage mean
401.7 versus reference 383.4; standalone means are 449.1 versus 432.1. With just
three mythicals, the draft mean is 626.7 versus 600. Ordinary totals cap at 600
to avoid inheriting the exceptional 670 total of a species balanced by a drawback
ability. These deviations need balance review; successful smoke samples do not
prove parity, competitive balance or the quality of every moveset.

## Verification evidence

Commands run from `C:\dev\DexArena\frontend` unless stated otherwise:

| Command | Actual result |
|---|---|
| `$env:CI='true'; yarn test --watchAll=false --runInBand` before edits | 58 tests / 7 suites passed |
| `yarn build` before edits | Compiled successfully |
| `node --use-system-ca scripts/capture-original-reference.cjs` | Captured all 493 normalized species and 163 moves for the fixed legacy fixture |
| `node scripts/legacy-baseline.cjs --capture` before runtime edits | Captured baseline and six matching replay variants |
| `yarn verify:original-plan` | 150 species, 104 moves, 71 starters; no data errors |
| `$env:CI='true'; yarn test --watchAll=false --runInBand` after edits | 73 tests / 9 suites passed |
| `yarn build` after edits | Compiled successfully; main JS 322.79 kB gzip |
| `yarn verify:legacy-baseline` | Matches captured winner, HP, end tick and log hash; all six replay variants match |
| `yarn sample:original-battles` | 72 ordinary drafts and 25 all-species fixtures completed; zero timeouts |
| `yarn verify:original-roster` | **FAIL (exit 1): 600 missing production assets, 150 unreviewed species, remaining release checks not implemented** |
| `git diff --check` from repository root | Passed |

Legacy reference: seed 9001, Pitch, Tactician slot 3, fixed teams in the fixture;
NPC wins at tick **11863**, remaining 0/2, log hash **cdccecff**. This is the
freshly captured baseline, not the historical hash in older PRD notes. Fixed data
removes future PokeAPI drift from the regression check. Full details, replay code
and variant list are in `legacy-baseline.json`.

Ordinary original sample: seeds 4101–4103, four terrains, six archetypes, 72 battles;
46 different original species appeared. All six shapes were in loadouts; AI used
shields 1,017 times and buffs 453 times, with 888 shield blocks. A further 25 fixed
Pitch battles included every species, including locked/sealed designs. Those
fixtures deliberately bypass progression and are not evidence of normal unlock
activation. See `battle-samples.json` for individual teams/outcomes.

The UI test mounts the actual App at `/designs` and exercises type/rarity filters,
search and family selection with network calls prohibited and legacy save bytes
checked for preservation. It is a jsdom interaction test, not browser rendering.

## Failures encountered and limits

- Initial Node reference fetch failed certificate validation. Retried with Node's
  `--use-system-ca`; certificate verification stayed enabled and capture completed.
- The first App test could not resolve React Router and Radix package subpath
  exports in CRA's older Jest resolver. Two test-only mappings to the installed
  CommonJS exports and the missing standard TextEncoder API repaired the test
  environment. No package versions or production runtime dependencies changed.
- A filter-reset test initially dispatched two control changes before React had
  applied the first. It was corrected to perform the interactions in order; all
  assertions remain, including an explicit return to all 150 results.
- The build emits Node's existing `fs.F_OK` deprecation warning.
- The browser tool reported **“Local browser use is disabled in Work settings.”**
  No browser screenshots, actual 360px layout checks or visual interaction claims
  are made. A local static preview is served at `http://127.0.0.1:3100/designs`;
  its HTML and concept image have HTTP response checks only.

## Remaining work

1. Turn the representative study into native-resolution transparent front/back
   art and genuine anatomy-motion loops for the twelve-species quality checkpoint;
   review and correct it at game size, then produce the remaining species in batches.
2. Add the actual selectable gameplay roster, isolated progression/save namespaces,
   original ability labels throughout battle UI, versioned sprite cache keys,
   daily challenges, gauntlets, presets and save/export/import routing. The current
   save code is untouched. Original replays are currently a headless development path.
3. Complete asset decoding/transparency/frame/timing checks in the release validator,
   generate final labelled contact sheets and animation gallery, and run the full
   required browser/compatibility acceptance matrix. The release command is an
   explicit incomplete gate and cannot currently certify a finished roster.

Regenerate draft data/reports with `yarn design:originals`. This preserves the asset
manifest and rejects identity drift. The family text and generator are authoritative
for this draft; hand edits to generated roster JSON will be overwritten.
