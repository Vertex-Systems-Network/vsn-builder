# Resource Packages

Milestone H defines two content sources and two portable package contracts.

## Source ownership

### My Library
Merchant-owned reusable resources. UI and mutations must query `BuilderLibraryItem.source = "local"`.

### Marketplace
VSN-supplied or remote catalog resources. Marketplace catalog IDs, versions, installs and rollback state remain Marketplace concerns. Never present supplied catalog entries as merchant-created My Library resources.

## Library resource package

Current format: `vsn-resource-package`, version `4`.

An export contains a manifest, normalized resources, dependency inventory and checksum. Import follows:

1. Parse and validate.
2. Inspect supported resource kinds.
3. Verify checksum when present.
4. Report dependency summary.
5. Report naming/source conflicts.
6. Ask for Copy, Skip or Replace behavior.
7. Resolve destination IDs.
8. Remap internal references.
9. Persist in one database transaction.
10. Roll back the transaction on failure.

Do not mutate the database during the inspection step.

## Page package

Current format: `vsn-page-package`, version `3`.

Page packages include referenced reusable sections. Imports remap `global-section` references to newly-created or resolved section IDs and create a draft/local copy transactionally.

## Backwards compatibility

Importers may accept older known package shapes, but exporters always emit the current format. Never silently discard an unsupported dependency; surface a readable import warning or validation failure.
