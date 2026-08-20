const ALLOWED_TEMPLATES = new Set(["page","index","collection","product","search","blog","article","header","footer","section","cart","404","password","customer-account","customer-login","customer-register","customer-order","customer-addresses","popup","modal","drawer","flyout","announcement-overlay","floating-element"]);

function nodeId() { return `node_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,9)}`; }
function cloneNodes(nodes) { return Array.isArray(nodes) ? nodes.map((node)=>({...node,id:nodeId(),children:cloneNodes(node.children)})) : []; }
function safeHandle(value, fallback) { return String(value || fallback).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || fallback; }
async function uniqueHandle(tx, shop, base) { let handle=base; let suffix=1; while(await tx.builderPage.findFirst({where:{shop,handle}})){suffix+=1;handle=`${base}-${suffix}`;} return handle; }

export async function importPagePackage({ db, shop, payload, actor, role }) {
  const source = payload?.format === "vsn-page-package" ? payload?.resources?.page : (payload?.page || payload);
  const dependencies = payload?.format === "vsn-page-package" ? payload?.resources?.sections : payload?.dependencies;
  if (!source || typeof source !== "object") throw new Error("The selected file does not contain a VSN page resource.");
  const content = Array.isArray(source.content) ? source.content : Array.isArray(source.elements) ? source.elements : null;
  if (!content) throw new Error("The page resource does not contain editable VSN content.");
  const template = ALLOWED_TEMPLATES.has(source.template) ? source.template : "page";

  return db.$transaction(async (tx) => {
    const dependencyMap = new Map();
    for (const dependency of Array.isArray(dependencies) ? dependencies.slice(0,100) : []) {
      if (dependency?.template !== "section") continue;
      const handle = await uniqueHandle(tx, shop, safeHandle(dependency.handle || dependency.title, "imported-section"));
      const row = await tx.builderPage.create({ data:{ shop, title:`${dependency.title || "Imported section"} (Imported)`, handle, template:"section", status:"draft", isDefault:false, contentJson:JSON.stringify(cloneNodes(dependency.content || [])), createdBy:actor || "Store owner" } });
      if (dependency.id) dependencyMap.set(String(dependency.id), row.id);
    }
    const rewrite = (nodes) => Array.isArray(nodes) ? nodes.map((node)=>({ ...node, props:node?.type==="global-section"&&node?.props?.sectionId&&dependencyMap.has(String(node.props.sectionId))?{...node.props,sectionId:dependencyMap.get(String(node.props.sectionId))}:node.props, children:rewrite(node.children) })) : [];
    const importedContent = rewrite(cloneNodes(content));
    const handle = await uniqueHandle(tx, shop, safeHandle(source.handle || source.title, "imported-template"));
    const created = await tx.builderPage.create({ data:{ shop, title:`${source.title || "Imported template"} (Imported)`, handle, template, status:"draft", isDefault:false, resourceId:null, resourceHandle:null, contentJson:JSON.stringify(importedContent), createdBy:actor || "Store owner" } });
    await tx.builderRevision.create({ data:{ shop, pageId:created.id, title:created.title, contentJson:created.contentJson || "[]", kind:"import", createdBy:actor } });
    await tx.builderAuditLog.create({ data:{ shop, pageId:created.id, actor, role, action:"template.imported", details:JSON.stringify({format:payload?.format || "legacy",version:Number(payload?.version || 1),dependencies:dependencyMap.size}) } });
    return { created, dependencies:dependencyMap.size };
  });
}
