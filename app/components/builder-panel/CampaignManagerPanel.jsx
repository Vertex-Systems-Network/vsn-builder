import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, Paintbrush, Pencil, Plus, Trash2 } from "lucide-react";
import { VsnButton, VsnCard, VsnEmpty, VsnInput, VsnPage, VsnSearchInput, VsnSelect, VsnTabs } from "../ui/VsnToolkit.jsx";
import { campaignScheduleState, normalizeCampaignSettings } from "../../builder/campaignSystem.js";

const label = (value) => String(value || "").replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
const TRIGGERS = [["delay", "After a delay"], ["exit-intent", "Exit intent"], ["scroll", "Scroll depth"], ["inactivity", "Visitor inactivity"], ["click-selector", "Click on an element"], ["cart-state", "Cart state"], ["page-count", "Pages viewed"]];
const FREQUENCIES = [["session", "Once per session"], ["day", "Once per day"], ["week", "Once per week"], ["once", "Only once"], ["custom", "Every N hours"]];
const POSITIONS = ["top-left", "top-center", "top-right", "middle-left", "middle-right", "bottom-left", "bottom-center", "bottom-right"];
const STATE_TONE = { active: "success", scheduled: "warning", expired: "neutral", disabled: "critical" };

function itemState(item, floating) {
  const settings = item.settings || {};
  if (settings.campaignEnabled === false) return "disabled";
  return item.scheduleState || campaignScheduleState(normalizeCampaignSettings(settings, floating ? "floating-element" : item.template));
}

function blankForm(floating, template) {
  const kind = floating ? "floating-element" : template || "popup";
  return { id: "", title: floating ? "Floating CTA" : "New campaign", template: kind, settings: normalizeCampaignSettings(floating ? { campaignDelayMs: 500, campaignFloatingPosition: "bottom-right" } : {}, kind) };
}

