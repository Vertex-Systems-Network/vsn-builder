# Reference Fidelity Pipeline

P1.4 separates reference understanding from page generation so screenshot and URL inspiration can be transformed into bounded VSN guidance before a page plan is produced.

## Runtime flag

`VSN_FEATURE_REFERENCE_FIDELITY=false` is the independent kill switch. It is OFF by default.

When the flag is OFF, AI Builder screenshot and URL operations use the existing single-phase behavior unchanged.

When the flag is ON, only `screenshot` and `url` operations use the two-phase reference path:

1. AI Builder reserves the normal single request quota row.
2. The bounded P1.4a reference analyzer extracts hierarchy, visual tokens, asset roles, responsive hints and fidelity priorities.
3. URL source text is obtained through the existing bounded DNS-pinned public-target fetch path. Screenshot input remains bounded base64 image data.
4. The reference analyzer runs internally with separate quota reservation disabled.
5. Only normalized reference analysis is supplied to the final page-generation phase. Raw screenshot data and raw URL source text are not sent again in that phase.
6. Reference-analysis and page-generation token counts are aggregated into the one Builder usage row.
7. The response includes the bounded normalized analysis plus deterministic `semantic-structural-v1` fidelity metadata with `notPixelScore: true`.

## Safety boundary

Reference content is always untrusted model data. The pipeline transforms hierarchy, layout intent and token patterns rather than copying source HTML, CSS, JavaScript, Liquid, logos, artwork or long text.

P1.4b does not add page persistence, publishing, command execution, Shopify Admin mutations, a Prisma migration or a live Figma API. Existing Builder validation remains authoritative for generated VSN nodes.

If reference analysis fails while the flag is ON, the request fails rather than silently bypassing the reference layer. This keeps the enabled path explicit and auditable.

## Figma

Structured Figma ingestion remains deferred. It should only be enabled after a hierarchy-preserving adapter can be verified independently of screenshot inference.
