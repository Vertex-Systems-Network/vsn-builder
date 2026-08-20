import crypto from "node:crypto";
import { builderActor, getBuilderRole, isBuilderOwner } from "../utils/builder-permissions.js";
import { getFeatureDecision, getQuotaDecision } from "./entitlements.server.js";

export const COLLABORATION_ROLES = Object.freeze([
  { key: "publisher", label: "Publisher", description: "Can edit, approve and publish." },
  { key: "approver", label: "Approver", description: "Can review and approve changes." },
  { key: "designer", label: "Designer", description: "Can edit layouts, save drafts and request review." },
  { key: "content_editor", label: "Content Editor", description: "Can edit content, save drafts and request review." },
]);

const ROLE_ACTIONS = Object.freeze({
  publisher: new Set(["view", "comment", "resolve_comment", "edit", "save", "lock", "request_review", "approve", "publish", "review_link", "branch", "label_revision", "assign_role"]),
  approver: new Set(["view", "comment", "resolve_comment", "request_review", "approve", "review_link", "label_revision"]),
  designer: new Set(["view", "comment", "resolve_comment", "edit", "save", "lock", "request_review", "review_link", "branch", "label_revision"]),
  content_editor: new Set(["view", "comment", "resolve_comment", "edit", "save", "lock", "request_review", "review_link", "branch", "label_revision"]),
  commenter: new Set(["view", "comment"]),
});

export function collaborationActorKey(session) {
  return String(session?.email || session?.userId || `${session?.firstName || ""}:${session?.lastName || ""}` || "shopify-user").trim().toLowerCase();
}

export function canCollaborate(role, action) {
  return ROLE_ACTIONS[role]?.has(action) === true;
}

