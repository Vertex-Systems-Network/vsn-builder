# Milestone K — Developer Mode Guard

VSN Builder v2.5.64 remains in developer mode.

Milestone K adds Developer Studio, GraphQL execution tooling and storefront Global CSS/JavaScript, but it does not imply production readiness or production deployment. Keep these safeguards in place:

- GraphQL Studio is restricted to the store owner until Milestone L action permissions are implemented.
- Mutations require explicit per-run typed confirmation; destructive-looking mutations require an additional DELETE confirmation.
- Global Code changes are revisioned and reversible; permanent deletion is explicitly confirmed.
- Safe Mode must continue to disable Global Code delivery.
- Do not add production billing assumptions, production domains or irreversible production migration behavior without explicit approval.
- Test GraphQL and Global Code against a development store and development database.
