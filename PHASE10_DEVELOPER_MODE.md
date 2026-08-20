# Phase 10 — Developer Mode Notes

Phase 10 is intentionally feature-flagged and uses database heartbeats instead of a production realtime/WebSocket service.

## Enable Phase 10 locally

Set this environment variable before starting the Shopify app:

```bash
VSN_FEATURE_COLLABORATION_REVIEW=true
```

Then apply the included Prisma migration before opening the editor:

```bash
npm run setup
npm run dev
```

## Developer-mode behavior

- Presence refresh: 15-second heartbeat; stale presence is removed after 90 seconds.
- Page locks: 120-second TTL and automatically renewed by the lock owner's heartbeat.
- Review links: tokenized, revocable and 7-day expiry by default.
- Publishing: when Phase 10 is enabled, the user must have Publisher permission and the workflow must be Approved before Publish.
- Existing builder version checks remain the source of truth for optimistic concurrency. Autosave never overwrites a newer server version.
- Feature flag OFF preserves pre-Phase-10 editor/save/publish behavior.

## Production follow-up later

Before production launch, the polling transport can be replaced by a hosted realtime channel if needed. The persisted Phase 10 data model and editor action contract do not require that replacement for developer mode.
