import { VsnInput, VsnTextarea } from "../ui/VsnToolkit";

export default function BrandProfileFields({ form, onChange }) {
  const field = (key) => (event) => onChange?.(key, event.currentTarget.value);
  return <div className="vsn-stack compact">
    <div>
      <strong>Brand Intelligence</strong>
      <p className="mt-1 text-sm text-[#666]">Optional guidance for VSN AI. These rules do not alter storefront rendering or existing Global Design tokens.</p>
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
