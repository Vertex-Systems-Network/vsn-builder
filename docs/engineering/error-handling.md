# Error Handling Contract

User-facing errors use human language and remediation. Preserve technical details for server logs and System Health.

Recommended structure:
1. What failed.
2. Known cause or likely category.
3. What is unavailable as a result.
4. Exact fix steps.
5. Verification action.

Authentication, Shopify scope, GraphQL, database, migration, upload and external integration failures must be classified rather than rendered as raw stack traces.
