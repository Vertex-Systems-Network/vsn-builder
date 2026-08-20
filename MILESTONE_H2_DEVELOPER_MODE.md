# Milestone H.2 — Developer Mode Guardrail

VSN Builder remains in Developer Mode.

Milestone H.2 corrects the app shell so Dashboard and Builder resources share one persistent application shell, one sidebar and one top navigation. It does not publish themes, change production URLs, or activate paid billing.

## Locked behavior
- One shared VSN Builder sidebar is rendered by the parent `/app` route.
- Dashboard/Home pages render only their page content; they do not create a second navigation shell.
- `/app/pages` and Builder panels render only workspace content; they do not create a second navigation shell.
- The visual editor remains the only intentionally separate full editing surface and opens in `s-app-window`.
- Legacy URLs remain valid for backward compatibility.
