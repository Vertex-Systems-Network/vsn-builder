import { useEffect } from "react";
import { useFetcher, useLoaderData, useRevalidator } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import { inspectThemeEmbedStatus } from "../services/theme-embed-status.server.js";
import { rebuildThemeAssets } from "../services/theme-assets.server.js";
import { paidMutationDenied } from "../services/paid-mutation-guard.server.js";
import { canAccessBuilderAction } from "../utils/builder-permissions.server.js";

// First-run setup shown on app activation: required steps one at a time,
// each verified against the store (not just ticked by the merchant).
function parse(value, fallback = {}) { try { return JSON.parse(value || "") || fallback; } catch { return fallback; } }
async function loadState(shop) { const row = await db.builderShopSetting.findUnique({ where: { shop } }); return parse(row?.onboardingJson, {}); }
async function saveState(shop, next) {
  const onboardingJson = JSON.stringify(next);
  await db.builderShopSetting.upsert({ where: { shop }, create: { shop, onboardingJson }, update: { onboardingJson } });
  return next;
}


async function assetPipelineReady(admin) {
  try {
    const response = await admin.graphql(`#graphql
      query VsnSetupAssets { currentAppInstallation { metafield(namespace: "vsn_page_builder", key: "asset_pipeline_ready") { value } } }
    `);
    const result = await response.json();
    return result.data?.currentAppInstallation?.metafield?.value === "true";
  } catch { return false; }
}

const REQUIRED_STEPS = ["plan", "embed", "assets"];

async function loadSteps(admin, session, state = {}) {
  const [embed, assetsReady, subscription, pageCount] = await Promise.all([
    inspectThemeEmbedStatus(admin, session),
    assetPipelineReady(admin),
    db.builderSubscription.findUnique({ where: { shop: session.shop } }).catch(() => null),
    db.builderPage.count({ where: { shop: session.shop, deletedAt: null, template: { notIn: ["header", "footer", "section"] } } }).catch(() => 0),
  ]);
  return [
    { key: "plan", title: "Choose a plan", done: Boolean(subscription), description: "Plan limits decide how many published templates and premium widgets you can use. Free works to get started.", detail: subscription ? `Current plan: ${subscription.planKey}` : "", actionHref: "/app?view=pricing", actionLabel: "View plans" },
    { key: "embed", title: "Turn on the VSN app embed", done: embed.active === true, description: "Builder pages, Liquid widgets and inline prerendered content load through the VSN Page Renderer app embed in your live theme.", detail: embed.themeName ? `Live theme: ${embed.themeName}` : "", actionUrl: embed.editorUrl, actionLabel: "Open theme editor" },
    { key: "assets", title: "Install theme files", done: assetsReady, description: "Writes the compiled CSS/JS for your published templates into the live theme so content renders with the Shopify page.", intent: "build-assets", actionLabel: "Install theme files" },
    { key: "page", title: "Create your first page", optional: true, done: pageCount > 0 || state.pageStepDone === true, description: "Start from a template or a blank canvas, then publish when it is ready.", actionHref: "/app/pages", actionLabel: "Create a page" },
  ];
}

export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);
  let state = await loadState(session.shop);
  const steps = await loadSteps(admin, session, state);
  // Remember once the required steps are done so the app stops sending the merchant here.
  const requiredDone = steps.filter((step) => REQUIRED_STEPS.includes(step.key)).every((step) => step.done);
  if (requiredDone !== (state.requiredStepsComplete === true)) state = await saveState(session.shop, { ...state, requiredStepsComplete: requiredDone });
  return { state, steps };
}

