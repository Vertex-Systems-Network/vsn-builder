import { Form, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import { applyExperimentVariant } from "../services/experiment-engine.server.js";
import { experimentVariantStats, EXPERIMENT_GOAL_TYPES, EXPERIMENT_TARGET_TYPES } from "../builder/experimentSystem.js";
import { migrateBuilderContent } from "../builder/schemaMigrations.js";
import { rebuildThemeAssets } from "../services/theme-assets.server.js";
import { builderActor } from "../utils/builder-permissions.js";
import { getPlan, getPlanUsage } from "../utils/plan.server.js";
import { getFeatureDecision, getQuotaDecision } from "../services/entitlements.server.js";

function safeJson(value, fallback = []) { try { const parsed = JSON.parse(value || "[]"); return parsed ?? fallback; } catch { return fallback; } }
function findNode(nodes, id) { for (const node of Array.isArray(nodes) ? nodes : []) { if (String(node?.id || "") === String(id || "")) return node; const nested = findNode(node?.children || [], id); if (nested) return nested; } return null; }
function pct(value) { return `${(Math.max(0, Number(value || 0)) * 100).toFixed(2)}%`; }
function money(value, currency = "") { return `${Number(value || 0).toFixed(2)}${currency ? ` ${currency}` : ""}`; }
function nextVariantKey(variants = []) { const used = new Set((variants || []).map((v) => String(v.key || "").toUpperCase())); for (let i = 1; i < 26; i += 1) { const key = String.fromCharCode(65 + i); if (!used.has(key)) return key; } return `V${variants.length + 1}`; }

async function snapshotForVariant({ shop, pageId, targetType, targetNodeId }) {
  const page = await db.builderPage.findFirst({ where: { id: pageId, shop, deletedAt: null } });
  if (!page) throw new Error("Variant source page was not found.");
  const content = migrateBuilderContent(safeJson(page.publishedJson || page.contentJson, []));
  if (targetType === "page") return JSON.stringify(content);
  const node = findNode(content, targetNodeId);
  if (!node) throw new Error(`Source node ${targetNodeId || "(blank)"} was not found on ${page.title}.`);
  return JSON.stringify(node);
}

async function experimentRows(shop) {
  const experiments = await db.builderExperiment.findMany({ where: { shop }, orderBy: { updatedAt: "desc" }, take: 100 });
  const rows = [];
  for (const experiment of experiments) {
    const [variants, assignments, events] = await Promise.all([
      db.builderExperimentVariant.findMany({ where: { experimentId: experiment.id }, orderBy: [{ isControl: "desc" }, { createdAt: "asc" }] }),
      db.builderExperimentAssignment.findMany({ where: { shop, experimentId: experiment.id }, take: 200000 }),
      db.builderExperimentEvent.findMany({ where: { shop, experimentId: experiment.id }, take: 500000 }),
    ]);
    rows.push({ ...experiment, variants, metrics: experimentVariantStats({ experiment, variants, assignments, events }) });
  }
  return rows;
}

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const plan = await getPlan(db, session.shop);
  const [experiments, pages, usage] = await Promise.all([
    experimentRows(session.shop),
    db.builderPage.findMany({ where: { shop: session.shop, deletedAt: null, status: "published", template: { notIn: ["header", "footer", "section", "popup", "modal", "drawer", "flyout", "announcement-overlay", "floating-element"] } }, orderBy: { updatedAt: "desc" }, select: { id: true, title: true, template: true, handle: true, shopifyPageUrl: true } }),
    getPlanUsage(db, session.shop, plan),
  ]);
  return { experiments, pages, shop: session.shop, plan: {key:plan.key,name:plan.name,croExperiments:plan.croExperiments}, usage };
}

