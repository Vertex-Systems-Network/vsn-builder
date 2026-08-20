import { useEffect, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import db from "../db.server.js";
import PreviewRenderer from "../components/editor/PreviewRenderer.jsx";
import { migrateBuilderContent } from "../builder/schemaMigrations.js";
import { getServerFeatureFlags } from "../services/feature-flags.server.js";
import { extractMentions } from "../services/collaboration.server.js";

function parseContent(value) {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? migrateBuilderContent(parsed) : [];
  } catch { return []; }
}

async function validReviewLink(token) {
  const link = await db.builderReviewLink.findUnique({ where: { token } });
  if (!link || link.revokedAt || (link.expiresAt && link.expiresAt <= new Date())) return null;
  return link;
}

export async function loader({ params }) {
  if (!getServerFeatureFlags().collaborationReviewV1) throw new Response("Review links are disabled.", { status: 404 });
  const token = String(params.token || "");
  const link = await validReviewLink(token);
  if (!link) throw new Response("This review link is invalid, expired or revoked.", { status: 404 });
  const page = await db.builderPage.findFirst({ where: { id: link.pageId, shop: link.shop, deletedAt: null } });
  if (!page) throw new Response("Page not found.", { status: 404 });
  const comments = await db.builderComment.findMany({ where: { shop: link.shop, pageId: link.pageId }, orderBy: { createdAt: "desc" }, take: 100 });
  return {
    link: { label: link.label || "Review", expiresAt: link.expiresAt },
    page: { id: page.id, title: page.title, template: page.template, workflowStatus: page.workflowStatus || "draft", content: parseContent(page.contentJson) },
    comments: comments.map((item) => ({ id:item.id, authorName:item.authorName, body:item.body, resolvedAt:item.resolvedAt, createdAt:item.createdAt, elementId:item.elementId })),
  };
}

export async function action({ request, params }) {
  if (!getServerFeatureFlags().collaborationReviewV1) return Response.json({success:false,error:"Review links are disabled."},{status:404});
  const token = String(params.token || "");
  const link = await validReviewLink(token);
  if (!link) return Response.json({success:false,error:"This review link is invalid, expired or revoked."},{status:404});
  const form = await request.formData();
  if (String(form.get("intent")||"") !== "comment") return Response.json({success:false,error:"Unsupported action."},{status:400});
  const authorName = String(form.get("name") || "Reviewer").trim().slice(0,80) || "Reviewer";
  const body = String(form.get("body") || "").trim().slice(0,5000);
  if (!body) return Response.json({success:false,error:"Comment cannot be empty."},{status:400});
  await db.builderComment.create({ data:{ shop:link.shop,pageId:link.pageId,authorName,authorRole:"commenter",body,mentionsJson:JSON.stringify(extractMentions(body)) } });
  await db.builderAuditLog.create({ data:{ shop:link.shop,pageId:link.pageId,actor:authorName,role:"commenter",action:"comment.created",details:JSON.stringify({summary:"Review-link comment"}) } });
  return Response.json({success:true,message:"Comment added."});
}

export default function ReviewPage() {
  const data = useLoaderData();
  const fetcher = useFetcher();
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  useEffect(() => { if (fetcher.data?.success) { setBody(""); window.location.reload(); } }, [fetcher.data]);
  return <div className="min-h-screen bg-[#f6f6f7] text-[#202223]">
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[#ddd] bg-white/95 px-5 py-3 backdrop-blur">
      <div><div className="text-sm font-bold">VSN Review</div><div className="text-xs text-[#777]">{data.page.title} · comment-only access</div></div>
      <div className="rounded-full bg-[#f1f1f1] px-3 py-1 text-xs font-semibold">{data.page.workflowStatus}</div>
    </header>
    <div className="grid min-h-[calc(100vh-57px)] grid-cols-[minmax(0,1fr)_360px]">
      <main className="overflow-auto bg-white p-4"><div className="mx-auto min-h-[80vh] max-w-[1440px] overflow-hidden rounded-xl border border-[#e4e4e4] bg-white shadow-sm"><PreviewRenderer elements={data.page.content.filter((item)=>!["global-styles","template-settings"].includes(item?.type))} globalStyles={{}} reusableSections={[]} componentDefinitions={[]} /></div></main>
      <aside className="border-l border-[#ddd] bg-[#fafafa] p-4">
        <div className="text-sm font-semibold">Feedback</div><div className="mt-1 text-xs text-[#777]">You can review the layout and leave comments. Editing and publishing are disabled.</div>
        <fetcher.Form method="post" className="mt-4 rounded-xl border border-[#ddd] bg-white p-3">
          <input type="hidden" name="intent" value="comment" />
          <label className="block text-xs font-semibold">Your name<input name="name" value={name} onChange={(e)=>setName(e.target.value)} className="mt-1 block w-full rounded-lg border border-[#ccc] px-3 py-2 text-sm" placeholder="Reviewer name" /></label>
          <label className="mt-3 block text-xs font-semibold">Comment<textarea name="body" value={body} onChange={(e)=>setBody(e.target.value)} rows={4} className="mt-1 block w-full resize-y rounded-lg border border-[#ccc] px-3 py-2 text-sm" placeholder="What should change?" /></label>
          {fetcher.data?.error ? <div className="mt-2 text-xs text-red-600">{fetcher.data.error}</div> : null}
          <button disabled={!body.trim() || fetcher.state!=="idle"} className="mt-3 rounded-lg bg-[#008060] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{fetcher.state!=="idle"?"Sending…":"Add comment"}</button>
        </fetcher.Form>
        <div className="mt-4 space-y-2">{data.comments.map((comment)=><div key={comment.id} className={`rounded-xl border bg-white p-3 ${comment.resolvedAt?"opacity-60":""}`}><div className="text-xs font-semibold">{comment.authorName}</div><div className="mt-0.5 text-[10px] text-[#999]">{new Date(comment.createdAt).toLocaleString()}{comment.resolvedAt?" · resolved":""}</div><div className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[#444]">{comment.body}</div></div>)}</div>
      </aside>
    </div>
  </div>;
}
