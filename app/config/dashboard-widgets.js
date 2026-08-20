export const DASHBOARD_WIDGETS = Object.freeze([
  { id: "published-pages", label: "Published Pages", description: "Published merchant pages and templates.", defaultVisible: true, size: "stat" },
  { id: "active-campaigns", label: "Active Campaigns", description: "Current campaign states and active campaign count.", defaultVisible: true, size: "wide" },
  { id: "system-health", label: "System Health Issues", description: "Errors and warnings that need attention.", defaultVisible: true, size: "stat" },
  { id: "live-monitor", label: "Live System Monitor", description: "Database, requests, editors and storefront activity.", defaultVisible: true, size: "wide" },
  { id: "visitor-map", label: "Visitor Map", description: "Recent VSN-rendered storefront visitor sessions by country.", defaultVisible: true, size: "wide" },
  { id: "continue-editing", label: "Continue Editing", description: "Recently updated merchant pages.", defaultVisible: true, size: "wide" },
  { id: "workspace-snapshot", label: "Workspace Snapshot", description: "Growth and form activity summary.", defaultVisible: true, size: "medium" },
  { id: "activity-timeline", label: "Activity Timeline", description: "Recent VSN Builder activity and audit events.", defaultVisible: true, size: "wide" },
  { id: "draft-pages", label: "Draft Pages", description: "Pages currently saved as drafts.", defaultVisible: false, size: "stat" },
  { id: "total-pages", label: "Total Pages", description: "All active merchant pages and templates.", defaultVisible: false, size: "stat" },
  { id: "cro-experiments", label: "CRO Experiments", description: "Active, paused and draft experiments.", defaultVisible: false, size: "stat" },
  { id: "unread-submissions", label: "Unread Submissions", description: "Unread non-spam form submissions.", defaultVisible: false, size: "stat" },
  { id: "saved-library", label: "Saved Library", description: "Merchant-owned saved Library resources.", defaultVisible: false, size: "stat" },
  { id: "marketplace-installs", label: "Marketplace Installs", description: "Templates installed from Marketplace.", defaultVisible: false, size: "stat" },
  { id: "active-widgets", label: "Active Widgets", description: "Widgets currently enabled in VSN Builder.", defaultVisible: false, size: "stat" },
  { id: "ai-usage", label: "AI Usage", description: "AI Builder operations recorded this month.", defaultVisible: false, size: "stat" },
  { id: "backups", label: "Backups", description: "Available Builder backups.", defaultVisible: false, size: "stat" },
  { id: "plan-usage", label: "Plan Usage", description: "Current plan and primary usage limits.", defaultVisible: false, size: "medium" },
  { id: "recent-updates", label: "Recent Updates", description: "Latest VSN Builder release notes.", defaultVisible: false, size: "medium" },
  { id: "getting-started", label: "Getting Started", description: "Quick links for common Builder workflows.", defaultVisible: false, size: "medium" },
]);

export const DASHBOARD_WIDGET_IDS = Object.freeze(DASHBOARD_WIDGETS.map((widget) => widget.id));
const DASHBOARD_SIZE_ORDER = Object.freeze({ stat:0, medium:1, wide:2 });
export const DEFAULT_DASHBOARD_WIDGET_ORDER = Object.freeze([...DASHBOARD_WIDGETS].sort((a,b)=>(DASHBOARD_SIZE_ORDER[a.size] ?? 9)-(DASHBOARD_SIZE_ORDER[b.size] ?? 9)).map((widget) => widget.id));
export const DEFAULT_DASHBOARD_VISIBLE_WIDGETS = Object.freeze(DASHBOARD_WIDGETS.filter((widget) => widget.defaultVisible).map((widget) => widget.id));
