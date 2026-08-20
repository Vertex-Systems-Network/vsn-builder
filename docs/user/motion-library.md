# Motion Library

Use built-in or custom reusable timelines from Advanced → Animation & Interaction. The catalog contains 1,347 unique built-ins: 97 Animate.css-named VSN recreations, 960 generated VSN presets and 286 deduplicated reference-library effects. Respect reduced-motion behavior.

## Checklist

- Confirm the relevant VSN permission.
- Test loading, empty and error states.
- Validate light/dark UI where applicable.
- Run System Health if Shopify/API data is unavailable.
- Preview before publishing or enabling storefront behavior.

## Reference effect catalogs (v2.5.80)

VSN also includes native interpretations of named effects from Hover.css, All Animation, Magic Animations, Tuesday, ReboundGen, CSShake, WickedCSS, Woah.css, Obnoxious.css, Infinite, Micron and Mimic.css. These are converted to VSN Motion timelines; the third-party stylesheets and runtimes are not bundled.

The catalog deduplicates canonical effect names across libraries. For example, a second `Fade In`, `Pulse`, `Heartbeat`, or `Spinner` reference is recorded as an alias instead of rendering a duplicate card. High-frequency strobe/flicker references are shipped only as reduced-frequency `Safe` adaptations and default to `reducedMotion: skip`.