export async function action({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") || "");
  const state = await loadState(session.shop);
  if (intent === "build-assets") {
    const paidDenial = await paidMutationDenied(db, session.shop); if (paidDenial) return paidDenial;
    if (!(await canAccessBuilderAction(db, session, "pages", "publish"))) return Response.json({ ok: false, intent, error: "Your role cannot install theme files." }, { status: 403 });
    const result = await rebuildThemeAssets({ admin, session, db }).catch((error) => ({ success: false, error: error instanceof Error ? error.message : "Theme file install failed." }));
    return Response.json({ ok: result?.success === true, intent, message: result?.success ? "Theme files installed." : "", error: result?.success ? "" : result?.error || "Theme file install failed." });
  }
  if (intent === "mark-page") {
    const next = await saveState(session.shop, { ...state, pageStepDone: true });
    return Response.json({ ok: true, intent, state: next });
  }
  if (intent === "skip") return Response.json({ ok: true, intent, redirect: "/app?setup=later" });
  if (intent === "finish") {
    const next = await saveState(session.shop, { ...state, setupCompleted: true, setupFinishedAt: new Date().toISOString() });
    return Response.json({ ok: true, intent, state: next, redirect: "/app" });
  }
  return Response.json({ ok: false, error: "Unsupported setup action." }, { status: 400 });
}

export default function Setup() {
  const { steps } = useLoaderData();
  const fetcher = useFetcher();
  const revalidator = useRevalidator();
  const currentIndex = steps.findIndex((step) => !step.done);
  const allDone = steps.every((step) => step.done || step.optional);
  const doneCount = steps.filter((step) => step.done).length;
  useEffect(() => {
    if (!fetcher.data?.redirect) return;
    const target = new URL(fetcher.data.redirect, window.location.origin);
    new URLSearchParams(window.location.search).forEach((value, key) => { if (!target.searchParams.has(key)) target.searchParams.set(key, value); });
    window.location.assign(target.pathname + target.search);
  }, [fetcher.data]);
  useEffect(() => { if (["build-assets", "mark-page"].includes(fetcher.data?.intent)) revalidator.revalidate(); }, [fetcher.data]); // eslint-disable-line react-hooks/exhaustive-deps
  // Coming back from the theme editor (another tab or the same window) re-checks the store.
  useEffect(() => {
    const recheck = () => { if (document.visibilityState === "visible" && revalidator.state === "idle") revalidator.revalidate(); };
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => { window.removeEventListener("focus", recheck); document.removeEventListener("visibilitychange", recheck); };
  }, [revalidator]);

  return <s-page heading="Set up VSN Builder">
    <s-stack direction="block" gap="base">
      {fetcher.data?.error ? <s-banner tone="critical">{fetcher.data.error}</s-banner> : null}
      {fetcher.data?.message ? <s-banner tone="success">{fetcher.data.message}</s-banner> : null}
      <s-section>
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-text color="subdued">{doneCount} of {steps.length} steps complete</s-text>
          <s-button variant="tertiary" onClick={() => revalidator.revalidate()} disabled={revalidator.state !== "idle"}>Check again</s-button>
        </s-stack>
        <s-box background="subdued" borderRadius="base" overflow="hidden" blockSize="8px"><div style={{ height: "100%", width: `${Math.round((doneCount / steps.length) * 100)}%`, background: "var(--vsn-e-green, #008060)" }} /></s-box>
      </s-section>
      {steps.map((step, index) => {
        const current = index === currentIndex;
        const locked = !step.done && !current;
        return <s-section key={step.key} heading={`${index + 1}. ${step.title}`}>
          <s-stack direction="block" gap="small-200">
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <s-badge tone={step.done ? "success" : current ? "info" : "neutral"}>{step.done ? "Done" : current ? "Current step" : "Up next"}</s-badge>
              {step.optional ? <s-badge>Optional</s-badge> : null}
              {step.detail ? <s-text color="subdued">{step.detail}</s-text> : null}
            </s-stack>
            {current ? <>
              <s-paragraph>{step.description}</s-paragraph>
              <s-stack direction="inline" gap="small-200">
                {step.intent ? <s-button variant="primary" disabled={fetcher.state !== "idle"} onClick={() => fetcher.submit({ intent: step.intent }, { method: "post" })}>{fetcher.state !== "idle" ? "Working…" : step.actionLabel}</s-button> : null}
                {step.actionUrl ? <s-button variant="primary" href={step.actionUrl} target="_top">{step.actionLabel}</s-button> : null}
                {step.actionHref ? <s-button variant="primary" href={step.actionHref}>{step.actionLabel}</s-button> : null}
                {step.optional
                  ? <s-button onClick={() => fetcher.submit({ intent: "mark-page" }, { method: "post" })}>Mark as complete</s-button>
                  : <s-button onClick={() => revalidator.revalidate()} disabled={revalidator.state !== "idle"}>{revalidator.state !== "idle" ? "Checking…" : "Check again"}</s-button>}
              </s-stack>
            </> : locked ? <s-text color="subdued">Complete the previous step first.</s-text> : null}
          </s-stack>
        </s-section>;
      })}
      <s-stack direction="inline" gap="small-200" justifyContent="end">
        {!allDone ? <s-button variant="tertiary" onClick={() => fetcher.submit({ intent: "skip" }, { method: "post" })}>Skip setup for now</s-button> : null}
        <s-button variant="primary" disabled={!allDone || fetcher.state !== "idle"} onClick={() => fetcher.submit({ intent: "finish" }, { method: "post" })}>Finish setup</s-button>
      </s-stack>
    </s-stack>
  </s-page>;
}
