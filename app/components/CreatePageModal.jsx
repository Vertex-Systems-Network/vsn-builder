import { useEffect, useMemo, useRef, useState } from "react";

const TYPE_OPTIONS = [
  ["page", "Normal Page"], ["index", "Home Page"], ["collection-default", "Default Collection Template"],
  ["collection-specific", "Specific Collection Template"], ["product-default", "Default Product Template"],
  ["product-specific", "Specific Product Template"], ["search", "Search Results Template"],
  ["blog-default", "Default Blog Template"], ["blog-specific", "Specific Blog Template"],
  ["article-default", "Default Article Template"], ["article-specific", "Specific Article Template"],
  ["header", "Global Header"], ["footer", "Global Footer"], ["section", "Reusable Global Section"],
  ["cart", "Cart Template"], ["404", "404 Template"], ["password", "Password Template"],
  ["customer-account", "Customer Account"], ["customer-login", "Customer Login"], ["customer-register", "Customer Register"], ["customer-order", "Customer Order"], ["customer-addresses", "Customer Addresses"],
];

function titleFor(type, resourceTitle = "") {
  const map = { page: "Untitled page", index: "Home Page", "collection-default": "Default Collection Template", "product-default": "Default Product Template", search: "Search Results Template", "blog-default": "Default Blog Template", "article-default": "Default Article Template", header: "Global Header", footer: "Global Footer", section: "Reusable Section", cart: "Cart Template", "404": "404 Template", password: "Password Template", "customer-account": "Customer Account", "customer-login": "Customer Login", "customer-register": "Customer Register", "customer-order": "Customer Order", "customer-addresses": "Customer Addresses" };
  if (type === "collection-specific") return `${resourceTitle || "Collection"} Collection Template`;
  if (type === "product-specific") return `${resourceTitle || "Product"} Product Template`;
  if (type === "blog-specific") return `${resourceTitle || "Blog"} Blog Template`;
  if (type === "article-specific") return "Specific Article Template";
  return map[type] || "Untitled page";
}

export default function CreatePageModal({ collections = [], products = [], blogs = [], busy = false, onCreate }) {
  const modalRef = useRef(null);
  const [type, setType] = useState("page");
  const [resource, setResource] = useState("");
  const [articlePath, setArticlePath] = useState("news/article-handle");
  const [title, setTitle] = useState("Untitled page");

  const resources = type === "collection-specific" ? collections : type === "product-specific" ? products : type === "blog-specific" ? blogs : [];
  const selectedResource = useMemo(() => resources.find((item) => String(item.id) === String(resource)) || null, [resources, resource]);

  useEffect(() => {
    if (resources.length && !resource) setResource(String(resources[0].id));
  }, [type]);

  useEffect(() => { setTitle(titleFor(type, selectedResource?.title)); }, [type, selectedResource?.id]);

  const submit = () => {
    let template = "page"; let isDefault = false; let resourceId = ""; let resourceHandle = "";
    if (type === "index") { template = "index"; isDefault = true; }
    if (type === "collection-default") { template = "collection"; isDefault = true; }
    if (type === "collection-specific") { template = "collection"; resourceId = selectedResource?.id || ""; resourceHandle = selectedResource?.handle || ""; }
    if (type === "product-default") { template = "product"; isDefault = true; }
    if (type === "product-specific") { template = "product"; resourceId = selectedResource?.id || ""; resourceHandle = selectedResource?.handle || ""; }
    if (type === "search") { template = "search"; isDefault = true; }
    if (type === "blog-default") { template = "blog"; isDefault = true; }
    if (type === "blog-specific") { template = "blog"; resourceId = selectedResource?.id || ""; resourceHandle = selectedResource?.handle || ""; }
    if (type === "article-default") { template = "article"; isDefault = true; }
    if (type === "article-specific") { template = "article"; resourceId = articlePath; resourceHandle = articlePath; }
    if (type === "header") { template = "header"; isDefault = true; }
    if (type === "footer") { template = "footer"; isDefault = true; }
    if (type === "section") { template = "section"; }
    if (["cart","404","password","customer-account","customer-login","customer-register","customer-order","customer-addresses"].includes(type)) { template = type; isDefault = true; }

    if (!title.trim()) return;
    if (["collection-specific","product-specific","blog-specific"].includes(type) && !selectedResource) return;
    if (type === "article-specific" && (!articlePath.includes("/") || !articlePath.trim())) return;
    onCreate?.({ title: title.trim(), template, isDefault, resourceId, resourceHandle: String(resourceHandle || "").trim().toLowerCase() });
    modalRef.current?.hideOverlay?.();
  };

  return (
    <s-modal ref={modalRef} id="vsn-create-page-modal" heading="Create page or template" accessibilityLabel="Create a new builder page or template" size="large">
        <div className="space-y-4">
          <s-select label="Page type" value={type} onChange={(event) => { setType(event.currentTarget.value || "page"); setResource(""); }}>{TYPE_OPTIONS.map(([value,label]) => <s-option key={value} value={value}>{label}</s-option>)}</s-select>
          {["collection-specific","product-specific","blog-specific"].includes(type) ? <s-select label="Shopify resource" value={resource} onChange={(event) => setResource(event.currentTarget.value || "")}>{resources.length ? resources.map((item) => <s-option key={item.id} value={item.id}>{item.title}</s-option>) : <s-option value="">No resources found</s-option>}</s-select> : null}
          {type === "article-specific" ? <div><s-text-field label="Article path" value={articlePath} onInput={(event) => setArticlePath(event.currentTarget.value || "")} placeholder="blog-handle/article-handle" /><p className="mt-1 text-[11px] text-[#8c9196]">Format: blog-handle/article-handle</p></div> : null}
          <s-text-field label="Title" value={title} onInput={(event) => setTitle(event.currentTarget.value || "")} />
        </div>
        <s-button slot="secondary-actions" commandFor="vsn-create-page-modal" command="--hide">Cancel</s-button>
        <s-button slot="primary-action" variant="primary" data-vsn-async="true" loading={busy || undefined} disabled={busy || !title.trim()} onClick={submit}>{busy ? "Creating…" : "Create"}</s-button>
    </s-modal>
  );
}