export async function action({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") || "");
  const experimentId = String(form.get("experimentId") || "");
  const actor = builderActor(session);

  if (intent === "create") {
    const quota = await getQuotaDecision(db, session.shop, "croExperiments");
    if (!quota.allowed) return Response.json({ ok: false, error: quota.message, code: quota.code, entitlement: quota }, { status: 403 });
    const name = String(form.get("name") || "New experiment").trim() || "New experiment";
    const pageId = String(form.get("pageId") || "");
    const targetType = EXPERIMENT_TARGET_TYPES.includes(String(form.get("targetType"))) ? String(form.get("targetType")) : "page";
    const targetNodeId = String(form.get("targetNodeId") || "").trim();
    const goalType = EXPERIMENT_GOAL_TYPES.includes(String(form.get("goalType"))) ? String(form.get("goalType")) : "purchase";
    const goalValue = String(form.get("goalValue") || "").trim();
    const variantPageId = String(form.get("variantPageId") || pageId);
    const variantSourceNodeId = String(form.get("variantSourceNodeId") || targetNodeId).trim();
    const base = await db.builderPage.findFirst({ where: { id: pageId, shop: session.shop, deletedAt: null, status: "published" } });
    if (!base?.publishedJson) return Response.json({ ok: false, error: "Publish the control page before creating an experiment." }, { status: 400 });
    if (targetType !== "page" && !targetNodeId) return Response.json({ ok: false, error: "Section/component experiments require the target element ID." }, { status: 400 });
    let snapshotJson;
    try { snapshotJson = await snapshotForVariant({ shop: session.shop, pageId: variantPageId, targetType, targetNodeId: variantSourceNodeId }); }
    catch (error) { return Response.json({ ok: false, error: error.message }, { status: 400 }); }
    const experiment = await db.builderExperiment.create({ data: {
      shop: session.shop, name, pageId, targetType, targetNodeId: targetNodeId || null, goalType, goalValue: goalValue || null,
      trafficPercent: Math.max(1, Math.min(100, Number(form.get("trafficPercent") || 100) || 100)),
      minimumSessions: Math.max(20, Number(form.get("minimumSessions") || 200) || 200),
      confidenceThreshold: Math.max(0.8, Math.min(0.999, Number(form.get("confidenceThreshold") || 0.95) || 0.95)),
    } });
    await db.$transaction([
      db.builderExperimentVariant.create({ data: { experimentId: experiment.id, key: "A", name: "Control", weight: 50, isControl: true, sourcePageId: pageId } }),
      db.builderExperimentVariant.create({ data: { experimentId: experiment.id, key: "B", name: "Variation B", weight: 50, isControl: false, sourcePageId: variantPageId, sourceNodeId: variantSourceNodeId || null, snapshotJson } }),
      db.builderAuditLog.create({ data: { shop: session.shop, pageId, actor, action: "experiment.created", details: JSON.stringify({ experimentId: experiment.id, targetType, goalType }) } }),
    ]);
    return Response.json({ ok: true, experimentId: experiment.id });
  }

  const experiment = await db.builderExperiment.findFirst({ where: { id: experimentId, shop: session.shop } });
  if (!experiment) return Response.json({ ok: false, error: "Experiment not found." }, { status: 404 });

  if (["add-variant", "start", "resume", "publish-winner"].includes(intent)) {
    const feature = await getFeatureDecision(db, session.shop, "croExperiments");
    if (!feature.allowed) return Response.json({ ok: false, error: feature.message, code: feature.code, entitlement: feature }, { status: 403 });
  }

  if (intent === "add-variant") {
    const variants = await db.builderExperimentVariant.findMany({ where: { experimentId }, orderBy: { createdAt: "asc" } });
    const sourcePageId = String(form.get("sourcePageId") || experiment.pageId);
    const sourceNodeId = String(form.get("sourceNodeId") || experiment.targetNodeId || "").trim();
    let snapshotJson; try { snapshotJson = await snapshotForVariant({ shop: session.shop, pageId: sourcePageId, targetType: experiment.targetType, targetNodeId: sourceNodeId }); }
    catch (error) { return Response.json({ ok: false, error: error.message }, { status: 400 }); }
    const key = nextVariantKey(variants);
    await db.builderExperimentVariant.create({ data: { experimentId, key, name: String(form.get("name") || `Variation ${key}`), weight: Math.max(1, Math.min(1000, Number(form.get("weight") || 50) || 50)), sourcePageId, sourceNodeId: sourceNodeId || null, snapshotJson } });
    return Response.json({ ok: true });
  }

  if (intent === "start" || intent === "resume") {
    const variants = await db.builderExperimentVariant.findMany({ where: { experimentId } });
    if (variants.length < 2 || !variants.some((v) => !v.isControl && v.snapshotJson)) return Response.json({ ok: false, error: "At least one valid variation is required." }, { status: 400 });
    const conflict = await db.builderExperiment.findFirst({ where: { shop: session.shop, pageId: experiment.pageId, targetNodeId: experiment.targetNodeId, status: "running", id: { not: experiment.id } } });
    if (conflict) return Response.json({ ok: false, error: `Another experiment is already running on this target: ${conflict.name}` }, { status: 409 });
    await db.builderExperiment.update({ where: { id: experiment.id }, data: { status: "running", startedAt: experiment.startedAt || new Date(), endedAt: null } });
    return Response.json({ ok: true });
  }
  if (intent === "pause") { await db.builderExperiment.update({ where: { id: experiment.id }, data: { status: "paused" } }); return Response.json({ ok: true }); }
  if (intent === "archive") { await db.builderExperiment.update({ where: { id: experiment.id }, data: { status: "archived", endedAt: experiment.endedAt || new Date() } }); return Response.json({ ok: true }); }
  if (intent === "duplicate") {
    const quota = await getQuotaDecision(db, session.shop, "croExperiments");
    if (!quota.allowed) return Response.json({ ok: false, error: quota.message, code: quota.code, entitlement: quota }, { status: 403 });
    const variants = await db.builderExperimentVariant.findMany({ where: { experimentId } });
    const copy = await db.builderExperiment.create({ data: { shop: session.shop, name: `${experiment.name} Copy`, status: "draft", targetType: experiment.targetType, pageId: experiment.pageId, targetNodeId: experiment.targetNodeId, goalType: experiment.goalType, goalValue: experiment.goalValue, trafficPercent: experiment.trafficPercent, minimumSessions: experiment.minimumSessions, confidenceThreshold: experiment.confidenceThreshold } });
    for (const variant of variants) await db.builderExperimentVariant.create({ data: { experimentId: copy.id, key: variant.key, name: variant.name, weight: variant.weight, isControl: variant.isControl, sourcePageId: variant.sourcePageId, sourceNodeId: variant.sourceNodeId, snapshotJson: variant.snapshotJson } });
    return Response.json({ ok: true, experimentId: copy.id });
  }
  if (intent === "publish-winner") {
    const variantId = String(form.get("variantId") || "");
    const [variants, assignments, events, base] = await Promise.all([
      db.builderExperimentVariant.findMany({ where: { experimentId } }),
      db.builderExperimentAssignment.findMany({ where: { shop: session.shop, experimentId } }),
      db.builderExperimentEvent.findMany({ where: { shop: session.shop, experimentId } }),
      db.builderPage.findFirst({ where: { id: experiment.pageId, shop: session.shop, deletedAt: null } }),
    ]);
    const stats = experimentVariantStats({ experiment, variants, assignments, events });
    const winner = variants.find((v) => v.id === variantId);
    if (!winner || !stats.winnerCandidate || stats.winnerCandidate.id !== winner.id) return Response.json({ ok: false, error: "Winner guardrail not met yet. More traffic or confidence is required." }, { status: 409 });
    if (!base?.publishedJson) return Response.json({ ok: false, error: "Control page is no longer published." }, { status: 409 });
    const baseContent = migrateBuilderContent(safeJson(base.publishedJson, []));
    const applied = applyExperimentVariant(baseContent, experiment, winner);
    if (!applied.changed) return Response.json({ ok: false, error: "Winner snapshot could not be applied." }, { status: 409 });
    const contentJson = JSON.stringify(applied.elements);
    await db.$transaction([
      db.builderPage.update({ where: { id: base.id }, data: { contentJson, publishedJson: contentJson, status: "published", version: { increment: 1 }, publishedVersion: { increment: 1 }, publishedAt: new Date() } }),
      db.builderExperiment.update({ where: { id: experiment.id }, data: { status: "completed", winnerVariantId: winner.id, endedAt: new Date() } }),
      db.builderRevision.create({ data: { shop: session.shop, pageId: base.id, title: base.title, contentJson, kind: "experiment-winner", createdBy: actor } }),
      db.builderAuditLog.create({ data: { shop: session.shop, pageId: base.id, actor, action: "experiment.winner_published", details: JSON.stringify({ experimentId, variantId: winner.id, variantKey: winner.key }) } }),
    ]);
    const assetBuild = await rebuildThemeAssets({ admin, session, db }).catch((error) => ({ success: false, error: error.message }));
    return Response.json({ ok: true, assetBuild });
  }
  return Response.json({ ok: false, error: "Unsupported experiment action." }, { status: 400 });
}

function StatusBadge({ value }) { const cls = value === "running" ? "bg-green-50 text-green-700" : value === "completed" ? "bg-blue-50 text-blue-700" : value === "paused" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"; return <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${cls}`}>{value}</span>; }

export default function ExperimentsRoute() {
  const { experiments, pages, shop } = useLoaderData();
  const pageById = new Map(pages.map((p)=>[p.id,p]));
  return <s-page heading="CRO Experiments">
    <div className="grid gap-4 pb-10">
      <section className="rounded-xl border border-[#e3e3e3] bg-white p-4">
        <h2 className="text-sm font-semibold">Create experiment</h2>
        <p className="mt-1 text-xs text-[#6d7175]">Page, section and component experiments use immutable snapshots. Publish the designs you want to test first, then select the control and variation sources.</p>
        <Form method="post" className="mt-4 grid gap-3 md:grid-cols-2">
          <input type="hidden" name="intent" value="create" />
          <label className="grid gap-1 text-xs">Name<input className="rounded-lg border px-3 py-2" name="name" required placeholder="Product hero test" /></label>
          <label className="grid gap-1 text-xs">Control page<select className="rounded-lg border px-3 py-2" name="pageId" required>{pages.map((p)=><option key={p.id} value={p.id}>{p.title} · {p.template}</option>)}</select></label>
          <label className="grid gap-1 text-xs">Target<select className="rounded-lg border px-3 py-2" name="targetType"><option value="page">Full page</option><option value="section">Section / element</option><option value="component">Component instance</option></select></label>
          <label className="grid gap-1 text-xs">Target element ID<input className="rounded-lg border px-3 py-2" name="targetNodeId" placeholder="Required for section/component" /></label>
          <label className="grid gap-1 text-xs">Goal<select className="rounded-lg border px-3 py-2" name="goalType">{EXPERIMENT_GOAL_TYPES.map((g)=><option key={g} value={g}>{g.replaceAll("_"," ")}</option>)}</select></label>
          <label className="grid gap-1 text-xs">Goal selector / custom event<input className="rounded-lg border px-3 py-2" name="goalValue" placeholder=".buy-button or lead_qualified" /></label>
          <label className="grid gap-1 text-xs">Variation source page<select className="rounded-lg border px-3 py-2" name="variantPageId">{pages.map((p)=><option key={p.id} value={p.id}>{p.title} · {p.template}</option>)}</select></label>
          <label className="grid gap-1 text-xs">Variation source element ID<input className="rounded-lg border px-3 py-2" name="variantSourceNodeId" placeholder="For section/component" /></label>
          <label className="grid gap-1 text-xs">Traffic %<input className="rounded-lg border px-3 py-2" type="number" min="1" max="100" name="trafficPercent" defaultValue="100" /></label>
          <label className="grid gap-1 text-xs">Minimum sessions<input className="rounded-lg border px-3 py-2" type="number" min="20" name="minimumSessions" defaultValue="200" /></label>
          <label className="grid gap-1 text-xs">Confidence threshold<select className="rounded-lg border px-3 py-2" name="confidenceThreshold" defaultValue="0.95"><option value="0.90">90%</option><option value="0.95">95%</option><option value="0.99">99%</option></select></label>
          <div className="flex items-end"><button className="rounded-lg bg-[#303030] px-4 py-2 text-xs font-semibold text-white" type="submit">Create A/B experiment</button></div>
        </Form>
      </section>

      {experiments.map((experiment) => <article key={experiment.id} className="rounded-xl border border-[#e3e3e3] bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><div className="flex items-center gap-2"><strong>{experiment.name}</strong><StatusBadge value={experiment.status}/></div><p className="mt-1 text-xs text-[#6d7175]">{experiment.targetType} · goal: {experiment.goalType} · traffic {experiment.trafficPercent}% · {experiment.metrics.totalSessions} assigned visitors</p></div>
          <div className="flex flex-wrap gap-2">
            {experiment.status === "draft" || experiment.status === "paused" ? <Form method="post"><input type="hidden" name="experimentId" value={experiment.id}/><button className="rounded-lg border px-3 py-1.5 text-xs" name="intent" value={experiment.status === "paused" ? "resume" : "start"}>Start</button></Form> : null}
            {experiment.status === "running" ? <Form method="post"><input type="hidden" name="experimentId" value={experiment.id}/><button className="rounded-lg border px-3 py-1.5 text-xs" name="intent" value="pause">Pause</button></Form> : null}
            <Form method="post"><input type="hidden" name="experimentId" value={experiment.id}/><button className="rounded-lg border px-3 py-1.5 text-xs" name="intent" value="duplicate">Duplicate</button></Form>
            <Form method="post"><input type="hidden" name="experimentId" value={experiment.id}/><button className="rounded-lg border px-3 py-1.5 text-xs" name="intent" value="archive">Archive</button></Form>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">{experiment.variants.map((variant)=>{ const base=pageById.get(experiment.pageId); const path=base?.shopifyPageUrl || "/"; const sep=path.includes("?")?"&":"?"; const href=`https://${shop}${path}${sep}vsn_exp_preview=${encodeURIComponent(experiment.id)}&vsn_variant=${encodeURIComponent(variant.key)}`; return <a key={variant.id} className="rounded-lg border px-2 py-1 text-xs" href={href} target="_blank" rel="noreferrer">Preview {variant.key}</a>; })}</div>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left text-xs"><thead><tr className="border-b"><th className="py-2">Variant</th><th>Sessions</th><th>Conversions</th><th>Rate</th><th>Uplift</th><th>Confidence</th><th>Revenue</th><th>AOV</th><th>Status</th></tr></thead><tbody>{experiment.metrics.rows.map((row)=><tr key={row.id} className="border-b border-[#f1f1f1]"><td className="py-2 font-medium">{row.key} · {row.name}{row.isControl ? " (Control)" : ""}</td><td>{row.sessions}</td><td>{row.conversions}</td><td>{pct(row.conversionRate)}</td><td>{row.uplift == null ? "—" : pct(row.uplift)}</td><td>{row.isControl ? "—" : pct(row.confidence)}</td><td>{money(row.revenue)}</td><td>{money(row.aov)}</td><td>{experiment.metrics.winnerCandidate?.id === row.id ? <Form method="post" className="inline"><input type="hidden" name="experimentId" value={experiment.id}/><input type="hidden" name="variantId" value={row.id}/><button className="rounded-lg bg-green-700 px-2 py-1 text-white" name="intent" value="publish-winner">Publish winner</button></Form> : experiment.metrics.status === "collecting" ? "Collecting" : "—"}</td></tr>)}</tbody></table></div>
        <div className="mt-3 rounded-lg bg-[#f6f6f7] p-3 text-xs text-[#5c5f62]">Statistical guardrail: {experiment.metrics.sampleReady ? `sample ready; ${Math.round(experiment.confidenceThreshold*100)}% confidence required.` : `collecting until at least ${experiment.minimumSessions} sessions with balanced variant traffic.`}</div>
        <Form method="post" className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-3"><input type="hidden" name="intent" value="add-variant"/><input type="hidden" name="experimentId" value={experiment.id}/><label className="grid gap-1 text-xs">New variant source page<select className="rounded-lg border px-2 py-1.5" name="sourcePageId">{pages.map((p)=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label><label className="grid gap-1 text-xs">Source element ID<input className="rounded-lg border px-2 py-1.5" name="sourceNodeId" placeholder={experiment.targetNodeId || "page target: leave blank"}/></label><label className="grid gap-1 text-xs">Name<input className="rounded-lg border px-2 py-1.5" name="name" placeholder="Variation C"/></label><label className="grid gap-1 text-xs">Weight<input className="w-20 rounded-lg border px-2 py-1.5" type="number" min="1" name="weight" defaultValue="50"/></label><button className="rounded-lg border px-3 py-1.5 text-xs" type="submit">Add variant</button></Form>
      </article>)}
      {!experiments.length ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-[#6d7175]">No CRO experiments yet.</div> : null}
    </div>
  </s-page>;
}
