# First twelve creatures — sprite and exhibition checkpoint

Recorded 5 November 2026 on `possible-designs`, based on `bccbff7`. Changes remain
uncommitted. This is acceptance of the bounded artwork/exhibition checkpoint,
not the full 150-creature release or the owner's aesthetic sign-off.

## Delivered

Reedlet, Thimblereed, Sedgewarden, Cindrick, Hearthorn, Rillip, Prismantis,
Voltrivet, Breakerbill, Bastilimp, Drakarn and Bathyridge are the representative
twelve selected in ART-DIRECTION.md. They are not catalogue numbers 001–012.

Each has a 96×96 transparent front PNG, rear PNG, front GIF and rear GIF under
`frontend/public/originals/v1/<slug>/`. Each GIF contains six different drawings
at 140 ms per frame, looping in 840 ms. There are 48 required runtime assets,
24 additional frame strips and 144 drawn frames. No front is reused or mirrored
as its rear. Motion comes from the drawings; no code-generated tweening or
whole-image translation was used to manufacture frames.

Generated source sheets and prompts are retained in `source/` and `prompts.json`.
Packaging applies a shared scale per species, nearest-neighbour sampling,
binary transparency, a shared palette of at most 24 colours and a final ground
anchor at y=86. Wide creatures occupy less vertical space to preserve all of
their tail/flippers within the 96-pixel canvas. `packaging.json` records scales
and hashes. A changed asset revision invalidates review and gets a new cache key.

## Visual review

Codex inspected the source sheets, every frame on the four `frames-*.png` review
sheets, the corrected contact sheet, and the browser gallery using the game's
GIF decoder. Silhouettes remain distinct: russet mouse/reed family, quilled
tenrecs, whiskered desman, translucent-winged insect, copper beetle, wader,
stepped limpet, basalt monitor and ridged turtle. Rear anatomy and appendages
are distinct from the forward views. The frames show breathing and secondary
motion (ears/leaves, quills, whiskers, wings, antennae, crest, siphons, tail and
flippers), with visible blinks in forward views. First/last drawings return
towards a neutral pose without a viewpoint cut.

Three initial sheets retained opaque background pixels: Sedgewarden, Prismantis
and Bastilimp. They were corrected with image generation before acceptance.
The initial structural check also found one frame ending at y=85; packaging now
anchors the sampled silhouette itself at y=86. Neither failure was waived.

The browser gallery supports play/pause, six-frame stepping and 48/96/192/384px
display controls. Its 24 animations decoded to six frames each without errors.
The review sheets provide a reproducible enlarged inspection independent of the
browser. A precise mobile/breakpoint sign-off is still outstanding: this session's
browser viewport override produced inconsistent effective viewport/DPR values.
It was reset. Do not interpret the small browser screenshots as device benchmarks.

## Runtime integration and observed evidence

- `/designs` exposes the animated gallery. `/designs/arena` offers a six-versus-six
  exhibition using the existing `prepareBattle`, `BattleCanvas` and battle renderer.
  Lead creature, four terrains, pause/resume and 1×/2×/4× controls are available.
- The exhibition permits exactly the selected twelve. Bathyridge is explicitly
  included for artwork review, not unlocked in campaign progression. No campaign
  rewards, save writes or roster switch are introduced by this page.
- All twelve were selected as player leads with the opposite six as rivals.
  `browser-pairs.json` records all 24 facing combinations with no fallbacks;
  `battle-*.jpg` are initial entry snapshots (ticks 8–13), not completed battles.
  An active Bathyridge/Rillip battle was also observed through tick 1836 with HP
  changes. Pause/resume and 4× speed were observed. No browser console errors
  were reported. The usual graphics governor lowered quality during inspection.
- The first match after reloading decoded 12 assets. Subsequent matches reused
  in-memory entries and reported zero new decodes and zero fallbacks. Revisiting
  the gallery decoded all front/rear pairs successfully.
- Original cache keys include roster, content version, asset revision, ID and
  facing. Legacy cache keys remain unchanged. Missing/corrupt original animations
  fail clearly rather than becoming static/legacy placeholders. Stored original
  animations must match dimensions, frame count, timing and URL.

## Verification

Run from `C:\dev\DexArena\frontend`:

```powershell
npm ci --prefix scripts/assets --ignore-scripts --no-audit --no-fund
node scripts/assets/package-sprites.cjs
node scripts/assets/review-sheets.cjs
yarn verify:original-batch
$env:CI='true'
yarn test --watchAll=false --runInBand
yarn verify:legacy-baseline
yarn verify:original-plan
yarn build
```

The packaging tools use isolated pinned pngjs/gifenc dependencies; the application
keeps its existing gifuct-js decoder. Repackaging unchanged bytes preserves an
existing review; changed bytes return the species to review status.

- Asset gate: PASS, 12 species / 24 GIFs / 144 frames. Checks actual GIF decoding,
  unique drawings (including cropped comparison to reject translated duplicates),
  dimensions, palette bounds, transparent margins, ground anchor, looping and
  delay. Static PNG pixels match the first decoded GIF frame. Results are in
  `asset-verification.json`. Structural checks alone do not award visual review.
- Tests: PASS, 82 tests / 10 suites. New contracts cover the bounded preview,
  revisioned asset paths/cache keys, fatal GIF failure, frame-clock looping and
  animation disabling. Four terrain runs plus 24 speed/animation variants finish
  without timeout and reproduce summaries and logs exactly.
- Legacy regression: PASS, seed 9001 still ends at tick 11863, NPC wins,
  log hash `cdccecff`, and all six replay variants match.
- Production build: PASS; the existing Node `fs.F_OK` deprecation warning remains.

A direct invocation of the release validator from the repository root failed
Babel plugin resolution because that existing source loader resolves plugins
relative to the working directory. The documented `yarn verify:original-roster`
command was then run from `frontend`; it reported the three release gaps below.
This working-directory constraint was not changed as part of the artwork task.

An initial catalogue UI test failed because it selected the first page-wide
dropdown; the new display-size dropdown changed that order. It now selects the
catalogue's filters and still checks the original counts, search, family
navigation and unchanged save bytes. It permits only the 24 new local GIF fetches,
not PokeAPI access. A new failure-path test initially had a reset Jest mock;
its asynchronous IndexedDB stub was corrected without changing its assertions.

## Boundary

The remaining 138 creatures have no runtime artwork and were not expanded.
The full release gate must still fail: 552 of 600 required assets are missing,
138 species lack visual review, and complete roster selection/save/progression
integration remains unfinished. The exhibition is not evidence of final balance,
offline-first readiness, campaign unlock behaviour or complete mobile acceptance.
