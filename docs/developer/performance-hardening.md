# Performance Hardening

Milestone Q.3 establishes runtime performance budgets and source-level guardrails.

## Code splitting
Dashboard secondary screens are loaded with React lazy boundaries. Heavy Builder systems such as Motion Library, Email Builder and Widget Studio are separately lazy-loaded.

## Motion catalog payload
`listMotionLibrary()` emits compact built-in preview records. A full built-in preset is resolved with `getBuiltinMotionPreset()` only for editing/customization. The release audit fails if the built-in initial JSON payload exceeds 800 KB.

## Storefront budgets
Run `npm run performance:q3` to verify total Theme App Extension JavaScript, CSS and the main renderer remain inside explicit budgets.

## Database index audit
Run `npm run db:index-audit` to verify high-frequency merchant-scoped models keep the compound indexes expected by their query patterns.

## Release gate
`npm run qa:milestone-q3` verifies lazy loading, Motion payload compaction, editor suggestion overlays, advanced Motion Editor features, workspace width and performance audit scripts.
