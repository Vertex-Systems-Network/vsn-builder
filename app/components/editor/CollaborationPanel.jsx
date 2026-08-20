import { useMemo, useState } from "react";
import PolarisIcon from "../ui/PolarisIcon";
import { VsnButton, VsnSelect, VsnOption, VsnTextArea, VsnTextField } from "./EditorUi";

function relativeTime(value) {
  if (!value) return "";
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(value).toLocaleDateString();
}

function statusClass(status) {
  return {
    draft: "bg-[#f1f1f1] text-[#555]",
    review: "bg-amber-50 text-amber-700",
    approved: "bg-emerald-50 text-emerald-700",
    published: "bg-blue-50 text-blue-700",
  }[status] || "bg-[#f1f1f1] text-[#555]";
}

function humanAction(value) {
  const map = {
    "template.autosaved": "Autosaved draft",
    "template.saved": "Saved draft",
    "template.published": "Published page",
    "workflow.review_requested": "Requested review",
    "workflow.approved": "Approved page",
    "workflow.returned_to_draft": "Returned to draft",
    "comment.created": "Added a comment",
    "comment.resolved": "Resolved a comment",
    "review_link.created": "Created a review link",
    "review_link.revoked": "Revoked a review link",
    "page.locked": "Locked the page",
    "page.unlocked": "Unlocked the page",
    "branch.created": "Created a branch",
    "branch.applied": "Applied a branch",
    "revision.labeled": "Labeled a revision",
    "collaboration.role_assigned": "Assigned role",
  };
  return map[value] || String(value || "Activity").replace(/[._-]+/g, " ");
}

