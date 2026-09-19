import { migrateBuilderContent } from "../builder/schemaMigrations.js";
import { findNode, insertNode, relocateNode, removeNode, updateNode } from "../builder/tree.js";
import { AI_ALLOWED_TYPES, aiNodeId, applyReplacementText, serializePageForAi } from "../builder/aiBuilder.js";
import { widgetRegistry } from "../builder/widgetRegistry.js";
import { canAccessBuilderAction } from "../utils/builder-permissions.server.js";
import { canCollaborate, getBlockingPageLock, getCollaborationRole } from "./collaboration.server.js";
import { getBuilderRuntimeEntitlements } from "./builder-runtime-entitlements.server.js";
import { runBuilderCommand } from "./command-bus.server.js";

const MAX_PATCH_KEYS = 80;
const MAX_PATCH_DEPTH = 6;
const MAX_PATCH_ARRAY = 120;
const MAX_PATCH_STRING = 8000;
const MAX_CONTENT_CHARS = 2_000_000;
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const UNSAFE_KEY = /^(?:on[a-z]+|script|scripts|srcdoc|customjs|custom_js|customcode|custom_code|liquid|html)$/i;
const UNSAFE_TEXT = /(?:javascript\s*:|vbscript\s*:|data\s*:\s*text\/html|<\s*script\b|\{%|\{\{)/i;
const SYSTEM_NODE_TYPES = new Set(["global-styles", "template-settings"]);

export class AiCommandError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "AiCommandError";
    this.code = code;
    this.status = status;
  }
}

function requiredString(value, field, max = 200) {
  const text = String(value || "").trim();
  if (!text) throw new AiCommandError("AI_COMMAND_INVALID_INPUT", `${field} is required.`, 400);
  if (text.length > max) throw new AiCommandError("AI_COMMAND_INVALID_INPUT", `${field} is too long.`, 400);
  return text;
}

function requiredVersion(value) {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1) {
    throw new AiCommandError("AI_COMMAND_INVALID_INPUT", "baseVersion must be a positive integer.", 400);
  }
  return version;
}

function safeGenerationId(value) {
  const text = String(value || "").trim();
  return text && text.length <= 100 ? text : null;
}

function sanitizePatch(value, depth = 0, counter = { keys: 0 }) {
  if (depth > MAX_PATCH_DEPTH) throw new AiCommandError("AI_COMMAND_INVALID_INPUT", "Patch nesting is too deep.", 400);
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    if (value.length > MAX_PATCH_STRING) throw new AiCommandError("AI_COMMAND_INVALID_INPUT", "Patch string is too long.", 400);
    if (UNSAFE_TEXT.test(value)) throw new AiCommandError("AI_COMMAND_UNSAFE_INPUT", "Executable or template syntax is not allowed in AI draft commands.", 400);
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_PATCH_ARRAY) throw new AiCommandError("AI_COMMAND_INVALID_INPUT", "Patch array is too large.", 400);
    return value.map((item) => sanitizePatch(item, depth + 1, counter));
  }
  if (typeof value !== "object") throw new AiCommandError("AI_COMMAND_INVALID_INPUT", "Patch values must be JSON-compatible.", 400);
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    counter.keys += 1;
    if (counter.keys > MAX_PATCH_KEYS) throw new AiCommandError("AI_COMMAND_INVALID_INPUT", "Patch contains too many fields.", 400);
    if (FORBIDDEN_KEYS.has(key) || UNSAFE_KEY.test(key)) throw new AiCommandError("AI_COMMAND_UNSAFE_INPUT", `Patch field is not allowed: ${key}.`, 400);
    output[key] = sanitizePatch(item, depth + 1, counter);
  }
  return output;
}

function requiredPatch(value) {
  const patch = sanitizePatch(value);
  if (!patch || Array.isArray(patch) || typeof patch !== "object" || !Object.keys(patch).length) {
    throw new AiCommandError("AI_COMMAND_INVALID_INPUT", "patch must be a non-empty object.", 400);
  }
  return patch;
}

function optionalString(value, max = 200) {
  const text = String(value || "").trim();
  if (text.length > max) throw new AiCommandError("AI_COMMAND_INVALID_INPUT", "Optional command field is too long.", 400);
  return text || null;
}