// List -> New/Edit form -> Save -> back to list, shared by Campaigns and Floating Elements.
export default function CampaignManagerPanel({ data, actionData, submit, busy, onEditPage, confirmAction, Notice, floating = false }) {
  const noun = floating ? "floating element" : "campaign";
  const [view, setView] = useState("list");
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [form, setForm] = useState(() => blankForm(floating));
  const items = useMemo(() => data.items || [], [data.items]);
  const types = floating ? [] : data.templates || ["popup", "modal", "drawer", "flyout", "announcement-overlay"];

  useEffect(() => {
    if (actionData?.ok && ["create", "update-settings"].includes(actionData.intent)) setView("list");
  }, [actionData]);

  const rows = useMemo(() => items.filter((item) => {
    const state = itemState(item, floating);
    if (tab !== "all" && state !== tab) return false;
    if (typeFilter !== "all" && item.template !== typeFilter) return false;
    return !query || String(item.title || "").toLowerCase().includes(query.toLowerCase());
  }), [items, tab, typeFilter, query, floating]);
  const counts = useMemo(() => items.reduce((map, item) => { const state = itemState(item, floating); map[state] = (map[state] || 0) + 1; return map; }, {}), [items, floating]);

  const set = (key, value) => setForm((current) => ({ ...current, settings: { ...current.settings, [key]: value } }));
  const openForm = (item) => {
    setForm(item ? { id: item.id, title: item.title, template: item.template, settings: normalizeCampaignSettings(item.settings || {}, floating ? "floating-element" : item.template) } : blankForm(floating, types[0]));
    setView("form");
  };
  const save = () => submit({ intent: form.id ? "update-settings" : "create", id: form.id, title: form.title, template: form.template, settings: JSON.stringify(form.settings) });
  const s = form.settings;

  if (view === "form") {
    return <VsnPage title={form.id ? `Edit ${form.title}` : `New ${noun}`} subtitle={floating ? "Where it shows, when it appears and how often." : "Choose the format, when it opens, how often and for whom."}
      actions={<VsnButton icon={<ArrowLeft size={14} />} onClick={() => setView("list")}>Back to list</VsnButton>}>
      {Notice ? <Notice data={actionData} /> : null}
      <div className="vsn-manager-form">
        <div className="vsn-manager-form__main">
          <VsnCard title="Basics">
            <div className="vsn-two-column-grid">
              <VsnInput label="Name" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
              {floating
                ? <VsnSelect label="Position on screen" value={s.campaignFloatingPosition} onChange={(event) => set("campaignFloatingPosition", event.target.value)}>{POSITIONS.map((value) => <option key={value} value={value}>{label(value)}</option>)}</VsnSelect>
                : <VsnSelect label="Format" value={form.template} disabled={Boolean(form.id)} onChange={(event) => setForm({ ...form, template: event.target.value, settings: normalizeCampaignSettings(form.settings, event.target.value) })}>{types.map((value) => <option key={value} value={value}>{label(value)}</option>)}</VsnSelect>}
            </div>
            <div className="vsn-switch-row"><span><b>Enabled</b><small>Turn off to pause without deleting.</small></span><button type="button" role="switch" aria-checked={s.campaignEnabled !== false} className={`vsn-toggle ${s.campaignEnabled !== false ? "is-on" : ""}`} onClick={() => set("campaignEnabled", s.campaignEnabled === false)}><span /></button></div>
          </VsnCard>
          <VsnCard title="When it appears">
            <div className="vsn-two-column-grid">
              <VsnSelect label="Trigger" value={s.campaignTrigger} onChange={(event) => set("campaignTrigger", event.target.value)}>{TRIGGERS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</VsnSelect>
              {s.campaignTrigger === "delay" ? <VsnInput label="Delay (seconds)" type="number" min="0" value={Math.round(s.campaignDelayMs / 100) / 10} onChange={(event) => set("campaignDelayMs", Math.round(Number(event.target.value || 0) * 1000))} /> : null}
              {s.campaignTrigger === "scroll" ? <VsnInput label="Scroll depth (%)" type="number" min="1" max="100" value={s.campaignScrollPercent} onChange={(event) => set("campaignScrollPercent", Number(event.target.value))} /> : null}
              {s.campaignTrigger === "inactivity" ? <VsnInput label="Inactive for (seconds)" type="number" min="1" value={Math.round(s.campaignInactivityMs / 1000)} onChange={(event) => set("campaignInactivityMs", Number(event.target.value || 1) * 1000)} /> : null}
              {s.campaignTrigger === "click-selector" ? <VsnInput label="CSS selector to click" value={s.campaignClickSelector} placeholder=".open-offer" onChange={(event) => set("campaignClickSelector", event.target.value)} /> : null}
              {s.campaignTrigger === "cart-state" ? <VsnSelect label="Cart" value={s.campaignCartState} onChange={(event) => set("campaignCartState", event.target.value)}><option value="any">Any</option><option value="empty">Empty</option><option value="has-items">Has items</option></VsnSelect> : null}
              {s.campaignTrigger === "page-count" ? <VsnInput label="After pages viewed" type="number" min="1" value={s.campaignPageCount} onChange={(event) => set("campaignPageCount", Number(event.target.value))} /> : null}
              <VsnSelect label="How often" value={s.campaignFrequency} onChange={(event) => set("campaignFrequency", event.target.value)}>{FREQUENCIES.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</VsnSelect>
              {s.campaignFrequency === "custom" ? <VsnInput label="Every (hours)" type="number" min="1" value={s.campaignFrequencyHours} onChange={(event) => set("campaignFrequencyHours", Number(event.target.value))} /> : null}
            </div>
          </VsnCard>
          <VsnCard title="Schedule">
            <div className="vsn-two-column-grid">
              <VsnInput label="Start" type="datetime-local" value={String(s.campaignStart || "").slice(0, 16)} onChange={(event) => set("campaignStart", event.target.value)} />
              <VsnInput label="End" type="datetime-local" value={String(s.campaignEnd || "").slice(0, 16)} onChange={(event) => set("campaignEnd", event.target.value)} />
            </div>
            <small className="vsn-help-text">Leave empty to run until you turn it off. Times use {s.campaignTimezone || "UTC"}.</small>
          </VsnCard>
          <VsnCard title="Who sees it">
            <div className="vsn-two-column-grid">
              <VsnInput label="Only on paths" value={s.campaignIncludePath} placeholder="/collections/*, /products/*" onChange={(event) => set("campaignIncludePath", event.target.value)} />
              <VsnInput label="Never on paths" value={s.campaignExcludePath} placeholder="/cart, /checkout" onChange={(event) => set("campaignExcludePath", event.target.value)} />
              <VsnSelect label="Customers" value={s.campaignCustomerState} onChange={(event) => set("campaignCustomerState", event.target.value)}><option value="any">Everyone</option><option value="logged-in">Logged-in customers</option><option value="logged-out">Guests</option></VsnSelect>
              <VsnInput label="Countries (codes)" value={s.campaignCountries} placeholder="US, GB, PK" onChange={(event) => set("campaignCountries", event.target.value)} />
            </div>
            <div className="vsn-switch-row"><span><b>Hide on mobile</b></span><button type="button" role="switch" aria-checked={s.campaignHideMobile === true} className={`vsn-toggle ${s.campaignHideMobile ? "is-on" : ""}`} onClick={() => set("campaignHideMobile", !s.campaignHideMobile)}><span /></button></div>
          </VsnCard>
        </div>
        <aside className="vsn-manager-form__side">
          <VsnCard title="Summary">
            <ul className="vsn-summary-list">
              <li><span>{floating ? "Position" : "Format"}</span><b>{label(floating ? s.campaignFloatingPosition : form.template)}</b></li>
              <li><span>Trigger</span><b>{TRIGGERS.find(([value]) => value === s.campaignTrigger)?.[1]}</b></li>
              <li><span>Frequency</span><b>{FREQUENCIES.find(([value]) => value === s.campaignFrequency)?.[1]}</b></li>
              <li><span>Status</span><b>{s.campaignEnabled === false ? "Paused" : label(campaignScheduleState(s))}</b></li>
            </ul>
            <small className="vsn-help-text">After saving, use <b>Design</b> in the list to edit the content in the visual editor.</small>
          </VsnCard>
          <div className="vsn-brandkit-form__actions">
            <VsnButton variant="primary" loading={busy} onClick={save}>{form.id ? "Save changes" : `Create ${noun}`}</VsnButton>
            <VsnButton onClick={() => setView("list")}>Cancel</VsnButton>
          </div>
        </aside>
      </div>
    </VsnPage>;
  }

  const tabs = [["all", "All", items.length], ["active", "Active", counts.active || 0], ["scheduled", "Scheduled", counts.scheduled || 0], ["expired", "Expired", counts.expired || 0], ["disabled", "Paused", counts.disabled || 0]];
  return <VsnPage title={floating ? "Floating Elements" : "Campaign Builder"} subtitle={floating ? "Persistent storefront elements such as chat, contact or offer buttons." : "Popups, modals, drawers, flyouts and announcement overlays."}
    actions={<VsnButton variant="primary" icon={<Plus size={14} />} onClick={() => openForm(null)}>New {noun}</VsnButton>}>
    {Notice ? <Notice data={actionData} /> : null}
    <VsnTabs items={tabs.map(([value, text, count]) => ({ value, label: text, count }))} value={tab} onChange={setTab} />
    <div className="vsn-list-toolbar is-wide">
      <VsnSearchInput label={`Search ${noun}s`} hideLabel value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${noun}s`} />
      {!floating ? <VsnSelect label="Format" hideLabel value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All formats</option>{types.map((value) => <option key={value} value={value}>{label(value)}</option>)}</VsnSelect> : null}
    </div>
    {rows.length ? <div className="vsn-table-wrap"><table className="vsn-data-table">
      <thead><tr><th>Name</th><th>{floating ? "Position" : "Format"}</th><th>Status</th><th>Trigger</th><th>Frequency</th><th>Updated</th><th className="is-actions">Actions</th></tr></thead>
      <tbody>{rows.map((item) => { const state = itemState(item, floating); return <tr key={item.id}>
        <td><strong>{item.title}</strong>{item.conflicts?.length ? <small className="vsn-warning-text">Overlaps: {item.conflicts.map((other) => other.title).join(", ")}</small> : null}</td>
        <td>{label(floating ? item.settings?.campaignFloatingPosition : item.template)}</td>
        <td><span className={`vsn-status-pill ${STATE_TONE[state] || "neutral"}`}>{state === "disabled" ? "Paused" : label(state)}</span></td>
        <td>{TRIGGERS.find(([value]) => value === item.settings?.campaignTrigger)?.[1] || "After a delay"}</td>
        <td>{FREQUENCIES.find(([value]) => value === item.settings?.campaignFrequency)?.[1] || "Once per session"}</td>
        <td>{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : ""}</td>
        <td className="is-actions"><div className="vsn-row-actions">
          <VsnButton size="xs" icon={<Pencil size={13} />} onClick={() => openForm(item)}>Settings</VsnButton>
          <VsnButton size="xs" variant="primary" icon={<Paintbrush size={13} />} onClick={() => onEditPage?.(item)}>Design</VsnButton>
          <VsnButton size="xs" icon={<Copy size={13} />} loading={busy} onClick={() => submit({ intent: "duplicate", id: item.id })}>Duplicate</VsnButton>
          <VsnButton size="xs" variant="danger" icon={<Trash2 size={13} />} onClick={async () => { const ok = confirmAction ? await confirmAction({ title: `Move ${item.title} to Trash?`, confirmLabel: "Move to Trash", tone: "danger" }) : true; if (ok) submit({ intent: "trash", id: item.id }); }}>Trash</VsnButton>
        </div></td>
      </tr>; })}</tbody>
    </table></div> : <VsnEmpty title={query || tab !== "all" || typeFilter !== "all" ? `No ${noun}s match these filters` : `No ${noun}s yet`} description={!items.length ? `Create your first ${noun}: choose when it appears, how often and for whom, then design it in the editor.` : undefined} action={!items.length ? <VsnButton variant="primary" icon={<Plus size={14} />} onClick={() => openForm(null)}>New {noun}</VsnButton> : null} />}
  </VsnPage>;
}
