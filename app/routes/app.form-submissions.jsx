import { useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server.js";

function safeJson(value) { try { return JSON.parse(value || "{}"); } catch { return {}; } }
function compactValue(value) { if (Array.isArray(value)) return value.join(", "); if (value && typeof value === "object") return value.name ? `${value.name} (${value.size || 0} bytes)` : JSON.stringify(value); return String(value ?? ""); }
function csvCell(value) { const text = String(value ?? ""); return `"${text.replace(/"/g, '""')}"`; }

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url); const formKey = String(url.searchParams.get("formKey") || "").trim();
  const status = String(url.searchParams.get("status") || "all"); const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
  const from = url.searchParams.get("from"); const to = url.searchParams.get("to");
  const where = { shop: session.shop, ...(formKey ? { formKey } : {}), ...(status === "spam" ? { isSpam: true } : status === "unread" ? { readAt: null, isSpam: false } : status === "read" ? { readAt: { not: null }, isSpam: false } : {}) };
  if (from || to) where.createdAt = { ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}) };
  let items = await db.builderFormSubmission.findMany({ where, orderBy: { createdAt: "desc" }, take: 500 });
  if (q) items = items.filter((item) => `${item.customerEmail || ""} ${item.formKey} ${item.fieldsJson}`.toLowerCase().includes(q));
  if (url.searchParams.get("export") === "csv") {
    const rows = [["id","formKey","email","status","createdAt","pageUrl","fields"], ...items.map((i)=>[i.id,i.formKey,i.customerEmail || "",i.isSpam?"spam":i.readAt?"read":"unread",i.createdAt.toISOString(),i.pageUrl || "",i.fieldsJson])];
    return new Response(rows.map((r)=>r.map(csvCell).join(",")).join("\n"), { headers: { "Content-Type":"text/csv; charset=utf-8", "Content-Disposition":`attachment; filename="vsn-form-submissions-${Date.now()}.csv"` } });
  }
  const visibleItems = items.slice(0,100);
  const uploads = visibleItems.length ? await db.builderFormUpload.findMany({ where:{ shop:session.shop, submissionId:{ in:visibleItems.map((item)=>item.id) } }, orderBy:{ createdAt:"asc" }, select:{ id:true,submissionId:true,fieldName:true,fileName:true,mimeType:true,size:true,scanStatus:true,scanMessage:true,createdAt:true } }) : [];
  const uploadsBySubmission = uploads.reduce((map,item)=>{(map[item.submissionId] ||= []).push({...item,url:`/app/form-uploads/${item.id}`});return map;},{});
  const groupsRows = await db.builderFormSubmission.findMany({ where: { shop: session.shop }, select: { formKey:true }, take: 5000 });
  const counts = {}; for (const row of groupsRows) counts[row.formKey]=(counts[row.formKey]||0)+1;
  return { items: visibleItems.map((item)=>({...item, fields:safeJson(item.fieldsJson), uploads:uploadsBySubmission[item.id]||[]})), groups:Object.entries(counts).map(([formKey,count])=>({formKey,count})), formKey,status,q,from:from||"",to:to||"" };
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request); const form = await request.formData(); const intent=String(form.get("intent")||""); const id=String(form.get("id")||"");
  const item = id ? await db.builderFormSubmission.findFirst({ where:{ id, shop:session.shop } }) : null;
  if (id && !item) return Response.json({ok:false,error:"Submission not found."},{status:404});
  if (intent === "read") await db.builderFormSubmission.update({ where:{id}, data:{readAt:new Date()} });
  else if (intent === "unread") await db.builderFormSubmission.update({ where:{id}, data:{readAt:null} });
  else if (intent === "spam") await db.builderFormSubmission.update({ where:{id}, data:{isSpam:true,spamReason:"manual"} });
  else if (intent === "not-spam") await db.builderFormSubmission.update({ where:{id}, data:{isSpam:false,spamReason:null} });
  else if (intent === "delete") { await db.$transaction([db.builderFormUpload.deleteMany({where:{shop:session.shop,submissionId:id}}),db.builderAutomationLog.deleteMany({where:{shop:session.shop,submissionId:id}}),db.builderFormSubmission.delete({ where:{id} })]); }
  else return Response.json({ok:false,error:"Unknown action."},{status:400});
  return Response.json({ok:true,intent,id});
}

