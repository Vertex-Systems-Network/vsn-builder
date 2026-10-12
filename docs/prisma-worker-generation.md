# Cloudflare Worker Prisma Client — separate generator (not deployed)

The **single** `prisma/cloud/schema.prisma` now defines two isolated generators over the same 51 PostgreSQL models:

- `client` → `generated/prisma-cloud/`, existing native Prisma Node client for **offline/ephemeral GitHub CI** migration and backup/restore tests.
- `workerClient` → `generated/prisma-worker/`, `engineType="client"` (Rust-free, intended for Cloudflare Worker runtime).

Both outputs are gitignored and `@prisma/client` remains the Local SQLite client. Schema certification generates both, validates the same 51 tables, and checks that the Worker client cannot initialize without a driver adapter. It does **not** install a Neon driver adapter, connect to Neon, port Shopify Node session storage, replace Node SSR streams, or deploy anything.

The intended runtime adapter is `@prisma/adapter-neon@6.19.3` with a Neon serverless driver for the existing Prisma ORM 6.19.3 (per Prisma v6's Cloudflare guidance). The adapter + Worker Shopify/Web API integration, session management, Cloudflare Vite plugin, and signed merchant auth must be implemented and tested **before** Worker deployment. A green generator CI is not a working Shopify Worker app.
