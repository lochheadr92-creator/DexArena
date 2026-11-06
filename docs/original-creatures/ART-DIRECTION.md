# Original creature art direction — design draft 1

**Batch 01 update:** the representative twelve below now have reviewed runtime
sprites and six-frame front/rear animation sets. See
[the review record](batch-01/REVIEW.md). The original concept-study assessment at
the end is historical; the other 138 species remain in production.

The source brief is the owner's `DexArena-150-Original-Creatures-Emergent-Prompt.md`.
This branch begins that work. A design record, concept sheet or simulation fixture is
not a finished species. No original is release-ready until both views and both
animations have been decoded, reviewed and seen in the actual battle renderer.

## Reference and production rules

Inspected native 96×96 PokeAPI front/back PNGs for Heracross, Noctowl, Donphan and
Butterfree. Reference downloads live in ignored `.cache/art-reference`, not in the
new roster. These establish crisp clustered pixels, outlined readable anatomy,
limited ramps, different rear silhouettes and stable feet. They are quality
references only; no source pixels are reused.

- Working canvas: 96×96 transparent RGBA per pose/frame. Pixel clusters must remain
  readable at 48×48. Inspect at 1×, 0.5× and 4× nearest-neighbour.
- Dark coloured one-pixel outer contour with selective lighter upper edges.
  Upper-left light, three-tone material ramps, approximately 12–24 visible colours.
  No antialiasing, blur, smooth-vector edges, photographic textures or opaque matte.
- Ground anchor: centre x=48, baseline y=86. Small creatures occupy 36–52 source
  pixels vertically; large creatures 60–78. Keep at least four pixels clear on all sides.
- Front: three-quarter forward pose. Back: purpose-designed three-quarter rear,
  keeping the same limbs, markings, scales, quills and material divisions. Never
  mirror a front view and call it a back view.
- Loop target: six distinct frames per view, 140 ms/frame (840 ms loop). Anatomy
  motion rather than whole-image transforms: breathing plus ears, quills, gills,
  antennae or tail. Feet remain planted unless the species hovers.
- The last frame must transition naturally to the first. Do not inflate a sequence
  with duplicate frames. Any generated sheet is a candidate until inspected and
  separated into decoded, transparent, correctly anchored assets.
- Final runtime assets: static PNG front/back and looping GIF front/back, using the
  existing lazy GIF decoder. Render clock only; no simulation RNG.
- Paths reserved: `/originals/v1/<slug>/front.png`, `back.png`, `front.gif`, `back.gif`.
  Missing assets have null manifest entries, not fabricated usable paths.

## Representative set

Reedlet → Thimblereed → Sedgewarden, Cindrick, Hearthorn, Rillip, Prismantis,
Voltrivet, Breakerbill, Bastilimp, Drakarn and Bathyridge. This tests an entire
evolution line, small/large bodies, single/dual typings, multiple animal groups,
soft/metal/mineral materials, flight and a sealed legendary. Concept sheets are
for direction, not substitutes for these twelve complete asset sets.

## Review record

Initial concept study: generated and inspected at 1536×1024, saved as
`frontend/public/originals/design/representative-study-v1.png`. The mouse evolution
line, material variety and broad body silhouettes are useful design directions.
This image is not accepted as production sprites: it contains an opaque designed
background, illustrations denser than the intended 96×96 pixel grid, and some rear
views (particularly Prismantis) need stronger rear anatomy. It has no animation.
Final front/back sprite and animation acceptance remains pending for all 150 species.
The manifest and the release validator record that incomplete state explicitly.
