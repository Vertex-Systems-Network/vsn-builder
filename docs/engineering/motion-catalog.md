# Motion Catalog 2.0

Milestone M.2 expands the existing Motion Engine; it does not introduce a parallel animation runtime.

The built-in catalog contains:

- 6 original VSN core presets.
- 97 Animate.css-named presets recreated as VSN-native timelines. The runtime does not load Animate.css.
- 960 generated VSN presets across Modern, Spring, Elastic, Robust, Pop, Zoom, Dynamic/Rotate, Drift and Reveal/Cinematic families.

Generated presets combine 10 families × 8 directions × 4 strengths × 3 moods. Every preset is normalized through the same Motion timeline schema, can be copied into a merchant custom preset, and respects the existing reduced-motion contract.

The Motion Library UI renders a bounded first batch and exposes incremental loading so opening the library does not mount more than one thousand animated preview cards at once.
