# Milestone F — Developer Mode Guardrails

VSN remains in Developer Mode for Milestone F.

- Extend the existing VSN visual language. Use Shopify/Polaris primitives only where they naturally match the established VSN workspace UI.
- Keep Dashboard/workspace and Editor visual profiles distinct; they may share behavior/contracts but not density or canvas-specific styling.
- Do not make production billing, deployment, theme activation, or irreversible merchant-data assumptions.
- Permanent destructive actions require explicit VSN confirmation. Reversible Trash actions remain reversible.
- Do not reset or wipe Prisma data to resolve a warning. Diagnose migrations and permissions first.
- Background collaboration/network work should pause when the document is hidden where practical.
- New reliability work must preserve Phase 0–16 schemas and existing storefront renderer behavior.
