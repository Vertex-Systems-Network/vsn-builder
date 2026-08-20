# Q6.3.2 Developer Mode

Q6.3.2 expands Stock Images into a provider-aware Stock Media system without changing Shopify billing, plan handles, subscriptions or production URLs.

Developer Mode remains safe:

- no provider secrets are bundled in the package;
- provider API calls require saved/env credentials;
- Shopify file writes require an authenticated store and `write_files` scope;
- Stock Audio remains disabled until Freesound commercial API permission/license is explicitly confirmed;
- no new Prisma migration is introduced in this milestone;
- exact Shopify plan handles remain `free`, `sliver`, `gold`, `platenium`.
