const labels = { published: "Published", draft: "Draft", scheduled: "Scheduled", trashed: "Trash" };
export default function Badge({ status = "draft", children }) {
  const safe = ["published", "draft", "scheduled", "trashed"].includes(status) ? status : "draft";
  return <span className={`vsn-badge vsn-badge--${safe}`}><span className="vsn-badge-dot" />{children ?? labels[safe]}</span>;
}