function safeDraftText(value, field, max = 6000, { required = true } = {}) {
  const text = String(value || "").trim();
  if (!text && required) throw new AiCommandError("AI_COMMAND_INVALID_INPUT", `${field} is required.`, 400);
  if (text.length > max) throw new AiCommandError("AI_COMMAND_INVALID_INPUT", `${field} is too long.`, 400);
  if (text && UNSAFE_TEXT.test(text)) throw new AiCommandError("AI_COMMAND_UNSAFE_INPUT", `${field} contains executable or template syntax.`, 400);
  return text || null;
}

function optionalPatch(value) {
  if (value == null) return {};
  const patch = sanitizePatch(value);
  if (!patch || Array.isArray(patch) || typeof patch !== "object") {
    throw new AiCommandError("AI_COMMAND_INVALID_INPUT", "Patch must be an object.", 400);
  }
  return patch;
}

const AI_INSERT_TYPE_SET = new Set(AI_ALLOWED_TYPES);

function normalizeElementInsert(input = {}) {
  const nodeType = requiredString(input.nodeType, "nodeType", 80);
  if (!AI_INSERT_TYPE_SET.has(nodeType)) {
    throw new AiCommandError("AI_COMMAND_UNSUPPORTED_WIDGET", `AI cannot insert unsupported widget type: ${nodeType}.`, 400);
  }
  const beforeId = optionalString(input.beforeId);
  const afterId = optionalString(input.afterId);
  if (beforeId && afterId) throw new AiCommandError("AI_COMMAND_INVALID_INPUT", "Use beforeId or afterId, not both.", 400);
  return {
    pageId: requiredString(input.pageId, "pageId"),
    baseVersion: requiredVersion(input.baseVersion),
    parentId: optionalString(input.parentId),
    beforeId,
    afterId,
    nodeType,
    label: safeDraftText(input.label, "label", 160, { required: false }),
    props: optionalPatch(input.props),
    styles: optionalPatch(input.styles),
    sourceGenerationId: safeGenerationId(input.sourceGenerationId),
  };
}

function normalizeElementMove(input = {}) {
  const beforeId = optionalString(input.beforeId);
  const afterId = optionalString(input.afterId);
  if (beforeId && afterId) throw new AiCommandError("AI_COMMAND_INVALID_INPUT", "Use beforeId or afterId, not both.", 400);
  return {
    pageId: requiredString(input.pageId, "pageId"),
    baseVersion: requiredVersion(input.baseVersion),
    elementId: requiredString(input.elementId, "elementId"),
    parentId: optionalString(input.parentId),
    beforeId,
    afterId,
    sourceGenerationId: safeGenerationId(input.sourceGenerationId),
  };
}

function normalizeElementRewrite(input = {}) {
  return {
    pageId: requiredString(input.pageId, "pageId"),
    baseVersion: requiredVersion(input.baseVersion),
    elementId: requiredString(input.elementId, "elementId"),
    text: safeDraftText(input.text, "text", 6000),
    sourceGenerationId: safeGenerationId(input.sourceGenerationId),
  };
}

function normalizeRevisionRestore(input = {}) {
  return {
    pageId: requiredString(input.pageId, "pageId"),
    baseVersion: requiredVersion(input.baseVersion),
    revisionId: requiredString(input.revisionId, "revisionId"),
    sourceGenerationId: safeGenerationId(input.sourceGenerationId),
  };
}

function insertionIndex(siblings, { beforeId, afterId } = {}) {
  if (beforeId) {
    const index = siblings.findIndex((item) => item?.id === beforeId);
    if (index < 0) throw new AiCommandError("AI_COMMAND_INVALID_PLACEMENT", "beforeId is not a sibling in the requested destination.", 400);
    return index;
  }
  if (afterId) {
    const index = siblings.findIndex((item) => item?.id === afterId);
    if (index < 0) throw new AiCommandError("AI_COMMAND_INVALID_PLACEMENT", "afterId is not a sibling in the requested destination.", 400);
    return index + 1;
  }
  return siblings.length;
}

function assertParentCanAccept(nodes, parentId) {
  if (!parentId) return null;
  const parent = findNode(nodes, parentId);
  if (!parent) throw new AiCommandError("AI_COMMAND_PARENT_NOT_FOUND", "Destination parent was not found.", 404);
  if (widgetRegistry[parent.type]?.acceptsChildren !== true) {
    throw new AiCommandError("AI_COMMAND_INVALID_PLACEMENT", `${parent.label || parent.type} cannot contain child widgets.`, 400);
  }
  return parent;
}

