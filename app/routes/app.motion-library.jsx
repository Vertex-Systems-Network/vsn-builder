import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import { canBuilder, getBuilderRole } from "../utils/builder-permissions.js";
import { canAccessBuilderEditor } from "../utils/builder-permissions.server.js";
import { getBuiltinMotionPreset, listMotionLibrary, normalizePresetInput } from "../services/motion-library.server.js";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  if (!(await canAccessBuilderEditor(db, session))) throw new Response("Your role does not have access to Motion Library.", { status: 403 });
  const url = new URL(request.url);
  const builtinId = String(url.searchParams.get("builtinId") || "");
  if (builtinId) {
    const builtin = getBuiltinMotionPreset(builtinId);
    if (!builtin) return Response.json({ ok:false, error:"Built-in motion preset not found." }, { status:404 });
    return { builtin };
  }
  return listMotionLibrary(db, session.shop);
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  if (!(await canAccessBuilderEditor(db, session))) return Response.json({ ok:false, error:"Your role does not have access to Motion Library." }, { status:403 });
  const role = getBuilderRole(session);
  if (!canBuilder(role, "edit")) return Response.json({ ok:false, error:"Your role cannot edit animations." }, { status:403 });
  const form = await request.formData();
  const intent = String(form.get("intent") || "");
  const id = String(form.get("id") || "");
  try {
    if (intent === "create" || intent === "update") {
      const input = normalizePresetInput({
        name: form.get("name"), description: form.get("description"), category: form.get("category"), scope: form.get("scope"), timeline: form.get("timeline"),
      });
      let row;
      if (intent === "create") row = await db.builderMotionPreset.create({ data: { shop:session.shop, ...input } });
      else {
        const result = await db.builderMotionPreset.updateMany({ where:{ id, shop:session.shop, deletedAt:null }, data:input });
        if (!result.count) return Response.json({ ok:false, error:"Animation not found or no longer editable." }, { status:404 });
        row = await db.builderMotionPreset.findFirst({ where:{ id, shop:session.shop } });
      }
      return Response.json({ ok:true, intent, id:row?.id || id, message:intent === "create" ? "Animation saved to Motion Library." : "Animation updated." });
    }
    if (intent === "duplicate") {
      const source = await db.builderMotionPreset.findFirst({ where:{ id, shop:session.shop, deletedAt:null } });
      if (!source) return Response.json({ ok:false, error:"Animation not found." }, { status:404 });
      const row = await db.builderMotionPreset.create({ data:{ shop:session.shop, name:`${source.name} Copy`, description:source.description, category:source.category, scope:source.scope, timelineJson:source.timelineJson, tokensJson:source.tokensJson } });
      return Response.json({ ok:true, intent, id:row.id, message:"Animation duplicated." });
    }
    if (intent === "favorite") {
      const favorite = String(form.get("favorite")) === "true";
      await db.builderMotionPreset.updateMany({ where:{ id, shop:session.shop, deletedAt:null }, data:{ isFavorite:favorite } });
      return Response.json({ ok:true, intent, id, favorite });
    }
    if (intent === "trash") {
      await db.builderMotionPreset.updateMany({ where:{ id, shop:session.shop, deletedAt:null }, data:{ deletedAt:new Date() } });
      return Response.json({ ok:true, intent, id, message:"Animation moved to Trash." });
    }
    if (intent === "restore") {
      await db.builderMotionPreset.updateMany({ where:{ id, shop:session.shop }, data:{ deletedAt:null } });
      return Response.json({ ok:true, intent, id, message:"Animation restored." });
    }
    if (intent === "hard-delete") {
      if (!canBuilder(role, "delete")) return Response.json({ ok:false, error:"Your role cannot permanently delete animations." }, { status:403 });
      await db.builderMotionPreset.deleteMany({ where:{ id, shop:session.shop } });
      return Response.json({ ok:true, intent, id, message:"Animation permanently deleted." });
    }
    return Response.json({ ok:false, error:"Unsupported Motion Library action." }, { status:400 });
  } catch (error) {
    console.error(`VSN Motion Library action failed (${intent}):`, error);
    return Response.json({ ok:false, error:"Motion Library could not complete that action. Try again, then check System Health if the problem continues." }, { status:500 });
  }
}

export default function MotionLibraryRoute(){ return null; }
