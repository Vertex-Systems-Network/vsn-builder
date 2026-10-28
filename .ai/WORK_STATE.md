# VSN Live Work State

---
schema_version: 1
status: active
mode: implementation
task_key: T033-staging-theme-app-embed
owner_intent: "Make the VSN theme app embed available in the Shopify Staging Theme Editor and verify the merchant-controlled activation path."
base_branch: development
working_branch: fix/staging-theme-embed-version
pull_request: 402 (open)
last_verified_commit: 9c84af627aff1bb8ddb33af32932e5982fb7504f
last_verified_step: "On 2026-10-28, the authenticated Staging Theme Editor showed 'You don't have any apps with embeds installed' and the toast 'App embed does not exist' for the VSN activation deep link. The repository contains the VSN Page Renderer app-embed block (target body), but protected T021 deploys only the Cloudflare Worker via Wrangler and does not publish a Shopify app version. PR #402 adds a protected manual draft-only Shopify app-version workflow; exact-head Repository Integrity, Environment Isolation, Production Confidence, and CodeQL all passed. The policy test passed 3/3 and workflow YAML parsed locally. T023 run #33 succeeded but captured /app/pages only; no /app CPU event was observed."
in_flight_step: "Wait for PR #402 to merge and for the app-scoped Shopify automation token to be configured in the protected cloudflare-staging environment."
next_exact_action: "After PR #402 merges, confirm SHOPIFY_APP_AUTOMATION_TOKEN is available in cloudflare-staging, dispatch the draft workflow on protected development with its exact confirmation, and inspect the unreleased app version. Keep app-version release and merchant theme activation separate from this draft operation."
approval_needed_now: false
updated_at: 2026-10-28
---

## Staging deploy of f4b24e3 — 2026-10-28

