# Performance & Workspace UX

VSN Builder keeps the management UI responsive by loading secondary Dashboard screens and heavy Builder panels only when they are opened. Motion Library sends compact preview data for built-in presets, then retrieves a full timeline only when a preset is customized.

## Motion Library
- Search is deferred so typing does not block rendering a 1,000+ preset catalog.
- Cards use browser content visibility and incremental rendering.
- Built-in preset cards use compact preview timelines; editing fetches the complete timeline on demand.
- The advanced Motion Editor uses a left live preview and a right inspector with Timeline, Actions, Frames and Keyframes.

## Dashboard width
Workspace screens use wider responsive desktop containers while preserving readable gutters. Narrow reading-oriented screens such as Profile or Changelog may intentionally remain narrower.

## Code suggestions
Editor and Developer Studio code suggestions render in top-level overlay portals so scrollable panels and cards cannot clip them.
