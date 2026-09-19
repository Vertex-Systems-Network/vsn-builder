import { blankEmailDocument } from "../../app/email/emailSchema.js";

export const EVAL_SHOP = "vsn-eval.myshopify.com";

export function basePage() {
  return [
    { id: "hero", type: "section", label: "Hero", props: {}, styles: { paddingTop: 48, paddingBottom: 48 }, children: [
      { id: "hero-title", type: "heading", label: "Hero title", props: { text: "Original product value" }, styles: { fontSize: 42 }, children: [] },
      { id: "hero-image", type: "image", label: "Hero image", props: { imageUrl: "https://cdn.example.com/product.jpg", alt: "Product" }, styles: {}, children: [] },
    ] },
  ];
}

export function fixtureContext(name = "") {
  const currentPage = basePage();
  if (name === "wide-page") {
    currentPage[0].styles.width = "980px";
  }
  if (name === "missing-alt-page") {
    currentPage[0].children[1].props.alt = "";
  }
  if (name === "existing-page") {
    currentPage[0].children.push({ id: "hero-cta", type: "button", label: "CTA", props: { text: "Shop now", url: "/products/example" }, styles: {}, children: [] });
  }
  const context = {
    currentPage,
    globalStyles: {},
    pageTemplate: "product",
    selectedElementId: "",
    commerceContext: {},
    currentDocument: blankEmailDocument(),
    meta: { campaignType: "product-launch" },
    sourceUrl: "",
    imageData: "",
  };
  if (name === "selected-heading") context.selectedElementId = "hero-title";
  if (name === "product-context") {
    context.commerceContext = {
      product: { id: "gid://shopify/Product/1", title: "Renewal Serum", handle: "renewal-serum", price: "$48.00", url: "/products/renewal-serum" },
    };
  }
  if (name === "brand-context") {
    context.globalStyles = {
      colors: { primary: "#1f3d2d", background: "#f5f0e8", text: "#171717" },
      typography: { heading: "Inter", body: "Inter" },
      direction: "premium, restrained, editorial",
    };
  }
  if (name === "email-document") {
    context.currentDocument = blankEmailDocument();
    context.meta = { campaignType: "launch", subject: "Introducing Renewal Serum" };
  }
  if (name === "tiny-image") {
    context.imageData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZrWQAAAAASUVORK5CYII=";
  }
  if (name === "https://example.com") context.sourceUrl = "https://example.com";
  return context;
}

export function createEvalDb({ shop = EVAL_SHOP, page = null } = {}) {
  const usageRows = [];
  const revisions = [];
  const auditRows = [];
  const pageState = page || {
    id: "eval-page-1",
    shop,
    title: "Eval page",
    template: "product",
    status: "draft",
    workflowStatus: "draft",
    version: 1,
    deletedAt: null,
    contentJson: JSON.stringify(basePage()),
  };

  const db = {
    builderSubscription: { findUnique: async () => null },
    builderAiUsage: {
      create: async ({ data }) => {
        const row = { id: `usage-${usageRows.length + 1}`, createdAt: new Date(), ...data };
        usageRows.push(row);
        return row;
      },
      count: async () => usageRows.filter((row) => ["started", "completed"].includes(row.status)).length,
      update: async ({ where, data }) => {
        const row = usageRows.find((item) => item.id === where.id);
        if (!row) throw new Error("missing usage row");
        Object.assign(row, data);
        return row;
      },
    },
    builderPage: {
      findFirst: async ({ where }) => {
        if (where?.id && where.id !== pageState.id) return null;
        if (where?.shop && where.shop !== pageState.shop) return null;
        if (where?.deletedAt === null && pageState.deletedAt !== null) return null;
        return { ...pageState };
      },
      updateMany: async ({ where, data }) => {
        if (where.id !== pageState.id || where.shop !== pageState.shop || where.version !== pageState.version) return { count: 0 };
        pageState.contentJson = data.contentJson;
        pageState.version += Number(data.version?.increment || 0);
        pageState.workflowStatus = data.workflowStatus;
        return { count: 1 };
      },
    },
    builderRevision: {
      findFirst: async () => revisions.at(-1) || null,
      create: async ({ data }) => {
        const row = { id: `revision-${revisions.length + 1}`, createdAt: new Date(), ...data };
        revisions.push(row);
        return row;
      },
    },
    builderAuditLog: {
      create: async ({ data }) => {
        const row = { id: `audit-${auditRows.length + 1}`, createdAt: new Date(), ...data };
        auditRows.push(row);
        return row;
      },
    },
  };
  db.$transaction = async (callback) => callback(db);
  return { db, pageState, usageRows, revisions, auditRows };
}

export function ownerSession(shop = EVAL_SHOP) {
  return {
    shop,
    onlineAccessInfo: {
      associated_user: { account_owner: true, email: "eval-owner@example.com" },
    },
  };
}