function parseRoleAssignments(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function getCollaborationRole(db, session) {
  if (isBuilderOwner(session)) return "publisher";
  const key = collaborationActorKey(session);
  const setting = await db.builderShopSetting.findUnique({ where: { shop: session.shop }, select: { collaborationRolesJson: true } });
  const assignments = parseRoleAssignments(setting?.collaborationRolesJson);
  if (COLLABORATION_ROLES.some((item) => item.key === assignments[key])) return assignments[key];
  const baseRole = getBuilderRole(session);
  return baseRole === "collaborator" ? "content_editor" : "designer";
}

export async function setCollaborationRole(db, { shop, actorKey, role }) {
  if (!COLLABORATION_ROLES.some((item) => item.key === role)) throw new Error("Invalid collaboration role.");
  const setting = await db.builderShopSetting.findUnique({ where: { shop }, select: { collaborationRolesJson: true } });
  const assignments = parseRoleAssignments(setting?.collaborationRolesJson);
  const normalizedActorKey = String(actorKey || "").trim().toLowerCase();
  if (!normalizedActorKey) throw new Error("A valid collaboration user is required.");
  const feature = await getFeatureDecision(db, shop, "collaboration");
  if (!feature.allowed) throw new Error(feature.message);
  const isNewSeat = !Object.prototype.hasOwnProperty.call(assignments, normalizedActorKey);
  if (isNewSeat) {
    const quota = await getQuotaDecision(db, shop, "collaborationSeats");
    if (!quota.allowed) throw new Error(quota.message);
  }
  assignments[normalizedActorKey] = role;
  await db.builderShopSetting.upsert({
    where: { shop },
    create: { shop, collaborationRolesJson: JSON.stringify(assignments) },
    update: { collaborationRolesJson: JSON.stringify(assignments) },
  });
  return assignments;
}

export function extractMentions(body) {
  const found = new Set();
  for (const match of String(body || "").matchAll(/@([^\s,;]+)/g)) {
    const token = String(match[1] || "").replace(/[.!?]+$/, "").trim().toLowerCase();
    if (token) found.add(token);
  }
  return [...found].slice(0, 20);
}

export async function touchPresence(db, { session, pageId, role, selectedElementId = null }) {
  const actorKey = collaborationActorKey(session);
  const actorName = builderActor(session);
  const now = new Date();
  const staleBefore = new Date(now.getTime() - 90_000);
  await db.builderPresence.deleteMany({ where: { shop: session.shop, pageId, lastSeenAt: { lt: staleBefore } } });
  const presence = await db.builderPresence.upsert({
    where: { shop_pageId_actorKey: { shop: session.shop, pageId, actorKey } },
    create: { shop: session.shop, pageId, actorKey, actorName, collaborationRole: role, selectedElementId: selectedElementId || null, lastSeenAt: now },
    update: { actorName, collaborationRole: role, selectedElementId: selectedElementId || null, lastSeenAt: now },
  });
  const lock = await db.builderPageLock.findUnique({ where: { shop_pageId: { shop: session.shop, pageId } } });
  if (lock?.ownerKey === actorKey) {
    await db.builderPageLock.update({ where: { id: lock.id }, data: { expiresAt: new Date(now.getTime() + 120_000) } });
  }
  return presence;
}

export async function getCollaborationSnapshot(db, { shop, pageId }) {
  const now = new Date();
  await Promise.all([
    db.builderPresence.deleteMany({ where: { shop, pageId, lastSeenAt: { lt: new Date(now.getTime() - 90_000) } } }),
    db.builderPageLock.deleteMany({ where: { shop, pageId, expiresAt: { lte: now } } }),
  ]);
  const [presence, comments, reviewLinks, lock, branches, activity] = await Promise.all([
    db.builderPresence.findMany({ where: { shop, pageId }, orderBy: { lastSeenAt: "desc" }, take: 20 }),
    db.builderComment.findMany({ where: { shop, pageId }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.builderReviewLink.findMany({ where: { shop, pageId }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.builderPageLock.findUnique({ where: { shop_pageId: { shop, pageId } } }),
    db.builderBranch.findMany({ where: { shop, pageId }, orderBy: { updatedAt: "desc" }, take: 30 }),
    db.builderAuditLog.findMany({ where: { shop, pageId }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return { presence, comments, reviewLinks, lock, branches, activity };
}

export async function acquirePageLock(db, { session, pageId, role }) {
  const actorKey = collaborationActorKey(session);
  const actorName = builderActor(session);
  const now = new Date();
  const current = await db.builderPageLock.findUnique({ where: { shop_pageId: { shop: session.shop, pageId } } });
  if (current && current.expiresAt > now && current.ownerKey !== actorKey) {
    return { ok: false, lock: current, error: `${current.ownerName} currently holds the page lock.` };
  }
  const lockToken = current?.ownerKey === actorKey ? current.lockToken : crypto.randomBytes(18).toString("hex");
  const lock = await db.builderPageLock.upsert({
    where: { shop_pageId: { shop: session.shop, pageId } },
    create: { shop: session.shop, pageId, ownerKey: actorKey, ownerName: actorName, ownerRole: role, lockToken, expiresAt: new Date(now.getTime() + 120_000) },
    update: { ownerKey: actorKey, ownerName: actorName, ownerRole: role, lockToken, expiresAt: new Date(now.getTime() + 120_000) },
  });
  return { ok: true, lock };
}

export async function releasePageLock(db, { session, pageId, force = false }) {
  const actorKey = collaborationActorKey(session);
  const current = await db.builderPageLock.findUnique({ where: { shop_pageId: { shop: session.shop, pageId } } });
  if (!current) return { ok: true };
  if (!force && current.ownerKey !== actorKey) return { ok: false, error: "Only the lock owner can unlock this page." };
  await db.builderPageLock.delete({ where: { id: current.id } });
  return { ok: true };
}

export async function getBlockingPageLock(db, { session, pageId }) {
  const actorKey = collaborationActorKey(session);
  const lock = await db.builderPageLock.findUnique({ where: { shop_pageId: { shop: session.shop, pageId } } });
  if (!lock) return null;
  if (lock.expiresAt <= new Date()) {
    await db.builderPageLock.delete({ where: { id: lock.id } }).catch(() => {});
    return null;
  }
  return lock.ownerKey === actorKey ? null : lock;
}

export async function createReviewLink(db, { request, session, pageId, label = "Review", days = 7 }) {
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = days > 0 ? new Date(Date.now() + Math.min(days, 90) * 86_400_000) : null;
  const row = await db.builderReviewLink.create({ data: { shop: session.shop, pageId, token, label: String(label || "Review").slice(0, 80), createdBy: builderActor(session), expiresAt } });
  const url = new URL(request.url);
  return { ...row, url: `${url.origin}/review/${token}` };
}

export function humanizeAuditAction(action) {
  const labels = {
    "template.autosaved": "Autosaved draft",
    "template.saved": "Saved draft",
    "template.published": "Published page",
    "workflow.review_requested": "Requested review",
    "workflow.approved": "Approved page",
    "workflow.returned_to_draft": "Returned page to draft",
    "comment.created": "Added a comment",
    "comment.resolved": "Resolved a comment",
    "review_link.created": "Created a review link",
    "review_link.revoked": "Revoked a review link",
    "page.locked": "Locked the page",
    "page.unlocked": "Unlocked the page",
    "branch.created": "Created a branch",
    "branch.applied": "Applied a branch",
    "revision.labeled": "Labeled a revision",
    "collaboration.role_assigned": "Assigned a collaboration role",
  };
  return labels[action] || String(action || "Activity").replace(/[._-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}
