import { migrateBuilderContent } from "../builder/schemaMigrations.js";
import { findNode, removeNode, updateNode } from "../builder/tree.js";
import { serializePageForAi } from "../builder/aiBuilder.js";
import { canAccessBuilderAction } from "../utils/builder-permissions.server.js";
import { runBuilderCommand } from "./command-bus.server.js";

const MAX_PATCH_KEYS = 80;
const MAX_PATCH_DEPTH = 6;
const MAX_PATCH_ARRAY = 120;
const MAX_PATCH_STRING = 8000;
const MAX_CONTENT_CHARS = 2_000_000;
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const UNSAFE_KEY = /^(?:on[a-z]+|script|scripts|srcdoc|customjs|custom_js|customcode|custom_code|liquid|html)$/i;
const UNSAFE_TEXT = /(?:javascript\s*:|<\s*script\b|\{%|\{\{)/i;

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
          const node = findNode(nodes, context.input.elementId);
          if (!node) throw new AiCommandError("AI_COMMAND_ELEMENT_NOT_FOUND", "Builder element not found.", 404);
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

export const AI_COMMAND_REGISTRY_VERSION = 1;

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