export default function FormSubmissionsRoute() {
  const data=useLoaderData(); const fetcher=useFetcher();
  const params=new URLSearchParams(); if(data.formKey)params.set("formKey",data.formKey); if(data.status!=="all")params.set("status",data.status); if(data.q)params.set("q",data.q); if(data.from)params.set("from",data.from); if(data.to)params.set("to",data.to);
  const base=`/app/form-submissions?${params.toString()}`;
  const act=(intent,id)=>fetcher.submit({intent,id},{method:"post"});
  return <s-page heading="Form submissions"><s-section>
    <form method="get" className="mb-4 grid gap-2 md:grid-cols-5"><s-text-field name="q" label="Search" labelAccessibilityVisibility="exclusive" value={data.q} placeholder="Search email or fields" /><s-select name="formKey" label="Form" labelAccessibilityVisibility="exclusive" value={data.formKey}><s-option value="">All forms</s-option>{data.groups.map(g=><s-option key={g.formKey} value={g.formKey}>{g.formKey} ({g.count})</s-option>)}</s-select><s-select name="status" label="Status" labelAccessibilityVisibility="exclusive" value={data.status}><s-option value="all">All</s-option><s-option value="unread">Unread</s-option><s-option value="read">Read</s-option><s-option value="spam">Spam</s-option></s-select><div className="flex gap-2"><s-date-field name="from" label="From" labelAccessibilityVisibility="exclusive" value={data.from} /><s-date-field name="to" label="To" labelAccessibilityVisibility="exclusive" value={data.to} /></div><div className="flex gap-2"><s-button type="submit" variant="primary">Filter</s-button><s-button href={`${base}${base.includes("?")?"&":"?"}export=csv`} download="form-submissions.csv">CSV</s-button></div></form>
    {!data.items.length?<div className="rounded-xl border border-dashed p-8 text-center text-sm text-[#666]">No matching submissions.</div>:<div className="grid gap-3">{data.items.map(item=><article key={item.id} className={`rounded-xl border p-4 ${item.isSpam?"border-red-200 bg-red-50":item.readAt?"bg-white":"border-emerald-200 bg-emerald-50/30"}`}><div className="flex flex-wrap items-center justify-between gap-2"><div><strong>{item.formKey}</strong><span className="ml-2 text-xs text-[#777]">{item.isSpam?"Spam":item.readAt?"Read":"Unread"}</span></div><time className="text-xs">{new Date(item.createdAt).toLocaleString()}</time></div>{item.customerEmail?<div className="mt-1 text-sm">{item.customerEmail}</div>:null}<details className="mt-3"><summary className="cursor-pointer text-sm font-medium">View fields</summary><dl className="mt-2 grid grid-cols-[140px_1fr] gap-2 text-xs">{Object.entries(item.fields||{}).map(([k,v])=><div key={k} className="contents"><dt className="font-semibold text-[#666]">{k}</dt><dd className="m-0 break-words whitespace-pre-wrap">{compactValue(v)}</dd></div>)}</dl></details><div className="mt-3 flex flex-wrap gap-2 text-xs">{item.readAt?<s-button onClick={()=>act("unread",item.id)} className="rounded border px-2 py-1">Mark unread</s-button>:<s-button onClick={()=>act("read",item.id)} className="rounded border px-2 py-1">Mark read</s-button>}{item.isSpam?<s-button onClick={()=>act("not-spam",item.id)} className="rounded border px-2 py-1">Not spam</s-button>:<s-button onClick={()=>act("spam",item.id)} className="rounded border px-2 py-1">Spam</s-button>}<s-button onClick={()=>confirm("Delete this submission?")&&act("delete",item.id)} className="rounded border border-red-200 px-2 py-1 text-red-700">Delete</s-button></div></article>)}</div>}
  </s-section></s-page>;
}
