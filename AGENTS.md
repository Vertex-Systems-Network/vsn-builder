# AI Agent Entry Contract

Repository/runtime evidence is authoritative. Read repository-local state, plans, and security/governance instructions before material work.


## VSN organization next-action handoff

Before every user-facing development handoff, read and follow `.ai/NEXT-ACTION-OPTIONS.md`.

If the user sends only this repository's GitHub URL, perform the policy's read-only bootstrap and return shuffled numbered next-action options. A URL-only message never authorizes a repository mutation. A later numeric selection must revalidate live repository state before acting.

## Development → Staging → Production promotion

All work MUST follow `.ai/ENVIRONMENT-PROMOTION.md`: Local/Development (Node + SQLite, PR into `development`) → Staging (Cloudflare Worker + Neon Staging, same certified SHA) → Production (same SHA, explicit owner approval). No tier may be skipped; missing evidence or infrastructure fails closed at the last passing tier.