function assertMutableElement(nodes, elementId) {
  const node = findNode(nodes, elementId);
  if (!node) throw new AiCommandError("AI_COMMAND_ELEMENT_NOT_FOUND", "Builder element not found.", 404);
  if (SYSTEM_NODE_TYPES.has(node.type)) {
    throw new AiCommandError("AI_COMMAND_SYSTEM_NODE_PROTECTED", "AI draft commands cannot mutate builder system nodes.", 403);
  }
  return node;
}

function mergePatch(current, patch) {
  const base = current && typeof current === "object" && !Array.isArray(current) ? structuredClone(current) : {};
  for (const [key, value] of Object.entries(patch || {})) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      base[key] &&
      typeof base[key] === "object" &&
      !Array.isArray(base[key])
    ) {
      base[key] = mergePatch(base[key], value);
    } else {
      base[key] = structuredClone(value);
    }
  }
  return base;
}

function parsePageContent(value) {
  let parsed;
  try { parsed = JSON.parse(String(value || "[]")); } catch { throw new AiCommandError("AI_COMMAND_PAGE_CORRUPT", "Page content is not valid JSON.", 500); }
  if (!Array.isArray(parsed)) throw new AiCommandError("AI_COMMAND_PAGE_CORRUPT", "Page content must be an array.", 500);
  return migrateBuilderContent(parsed);
}

async function loadPage(tx, shop, pageId) {
  const page = await tx.builderPage.findFirst({ where: { id: pageId, shop, deletedAt: null } });
  if (!page) throw new AiCommandError("AI_COMMAND_PAGE_NOT_FOUND", "Builder page not found.", 404);
  return page;
}

function workflowAfterDraftMutation(workflowStatus) {
  return ["approved", "published"].includes(String(workflowStatus || "draft")) ? "draft" : String(workflowStatus || "draft");
}

