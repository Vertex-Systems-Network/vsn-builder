# Phase 15 Developer Mode

VSN Builder v2.5.53 keeps Phase 15 developer-safe.

- Enterprise hardening settings are store-scoped and reversible.
- Safe Mode disables Builder custom JavaScript and generated custom-JS theme assets after the asset rebuild.
- Environment promotion is a dry-run readiness manifest only; it does not deploy or mutate another environment.
- Production application/auth URLs remain unchanged while the project is in Developer Mode.
- Health/audit exports are sanitized and do not expose secrets.
- Theme asset optimization controls may require `read_themes` + `write_themes` to rebuild generated assets.
- The Phase 15 feature flag is `VSN_FEATURE_ENTERPRISE_HARDENING`.
