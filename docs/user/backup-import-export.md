# Backups, Import & Export

Back up before schema/package changes. Resource packages carry a manifest, dependencies and hashes. Import uses validation/conflict handling; restore preserves tenant ownership and current schema rules.

## Checklist

- Confirm the relevant VSN permission.
- Test loading, empty and error states.
- Validate light/dark UI where applicable.
- Run System Health if Shopify/API data is unavailable.
- Preview before publishing or enabling storefront behavior.