export default function CollaborationPanel({
  open,
  onClose,
  data,
  currentActor,
  selectedElementId,
  busy = false,
  onAction,
}) {
  const [tab, setTab] = useState("comments");
  const [comment, setComment] = useState("");
  const [reviewLabel, setReviewLabel] = useState("Client review");
  const [branchName, setBranchName] = useState("");
  const comments = data?.comments || [];
  const unresolved = useMemo(() => comments.filter((item) => !item.resolvedAt), [comments]);
  const workflow = data?.workflowStatus || "draft";
  const lock = data?.lock || null;
  const mine = lock && lock.ownerKey === currentActor?.key;

  if (!open) return null;

  const submitComment = () => {
    const body = comment.trim();
    if (!body) return;
    onAction?.("comment-create", { body, elementId: selectedElementId || "" });
    setComment("");
  };

  return (
    <aside className="absolute right-3 top-3 z-50 flex max-h-[calc(100%-24px)] w-[390px] flex-col overflow-hidden rounded-2xl border border-[#d8d8d8] bg-white shadow-2xl">
      <div className="border-b border-[#ececec] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[#202223]"><PolarisIcon type="profile"/> Collaboration & Review</div>
            <div className="mt-1 flex items-center gap-2 text-[10px] text-[#777]">
              <span className={`rounded-full px-2 py-0.5 font-semibold ${statusClass(workflow)}`}>{workflow}</span>
              <span>{currentActor?.roleLabel || currentActor?.role || "member"}</span>
              <span>· {data?.presence?.length || 0} active</span>
            </div>
          </div>
          <VsnButton variant="icon" size="sm" onClick={onClose} title="Close collaboration"><PolarisIcon type="x"/></VsnButton>
        </div>
        <div className="mt-3 flex gap-1 rounded-lg bg-[#f6f6f7] p-1">
          {[["comments",`Comments ${unresolved.length}`],["workflow","Workflow"],["activity","Activity"],["share","Share"]].map(([key,label]) => (
            <button key={key} type="button" onClick={() => setTab(key)} className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold ${tab===key?"bg-white text-[#202223] shadow-sm":"text-[#6d7175]"}`}>{label}</button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "comments" ? <>
          <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-3">
            <div className="mb-2 text-[11px] font-semibold text-[#444]">New comment {selectedElementId ? <span className="font-normal text-[#888]">· selected element</span> : <span className="font-normal text-[#888]">· page</span>}</div>
            <VsnTextArea value={comment} onInput={(e)=>setComment(e.currentTarget.value)} rows={3} placeholder="Add feedback. Use @name or @email to mention someone." />
            <div className="mt-2 flex justify-end"><VsnButton variant="primary" disabled={!comment.trim() || busy} onClick={submitComment}><PolarisIcon type="send"/> Comment</VsnButton></div>
          </div>
          <div className="mt-4 space-y-2">
            {comments.length ? comments.map((item) => <div key={item.id} className={`rounded-xl border p-3 ${item.resolvedAt?"border-[#ededed] bg-[#fafafa] opacity-70":"border-[#dedede] bg-white"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><div className="truncate text-xs font-semibold text-[#303030]">{item.authorName}</div><div className="text-[9px] text-[#999]">{item.authorRole} · {relativeTime(item.createdAt)}{item.elementId?` · element ${item.elementId.slice(0,8)}`:" · page"}</div></div>
                {!item.resolvedAt ? <VsnButton variant="tertiary" size="sm" disabled={busy} onClick={()=>onAction?.("comment-resolve",{commentId:item.id})}>Resolve</VsnButton> : <span className="text-[9px] font-semibold text-emerald-700">Resolved</span>}
              </div>
              <div className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[#444]">{item.body}</div>
              {item.mentions?.length ? <div className="mt-2 text-[9px] text-[#777]">Mentions: {item.mentions.map((m)=>`@${m}`).join(", ")}</div> : null}
            </div>) : <div className="py-10 text-center text-xs text-[#888]">No comments yet.</div>}
          </div>
        </> : null}

        {tab === "workflow" ? <div className="space-y-4">
          <section className="rounded-xl border border-[#e3e3e3] p-3">
            <div className="text-xs font-semibold text-[#303030]">Review workflow</div>
            <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[9px]">
              {["draft","review","approved","published"].map((item)=><div key={item} className={`rounded-md px-1 py-2 ${workflow===item?statusClass(item):"bg-[#f7f7f7] text-[#888]"}`}>{item}</div>)}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <VsnButton size="sm" disabled={busy || !currentActor?.permissions?.requestReview} onClick={()=>onAction?.("workflow-review")}>Request review</VsnButton>
              <VsnButton size="sm" variant="primary" disabled={busy || !currentActor?.permissions?.approve} onClick={()=>onAction?.("workflow-approve")}>Approve</VsnButton>
              <VsnButton size="sm" disabled={busy || !currentActor?.permissions?.requestReview} onClick={()=>onAction?.("workflow-draft")}>Return to draft</VsnButton>
            </div>
          </section>

          <section className="rounded-xl border border-[#e3e3e3] p-3">
            <div className="flex items-center justify-between"><div><div className="text-xs font-semibold text-[#303030]">Page lock</div><div className="mt-0.5 text-[10px] text-[#888]">Advisory lock is enforced on save/publish.</div></div><PolarisIcon type={lock?"lock":"unlock"}/></div>
            {lock ? <div className="mt-2 rounded-lg bg-[#fafafa] px-3 py-2 text-[10px] text-[#555]">Locked by <strong>{lock.ownerName}</strong> · expires automatically if heartbeat stops.</div> : <div className="mt-2 text-[10px] text-[#777]">No active lock.</div>}
            <div className="mt-3"><VsnButton size="sm" disabled={busy || (!mine && lock) || !currentActor?.permissions?.lock} onClick={()=>onAction?.(mine?"lock-release":"lock-acquire")}>{mine?"Unlock page":"Lock page"}</VsnButton></div>
          </section>

          <section className="rounded-xl border border-[#e3e3e3] p-3">
            <div className="text-xs font-semibold text-[#303030]">Live presence</div>
            <div className="mt-2 space-y-1.5">{(data?.presence||[]).map((person)=><div key={person.id} className="flex items-center justify-between rounded-lg bg-[#fafafa] px-2.5 py-2"><div className="min-w-0"><div className="truncate text-[11px] font-semibold">{person.actorName}</div><div className="text-[9px] text-[#888]">{person.collaborationRole}{person.selectedElementId?` · editing ${person.selectedElementId.slice(0,8)}`:""}</div></div><span className="h-2 w-2 rounded-full bg-emerald-500"/></div>)}</div>
          </section>

          <section className="rounded-xl border border-[#e3e3e3] p-3">
            <div className="text-xs font-semibold text-[#303030]">Branches</div>
            <div className="mt-2 flex gap-2"><div className="flex-1"><VsnTextField value={branchName} onInput={(e)=>setBranchName(e.currentTarget.value)} placeholder="Branch name" /></div><VsnButton size="sm" disabled={busy || !branchName.trim() || !currentActor?.permissions?.branch} onClick={()=>{onAction?.("branch-create",{name:branchName.trim()});setBranchName("");}}>Create</VsnButton></div>
            <div className="mt-2 space-y-1">{(data?.branches||[]).map((branch)=><div key={branch.id} className="flex items-center justify-between gap-2 rounded-lg bg-[#fafafa] px-2.5 py-2"><div className="min-w-0"><div className="truncate text-[11px] font-semibold">{branch.name}</div><div className="text-[9px] text-[#888]">{relativeTime(branch.updatedAt)} · {branch.createdBy||"user"}</div></div><VsnButton size="sm" disabled={busy || !currentActor?.permissions?.branch} onClick={()=>onAction?.("branch-apply",{branchId:branch.id})}>Apply</VsnButton></div>)}</div>
          </section>

          {currentActor?.permissions?.assignRole ? <section className="rounded-xl border border-[#e3e3e3] p-3"><div className="text-xs font-semibold text-[#303030]">Assign active user role</div><div className="mt-2 space-y-2">{(data?.presence||[]).filter(p=>p.actorKey!==currentActor.key).map((person)=><div key={person.actorKey} className="grid grid-cols-[1fr_145px] items-center gap-2"><span className="truncate text-[10px]">{person.actorName}</span><VsnSelect value={person.collaborationRole} onChange={(e)=>onAction?.("role-assign",{actorKey:person.actorKey,role:e.currentTarget.value})}>{["publisher","approver","designer","content_editor"].map(r=><VsnOption key={r} value={r}>{r.replace("_"," ")}</VsnOption>)}</VsnSelect></div>)}</div></section> : null}
        </div> : null}

        {tab === "activity" ? <div className="space-y-2">{(data?.activity||[]).length ? data.activity.map((item)=><div key={item.id} className="rounded-xl border border-[#e7e7e7] px-3 py-2.5"><div className="text-[11px] font-semibold text-[#333]">{humanAction(item.action)}</div><div className="mt-0.5 text-[9px] text-[#888]">{item.actor||"System"}{item.role?` · ${item.role}`:""} · {relativeTime(item.createdAt)}</div>{item.summary?<div className="mt-1 text-[10px] text-[#666]">{item.summary}</div>:null}</div>) : <div className="py-10 text-center text-xs text-[#888]">No activity yet.</div>}</div> : null}

        {tab === "share" ? <div className="space-y-4">
          <section className="rounded-xl border border-[#e3e3e3] p-3">
            <div className="text-xs font-semibold text-[#303030]">Comment-only review link</div><div className="mt-1 text-[10px] text-[#888]">Developer mode: tokenized link, 7-day expiry, no edit controls.</div>
            <div className="mt-3 flex gap-2"><div className="flex-1"><VsnTextField value={reviewLabel} onInput={(e)=>setReviewLabel(e.currentTarget.value)} /></div><VsnButton size="sm" disabled={busy || !currentActor?.permissions?.reviewLink} onClick={()=>onAction?.("review-link-create",{label:reviewLabel,days:"7"})}>Create</VsnButton></div>
          </section>
          <div className="space-y-2">{(data?.reviewLinks||[]).map((link)=><div key={link.id} className="rounded-xl border border-[#e4e4e4] p-3"><div className="flex items-start justify-between gap-2"><div><div className="text-[11px] font-semibold">{link.label||"Review"}</div><div className="text-[9px] text-[#888]">{link.revokedAt?"Revoked":link.expiresAt?`Expires ${new Date(link.expiresAt).toLocaleString()}`:"No expiry"}</div></div>{!link.revokedAt?<VsnButton size="sm" variant="tertiary" disabled={busy} onClick={()=>onAction?.("review-link-revoke",{reviewLinkId:link.id})}>Revoke</VsnButton>:null}</div>{link.url?<div className="mt-2 flex gap-1"><input readOnly value={link.url} className="min-w-0 flex-1 rounded-md border border-[#ddd] bg-[#fafafa] px-2 py-1 text-[9px]"/><VsnButton size="sm" onClick={()=>navigator.clipboard?.writeText(link.url)}>Copy</VsnButton></div>:null}</div>)}</div>
        </div> : null}
      </div>
    </aside>
  );
}
