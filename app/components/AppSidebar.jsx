import { FileText, Grid2X2, ListChecks, Settings2, CheckCircle2, ArchiveRestore, Star, UserCog, Wrench, Home, ChevronLeft, ChevronRight, Megaphone, FlaskConical, Type, Code2, PanelTopOpen, Languages, SlidersHorizontal } from "lucide-react";

const NAV_GROUPS = [
  { label: "Build", items: [
    { id: "pages", icon: FileText, label: "Pages" },
    { id: "library", icon: Grid2X2, label: "Saved Library" },
    { id: "marketplace", icon: Grid2X2, label: "Marketplace" },
    { id: "brand-kits", icon: Settings2, label: "Brand Kits" },
  ]},
  { label: "Growth", items: [
    { id: "campaigns", icon: Megaphone, label: "Campaigns" },
    { id: "experiments", icon: FlaskConical, label: "CRO Experiments" },
    { id: "floating-elements", icon: PanelTopOpen, label: "Floating Elements" },
  ]},
  { label: "Assets", items: [
    { id: "fonts", icon: Type, label: "Custom Fonts" },
    { id: "svg-assets", icon: Code2, label: "SVG Library" },
  ]},
  { label: "Data & Forms", items: [
    { id: "form-submissions", icon: ListChecks, label: "Submissions" },
    { id: "form-settings", icon: Settings2, label: "Form Settings" },
  ]},
  { label: "Localization", items: [
    { id: "localization", icon: Languages, label: "Languages & Markets", href: "/app?view=localization" },
  ]},
  { label: "Developer", items: [
    { id: "developer-sdk", icon: Code2, label: "Plugin SDK", ownerOnly: true },
  ]},
  { label: "System", items: [
    { id: "onboarding", icon: CheckCircle2, label: "Setup" },
    { id: "backups", icon: ArchiveRestore, label: "Backups" },
    { id: "plans", icon: Star, label: "Plan usage" },
    { id: "role-manager", icon: UserCog, label: "Roles", ownerOnly: true },
    { id: "control-center", icon: Wrench, label: "System Health" },
    { id: "settings", icon: SlidersHorizontal, label: "App Settings", href: "/app?view=settings" },
  ]},
];

export { BUILDER_PANEL_ROUTES, BUILDER_PANEL_IDS } from "../config/builder-panels.js";

export default function AppSidebar({ activeView = "pages", onViewChange, isOwner = false, collapsed = false, onToggleCollapse }) {
  return <aside className={`vsn-builder-sidebar ${collapsed ? "is-collapsed" : ""}`}>
    <div className="vsn-builder-brand"><div className="vsn-builder-brand-mark">VSN</div>{!collapsed?<div><strong>VSN Builder</strong><span>Workspace</span></div>:null}</div>
    <nav className="vsn-builder-nav" aria-label="VSN Builder workspace">
      {NAV_GROUPS.map((group) => {
        const items=group.items.filter((item)=>!item.ownerOnly||isOwner);
        if(!items.length)return null;
        return <section key={group.label}>{!collapsed?<div className="vsn-builder-nav-label">{group.label}</div>:null}{items.map((item)=>{
          const Icon=item.icon;
          const active=!item.href&&activeView===item.id;
          if(item.href) return <a key={item.id} href={item.href} title={collapsed?item.label:undefined}><Icon size={18} strokeWidth={1.8}/>{!collapsed?<span>{item.label}</span>:null}</a>;
          return <button key={item.id} type="button" title={collapsed?item.label:undefined} onClick={()=>onViewChange?.(item.id)} className={active?"active":""} aria-current={active?"page":undefined}><Icon size={18} strokeWidth={1.8}/>{!collapsed?<span>{item.label}</span>:null}</button>;
        })}</section>;
      })}
    </nav>
    <a className="vsn-builder-home-link" href="/app" title={collapsed?"Home":undefined}><Home size={18} strokeWidth={1.8}/>{!collapsed?<span>Home</span>:null}</a>
    <button className="vsn-builder-collapse" type="button" onClick={onToggleCollapse} title={collapsed?"Expand sidebar":"Collapse sidebar"} aria-label={collapsed?"Expand sidebar":"Collapse sidebar"}>{collapsed?<ChevronRight size={13}/>:<ChevronLeft size={13}/>}</button>
  </aside>;
}
