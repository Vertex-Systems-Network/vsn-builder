# VSN Builder v2.5.59 — Milestone H.1 Runtime Stabilization

## Scope

This hotfix stabilizes Marketplace catalog loading and Builder panel error UX without changing the H.1 navigation architecture.

## Marketplace

- Supplied catalog records are normalized and invalid rows are skipped.
- Optional starter-catalog failures no longer remove the built-in Marketplace catalog.
- Favorite/install database rows are validated before joining to catalog items.
- Remote catalog items remain independently validated.

## Builder error UX

- Raw server exception messages are not rendered as the primary end-user panel state.
- Panel failures use VSN-native styling, concise human copy, Try again, and Open System Health actions.
- Full technical exceptions continue to be logged on the server for developers.

## Compatibility

- No Prisma schema migration.
- Existing routes, Marketplace IDs, installs, favorites, and H.1 navigation remain compatible.
