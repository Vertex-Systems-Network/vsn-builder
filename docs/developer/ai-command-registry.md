# AI command registry

The AI command registry is the server-side boundary between AI-assisted intent and builder mutations.

## Principles

- AI does not mutate Prisma records or Shopify resources directly.
- Every executable AI command resolves through a named registry entry.
- Authorization uses the existing VSN role/action permission model.
- Page mutations require an exact `baseVersion` and fail closed when stale.
- When Collaboration & Review is enabled, draft commands honor the same collaboration save permission and active page lock as the visual editor.
- Draft mutations run through `runBuilderCommand`, so the mutation and command audit event share one database transaction.
- Each draft mutation creates an undo revision before the change and an applied AI revision after it.
- Consequential operations are typed but are not directly executable by AI.

## Registry v2

| Command | Kind | Permission | Direct execution |
| --- | --- | --- | --- |
| `page.read` | read | `pages:view` | yes |
| `element.insert` | draft mutation | `pages:edit` | yes |
| `element.move` | draft mutation | `pages:edit` | yes |
| `element.rewrite` | draft mutation | `pages:edit` | yes |
| `element.update-props` | draft mutation | `pages:edit` | yes |
| `element.update-styles` | draft mutation | `pages:edit` | yes |
| `element.remove` | draft mutation | `pages:edit` | yes |
| `revision.restore` | draft mutation | `pages:edit` | yes |
| `page.publish` | consequential | `pages:publish` | no |

Draft element commands operate through the canonical tree helpers and bounded sanitizers. Insert is restricted to the AI-safe widget allowlist. Move rejects invalid/cyclic placement. Rewrite and patch fields reject executable/template syntax. Builder system nodes (`global-styles`, `template-settings`) cannot be mutated or used as Agent placement anchors. Patch commands cannot change element IDs/types/children or write published content.

`revision.restore` is tenant/page scoped and restores an existing checkpoint through the same versioned draft-mutation path, so restore itself is also revision-backed and auditable.

## Concurrency and undo

Every draft mutation requires the page's current `baseVersion`. The command transaction compares that version before writing and uses a version-qualified update. If another editor changed the page, the command returns `AI_COMMAND_STALE_VERSION`.

Before a mutation, VSN stores an `ai-command-undo` revision. After the mutation it stores an `ai-command` revision linked to the undo snapshot. The command result exposes the undo revision ID as metadata for a future explicit restore workflow.

## Consequential actions

`page.publish` is intentionally present in the registry metadata so orchestration can reason about its permission and approval class. Direct execution returns `AI_COMMAND_EXPLICIT_APPROVAL_REQUIRED`.

Publishing continues through the existing authenticated editor route, collaboration checks, Shopify writes, and theme asset rebuild path. P0.3 does not create a model-to-Shopify mutation path.

## Route

The authenticated `/app/ai-command` route exposes registry metadata through its loader and accepts bounded JSON command requests through its action. The route is protected by the existing AI Builder feature flag, Shopify admin authentication, trusted-mutation checks, role permissions, payload limits, and the command registry validators.
