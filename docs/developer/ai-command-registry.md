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

## Registry v1

| Command | Kind | Permission | Direct execution |
| --- | --- | --- | --- |
| `page.read` | read | `pages:view` | yes |
| `element.update-props` | draft mutation | `pages:edit` | yes |
| `element.update-styles` | draft mutation | `pages:edit` | yes |
| `element.remove` | draft mutation | `pages:edit` | yes |
| `page.publish` | consequential | `pages:publish` | no |

The three element mutation commands operate on one element at a time. They cannot replace the complete page document, change element IDs/types/children through a patch, or write published content.

## Concurrency and undo

Every draft mutation requires the page's current `baseVersion`. The command transaction compares that version before writing and uses a version-qualified update. If another editor changed the page, the command returns `AI_COMMAND_STALE_VERSION`.

Before a mutation, VSN stores an `ai-command-undo` revision. After the mutation it stores an `ai-command` revision linked to the undo snapshot. The command result exposes the undo revision ID as metadata for a future explicit restore workflow.

## Consequential actions

`page.publish` is intentionally present in the registry metadata so orchestration can reason about its permission and approval class. Direct execution returns `AI_COMMAND_EXPLICIT_APPROVAL_REQUIRED`.

Publishing continues through the existing authenticated editor route, collaboration checks, Shopify writes, and theme asset rebuild path. P0.3 does not create a model-to-Shopify mutation path.

## Route

The authenticated `/app/ai-command` route exposes registry metadata through its loader and accepts bounded JSON command requests through its action. The route is protected by the existing AI Builder feature flag, Shopify admin authentication, trusted-mutation checks, role permissions, payload limits, and the command registry validators.
