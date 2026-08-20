# Milestone N.2 — Developer Mode

Milestone N.2 adds the visual Email Editor and dynamic binding authoring layer while keeping production sending disabled.

The editor uses the existing `BuilderEmailTemplate` persistence model. No new migration is required. Preview may read non-sensitive shop/product/order sample data through the authenticated Admin GraphQL client when the current app scopes allow it. Customer, discount, campaign and form values remain safe preview samples until a real send/event context exists.

Production ESP delivery, inbox-provider screenshot rendering and campaign sending remain disabled for Developer Mode.
