// Only decorate *already* Shopify-SDK authenticated, tenant-scoped HTML.
// This stays dormant unless the Worker has two explicit Staging opt-in flags.
const SHOP=/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const PAGE=/^[a-zA-Z0-9_-]{1,64}$/;
const CSS=[
  ".editor-actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:12px 0}",
  ".editor-block{border:1px solid #dfe3e7;border-radius:10px;padding:16px;margin:10px 0;background:#fff}",
  "label{display:block;font-weight:600;font-size:14px;margin-bottom:7px}",
  "input,textarea{font:inherit;width:100%;border:1px solid #acb3ba;border-radius:8px;padding:11px;min-width:0}",
  "button{font:inherit;border:0;border-radius:8px;padding:11px 17px;background:#202223;color:white;cursor:pointer}",
  "button:disabled{opacity:.55;cursor:not-allowed}",
  ".preview{border:1px dashed #aab3bc;background:#fafafa;padding:15px;border-radius:9px;min-height:48px;white-space:pre-wrap}",
  "[data-vsn-editor-status]{font-weight:600}",
].join("");
const script='<script src="/__vsn/staging-editor-ui.js" defer></script>';
function panel(id){
  if(id===null)return '<section class="panel" aria-label="Create new Builder page">'+
    '<h2>Create a draft page</h2><form data-vsn-create-form>'+
    '<label for="builder-page-title">Page title</label>'+
    '<input name="title" id="builder-page-title" maxlength="120" required autocomplete="off">'+
    '<div class="editor-actions"><button type="submit">Create draft</button></div>'+
    '</form><p data-vsn-editor-status role="status" aria-live="polite"></p></section>';
  return '<section class="panel" data-vsn-block-editor data-page-id="'+id+'">'+
    '<h2>Draft text editor</h2><p class="muted">Saved version: '+
    '<span data-vsn-version>—</span>. Other block types are preserved on save.</p>'+
    '<div data-vsn-block-list></div><div class="editor-actions">'+
    '<button type="button" data-vsn-add-text disabled>Add text block</button>'+
    '<button type="button" data-vsn-save disabled>Save draft</button></div>'+
    '<h2>Text preview (not published)</h2>'+
    '<div class="preview" data-vsn-preview aria-live="polite"></div>'+
    '<p data-vsn-editor-status role="status" aria-live="polite"></p></section>';
}
export async function decorateVerifiedStagingEditorUi(response,{shop,pageId=null}={}){
  if(!(response instanceof Response)||response.status!==200 ||
     !SHOP.test(String(shop||""))||
     (pageId!==null&&!PAGE.test(String(pageId))))
    throw new TypeError("Verified Staging UI scope required");
  const csp=response.headers.get("content-security-policy")||"";
  if(!csp.includes("script-src https://cdn.shopify.com") ||
     !csp.includes("frame-ancestors https://admin.shopify.com"))
    throw new TypeError("Shopify App Bridge safety policy unavailable");
  const original=await response.text();
  if(!original.includes("<main>") ||
     !original.includes("</head>") || !original.includes("</style>") ||
     !original.includes("</main></body></html>"))
    throw new TypeError("Unsupported verified Staging HTML");
  // Shop was verified by official SDK and strictly validated, not from
  // untrusted URL fields. No merchant draft bytes enter inline JavaScript.
  let html=original.replace("<main>",'<main data-vsn-stage-editor data-shop="'+shop+'">')
    .replace("</style>",CSS+"</style>")
    .replace("</head>",script+"</head>")
    .replace("</main></body></html>",panel(pageId)+"</main></body></html>");
  if(pageId===null){
    html=html.replace("Read-only pages from your verified store:",
      "Staging draft pages for your verified store:");
  }else{
    html=html.replace("Read-only inspection. This is not a live storefront preview. Editing and publishing remain disabled pending hosted merchant acceptance.",
      "Draft-only Staging editor. Saving never publishes to a live storefront.");
  }
  const headers=new Headers(response.headers);
  headers.set("content-security-policy",
    csp.replace("script-src https://cdn.shopify.com",
      "script-src 'self' https://cdn.shopify.com"));
  headers.delete("content-length");
  headers.set("cache-control","no-store");
  return new Response(html,{status:200,headers});
}
