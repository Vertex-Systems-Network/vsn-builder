# Migration Standard

Database changes require Prisma migrations. Persisted VSN document structures require schema-version migrations. Migrations must be backward-compatible where possible, idempotent where designed for repeated reads, and covered by old-page/revision tests. Never edit historical migrations after release.
