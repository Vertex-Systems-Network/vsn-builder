import { useEffect, useState } from "react";
import { ArrowLeft, Edit3, Plus, RotateCcw, Star, Trash2 } from "lucide-react";
import { VsnButton, VsnCard, VsnEmpty, VsnInput, VsnPage, VsnSearchInput, VsnSelect, VsnTabs } from "../ui/VsnToolkit.jsx";
import { ColorGradientControl, MediaControl } from "../editor/EditorControls.jsx";
import BrandProfileFields from "./BrandProfileFields.jsx";
import { brandProfileForm } from "../../brand/brandProfile.js";

export const EMPTY_BRAND_KIT = { id: "", name: "New Brand Kit", logoUrl: "", primary: "#008060", secondary: "#6d7175", accent: "#008060", text: "#1a1a1a", background: "#ffffff", surface: "#ffffff", bodyFont: "Inter, system-ui, sans-serif", headingFont: "inherit", headingScale: "1.25", spacingBase: "4", containerMaxWidth: "1200px", radiusSm: "6px", radiusMd: "12px", radiusLg: "20px", buttonRadius: "8px", shadowSm: "0 1px 2px rgba(0,0,0,.08)", shadowMd: "0 8px 24px rgba(0,0,0,.12)", shadowLg: "0 20px 50px rgba(0,0,0,.16)", ...brandProfileForm({}) };

export function brandKitForm(kit) {
  if (!kit) return { ...EMPTY_BRAND_KIT };
  return { id: kit.id, name: kit.name || "Brand Kit", logoUrl: kit.logoUrl || "", primary: kit.colors?.primary || "#008060", secondary: kit.colors?.secondary || "#6d7175", accent: kit.colors?.accent || "#008060", text: kit.colors?.text || "#1a1a1a", background: kit.colors?.background || "#ffffff", surface: kit.colors?.surface || "#ffffff", bodyFont: kit.typography?.bodyFont || "Inter, system-ui, sans-serif", headingFont: kit.typography?.headingFont || "inherit", headingScale: String(kit.typography?.headingScale || 1.25), spacingBase: String(kit.spacing?.base || 4), containerMaxWidth: kit.spacing?.containerMaxWidth || "1200px", radiusSm: kit.radius?.sm || "6px", radiusMd: kit.radius?.md || "12px", radiusLg: kit.radius?.lg || "20px", buttonRadius: kit.radius?.button || "8px", shadowSm: kit.shadows?.sm || EMPTY_BRAND_KIT.shadowSm, shadowMd: kit.shadows?.md || EMPTY_BRAND_KIT.shadowMd, shadowLg: kit.shadows?.lg || EMPTY_BRAND_KIT.shadowLg, ...brandProfileForm(kit.profile) };
}

function isShopifyCdn(url) {
  try { return new URL(String(url || "")).hostname === "cdn.shopify.com"; } catch { return false; }
}

const COLOR_FIELDS = [["primary", "Primary"], ["secondary", "Secondary"], ["accent", "Accent"], ["text", "Text"], ["background", "Background"], ["surface", "Surface"]];

