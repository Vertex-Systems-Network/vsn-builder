# Security Standard

Treat uploaded SVG/HTML/code, URLs, plugin descriptors and webhooks as untrusted input. Validate/sanitize at the server boundary even when the editor already validates. Do not expose secrets in backups, System Health exports or client loader data. Custom JS, plugin network access and GraphQL mutation tooling must remain permission-gated.
