# VSN Phase 14 Runtime Stabilization — v2.5.51

Developer-mode stabilization release based on v2.5.50. No production deployment assumptions were introduced.

## Runtime fixes

1. Replaced the Builder workspace's secondary React Router panel loader fetcher with an abortable, generation-scoped native JSON loader. This prevents a panel refresh from re-entering the whole Pages route loader and removes the render/update loop that could leave every Builder screen loading.
2. Builder lazy-panel mutations submit directly to their real route and `app.pages` opts out of full workspace revalidation for those actions.
3. Font and SVG uploads keep multipart transport, client/server validation, readable errors, one-time panel refresh, and live registry-change events. Typography can refresh custom fonts without reopening the editor; an already-open SVG picker can refresh its managed VSN assets.
4. Marketplace favorites use a per-item pending action instead of applying `loading` to every grid card. Marketplace pagination is fixed at 24 items/page with Previous/Next and filter reset.
5. Saved Library previews now render behind an error boundary in static-preview mode. Thumbnail previews do not run Custom JS, interaction runtime, or SDK mount/unmount hooks, so one malformed/legacy template cannot crash Library pagination.
6. Pages list/grid Edit controls are buttons that call the existing `s-app-window` workflow directly. They no longer rely on top-frame anchor navigation.
7. Async file-picker handlers now await the caller so validation/processing failures reach the screen-scoped VSN error notice instead of becoming unhandled promises.

## Versioning

- Version: 2.5.51
- Milestone: D
- Phase: 14
- Schema versions: unchanged
- Prisma migration: none required
- Developer mode: ON