// Two screens: the kit list (All / Trash, search, edit, trash) and a full-page
// form. Saving returns to the list.
export default function BrandKitsPanel({ data, actionData, submit, busy, confirmAction, Notice }) {
  const [view, setView] = useState("list");
  const [tab, setTab] = useState("active");
  const [q, setQ] = useState("");
  const [form, setForm] = useState(() => ({ ...EMPTY_BRAND_KIT }));
  const [logoSource, setLogoSource] = useState("url");
  const [applyTarget, setApplyTarget] = useState("");
  const field = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const rows = (tab === "trash" ? data.trash : data.kits) || [];
  const filtered = rows.filter((kit) => !q || String(kit.name || "").toLowerCase().includes(q.toLowerCase()));

  useEffect(() => {
    if (actionData?.ok && actionData.intent === "save") { setView("list"); setTab("active"); }
  }, [actionData]);

  const openForm = (kit) => { setForm(brandKitForm(kit)); setLogoSource(isShopifyCdn(kit?.logoUrl) ? "shopify" : "url"); setView("form"); };
  const fonts = data.fontFamilies || [];
  const fontOptions = (value, allowInherit) => <>
    {allowInherit ? <option value="inherit">Inherit body font</option> : null}
    {value && value !== "inherit" && !fonts.some((font) => font.value === value) ? <option value={value}>{value}</option> : null}
    {fonts.map((font, index) => <option key={`${font.provider || "font"}-${font.family}-${index}`} value={font.value}>{font.family} · {font.provider || "Font"}</option>)}
  </>;

  if (view === "form") {
    return <VsnPage title={form.id ? `Edit ${form.name || "Brand Kit"}` : "New Brand Kit"} subtitle="Logo, colours, typography, spacing, radius and shadows used by Global Design and your templates."
      actions={<VsnButton icon={<ArrowLeft size={14} />} onClick={() => setView("list")}>Back to Brand Kits</VsnButton>}>
      {Notice ? <Notice data={actionData} /> : null}
      <div className="vsn-brandkit-form">
        <div className="vsn-brandkit-form__main">
          <VsnCard title="Identity">
            <VsnInput label="Kit name" value={form.name} onChange={(event) => field("name", event.target.value)} />
            <div className="vsn-brandkit-logo">
              <span className="vsn-field-label">Logo</span>
              <div className="vsn-segmented" role="radiogroup" aria-label="Logo source">
                <button type="button" role="radio" aria-checked={logoSource === "url"} className={logoSource === "url" ? "is-active" : ""} onClick={() => setLogoSource("url")}>Image URL</button>
                <button type="button" role="radio" aria-checked={logoSource === "shopify"} className={logoSource === "shopify" ? "is-active" : ""} onClick={() => setLogoSource("shopify")}>Shopify media library</button>
              </div>
              {logoSource === "url"
                ? <VsnInput label="Logo URL" hideLabel value={form.logoUrl} onChange={(event) => field("logoUrl", event.target.value)} placeholder="https://…" />
                : <MediaControl label="Choose logo" value={form.logoUrl ? { url: form.logoUrl } : {}} onChange={(media) => field("logoUrl", media?.url || "")} />}
              {form.logoUrl ? <img className="vsn-brandkit-logo__preview" src={form.logoUrl} alt="Logo preview" /> : null}
            </div>
          </VsnCard>
          <VsnCard title="Colours">
            <div className="vsn-brandkit-color-grid">
              {COLOR_FIELDS.map(([key, label]) => <div key={key} className="vsn-brandkit-color"><ColorGradientControl label={label} solidOnly value={{ type: "color", color: form[key] }} onChange={(next) => field(key, next?.color || form[key])} /></div>)}
            </div>
          </VsnCard>
          <VsnCard title="Typography & layout">
            <div className="vsn-two-column-grid">
              <VsnSelect label="Body font family" value={form.bodyFont} onChange={(event) => field("bodyFont", event.target.value)}>{fontOptions(form.bodyFont, false)}</VsnSelect>
              <VsnSelect label="Heading font family" value={form.headingFont} onChange={(event) => field("headingFont", event.target.value)}>{fontOptions(form.headingFont, true)}</VsnSelect>
              <VsnInput label="Heading scale" type="number" min="0.8" max="2" step="0.05" value={form.headingScale} onChange={(event) => field("headingScale", event.target.value)} />
              <VsnInput label="Spacing base (px)" type="number" min="1" max="16" value={form.spacingBase} onChange={(event) => field("spacingBase", event.target.value)} />
              <VsnInput label="Container max width" value={form.containerMaxWidth} onChange={(event) => field("containerMaxWidth", event.target.value)} />
              <VsnInput label="Button radius" value={form.buttonRadius} onChange={(event) => field("buttonRadius", event.target.value)} />
              <VsnInput label="Radius small" value={form.radiusSm} onChange={(event) => field("radiusSm", event.target.value)} />
              <VsnInput label="Radius medium" value={form.radiusMd} onChange={(event) => field("radiusMd", event.target.value)} />
              <VsnInput label="Radius large" value={form.radiusLg} onChange={(event) => field("radiusLg", event.target.value)} />
            </div>
            <VsnInput label="Shadow small" value={form.shadowSm} onChange={(event) => field("shadowSm", event.target.value)} />
            <VsnInput label="Shadow medium" value={form.shadowMd} onChange={(event) => field("shadowMd", event.target.value)} />
            <VsnInput label="Shadow large" value={form.shadowLg} onChange={(event) => field("shadowLg", event.target.value)} />
          </VsnCard>
          <VsnCard title="Brand voice & rules">
            <BrandProfileFields form={form} onChange={field} extractionEnabled={data.aiBrandExtractionEnabled === true} extractionBusy={busy} extractionResult={actionData?.intent === "extract-profile" ? actionData : null} onExtract={({ sourceUrl, authorized }) => submit({intent:"extract-profile", sourceUrl, authorized: String(authorized) })} />
          </VsnCard>
        </div>
        <aside className="vsn-brandkit-form__side">
          <VsnCard title="Preview">
            <div className="vsn-brandkit-preview" style={{ background: form.background, color: form.text, borderRadius: form.radiusLg, boxShadow: form.shadowMd }}>
              {form.logoUrl ? <img src={form.logoUrl} alt="" style={{ maxHeight: 36, maxWidth: 140, objectFit: "contain" }} /> : null}
              <span style={{ color: form.accent }}>BRAND PREVIEW</span>
              <h3 style={{ fontFamily: form.headingFont === "inherit" ? form.bodyFont : form.headingFont, color: form.text }}>A consistent visual system</h3>
              <p style={{ fontFamily: form.bodyFont }}>Brand Kits reuse the same tokens across editor, templates and storefront rendering.</p>
              <button type="button" style={{ background: form.primary, color: "#fff", borderRadius: form.buttonRadius }}>Primary action</button>
            </div>
            <div className="vsn-brandkit-swatches">{COLOR_FIELDS.map(([key, label]) => <span key={key} title={label} style={{ background: form[key] }} />)}</div>
          </VsnCard>
          <div className="vsn-brandkit-form__actions">
            <VsnButton variant="primary" loading={busy} onClick={() => submit({ intent: "save", ...form })}>{form.id ? "Save changes" : "Create Brand Kit"}</VsnButton>
            <VsnButton onClick={() => setView("list")}>Cancel</VsnButton>
          </div>
          {form.id ? <VsnCard title="Use this kit">
            <VsnButton loading={busy} onClick={() => submit({ intent: "default", id: form.id })}>Apply as Global Design</VsnButton>
            <VsnSelect label="Apply to a saved template" value={applyTarget} onChange={(event) => setApplyTarget(event.target.value)}><option value="">Choose page or section</option>{(data.library || []).map((item) => <option key={item.id} value={item.id}>{item.title} · {item.kind}</option>)}</VsnSelect>
            <VsnButton disabled={!applyTarget} loading={busy} onClick={() => submit({ intent: "apply-template", id: form.id, libraryItemId: applyTarget })}>Apply Kit to template</VsnButton>
          </VsnCard> : null}
        </aside>
      </div>
    </VsnPage>;
  }

  return <VsnPage title="Brand Kits" subtitle="Reusable logo, colours and typography for Global Design and your templates."
    actions={<VsnButton variant="primary" icon={<Plus size={14} />} onClick={() => openForm(null)}>New Brand Kit</VsnButton>}>
    {Notice ? <Notice data={actionData} /> : null}
    <VsnTabs items={[{ value: "active", label: "All", count: data.kits?.length || 0 }, { value: "trash", label: "Trash", count: data.trash?.length || 0 }]} value={tab} onChange={setTab} />
    <div className="vsn-list-toolbar"><VsnSearchInput label="Search Brand Kits" hideLabel value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search Brand Kits" /></div>
    {filtered.length ? <div className="vsn-brandkit-cards">
      {filtered.map((kit) => <article key={kit.id} className={`vsn-brandkit-card${kit.isDefault ? " is-default" : ""}`}>
        <button type="button" className="vsn-brandkit-card__preview" onClick={() => tab === "active" && openForm(kit)} style={{ background: kit.colors?.background || "#fff", color: kit.colors?.text || "#111" }}>
          {kit.logoUrl ? <img src={kit.logoUrl} alt="" /> : <strong style={{ fontFamily: kit.typography?.headingFont === "inherit" ? kit.typography?.bodyFont : kit.typography?.headingFont }}>Aa</strong>}
          <span className="vsn-brandkit-card__swatches">{["primary", "secondary", "accent", "text", "surface"].map((key) => <i key={key} style={{ background: kit.colors?.[key] || "#ddd" }} />)}</span>
        </button>
        <div className="vsn-brandkit-card__body">
          <div><strong>{kit.name}</strong><small>{kit.isDefault ? "Store default" : `Updated ${new Date(kit.updatedAt).toLocaleDateString()}`}</small></div>
          <div className="vsn-row-actions">
            {tab === "active" ? <>
              <VsnButton size="sm" icon={<Edit3 size={13} />} onClick={() => openForm(kit)}>Edit</VsnButton>
              {!kit.isDefault ? <VsnButton size="sm" icon={<Star size={13} />} onClick={() => submit({ intent: "default", id: kit.id })}>Set default</VsnButton> : null}
              <VsnButton size="sm" variant="danger" icon={<Trash2 size={13} />} onClick={() => submit({ intent: "trash", id: kit.id })}>Move to Trash</VsnButton>
            </> : <>
              <VsnButton size="sm" icon={<RotateCcw size={13} />} onClick={() => submit({ intent: "restore", id: kit.id })}>Restore</VsnButton>
              <VsnButton size="sm" variant="danger" icon={<Trash2 size={13} />} onClick={async () => { const ok = await confirmAction({ title: "Delete Brand Kit permanently?", message: `${kit.name} will be permanently deleted. This cannot be undone.`, confirmLabel: "Delete permanently", tone: "danger" }); if (ok) submit({ intent: "delete", id: kit.id }); }}>Delete</VsnButton>
            </>}
          </div>
        </div>
      </article>)}
    </div> : <VsnEmpty title={tab === "trash" ? "Trash is empty" : q ? "No Brand Kit matches your search" : "No Brand Kits yet"} description={tab === "active" && !q ? "Create a kit with your logo, colours and fonts, then apply it to Global Design." : undefined} action={tab === "active" && !q ? <VsnButton variant="primary" icon={<Plus size={14} />} onClick={() => openForm(null)}>New Brand Kit</VsnButton> : null} />}
  </VsnPage>;
}
