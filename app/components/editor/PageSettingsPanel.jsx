import { useState } from "react";
import { VsnButton, VsnTextField, VsnNumberField, VsnTextArea, VsnSelect, VsnOption, VsnCheckbox, VsnColorField, VsnSearchField, VsnUrlField, VsnDateField, VsnSpinner } from "./EditorUi";
import { openShopifyFilePicker } from "./EditorControls";
import PolarisIcon from "../ui/PolarisIcon";
import { isCampaignTemplate } from "../../builder/campaignSystem";

function Field({ label, children }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-medium text-[#5c5f62]">{label}</span>
      {children}
    </label>
  );
}

const inputClass = "w-full rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] px-2.5 py-2 text-xs text-[#202223] outline-none focus:border-[#95BF47]";

export default function PageSettingsPanel({
  open,
  onClose,
  page,
  settings = {},
  onChange,
  headers = [],
  footers = [],
  resourceFeaturedImage = "",
}) {
  const [templateImageBusy, setTemplateImageBusy] = useState(false);
  const [templateImageError, setTemplateImageError] = useState("");

  if (!open) return null;

  const update = (patch) => onChange?.({ ...settings, ...patch });
  const isHeader = page?.template === "header";
  const isFooter = page?.template === "footer";
  const isGlobal = isHeader || isFooter;
  const isCampaign = isCampaignTemplate(page?.template);

  const chooseTemplateImage = async () => {
    if (templateImageBusy) return;
    setTemplateImageBusy(true);
    setTemplateImageError("");
    try {
      const files = await openShopifyFilePicker({ multiSelect: false, mediaTypes: ["MediaImage"] });
      const file = files?.[0];
      const url = String(file?.url || file?.previewUrl || "").trim();
      if (url) update({ templateImage: url });
    } catch (error) {
      setTemplateImageError(error instanceof Error ? error.message : "Could not choose a Shopify image.");
    } finally {
      setTemplateImageBusy(false);
    }
  };

  return (
    <aside className="absolute right-[calc(var(--vsn-right-panel,256px)+12px)] top-3 z-30 flex max-h-[calc(100%-24px)] w-[330px] flex-col overflow-hidden rounded-xl border border-[#e3e3e3] bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-[#e3e3e3] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-[#202223]">Page Settings</p>
          <p className="mt-0.5 text-[10px] text-[#8c9196]">Assignments, SEO and template behavior</p>
        </div>
        <VsnButton type="button" onClick={onClose} variant="icon" size="sm" className="vsn-icon-button"><PolarisIcon type="x" size="small" /></VsnButton>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {!isGlobal && !isCampaign && (
          <section className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6d7175]">Header & Footer</p>
            <VsnCheckbox checked={settings.headerEnabled !== false} onChange={(e) => update({ headerEnabled: e.currentTarget.checked })}>Show builder header</VsnCheckbox>
            {settings.headerEnabled !== false && (
              <Field label="Header assignment">
                <VsnSelect label="Header assignment" labelAccessibilityVisibility="exclusive" value={settings.headerId || ""} onChange={(e) => update({ headerId: e.currentTarget.value })}><VsnOption value="">Default Global Header</VsnOption>{headers.map((item) => <VsnOption key={item.id} value={item.id}>{item.title}{item.status !== "published" ? " (draft)" : ""}</VsnOption>)}</VsnSelect>
              </Field>
            )}
            <VsnCheckbox checked={settings.footerEnabled !== false} onChange={(e) => update({ footerEnabled: e.currentTarget.checked })}>Show builder footer</VsnCheckbox>
            {settings.footerEnabled !== false && (
              <Field label="Footer assignment">
                <VsnSelect label="Footer assignment" labelAccessibilityVisibility="exclusive" value={settings.footerId || ""} onChange={(e) => update({ footerId: e.currentTarget.value })}><VsnOption value="">Default Global Footer</VsnOption>{footers.map((item) => <VsnOption key={item.id} value={item.id}>{item.title}{item.status !== "published" ? " (draft)" : ""}</VsnOption>)}</VsnSelect>
              </Field>
            )}
          </section>
        )}

        {isHeader && (
          <section className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6d7175]">Header behavior</p>
            <VsnCheckbox checked={settings.sticky === true} onChange={(e) => update({ sticky: e.currentTarget.checked })}>Sticky header</VsnCheckbox>
            <VsnCheckbox checked={settings.transparent === true} onChange={(e) => update({ transparent: e.currentTarget.checked })}>Transparent over content</VsnCheckbox>
            <VsnCheckbox checked={settings.mobileMenu !== false} onChange={(e) => update({ mobileMenu: e.currentTarget.checked })}>Enable mobile menu</VsnCheckbox>
            <Field label="Mobile breakpoint (px)"><VsnNumberField label="Mobile breakpoint" labelAccessibilityVisibility="exclusive" min={320} max={1200} value={String(settings.mobileBreakpoint ?? 749)} onInput={(e) => update({ mobileBreakpoint: Math.max(320, Number(e.currentTarget.value) || 749) })} /></Field>
          </section>
        )}

        {isFooter && (
          <section className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6d7175]">Footer behavior</p>
            <VsnCheckbox checked={settings.fullWidth !== false} onChange={(e) => update({ fullWidth: e.currentTarget.checked })}>Full width</VsnCheckbox>
          </section>
        )}

        {!isGlobal && !isCampaign && (
          <section className="space-y-3 border-t border-[#f1f1f1] pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6d7175]">Template Assignment</p>
            <Field label="Priority"><VsnNumberField label="Priority" labelAccessibilityVisibility="exclusive" min={1} max={9999} value={String(settings.assignmentPriority ?? 100)} onInput={(e)=>update({assignmentPriority: Math.max(1, Number(e.currentTarget.value)||100)})} /></Field>
            <Field label="Include path contains"><VsnTextField label="Include path" labelAccessibilityVisibility="exclusive" value={settings.includePath || ""} onInput={(e)=>update({includePath:e.currentTarget.value})} placeholder="/collections/sale" /></Field>
            <Field label="Exclude path contains"><VsnTextField label="Exclude path" labelAccessibilityVisibility="exclusive" value={settings.excludePath || ""} onInput={(e)=>update({excludePath:e.currentTarget.value})} placeholder="/wholesale" /></Field>
            <Field label="Customer state"><VsnSelect label="Customer state" labelAccessibilityVisibility="exclusive" value={settings.customerState || "any"} onChange={(e)=>update({customerState:e.currentTarget.value})}><VsnOption value="any">Any visitor</VsnOption><VsnOption value="logged-in">Logged in</VsnOption><VsnOption value="logged-out">Logged out</VsnOption></VsnSelect></Field>
            <p className="text-[10px] leading-4 text-[#8c9196]">Higher-priority matching rules win before the default template. Specific product/collection assignments still take precedence over generic defaults.</p>
          </section>
        )}

        {!isGlobal && !isCampaign && (
          <section className="space-y-3 border-t border-[#f1f1f1] pt-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6d7175]">Image</p>
              <p className="mt-1 text-[10px] leading-4 text-[#8c9196]">This image is used by the Templates list and grid views. You can use the current Shopify resource featured image when one is available.</p>
            </div>
            {settings.templateImage ? (
              <div className="overflow-hidden rounded-lg border border-[#e3e3e3] bg-[#f6f6f7]">
                <img src={settings.templateImage} alt="Template preview" className="h-28 w-full object-cover" />
              </div>
            ) : null}
            <Field label="Image URL">
              <VsnUrlField label="Image URL" labelAccessibilityVisibility="exclusive" value={settings.templateImage || ""} onInput={(e) => update({ templateImage: e.currentTarget.value })} placeholder="Choose from Shopify Files or paste an image URL" />
            </Field>
            <div className="flex flex-wrap gap-2">
              <VsnButton type="button" variant="secondary" size="sm" disabled={templateImageBusy} onClick={chooseTemplateImage}>
                {templateImageBusy ? "Opening…" : "Choose from Shopify Files"}
              </VsnButton>
              {resourceFeaturedImage && resourceFeaturedImage !== settings.templateImage ? (
                <VsnButton type="button" variant="tertiary" size="sm" onClick={() => update({ templateImage: resourceFeaturedImage })}>Use featured image</VsnButton>
              ) : null}
              {settings.ogImage && settings.ogImage !== settings.templateImage ? (
                <VsnButton type="button" variant="tertiary" size="sm" onClick={() => update({ templateImage: settings.ogImage })}>Use OG image</VsnButton>
              ) : null}
              {settings.templateImage ? <VsnButton type="button" variant="tertiary" size="sm" onClick={() => update({ templateImage: "" })}>Clear</VsnButton> : null}
            </div>
            {templateImageError ? <p className="text-[10px] leading-4 text-[#d72c0d]">{templateImageError}</p> : null}
          </section>
        )}

        {!isGlobal && !isCampaign && (
          <section className="space-y-3 border-t border-[#f1f1f1] pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6d7175]">SEO</p>
            <Field label="SEO title"><VsnTextField label="SEO title" labelAccessibilityVisibility="exclusive" value={settings.seoTitle || ""} onInput={(e) => update({ seoTitle: e.currentTarget.value })} placeholder={page?.title || "Page title"} /></Field>
            <Field label="Meta description"><VsnTextArea label="Meta description" labelAccessibilityVisibility="exclusive" value={settings.seoDescription || ""} onInput={(e) => update({ seoDescription: e.currentTarget.value })} placeholder="Search description" rows={4} /></Field>
            <Field label="Canonical URL"><VsnUrlField label="Canonical URL" labelAccessibilityVisibility="exclusive" value={settings.canonical || ""} onInput={(e) => update({ canonical: e.currentTarget.value })} placeholder="Leave blank to preserve Shopify canonical" /></Field>
            <Field label="Open Graph title"><VsnTextField label="Open Graph title" labelAccessibilityVisibility="exclusive" value={settings.ogTitle || ""} onInput={(e) => update({ ogTitle: e.currentTarget.value })} /></Field>
            <Field label="Open Graph description"><VsnTextArea label="Open Graph description" labelAccessibilityVisibility="exclusive" value={settings.ogDescription || ""} onInput={(e) => update({ ogDescription: e.currentTarget.value })} rows={3} /></Field>
            <Field label="Open Graph image URL"><VsnUrlField label="Open Graph image URL" labelAccessibilityVisibility="exclusive" value={settings.ogImage || ""} onInput={(e) => update({ ogImage: e.currentTarget.value })} /></Field>
            <VsnCheckbox checked={settings.schemaEnabled !== false} onChange={(e) => update({ schemaEnabled: e.currentTarget.checked })}>Structured data / schema</VsnCheckbox>
          </section>
        )}

        {isCampaign && (
          <section className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6d7175]">Campaign</p>
              <p className="mt-1 text-[10px] leading-4 text-[#8c9196]">Server-enforced schedule and storefront trigger settings for this {page?.template}.</p>
            </div>
            <VsnCheckbox checked={settings.campaignEnabled !== false} onChange={(e)=>update({campaignEnabled:e.currentTarget.checked})}>Enable campaign</VsnCheckbox>
            <Field label="Start (ISO date/time)"><VsnTextField label="Campaign start" labelAccessibilityVisibility="exclusive" value={settings.campaignStart || ""} onInput={(e)=>update({campaignStart:e.currentTarget.value})} placeholder="2026-08-10T09:00:00Z" /></Field>
            <Field label="End (ISO date/time)"><VsnTextField label="Campaign end" labelAccessibilityVisibility="exclusive" value={settings.campaignEnd || ""} onInput={(e)=>update({campaignEnd:e.currentTarget.value})} placeholder="2026-08-20T23:59:59Z" /></Field>
            <Field label="Timezone"><VsnTextField label="Campaign timezone" labelAccessibilityVisibility="exclusive" value={settings.campaignTimezone || "UTC"} onInput={(e)=>update({campaignTimezone:e.currentTarget.value})} placeholder="UTC / Asia/Karachi" /></Field>
            <Field label="Fallback campaign template ID"><VsnTextField label="Fallback campaign" labelAccessibilityVisibility="exclusive" value={settings.campaignFallbackPageId || ""} onInput={(e)=>update({campaignFallbackPageId:e.currentTarget.value})} placeholder="Optional published campaign page ID" /></Field>
            <Field label="Trigger"><VsnSelect label="Trigger" labelAccessibilityVisibility="exclusive" value={settings.campaignTrigger || "delay"} onChange={(e)=>update({campaignTrigger:e.currentTarget.value})}>
              <VsnOption value="delay">Delay</VsnOption><VsnOption value="exit-intent">Exit intent</VsnOption><VsnOption value="scroll">Scroll percentage</VsnOption><VsnOption value="inactivity">Inactivity</VsnOption><VsnOption value="click-selector">Click selector</VsnOption><VsnOption value="cart-state">Cart state</VsnOption><VsnOption value="page-count">Page count</VsnOption>
            </VsnSelect></Field>
            {settings.campaignTrigger === "delay" ? <Field label="Delay (ms)"><VsnNumberField label="Delay" labelAccessibilityVisibility="exclusive" min={0} max={3600000} value={String(settings.campaignDelayMs ?? 1500)} onInput={(e)=>update({campaignDelayMs:Number(e.currentTarget.value)||0})}/></Field> : null}
            {settings.campaignTrigger === "scroll" ? <Field label="Scroll %"><VsnNumberField label="Scroll percent" labelAccessibilityVisibility="exclusive" min={1} max={100} value={String(settings.campaignScrollPercent ?? 50)} onInput={(e)=>update({campaignScrollPercent:Number(e.currentTarget.value)||50})}/></Field> : null}
            {settings.campaignTrigger === "inactivity" ? <Field label="Inactivity (ms)"><VsnNumberField label="Inactivity" labelAccessibilityVisibility="exclusive" min={1000} max={3600000} value={String(settings.campaignInactivityMs ?? 8000)} onInput={(e)=>update({campaignInactivityMs:Number(e.currentTarget.value)||8000})}/></Field> : null}
            {settings.campaignTrigger === "click-selector" ? <Field label="CSS selector"><VsnTextField label="Click selector" labelAccessibilityVisibility="exclusive" value={settings.campaignClickSelector || ""} onInput={(e)=>update({campaignClickSelector:e.currentTarget.value})} placeholder=".open-offer" /></Field> : null}
            {settings.campaignTrigger === "cart-state" ? <Field label="Cart state"><VsnSelect label="Cart state" labelAccessibilityVisibility="exclusive" value={settings.campaignCartState || "any"} onChange={(e)=>update({campaignCartState:e.currentTarget.value})}><VsnOption value="any">Any</VsnOption><VsnOption value="empty">Empty cart</VsnOption><VsnOption value="has-items">Cart has items</VsnOption></VsnSelect></Field> : null}
            {settings.campaignTrigger === "page-count" ? <Field label="Show after page views"><VsnNumberField label="Page count" labelAccessibilityVisibility="exclusive" min={1} max={1000} value={String(settings.campaignPageCount ?? 2)} onInput={(e)=>update({campaignPageCount:Number(e.currentTarget.value)||2})}/></Field> : null}
            <Field label="Frequency cap"><VsnSelect label="Frequency" labelAccessibilityVisibility="exclusive" value={settings.campaignFrequency || "session"} onChange={(e)=>update({campaignFrequency:e.currentTarget.value})}><VsnOption value="session">Once per session</VsnOption><VsnOption value="day">Once per day</VsnOption><VsnOption value="week">Once per week</VsnOption><VsnOption value="once">Once per visitor</VsnOption><VsnOption value="custom">Custom hours</VsnOption></VsnSelect></Field>
            {settings.campaignFrequency === "custom" ? <Field label="Custom frequency (hours)"><VsnNumberField label="Custom frequency" labelAccessibilityVisibility="exclusive" min={1} max={8760} value={String(settings.campaignFrequencyHours ?? 24)} onInput={(e)=>update({campaignFrequencyHours:Number(e.currentTarget.value)||24})}/></Field> : null}
            <div className="border-t border-[#f1f1f1] pt-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-[#6d7175]">Display conditions</p></div>
            <Field label="Include path contains"><VsnTextField label="Campaign include path" labelAccessibilityVisibility="exclusive" value={settings.campaignIncludePath || ""} onInput={(e)=>update({campaignIncludePath:e.currentTarget.value})} placeholder="/products/" /></Field>
            <Field label="Exclude path contains"><VsnTextField label="Campaign exclude path" labelAccessibilityVisibility="exclusive" value={settings.campaignExcludePath || ""} onInput={(e)=>update({campaignExcludePath:e.currentTarget.value})} placeholder="/cart" /></Field>
            <Field label="Customer state"><VsnSelect label="Campaign customer state" labelAccessibilityVisibility="exclusive" value={settings.campaignCustomerState || "any"} onChange={(e)=>update({campaignCustomerState:e.currentTarget.value})}><VsnOption value="any">Any visitor</VsnOption><VsnOption value="logged-in">Logged in</VsnOption><VsnOption value="logged-out">Logged out</VsnOption></VsnSelect></Field>
            <Field label="Page templates (comma-separated)"><VsnTextField label="Campaign templates" labelAccessibilityVisibility="exclusive" value={settings.campaignTemplates || ""} onInput={(e)=>update({campaignTemplates:e.currentTarget.value})} placeholder="product,collection,index" /></Field>
            <Field label="Resource handles (comma-separated)"><VsnTextField label="Campaign resource handles" labelAccessibilityVisibility="exclusive" value={settings.campaignResourceHandles || ""} onInput={(e)=>update({campaignResourceHandles:e.currentTarget.value})}/></Field>
            <Field label="Languages"><VsnTextField label="Campaign languages" labelAccessibilityVisibility="exclusive" value={settings.campaignLanguages || ""} onInput={(e)=>update({campaignLanguages:e.currentTarget.value})} placeholder="en,tr" /></Field>
            <Field label="Countries"><VsnTextField label="Campaign countries" labelAccessibilityVisibility="exclusive" value={settings.campaignCountries || ""} onInput={(e)=>update({campaignCountries:e.currentTarget.value})} placeholder="US,TR,PK" /></Field>
            <div className="border-t border-[#f1f1f1] pt-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-[#6d7175]">{page?.template === "floating-element" ? "Floating behavior" : "Overlay behavior"}</p></div>
            <Field label="Max width (px)"><VsnNumberField label="Campaign max width" labelAccessibilityVisibility="exclusive" min={180} max={1800} value={String(settings.campaignMaxWidth ?? (page?.template === "floating-element" ? 360 : 640))} onInput={(e)=>update({campaignMaxWidth:Number(e.currentTarget.value)||(page?.template === "floating-element" ? 360 : 640)})}/></Field>
            {page?.template === "floating-element" ? <>
              <Field label="Position"><VsnSelect label="Floating position" labelAccessibilityVisibility="exclusive" value={settings.campaignFloatingPosition || "bottom-right"} onChange={(e)=>update({campaignFloatingPosition:e.currentTarget.value})}><VsnOption value="top-left">Top left</VsnOption><VsnOption value="top-center">Top center</VsnOption><VsnOption value="top-right">Top right</VsnOption><VsnOption value="middle-left">Middle left</VsnOption><VsnOption value="middle-right">Middle right</VsnOption><VsnOption value="bottom-left">Bottom left</VsnOption><VsnOption value="bottom-center">Bottom center</VsnOption><VsnOption value="bottom-right">Bottom right</VsnOption></VsnSelect></Field>
              <div className="grid grid-cols-2 gap-2"><Field label="X offset"><VsnNumberField label="X offset" labelAccessibilityVisibility="exclusive" min={0} max={240} value={String(settings.campaignOffsetX ?? 20)} onInput={(e)=>update({campaignOffsetX:Number(e.currentTarget.value)||0})}/></Field><Field label="Y offset"><VsnNumberField label="Y offset" labelAccessibilityVisibility="exclusive" min={0} max={240} value={String(settings.campaignOffsetY ?? 20)} onInput={(e)=>update({campaignOffsetY:Number(e.currentTarget.value)||0})}/></Field></div>
              <VsnCheckbox checked={settings.campaignHideMobile === true} onChange={(e)=>update({campaignHideMobile:e.currentTarget.checked})}>Hide on mobile</VsnCheckbox>
            </> : null}
            {page?.template === "drawer" ? <Field label="Drawer side"><VsnSelect label="Drawer side" labelAccessibilityVisibility="exclusive" value={settings.campaignDrawerSide || "right"} onChange={(e)=>update({campaignDrawerSide:e.currentTarget.value})}><VsnOption value="right">Right</VsnOption><VsnOption value="left">Left</VsnOption></VsnSelect></Field> : null}
            <VsnCheckbox checked={settings.campaignShowClose !== false} onChange={(e)=>update({campaignShowClose:e.currentTarget.checked})}>Show close button</VsnCheckbox>
            {page?.template !== "floating-element" ? <VsnCheckbox checked={settings.campaignCloseOnBackdrop !== false} onChange={(e)=>update({campaignCloseOnBackdrop:e.currentTarget.checked})}>Close on backdrop click</VsnCheckbox> : null}
            <VsnCheckbox checked={settings.campaignCloseOnEscape !== false} onChange={(e)=>update({campaignCloseOnEscape:e.currentTarget.checked})}>Close on Escape</VsnCheckbox>
            <div className="border-t border-[#f1f1f1] pt-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-[#6d7175]">Campaign metadata</p></div>
            <Field label="UTM source"><VsnTextField label="UTM source" labelAccessibilityVisibility="exclusive" value={settings.campaignUtmSource || ""} onInput={(e)=>update({campaignUtmSource:e.currentTarget.value})}/></Field>
            <Field label="UTM medium"><VsnTextField label="UTM medium" labelAccessibilityVisibility="exclusive" value={settings.campaignUtmMedium || ""} onInput={(e)=>update({campaignUtmMedium:e.currentTarget.value})}/></Field>
            <Field label="UTM campaign"><VsnTextField label="UTM campaign" labelAccessibilityVisibility="exclusive" value={settings.campaignUtmCampaign || ""} onInput={(e)=>update({campaignUtmCampaign:e.currentTarget.value})}/></Field>
          </section>
        )}
      </div>
    </aside>
  );
}
