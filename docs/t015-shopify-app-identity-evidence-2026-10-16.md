# T015 — Shopify Builder app identity: authenticated store evidence (2026-10-16)

This is **read-only Shopify Admin GraphQL evidence**, not Partner Dashboard ownership certification, a new registration or OAuth acceptance. It supersedes the prior conclusion that only the ChatGPT connector application was identifiable: that was merely the **current connected application**, while `appByKey`, `appByHandle` and `appInstallations` can independently inspect other Builder apps.

| Purpose | Shopify app ID | Actual app display title | Handle | Evidence |
| --- | --- | --- | --- | --- |
| ONE eventual public Live app | `gid://shopify/App/403624132609` | VSN Builder | `vsn-page-builder` | Public client_id in root `shopify.app.toml` matches Admin `appByKey` on all three stores; Live test-store installation confirmed |
| Internal Staging app (no second public listing) | `gid://shopify/App/434691211265` | VSN \| Builder (Staging) | `vsn-builder-staging` | Admin `appByHandle` and installed on the Staging test store |
| Internal Development app (no third public listing) | `gid://shopify/App/434688425985` | VSN Builder (Development) | `vsn-builder-development` | Admin `appByHandle` exists, but **not installed** in Development store |

Read-only inventory:
- Development store `local-testing-iashboek.myshopify.com` has no Builder app installation in its unpaginated `appInstallations(first:50)` result (`hasNextPage=false`).
- Staging store `staging-oath3rth.myshopify.com` has `VSN | Builder (Staging)` installed, `gid://shopify/AppInstallation/1034282500468`. Its `Horizon` theme is present but unpublished.
- Production TEST store `vertex-systems-network.myshopify.com` has the canonical `VSN Builder` app installed, `gid://shopify/AppInstallation/650088480877`. This is **not** evidence that the public Shopify App Store listing has been published.
- All three `App.developerName` fields report `Vertex Systems Network`; **Partner organization legal ownership is not proved** by this display string.
- All three `appStoreAppUrl` reads were `null` and **no one** asserted a published App Store listing.
- The actual Shopify app names for Live/Development presently differ from the desired `VSN | Builder` format. Title changes would require authorized Partner actions; none were made.

**Code-policy defect resolved on integration branch:** Old source treated `shopify.app.toml` client ID as an unclassified development app and **rejected the real verified Live Builder identity**. The source root app is, in fact, the canonical ONE intended public Builder app. Tier isolation now requires Production to match that identity while keeping internal Dev and Staging distinct. `shopify.app.*.template.toml` files retain nondeployable placeholders; actual identifiers should come from protected environment inputs. The readiness workflow now forwards all three tier IDs and Neon/Worker identity variables to the existing no-deploy check.

**Required before T015 final closure:**
1. Authenticated VSN Shopify Partner organization ownership and whether the canonical Builder app is the sole public listing (not inferred from `developerName`).
2. Actual verified Dev app install/OAuth and safe Staging/Live stable callback URLs (current repository configs include explicit placeholders).
3. Verified Staging test billing on and Live test billing off, including real Partner and environment credentials; **no transaction or plan charge was made**.

This evidence closes important **identity discovery and source-contract repair subtasks**, not full T015 acceptance. Shopify SDK connector was never used to mutate, install, publish or submit an app.
