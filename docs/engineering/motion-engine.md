# Motion Engine 2.0

Milestone I extends the existing Phase 6 Interaction Engine. It is not a parallel animation runtime.

## Data model

A reusable Motion Library entry stores a normalized Interaction Timeline. The same timeline schema is used by:

- element/widget Advanced → Animation & Interaction;
- page Motion Defaults;
- Canvas and Preview runtime;
- storefront `vsn-interactions.js` runtime.

Motion schema version 4 adds intermediate keyframes and an explicit reduced-motion policy (`instant`, `skip`, `allow`).

## Reuse contract

Built-in presets are read-only. Custom presets can be created, edited, duplicated, favorited, trashed, restored and permanently deleted with confirmation. Applying a preset creates a new timeline instance so editing one element does not mutate the library master.

## Runtime contract

The storefront and editor runtimes both support From → intermediate keyframes → To. Scroll-progress interactions interpolate across the same keyframe sequence. Reduced-motion preference is respected by each timeline.

## Boundaries

Motion Library owns reusable animation definitions. The Interaction Engine owns triggers, conditions, targets and execution. Components and widgets do not implement separate animation code.
