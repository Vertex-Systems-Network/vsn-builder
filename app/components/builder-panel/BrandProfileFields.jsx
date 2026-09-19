import { useState } from "react";
import { VsnButton, VsnCheckbox, VsnInput, VsnNotice, VsnTextarea } from "../ui/VsnToolkit";

const PROFILE_FIELDS = Object.freeze([
  ["brandSummary", "summary"],
  ["brandAudience", "audience"],
  ["brandToneVoice", "toneVoice"],
  ["brandImageryDirection", "imageryDirection"],
  ["brandMerchandisingRules", "merchandisingRules"],
  ["brandCtaRules", "ctaRules"],
  ["brandComponentGuidance", "componentGuidance"],
]);

export default function BrandProfileFields({
  form,
  onChange,
  extractionEnabled = false,
  extractionBusy = false,
  extractionResult = null,
  onExtract,
}) {
  const [sourceUrl,setSourceUrl]=useState("");
  const [authorized,setAuthorized]=useState(false);
  const field = (key) => (event) => onChange?.(key, event.currentTarget.value);
  const extracted = extractionResult?.ok && extractionResult?.intent === "extract-profile" ? extractionResult : null;

  const useSuggestions=()=>{
    const profile=extracted?.profile||{};
    for(const [formKey,profileKey] of PROFILE_FIELDS)onChange?.(formKey,String(profile[profileKey]||""));
    onChange?.("brandDoRules",Array.isArray(profile.doRules)?profile.doRules.join("\n"):"");
    onChange?.("brandDontRules",Array.isArray(profile.dontRules)?profile.dontRules.join("\n"):"");
  };

  const analyze=()=>onExtract?.({sourceUrl:sourceUrl.trim(),authorized});

  return <div className="vsn-stack compact">
    <div>
      <strong>Brand Intelligence</strong>
      <p className="mt-1 text-sm text-[#666]">Optional guidance for VSN AI. These rules do not alter storefront rendering or existing Global Design tokens.</p>
    </div>

    <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-4">
      <strong>Analyze an owned website</strong>
      <p className="mt-1 text-sm text-[#666]">Preview-only. VSN reads bounded public text and proposes Brand Profile guidance; nothing is saved until you choose suggestions and then save this Brand Kit.</p>
      <div className="mt-3 vsn-form-stack">
        <VsnInput label="Owned / authorized public HTTPS URL" type="url" value={sourceUrl} onChange={(event)=>setSourceUrl(event.currentTarget.value)} placeholder="https://yourbrand.com"/>
        <VsnCheckbox label="I confirm that I own, control, or am authorized to analyze this website." checked={authorized} onChange={(event)=>setAuthorized(event.currentTarget.checked)}/>
        <div className="vsn-row-actions">
          <VsnButton
            disabled={!extractionEnabled||!authorized||!sourceUrl.trim()||extractionBusy}
            loading={extractionBusy}
            onClick={analyze}
          >Analyze website</VsnButton>
          {!extractionEnabled?<span className="text-xs text-[#666]">Enable VSN AI Builder to use extraction.</span>:null}
        </div>
        {extractionResult?.intent==="extract-profile"&&!extractionResult?.ok?<VsnNotice tone="critical">{extractionResult.error||"Brand extraction failed."}</VsnNotice>:null}
        {extracted?<div className="rounded-lg border border-[#d8e8df] bg-white p-3">
          <div className="vsn-list-row">
            <div><strong>Suggestions ready</strong><p>{extracted.sourceHost} · Brand Profile v{extracted.profile?.version||1} · preview only</p></div>
            <VsnButton variant="primary" onClick={useSuggestions}>Use suggestions</VsnButton>
          </div>
          {extracted.profile?.summary?<p className="mt-2 text-sm text-[#555]">{extracted.profile.summary}</p>:null}
          <p className="mt-2 text-xs text-[#666]">Using suggestions only fills the fields below. Review them before the normal Brand Kit Save action.</p>
        </div>:null}
      </div>
    </div>

    <div className="vsn-two-column-grid">
      <VsnTextarea label="Brand summary" rows={3} value={form.brandSummary||""} onChange={field("brandSummary")} placeholder="What the brand stands for, in plain language."/>
      <VsnTextarea label="Primary audience" rows={3} value={form.brandAudience||""} onChange={field("brandAudience")} placeholder="Who the brand serves and what matters to them."/>
    </div>
    <VsnTextarea label="Tone & voice" rows={4} value={form.brandToneVoice||""} onChange={field("brandToneVoice")} placeholder="Example: concise, authoritative, warm; avoid hype and slang."/>
    <VsnTextarea label="Imagery direction" rows={4} value={form.brandImageryDirection||""} onChange={field("brandImageryDirection")} placeholder="Photography/art direction, subjects, lighting, composition and visual constraints."/>
    <div className="vsn-two-column-grid">
      <VsnTextarea label="Merchandising rules" rows={4} value={form.brandMerchandisingRules||""} onChange={field("brandMerchandisingRules")} placeholder="How products, offers, proof and hierarchy should be presented."/>
      <VsnTextarea label="CTA rules" rows={4} value={form.brandCtaRules||""} onChange={field("brandCtaRules")} placeholder="Preferred CTA language, hierarchy and behaviors to avoid."/>
    </div>
    <VsnTextarea label="Reusable component guidance" rows={4} value={form.brandComponentGuidance||""} onChange={field("brandComponentGuidance")} placeholder="Preferred hero, card, trust, navigation and section patterns."/>
    <div className="vsn-two-column-grid">
      <VsnTextarea label="Do rules" rows={5} value={form.brandDoRules||""} onChange={field("brandDoRules")} placeholder={"One rule per line\nUse concise benefit-led headlines\nKeep product imagery natural"}/>
      <VsnTextarea label="Don't rules" rows={5} value={form.brandDontRules||""} onChange={field("brandDontRules")} placeholder={"One rule per line\nDo not use neon gradients\nDo not invent urgency claims"}/>
    </div>
    <VsnInput label="Profile version" value="Brand Profile v1" disabled/>
  </div>;
}