- Protected T021 run 47 (https://github.com/Vertex-Systems-Network/vsn-builder/actions/runs/40667781058) deployed exact `development` SHA `f4b24e30f761b5dc4be767f6a6f4a5bcdf46cf56` (PRs #404-#407) to `vsn-builder-staging`. No Prisma changes since the previous Staging SHA `9c84af6`, so no migration or snapshot was needed.
- Hosted probe: `/healthz` 200, `/readyz` 200 (`merchantAppReady`, `shopifyOauthReady`, `persistentSessionsReady`, `merchantRoutesReady` all true).
- Pre-existing, unchanged by this deploy (run 46 on `9c84af6` probed the same): a bare `/app` request without Shopify `shop` params returns 500. T023 tail run 36 shows the Shopify auth layer throwing a 410 that escapes as React Router's plain-text 500; `/app?shop=...` returns the expected 410 HTML. Real Admin traffic always carries `shop`/`host`/`hmac`.
- Not yet certified: Tier 2 exit still needs real Shopify Admin E2E on a Staging test store (install/OAuth, editor save/publish, theme embed, Liquid widget, webhooks, test billing) and a rollback drill. Production promotion stays blocked until that evidence and explicit owner approval exist.

## Owner queue 2 — 2026-10-28 (FIFO, CI-aware)

Working rule for any agent:
- Take the first open item and finish it end to end: code, tests, a browser check, a PR into `development`, and merge when `verify` is green.
- While a PR's CI is running, start the next item on a new commit or PR.
- When that CI finishes, go back to it first (fix or merge), then continue.
- Never wait idle on runners.
- Report to the owner in Roman Urdu.
- Record each item's outcome on its line here: DONE plus the PR link, or BLOCKED plus the reason.

QA method:
- Editor harness in `node_modules/.cache/qa`: build `editor-entry.jsx` with esbuild, serve the page, and drive it with Playwright from the scratchpad.
- SSR sweep `sweep.jsx`: renders every widget × Content/Style/Advanced.
- Compare `node --test tests/*.test.mjs tests/**/*.test.mjs` against the baseline failures before pushing. No new failures are allowed.

1. DONE: **Canvas auto-fit.** The page design fits the visible canvas on load, on window resize and on device switch (desktop/tablet/mobile).
   - Files: `app/components/editor/Canvas.jsx`, `PageEditor.jsx` (zoom/Fit).
   - Done when: no horizontal scroll at 1280, 1440 or 1920 width; Fit is the default zoom; manual zoom is kept until the device changes.
2. DONE: **Show/hide toggles.**
   - Add an eye toggle for each widget, section and the global header/footer, in the Navigator and on the canvas toolbar.
   - Add per-device visibility (desktop/tablet/mobile) in Advanced.
   - Store the state in node props (`hidden`, `hideOn`).
   - The editor shows hidden nodes dimmed. `PreviewRenderer` and the storefront renderer (`builder-proxy.$.jsx`) leave them out, using responsive CSS for per-device hiding.
3. DONE: **Linked/unlinked box controls.**
   - Applies to padding, margin, border-width, border-radius and any other 4-side control.
   - A link toggle sets one value on all sides. Unlinked, top/right/bottom/left are edited separately, each with its own unit (Elementor style).
   - File: `EditorControls.jsx` spacing controls. Keep the stored shape backwards compatible.
4. DONE (round 1; more in item 8): **Editor UI pass.** Inspect every panel at 1280 and 1440, in light and dark mode.
   - Fix overflow, truncation, misaligned controls, inconsistent spacing and broken icons.
   - List every fix in the PR body.
5. **Marketplace templates.**
   - Every built-in template in `app/data/marketplaceCatalog.js` renders correctly: no empty or broken sections, real images or placeholders, responsive columns.
   - The marketplace list and grid views use consistent cards (thumbnail ratio, title, tags, actions) with no layout shift.
6. **Motion library.**
   - Check entrance, scroll and hover animations for wrong behaviour: replays, flicker, wrong origin, not stopping, and differences between editor and storefront.
   - The library preview must match the runtime (`vsn-interactions.js`).
   - Respect `prefers-reduced-motion`.
7. **Global Style Kit (Elementor-like Site Settings).**
   - Global colours: primary, secondary, text, accent and custom colours.
   - Global typography presets: H1–H6, body, button.
   - Global styles for buttons, form fields and images.
   - Layout: content width, gaps, breakpoints.
   - Widgets reference globals by token and update live when the kit changes. The storefront output is the same.
8. **Ongoing deep QA.** After items 1–7, sweep every module for remaining defects. Add each finding here before fixing it.

## Owner queue — 2026-10-28 (strict FIFO, one item finished before the next)

0. DONE when merged: `/readyz` reported tier "staging" on Production (hardcoded label).
1. Editor dark mode styling.
2. Grid layouts on pages no longer render as grids.
3. DONE (PR #412): Preview opens `/preview` in its own tab outside the Shopify admin shell; the editor streams live (unsaved) state to it via same-origin postMessage.
4. DONE (PR #412): 134/138 module audits pass; ecosystem manifest regenerated; remaining 4 are stale source-marker checks (fonts, Trash now in table filter, carousel markers) with working behaviour. Audit every module: options, systems, behaviour, logic.
5. DONE (PR #412): editor loader runs 9 independent DB/Admin reads in parallel instead of serially; client bundles measured (editor 163 KB gzip). App and page load time.
6. DONE (PR #412): SSR sweep of 117 widgets x Content/Style/Advanced + preview renders clean; fixed SDK key-spread and fetchPriority React warnings; storefront buttons no longer stretch full width. Editor UI issues.
7. DONE (PR #412): home builder fragment is cached in an app metafield by the proxy and printed inline by the app embed (Liquid), so it swaps in with zero network requests and no loader; publish clears the cache, 6h TTL; personalised/experiment/localized/dynamic pages keep the live fetch. Storefront: no loader flash — widget output files installed in the theme on activation, content renders with the Shopify page.
8. DONE (PR #412): /app/setup wizard opens on first activation (home redirects until finished or skipped): plan, app embed (verified from settings_data.json), theme files install, first page; one step at a time, each verified against the store. Setup page appears on app activation and walks required steps one by one.

Production went live 2026-10-28 via T041 run 1 (main 74cf6b7): Neon backup branch, migrate deploy, Worker deploy; /healthz and /readyz 200.

## Polaris cards, Liquid widget, editor browser QA and CI runners — 2026-10-28

- Merged into `development`: #404 (palette, storefront carousels), #405 (template device preview), #406 (superseded pull_request runs cancelled across 28 workflows; push runs never cancelled; `tests/ci-runner-concurrency.test.mjs`).
- PR #407: `VsnCard` renders through Polaris `s-section`; the Liquid widget runs on the storefront via an `application/liquid` app-proxy body with all other content inside `{% raw %}` and Safe Mode stripping it (security invariant replaced in P1.6w and `security-audit`, flagged for review); editor fixes from browser QA (safe-centered canvas, VSN-themed editor chrome, Global Styles hint).
- Editor browser QA method: `PageEditor` mounted with a memory router and a marketplace template in Chromium against the built CSS; add/undo/redo, text edit, delete, save, publish confirm, devices, search, preview and Fit all pass with no page errors.
- Verified: full `qa:release` chain passes; `node --test tests/*.test.mjs` has no new failures relative to `development`. Inactive stores have zero features/quotas; paid-guard tests 15/15.
- Still blocked outside the repository: Staging Worker secrets/bindings, Neon Staging, Shopify Partner plan publication and live billing, real Dev/Staging store OAuth E2E, Production approval (Issues #158-#168, #184).

## Metafields palette, storefront carousel fix and template device preview — 2026-10-28

- Branch `claude/eloquent-ride-hp6lsp`, PR #404 into `development` (Tier 1 only; no Staging/Production action).
- Default admin/editor palette now matches vsn-metafields (#625BA8 / #5CC9D7 / #6488C6); Lime stays selectable.
- Storefront bug fixed: Carousel, Slides and Testimonials Carousel were not routed to the slider renderer and rendered empty; `global-section` gained a renderer fallback. CSS-6 audit now reads delegated storefront modules (117/117).
- Marketplace template preview fits its container and offers Desktop/Tablet/Mobile in an iframe at real device width; grid previews honour tablet/mobile columns.
- QA evidence (Node 22): typecheck, lint on touched files, `npm run qa`, full `qa:release` audit chain (after `prisma generate` + `db:prepare`), CSS-1..6. 117-widget storefront render harness: no throws; 8 widgets empty only when their data is absent. `node --test tests/*.test.mjs`: 33 failures, identical set on `development` (need Postgres/Worker client).
- Plan catalog checked: feature/quota tiers consistent; CRO, backups, library, collaboration, developer SDK and enterprise controls enforced server-side.
- Known limitation, not changed: the `liquid` widget prints code as text because page HTML is fetched by JS from the app proxy; executing merchant Liquid needs an `application/liquid` proxy-page architecture and a security review.

## Eight paid plan catalog — 2026-10-26

- Public plan keys and labels: Starter, Solo, Silver, Gold, Business, Platinum, Agency, Scale. No public Free plan; inactive stores receive no entitlement.
- Updated the shared catalog, Partner-handle mapping/legacy aliases, server-side quotas, plan cards and comparison table, worker plan mirror, tests, audits, docs and task manifest.
- Verification on supported Node 22.18.0: `npm run typecheck`, `npm run lint`, `npm run qa`, and 62 focused billing/entitlement tests passed. `git diff --check` passed. Shopify Partner plan publication/pricing is still a required external step; no hosted Staging result is claimed.
- The local `git push` had no credentials; branch/PR updates were published through the connected GitHub integration.
- CI exposed and the PR fixed three stale contract expectations: unknown monthly plan keys, legacy `sliver` normalized to canonical `silver`, and the Q5.1/Q5.3/Q5.5 audit assumptions. Latest exact PR head passed all observed workflows, including T021 artifact dry-run; no hosted Staging deployment has been run.
- Shopify Partner publication and live billing verification for all eight offers remain pending; prices in code are proposed values until Partner configuration is verified.

## Eight-plan quota hardening — 2026-10-27

- Started from protected development SHA `efd6c9b7263e0fa50c2a84e253c1c4f741315483` on `codex/eight-plan-quota-hardening`.
- Added transactional per-shop quota serialization and removed fail-open zero-usage fallbacks. Applied it to page creation, import (including imported section dependencies), duplication, restore, backup restore, onboarding demo seeding, campaigns, floating elements, Marketplace installs, CRO experiment creation/duplication/reactivation, AI generation reservations, and collaboration seats. Backup restore also checks page and marketplace-install capacity. Worker page creation uses the shared quota lock. Marketplace free-tier catalog items now require Starter rather than mapping the catalog label `free` to the inactive billing tier.
- Initial exact-head CI found two gates: `app/routes/app.pages.jsx` exceeded the Milestone G line ceiling by three counted lines, and the Milestone H static audit expected an inline `db.$transaction` call in the import service. Both are corrected: create/duplicate use `createPageWithQuota`, and the audit verifies the shared `withShopQuotaLock` transaction helper. Milestone H passes 39/39 and codebase health passes at 1,214/1,225 lines. On Node 22.18.0, typecheck, QA (429 files; Phase C 112/112), focused billing/plan/Worker tests (27/27), touched-file ESLint, and `git diff --check` pass. Exact-head CI on `afe2882` passed all seven required workflows, including the T021 dry run. PR review is still required before merge; no Staging promotion has occurred.

## Purpose

This file is the live execution cursor for VSN engineering work. It exists so a new AI session can recover the exact work position from the repository without asking the owner to restate prior progress.

`CHECKPOINT.md` records stable verified project state. `WORK_STATE.md` records the current task cursor, including work that may be paused or in progress.

## Silent resume contract

When a user says any equivalent of `continue`, `resume`, `start development`, `carry on`, or gives a new instruction that clearly continues the active task, the AI MUST NOT ask where the previous session stopped if repository evidence can resolve it.

Instead it must:

1. read `.ai/README.md`, this file, and `.ai/CHECKPOINT.md`;
2. inspect current Git branch/status, recent commits, referenced PR/issue and the task-relevant source;
3. compare repository evidence with the fields above;
4. DONE (PR #412): 134/138 module audits pass; ecosystem manifest regenerated; remaining 4 are stale source-marker checks (fonts, Trash now in table filter, carousel markers) with working behaviour. reconcile stale state silently when the answer is recoverable from Git/repository evidence;
5. DONE (PR #412): editor loader runs 9 independent DB/Admin reads in parallel instead of serially; client bundles measured (editor 163 KB gzip). verify whether any `in_flight_step` actually completed before repeating it;
6. DONE (PR #412): SSR sweep of 117 widgets x Content/Style/Advanced + preview renders clean; fixed SDK key-spread and fetchPriority React warnings; storefront buttons no longer stretch full width. continue from `next_exact_action` or the earliest unverified sub-step;
7. DONE (PR #412): home builder fragment is cached in an app metafield by the proxy and printed inline by the app embed (Liquid), so it swaps in with zero network requests and no loader; publish clears the cache, 6h TTL; personalised/experiment/localized/dynamic pages keep the live fetch. ask the owner only when a genuinely material product/security/data-loss decision cannot be resolved from repository evidence.

Conversation memory is never required for resume.

## Two-phase work cursor

For every non-trivial implementation step, update this file using two phases whenever repository writes are available.

### Before execution

Set:

- `status: active`;
- `in_flight_step` to one precise action;
- the expected evidence that would prove completion in the notes below when useful;
- `next_exact_action` to the recovery action if the session stops during that step.

This creates a recoverable intent marker before the risky or multi-file operation starts.

### After verification

Only after inspecting the result:

- move the completed action into `last_verified_step`;
- update `last_verified_commit` when a commit exists;
- clear `in_flight_step` to `none`;
- set the next precise action;
- record validation results or failures in `CHECKPOINT.md` when they are durable/significant.

If a session dies between the two phases, the next AI must inspect whether the intended operation landed. It must never assume success and must never blindly execute the step twice.

## Update cadence

Update the live cursor at least:

- when starting a new meaningful task;
- before a destructive, high-impact, long-running or multi-file operation;
- after each coherent implementation unit is verified;
- after a test/build/migration/deployment result materially changes what should happen next;
- when switching branches or PRs;
- before an intentional handoff/pause;
- when blocked by an external dependency or required human approval.

Do not update it for every keystroke or trivial local edit.

## Recovery rules

- Repository state and tests override this file when they disagree.
- Never resume from a stale SHA without checking current branch history.
- Never overwrite uncommitted or collaborator changes just to restore the recorded cursor.
- If the recorded branch was merged, continue from current target branch and preserve the historical task reference.
- If the recorded PR was closed without merge, determine whether the task was superseded before reviving it.
- If an `in_flight_step` changed external state, verify idempotency and actual remote state before retrying.
- If tests previously failed, do not treat them as passed merely because the next session started later.
- If a task is fully complete, set `status: complete`, clear `in_flight_step`, and set `next_exact_action` to the next roadmap item or `none`.

## Current state

**2026-10-26:** PR #384 wired the full React Router app to the Staging Worker; PR #385 repaired the protected deploy config guard; PR #386 added safe session persistence reason codes. All three are merged to protected `development`, and T021 run #34 deployed `45e9d41b342721f3ccce8a10f81512d1d90c9a6a` to Staging. Live Shopify Admin showed the full navigation and plan catalog, but repeat opens/navigation failed intermittently. Protected T023 run #21 recorded Cloudflare invocation outcome `exceededCpu`, which is the current blocker. Production remains untouched.

**2026-10-26 billing follow-up:** PR #391 at `02ecff5a5dadcf1666ae7d73e8d959851820d827` is merged and its T021 run #39 passed. Live Staging now loads Dashboard and Plans & License; forced billing refresh says `Shopify subscription status verified.` The current subscription is `canceling` through 2026-11-24, while entitlements remain fail-closed with 0 pages and source `production-unrecognized-paid-contract`. Shopify hosted App Pricing confirms subscription expiration on 2026-11-24. A Tier-1 branch `fix/staging-plan-handle-diagnostic` now preserves one syntactically safe unmapped Partner API plan handle and surfaces it on Plans & License without granting access. Focused tests passed under Node 24, but the repository rejects Node 24; `npm ci` stopped at its runtime guard and ESLint/typecheck/full local QA are NOT VERIFIED. Continue only after supported Node 22.18+ is available; no PR or additional Staging deployment yet. Production untouched.

Historical note (2026-09-18):

The documentation operating-system task is complete once this reconciled PR lands on `main`. The previous runtime-alignment implementation task is also complete and validated independently.

Future engineering should start from current `main` on a fresh feature branch, verify repository state, and continue from the earliest uncompleted roadmap item. Do not revive the completed Node-runtime remediation or use this historical docs branch for product implementation.