async function applyDraftMutation(tx, { shop, actor, commandName, input, mutate }) {
  const page = await loadPage(tx, shop, input.pageId);
  if (Number(page.version || 1) !== input.baseVersion) {
    throw new AiCommandError(
      "AI_COMMAND_STALE_VERSION",
      `Page version changed from ${input.baseVersion} to ${Number(page.version || 1)}. Reload before applying the command.`,
      409,
    );
  }

  const current = parsePageContent(page.contentJson);
  const mutation = mutate(current);
  const next = mutation?.nodes;
  if (!Array.isArray(next)) throw new AiCommandError("AI_COMMAND_INVALID_RESULT", "Command did not produce valid page content.", 500);
  const contentJson = JSON.stringify(next);
  if (contentJson.length > MAX_CONTENT_CHARS) throw new AiCommandError("AI_COMMAND_CONTENT_TOO_LARGE", "Command result exceeds the safe page size.", 413);
  if (contentJson === JSON.stringify(current)) throw new AiCommandError("AI_COMMAND_NO_CHANGE", "Command did not change the page.", 409);

  const latestRevision = await tx.builderRevision.findFirst({
    where: { shop, pageId: page.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const undoRevision = await tx.builderRevision.create({
    data: {
      shop,
      pageId: page.id,
      title: page.title,
      contentJson: JSON.stringify(current),
      kind: "ai-command-undo",
      label: `Before AI: ${commandName}`.slice(0, 80),
      parentRevisionId: latestRevision?.id || null,
      createdBy: actor,
    },
  });

  const updated = await tx.builderPage.updateMany({
    where: { id: page.id, shop, deletedAt: null, version: input.baseVersion },
    data: {
      contentJson,
      version: { increment: 1 },
      workflowStatus: workflowAfterDraftMutation(page.workflowStatus),
    },
  });
  if (updated.count !== 1) throw new AiCommandError("AI_COMMAND_STALE_VERSION", "Page changed while the command was being applied.", 409);

  const fresh = await tx.builderPage.findFirst({ where: { id: page.id, shop, deletedAt: null }, select: { version: true, workflowStatus: true } });
  const appliedRevision = await tx.builderRevision.create({
    data: {
      shop,
      pageId: page.id,
      title: page.title,
      contentJson,
      kind: "ai-command",
      label: `AI: ${commandName}`.slice(0, 80),
      parentRevisionId: undoRevision.id,
      createdBy: actor,
    },
  });

  return {
    pageId: page.id,
    command: commandName,
    changed: true,
    version: Number(fresh?.version || input.baseVersion + 1),
    workflowStatus: fresh?.workflowStatus || "draft",
    elementId: mutation?.elementId || null,
    revisionId: appliedRevision.id,
    sourceGenerationId: input.sourceGenerationId || null,
    undo: {
      kind: "revision.restore",
      revisionId: undoRevision.id,
      pageId: page.id,
      baseVersion: Number(fresh?.version || input.baseVersion + 1),
    },
  };
}

function normalizePageRead(input = {}) {
  return {
    pageId: requiredString(input.pageId, "pageId"),
    sourceGenerationId: safeGenerationId(input.sourceGenerationId),
  };
}

function normalizeElementMutation(input = {}, { patch = false } = {}) {
  const normalized = {
    pageId: requiredString(input.pageId, "pageId"),
    baseVersion: requiredVersion(input.baseVersion),
    elementId: requiredString(input.elementId, "elementId"),
    sourceGenerationId: safeGenerationId(input.sourceGenerationId),
  };
  if (patch) normalized.patch = requiredPatch(input.patch);
  return normalized;
}

function publicDefinition(name, definition) {
  return Object.freeze({
    name,
    kind: definition.kind,
    resource: definition.resource,
    action: definition.action,
    reversible: definition.reversible === true,
    requiresBaseVersion: definition.requiresBaseVersion === true,
    directExecution: definition.directExecution !== false,
    approval: definition.approval || "none",
    input: definition.input,
  });
}

const REGISTRY = Object.freeze({
  "page.read": Object.freeze({
    kind: "read",
    resource: "pages",
    action: "view",
    reversible: false,
    requiresBaseVersion: false,
    directExecution: true,
    approval: "none",
    input: Object.freeze({ pageId: "string", sourceGenerationId: "string?" }),
    normalize: normalizePageRead,
    async execute(tx, context) {
      const page = await loadPage(tx, context.shop, context.input.pageId);
      const content = parsePageContent(page.contentJson);
      return {
        pageId: page.id,
        title: page.title,
        template: page.template,
        status: page.status,
        workflowStatus: page.workflowStatus,
        version: Number(page.version || 1),
        elements: serializePageForAi(content, { maxNodes: 160 }),
        sourceGenerationId: context.input.sourceGenerationId || null,
        undo: null,
      };
    },
  }),
  "element.insert": Object.freeze({
    kind: "draft-mutation",
    resource: "pages",
    action: "edit",
    reversible: true,
    requiresBaseVersion: true,
    directExecution: true,
    approval: "none",
    input: Object.freeze({ pageId: "string", baseVersion: "integer", parentId: "string?", beforeId: "string?", afterId: "string?", nodeType: "string", label: "string?", props: "object?", styles: "object?", sourceGenerationId: "string?" }),
    normalize: normalizeElementInsert,
    execute(tx, context) {
      return applyDraftMutation(tx, {
        ...context,
        commandName: "element.insert",
        mutate(nodes) {
          const parent = assertParentCanAccept(nodes, context.input.parentId);
          const siblings = context.input.parentId ? (parent?.children || []) : nodes;
          const index = insertionIndex(siblings, context.input);
          const definition = widgetRegistry[context.input.nodeType];
          if (!definition) throw new AiCommandError("AI_COMMAND_UNSUPPORTED_WIDGET", "Widget definition is unavailable.", 400);
          const node = {
            id: aiNodeId(`agent-${context.input.nodeType}`),
            type: context.input.nodeType,
            label: context.input.label || definition.label || context.input.nodeType,
            props: mergePatch(structuredClone(definition.props || {}), context.input.props),
            styles: mergePatch(structuredClone(definition.styles || {}), context.input.styles),
            children: [],
          };
          const next = insertNode(nodes, node, context.input.parentId, index);
          if (next === nodes) throw new AiCommandError("AI_COMMAND_INVALID_PLACEMENT", "Widget could not be inserted at the requested destination.", 400);
          return { nodes: next, elementId: node.id };
        },
      });
    },
  }),
  "element.move": Object.freeze({
    kind: "draft-mutation",
    resource: "pages",
    action: "edit",
    reversible: true,
    requiresBaseVersion: true,
    directExecution: true,
    approval: "none",
    input: Object.freeze({ pageId: "string", baseVersion: "integer", elementId: "string", parentId: "string?", beforeId: "string?", afterId: "string?", sourceGenerationId: "string?" }),
    normalize: normalizeElementMove,
    execute(tx, context) {
      return applyDraftMutation(tx, {
        ...context,
        commandName: "element.move",
        mutate(nodes) {
          const moving = assertMutableElement(nodes, context.input.elementId);
          const parent = assertParentCanAccept(nodes, context.input.parentId);
          const siblings = context.input.parentId ? (parent?.children || []) : nodes;
          insertionIndex(siblings.filter((item) => item?.id !== moving.id), context.input);
          const next = relocateNode(nodes, moving.id, {
            parentId: context.input.parentId,
            beforeId: context.input.beforeId,
            afterId: context.input.afterId,
          });
          if (next === nodes) throw new AiCommandError("AI_COMMAND_NO_CHANGE", "Move did not change the page.", 409);
          return { nodes: next, elementId: moving.id };
        },
      });
    },
  }),
  "element.rewrite": Object.freeze({
    kind: "draft-mutation",
    resource: "pages",
    action: "edit",
    reversible: true,
    requiresBaseVersion: true,
    directExecution: true,
    approval: "none",
    input: Object.freeze({ pageId: "string", baseVersion: "integer", elementId: "string", text: "string", sourceGenerationId: "string?" }),
    normalize: normalizeElementRewrite,
    execute(tx, context) {
      return applyDraftMutation(tx, {
        ...context,
        commandName: "element.rewrite",
        mutate(nodes) {
          assertMutableElement(nodes, context.input.elementId);
          const next = applyReplacementText(nodes, context.input.elementId, context.input.text);
          if (next === nodes || JSON.stringify(next) === JSON.stringify(nodes)) {
            throw new AiCommandError("AI_COMMAND_NO_CHANGE", "Selected element does not expose editable text.", 409);
          }
          return { nodes: next, elementId: context.input.elementId };
        },
      });
    },
  }),
  "element.update-props": Object.freeze({
    kind: "draft-mutation",
    resource: "pages",
    action: "edit",
    reversible: true,
    requiresBaseVersion: true,
    directExecution: true,
    approval: "none",
    input: Object.freeze({ pageId: "string", baseVersion: "integer", elementId: "string", patch: "object", sourceGenerationId: "string?" }),
    normalize(input) { return normalizeElementMutation(input, { patch: true }); },
    execute(tx, context) {
      return applyDraftMutation(tx, {
        ...context,
        commandName: "element.update-props",
        mutate(nodes) {
          const node = assertMutableElement(nodes, context.input.elementId);
          return {
            elementId: node.id,
            nodes: updateNode(nodes, node.id, (current) => ({ ...current, props: mergePatch(current.props || {}, context.input.patch) })),
          };
        },
      });
    },
  }),
  "element.update-styles": Object.freeze({
    kind: "draft-mutation",
    resource: "pages",
    action: "edit",
    reversible: true,
    requiresBaseVersion: true,
    directExecution: true,
    approval: "none",
    input: Object.freeze({ pageId: "string", baseVersion: "integer", elementId: "string", patch: "object", sourceGenerationId: "string?" }),
    normalize(input) { return normalizeElementMutation(input, { patch: true }); },
    execute(tx, context) {
      return applyDraftMutation(tx, {
        ...context,
        commandName: "element.update-styles",
        mutate(nodes) {
          const node = findNode(nodes, context.input.elementId);
          if (!node) throw new AiCommandError("AI_COMMAND_ELEMENT_NOT_FOUND", "Builder element not found.", 404);
          return {
            elementId: node.id,
            nodes: updateNode(nodes, node.id, (current) => ({ ...current, styles: mergePatch(current.styles || {}, context.input.patch) })),
          };
        },
      });
    },
  }),
  "element.remove": Object.freeze({
    kind: "draft-mutation",
    resource: "pages",
    action: "edit",
    reversible: true,
    requiresBaseVersion: true,
    directExecution: true,
    approval: "none",
    input: Object.freeze({ pageId: "string", baseVersion: "integer", elementId: "string", sourceGenerationId: "string?" }),
    normalize: normalizeElementMutation,
    execute(tx, context) {
      return applyDraftMutation(tx, {
        ...context,
        commandName: "element.remove",
        mutate(nodes) {
          const node = findNode(nodes, context.input.elementId);
          if (!node) throw new AiCommandError("AI_COMMAND_ELEMENT_NOT_FOUND", "Builder element not found.", 404);
          return { elementId: node.id, nodes: removeNode(nodes, node.id) };
        },
      });
    },
  }),
  "revision.restore": Object.freeze({
    kind: "draft-mutation",
    resource: "pages",
    action: "edit",
    reversible: true,
    requiresBaseVersion: true,
    directExecution: true,
    approval: "none",
    input: Object.freeze({ pageId: "string", baseVersion: "integer", revisionId: "string", sourceGenerationId: "string?" }),
    normalize: normalizeRevisionRestore,
    async execute(tx, context) {
      const revision = await tx.builderRevision.findFirst({
        where: { id: context.input.revisionId, shop: context.shop, pageId: context.input.pageId },
      });
      if (!revision) throw new AiCommandError("AI_COMMAND_REVISION_NOT_FOUND", "Revision checkpoint was not found.", 404);
      const target = parsePageContent(revision.contentJson);
      return applyDraftMutation(tx, {
        ...context,
        commandName: "revision.restore",
        mutate() {
          return { nodes: target, elementId: null };
        },
      });
    },
  }),
  "page.publish": Object.freeze({
    kind: "consequential",
    resource: "pages",
    action: "publish",
    reversible: false,
    requiresBaseVersion: true,
    directExecution: false,
    approval: "explicit-route",
    input: Object.freeze({ pageId: "string", baseVersion: "integer", sourceGenerationId: "string?" }),
    normalize(input) {
      return {
        pageId: requiredString(input.pageId, "pageId"),
        baseVersion: requiredVersion(input.baseVersion),
        sourceGenerationId: safeGenerationId(input.sourceGenerationId),
      };
    },
  }),
});

export const AI_COMMAND_REGISTRY_VERSION = 2;

export function listAiCommandDefinitions() {
  return Object.freeze(Object.entries(REGISTRY).map(([name, definition]) => publicDefinition(name, definition)));
}

export function resolveAiCommandDefinition(name) {
  const commandName = String(name || "").trim();
  const definition = REGISTRY[commandName];
  if (!definition) throw new AiCommandError("AI_COMMAND_UNSUPPORTED", `Unsupported AI command: ${commandName || "unknown"}.`, 400);
  return { name: commandName, ...definition };
}

export async function executeAiCommand({ db, session, actor = "system", role = "system", name, input = {} } = {}) {
  if (!db) throw new AiCommandError("AI_COMMAND_SERVER_ERROR", "AI command database is unavailable.", 500);
  if (!session?.shop) throw new AiCommandError("AI_COMMAND_UNAUTHENTICATED", "Authenticated shop session is required.", 401);

  const definition = resolveAiCommandDefinition(name);
  if (!(await canAccessBuilderAction(db, session, definition.resource, definition.action))) {
    throw new AiCommandError("AI_COMMAND_FORBIDDEN", `Your role cannot execute ${definition.name}.`, 403);
  }

  const normalized = definition.normalize(input);
  if (definition.kind === "draft-mutation") {
    const runtimeEntitlements = await getBuilderRuntimeEntitlements(db, session.shop);
    if (runtimeEntitlements.collaborationEnabled) {
      const collaborationRole = await getCollaborationRole(db, session);
      if (!canCollaborate(collaborationRole, "save")) {
        throw new AiCommandError("AI_COMMAND_COLLABORATION_FORBIDDEN", `Your ${collaborationRole} collaboration role cannot apply AI draft commands.`, 403);
      }
      const blockingLock = await getBlockingPageLock(db, { session, pageId: normalized.pageId });
      if (blockingLock) {
        throw new AiCommandError("AI_COMMAND_PAGE_LOCKED", `This page is locked by ${blockingLock.ownerName}.`, 423);
      }
    }
  }
  if (definition.directExecution === false || definition.kind === "consequential") {
    throw new AiCommandError(
      "AI_COMMAND_EXPLICIT_APPROVAL_REQUIRED",
      `${definition.name} must use the existing explicit user-approved route and cannot be executed directly by AI.`,
      409,
    );
  }

  return runBuilderCommand(db, {
    shop: session.shop,
    pageId: normalized.pageId || null,
    actor,
    role,
    name: `ai.${definition.name}`,
    input: {
      ...normalized,
      patch: normalized.patch ? sanitizePatch(normalized.patch) : undefined,
    },
    execute: (tx) => definition.execute(tx, {
      shop: session.shop,
      actor,
      role,
      input: normalized,
      definition,
    }),
  });
}
