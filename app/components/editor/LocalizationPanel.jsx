import { useEffect, useMemo, useState } from "react";
import PolarisIcon from "../ui/PolarisIcon";
import { VsnButton, VsnSelect, VsnOption, VsnTextArea, VsnTextField } from "./EditorUi";
import { collectTranslatableFields, localeDirection, localizationDiagnostics, removeLocalizationOverride, setLocalizationOverride, translationCompletion } from "../../builder/localizationEngine.js";

function recordKey(locale, marketKey) { return `${locale}|${marketKey || "*"}`; }

export default function LocalizationPanel({ open, onClose, data = {}, elements = [], pageSettings = {}, selectedElementId = null, busy = false, onAction, onPreviewChange }) {
  const config = data?.config || { baseLocale: "en", locales: [], markets: [] };
  const locales = config.locales || [];
  const translatableLocales = locales.filter((item) => item.locale !== config.baseLocale);
  const [locale, setLocale] = useState(() => translatableLocales[0]?.locale || config.baseLocale || "en");
  const [marketKey, setMarketKey] = useState("*");
  const [overrides, setOverrides] = useState({});
  const [seo, setSeo] = useState({});
  const [status, setStatus] = useState("draft");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState(false);
  const records = useMemo(() => new Map((data?.translations || []).map((row) => [recordKey(row.locale, row.marketKey), row])), [data?.translations]);
  const record = records.get(recordKey(locale, marketKey)) || null;

  useEffect(() => {
    if (!open) return;
    setOverrides(record?.overrides || {});
    setSeo(record?.seo || {});
    setStatus(record?.status || "draft");
  }, [open, record?.id, locale, marketKey]);

  useEffect(() => {
    if (!preview) return;
    onPreviewChange?.({ enabled: true, locale, marketKey, overrides, seo, direction: localeDirection(locale) });
    return () => onPreviewChange?.({ enabled: false });
  }, [preview, locale, marketKey, overrides, seo, onPreviewChange]);

  useEffect(() => () => onPreviewChange?.({ enabled: false }), [onPreviewChange]);

  const allFields = useMemo(() => collectTranslatableFields(elements), [elements]);
  const fields = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allFields.filter((field) => (!selectedElementId || field.nodeId === selectedElementId) && (!q || `${field.nodeLabel} ${field.key} ${field.value}`.toLowerCase().includes(q)));
  }, [allFields, query, selectedElementId]);
  const completion = useMemo(() => translationCompletion(elements, overrides), [elements, overrides]);
  const diagnostics = useMemo(() => localizationDiagnostics({ locale, elements, overrides, seo }), [locale, elements, overrides, seo]);
  const outdated = record ? Number(record.sourceVersion || 0) < Number(data?.pageVersion || 1) : false;

  if (!open) return null;
  const market = (config.markets || []).find((item) => item.key === marketKey) || null;

  const save = (nextStatus = status) => onAction?.("localization-save", { locale, marketKey, overrides: JSON.stringify(overrides), seo: JSON.stringify(seo), status: nextStatus });
  const updateOverride = (field, value) => setOverrides((current) => value === "" ? removeLocalizationOverride(current, field.nodeId, field.key) : setLocalizationOverride(current, field.nodeId, field.key, value));

  return (
    <aside className="absolute right-3 top-3 z-50 flex max-h-[calc(100%-24px)] w-[430px] flex-col overflow-hidden rounded-2xl border border-[#d8d8d8] bg-white shadow-2xl" dir="ltr">
      <div className="border-b border-[#ececec] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div><div className="flex items-center gap-2 text-sm font-semibold text-[#202223]"><PolarisIcon type="language"/> Localization & Markets</div><div className="mt-1 text-[10px] text-[#777]">Base {config.baseLocale} · {translatableLocales.length} alternate locale(s) · {(config.markets||[]).length} market(s)</div></div>
          <VsnButton variant="icon" size="sm" onClick={onClose} title="Close localization"><PolarisIcon type="x"/></VsnButton>
        </div>
        {config.catalogErrors?.length ? <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] text-amber-800">{config.catalogErrors.join(" ")}</div> : null}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-[10px] font-semibold text-[#555]">Locale<VsnSelect value={locale} onChange={(event)=>setLocale(event.currentTarget.value)}>{translatableLocales.length ? translatableLocales.map((item)=><VsnOption key={item.locale} value={item.locale}>{item.name} · {item.locale}{item.direction==="rtl"?" · RTL":""}</VsnOption>) : <VsnOption value={config.baseLocale}>{config.baseLocale} · add Shopify locales</VsnOption>}</VsnSelect></label>
          <label className="text-[10px] font-semibold text-[#555]">Market<VsnSelect value={marketKey} onChange={(event)=>setMarketKey(event.currentTarget.value)}><VsnOption value="*">All markets</VsnOption>{(config.markets||[]).map((item)=><VsnOption key={item.key} value={item.key}>{item.name}</VsnOption>)}</VsnSelect></label>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#ececec]"><div className="h-full bg-[#95BF47]" style={{ width:`${completion.percent}%` }}/></div><span className="text-[10px] font-semibold text-[#555]">{completion.percent}%</span>
          <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${outdated?"bg-amber-50 text-amber-700":record?"bg-emerald-50 text-emerald-700":"bg-[#f1f1f1] text-[#666]"}`}>{outdated?"Outdated":record?.status||"Missing"}</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <section className="rounded-xl border border-[#e3e3e3] p-3">
          <div className="flex items-center justify-between gap-3"><div><div className="text-xs font-semibold text-[#303030]">Locale preview</div><div className="mt-0.5 text-[10px] text-[#888]">Apply overrides to the canvas without changing base content.</div></div><button type="button" onClick={()=>setPreview((value)=>!value)} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold ${preview?"bg-[#95BF47] text-white":"bg-[#f3f4f6] text-[#555]"}`}>{preview?"Previewing":"Preview"}</button></div>
          <div className="mt-2 text-[10px] text-[#777]">Direction: <strong>{localeDirection(locale).toUpperCase()}</strong>{market?` · ${market.name}`:" · inherited by every market"}</div>
        </section>

        <section className="mt-3 rounded-xl border border-[#e3e3e3] p-3">
          <div className="text-xs font-semibold text-[#303030]">Localized SEO</div>
          <div className="mt-2 grid gap-2"><VsnTextField label="Meta title" value={seo.seoTitle||""} onInput={(e)=>setSeo((current)=>({...current,seoTitle:e.currentTarget.value}))} placeholder={pageSettings.seoTitle||"Base meta title"}/><VsnTextArea label="Meta description" rows={3} value={seo.seoDescription||""} onInput={(e)=>setSeo((current)=>({...current,seoDescription:e.currentTarget.value}))} placeholder={pageSettings.seoDescription||"Base meta description"}/><VsnTextField label="OG title" value={seo.ogTitle||""} onInput={(e)=>setSeo((current)=>({...current,ogTitle:e.currentTarget.value}))}/><VsnTextArea label="OG description" rows={2} value={seo.ogDescription||""} onInput={(e)=>setSeo((current)=>({...current,ogDescription:e.currentTarget.value}))}/><VsnTextField label="OG image" value={seo.ogImage||""} onInput={(e)=>setSeo((current)=>({...current,ogImage:e.currentTarget.value}))} placeholder="Localized image URL"/><VsnTextField label="Shopify page title" value={seo.shopifyTitle||""} onInput={(e)=>setSeo((current)=>({...current,shopifyTitle:e.currentTarget.value}))} placeholder="Optional native Shopify translation"/></div>
        </section>

        <section className="mt-3 rounded-xl border border-[#e3e3e3] p-3">
          <div className="flex items-center justify-between gap-2"><div><div className="text-xs font-semibold text-[#303030]">Content overrides</div><div className="mt-0.5 text-[10px] text-[#888]">{selectedElementId?"Showing selected element fields.":`${allFields.length} localizable fields on this page.`}</div></div>{selectedElementId?<span className="rounded bg-[#f5f5f5] px-2 py-1 text-[9px]">Selected</span>:null}</div>
          <div className="mt-2"><VsnTextField value={query} onInput={(e)=>setQuery(e.currentTarget.value)} placeholder="Filter fields…"/></div>
          <div className="mt-3 space-y-3">{fields.slice(0,160).map((field)=>{
            const value = overrides?.[field.nodeId]?.props?.[field.key] ?? "";
            const multiline = field.kind === "text" && (field.value.length > 70 || /description|content|html|message/i.test(field.key));
            return <div key={field.id} className="rounded-lg bg-[#fafafa] p-2.5"><div className="flex items-center justify-between gap-2"><span className="truncate text-[10px] font-semibold text-[#444]">{field.nodeLabel} · {field.key}</span><span className="text-[8px] uppercase text-[#999]">{field.kind}</span></div><div className="mt-1 truncate text-[9px] text-[#999]" title={field.value}>Base: {field.value || "—"}</div><div className="mt-2">{multiline?<VsnTextArea rows={3} value={value} onInput={(e)=>updateOverride(field,e.currentTarget.value)} placeholder="Inherit base value"/>:<VsnTextField value={value} onInput={(e)=>updateOverride(field,e.currentTarget.value)} placeholder="Inherit base value"/>}</div></div>})}{!fields.length?<div className="py-6 text-center text-[11px] text-[#888]">No localizable fields match this view.</div>:null}</div>
        </section>

        <section className="mt-3 rounded-xl border border-[#e3e3e3] p-3">
          <div className="text-xs font-semibold text-[#303030]">Direction QA</div>
          <div className="mt-2 space-y-1.5">{diagnostics.issues.slice(0,20).map((issue,index)=><div key={`${issue.code}-${index}`} className={`rounded-lg px-2.5 py-2 text-[10px] ${issue.level==="warn"?"bg-amber-50 text-amber-800":"bg-blue-50 text-blue-700"}`}>{issue.message}</div>)}{!diagnostics.issues.length?<div className="rounded-lg bg-emerald-50 px-2.5 py-2 text-[10px] text-emerald-700">No locale-direction issues detected.</div>:null}</div>
        </section>
      </div>

      <div className="border-t border-[#ececec] bg-[#fafafa] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex gap-2"><VsnButton size="sm" disabled={busy} onClick={()=>onAction?.("localization-catalog-refresh")}>Refresh Shopify locales</VsnButton>{record?.id?<VsnButton size="sm" disabled={busy || !seo.shopifyTitle && !seo.seoTitle && !seo.seoDescription} onClick={()=>onAction?.("localization-native-sync",{translationId:record.id})}>Sync Shopify</VsnButton>:null}</div><div className="flex gap-2"><VsnButton size="sm" disabled={busy} onClick={()=>{setStatus("draft");save("draft");}}>Save draft</VsnButton><VsnButton variant="primary" size="sm" disabled={busy || !locale} onClick={()=>{setStatus("translated");save("translated");}}>Mark translated</VsnButton></div></div>
      </div>
    </aside>
  );
}
