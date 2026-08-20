# VSN Builder v2.5.82 — Milestone Q.3 Performance Hardening & Motion Editor UX

## User-visible fixes
- Code suggestion menus now render in top-level overlays so editor/dashboard scroll containers cannot clip them.
- Motion Editor uses a left live-preview workspace and right inspector with Timeline, Actions, Frames and Keyframes.
- Dashboard workspace pages use wider responsive desktop containers.

## Performance changes
- Secondary Dashboard pages are React-lazy loaded.
- Motion Library, Email Builder and Widget Studio UI modules are lazy loaded.
- Built-in Motion list payload uses compact preview summaries; complete built-in timelines are loaded on demand for customization.
- Motion search uses deferred input and cards use `content-visibility`.
- Theme App Extension payload budgets and Prisma hot-path index audits are automated.

## Database
No Prisma schema migration is required.
