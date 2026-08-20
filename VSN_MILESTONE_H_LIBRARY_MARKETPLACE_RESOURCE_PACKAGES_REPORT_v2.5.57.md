# VSN Milestone H — Library, Marketplace & Resource Packages

Version: **2.5.57**  
Mode: **Developer Mode**

## Purpose
Milestone H separates merchant-owned reusable content from VSN-supplied catalog content and replaces ad-hoc template JSON transfer with versioned, inspectable resource packages.

## Saved Library
- Saved Library now represents merchant-owned local resources only.
- Legacy VSN starter/default rows are retired from Saved Library.
- Merchant resources keep search, favorites, trash, restore, permanent-delete consent, pagination and visual previews.

## Marketplace
- VSN starter pages and sections are supplied through Marketplace.
- Existing built-in and optional remote catalogs remain supported.
- Marketplace favorites, installs, updates and rollback remain independent from My Library navigation.
- Installed Marketplace resources stay addressable by the Marketplace source instead of being presented as merchant-created templates.

## Editor Template Browser
- My Library and Marketplace are separate top-level sources.
- Each source has independent filters, favorites and pagination.
- Marketplace items require install/update before editor insertion when appropriate.
- Nothing is silently merged into merchant-owned My Library.

## Resource Package v4
Library exports use `vsn-resource-package` version 4 with:
- manifest metadata;
- normalized resources;
- dependency inventory;
- content checksum;
- conflict inspection before import;
- Copy / Skip / Replace conflict policy;
- internal ID remapping;
- transactional database import and rollback on failure.

Legacy library export formats remain readable for backwards compatibility.

## Page Package v3
Page export/import uses `vsn-page-package` version 3. Reusable section dependencies are bundled and remapped during transactional import. Imported pages remain drafts/copies and are not automatically published.

## Plans
Dashboard Pricing Plans remains the single authoritative plan/billing screen. Builder contains usage information and links back to that Dashboard screen.

## Database
Milestone H reuses existing Marketplace and Library models. No Prisma schema migration is required. Packaged developer SQLite is cleaned of legacy VSN default-library rows without modifying merchant-owned local resources.
