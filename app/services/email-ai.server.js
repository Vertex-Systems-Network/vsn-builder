import dbDefault from "../db.server.js";
import { createEmailBlock, normalizeEmailDocument } from "../email/emailSchema.js";
import { EMAIL_BINDING_TOKENS } from "../email/emailBindings.js";
import { aiUsageStatus, reserveAiUsage } from "./ai-builder.server.js";
import { resolveAiBehavior } from "../ai/behaviors.js";
import { createAiExecution, generateStructuredAi, getAiRuntimePolicy } from "./ai-provider.server.js";
const EMAIL_AI_TYPES=["logo","header","navbar","hero","section","columns","text","image","image-text","button","testimonial","product","product-grid","order-summary","coupon","social","divider","spacer","footer"];
const AI_EMAIL_TOKENS=new Set(EMAIL_BINDING_TOKENS.map((item)=>item.path));
const AI_EMAIL_URL_TOKENS=new Set(["shop.url","product.url","product.image","order.status_url","cart.url","discount.url","campaign.url","item.url","item.image"]);

const AI_BLOCK_SCHEMA={type:"object",additionalProperties:false,required:["type","heading","text","buttonText","buttonUrl","image","alt","align","background","textColor"],properties:{type:{type:"string",enum:EMAIL_AI_TYPES},heading:{type:"string"},text:{type:"string"},buttonText:{type:"string"},buttonUrl:{type:"string"},image:{type:"string"},alt:{type:"string"},align:{type:"string",enum:["left","center","right"]},background:{type:"string"},textColor:{type:"string"}}};
const EMAIL_AI_SCHEMA={type:"object",additionalProperties:false,required:["name","subject","preheader","summary","blocks","subjectVariants"],properties:{name:{type:"string"},subject:{type:"string"},preheader:{type:"string"},summary:{type:"string"},blocks:{type:"array",maxItems:18,items:AI_BLOCK_SCHEMA},subjectVariants:{type:"array",maxItems:8,items:{type:"string"}}}};

function cleanColor(value,fallback=""){const raw=String(value||"").trim();return /^#[0-9a-f]{3,8}$/i.test(raw)?raw:fallback;}
function sanitizeAiText(value,max=2400){return String(value||"").replace(/\{\{[\s\S]*?\}\}/g,(token)=>{const path=token.slice(2,-2).trim();return /^[a-zA-Z0-9_.-]+$/.test(path)&&AI_EMAIL_TOKENS.has(path)?`{{ ${path} }}`:"";}).replace(/\{%[\s\S]*?%\}/g,"").split("\u0000").join("").slice(0,max);}
function unsafeNetworkHost(hostname=""){const host=String(hostname||"").toLowerCase().replace(/^\[|\]$/g,"").replace(/\.$/,"");if(!host||host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")||host==="::"||host==="::1"||host.startsWith("::ffff:")||host.startsWith("fc")||host.startsWith("fd")||/^fe[89ab]/.test(host)||host.startsWith("2001:db8:"))return true;const match=host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);if(!match)return false;const parts=match.slice(1).map(Number);if(parts.some((n)=>n>255))return true;const[a,b,c]=parts;return a===0||a===10||a===127||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===192&&b===0&&(c===0||c===2))||(a===198&&(b===18||b===19))||(a===198&&b===51&&c===100)||(a===203&&b===0&&c===113)||a>=224;}
function cleanUrl(value,fallback="{{ shop.url }}"){const raw=String(value||"").trim();if(!raw)return fallback;const token=raw.match(/^\{\{([\s\S]*?)\}\}$/);if(token){const path=String(token[1]||"").trim();return /^[a-zA-Z0-9_.-]+$/.test(path)&&AI_EMAIL_URL_TOKENS.has(path)?`{{ ${path} }}`:fallback;}if(raw.startsWith("/")&&!raw.startsWith("//"))return raw;let parsed;try{parsed=new URL(raw);}catch{return fallback;}if(!["http:","https:","mailto:","tel:"].includes(parsed.protocol)||parsed.username||parsed.password)return fallback;if(["http:","https:"].includes(parsed.protocol)&&unsafeNetworkHost(parsed.hostname))return fallback;return raw;}
function fromAiBlock(raw){const block=createEmailBlock(raw?.type||"text");const c={...block.content},s={...block.style};const heading=sanitizeAiText(raw?.heading,300),text=sanitizeAiText(raw?.text,2400),buttonText=sanitizeAiText(raw?.buttonText,120),buttonUrl=cleanUrl(raw?.buttonUrl),image=cleanUrl(raw?.image,"");if("heading" in c&&heading)c.heading=heading;if("text" in c&&text)c.text=text;if("buttonText" in c&&buttonText)c.buttonText=buttonText;if("buttonUrl" in c&&buttonText)c.buttonUrl=buttonUrl;if("url" in c&&buttonText)c.url=buttonUrl;if("image" in c&&image)c.image=image;if("src" in c&&image)c.src=image;if("alt" in c&&raw?.alt)c.alt=sanitizeAiText(raw.alt,240);if(raw?.align)s.align=raw.align;const bg=cleanColor(raw?.background);const fg=cleanColor(raw?.textColor);if(bg)s.background=bg;if(fg)s.color=fg;return {...block,content:c,style:s};}
export function normalizeEmailAiResult(raw,currentDocument){const blocks=(Array.isArray(raw?.blocks)?raw.blocks:[]).map(fromAiBlock);const current=normalizeEmailDocument(currentDocument||{});return {name:sanitizeAiText(raw?.name||"AI email",140),subject:sanitizeAiText(raw?.subject,200),preheader:sanitizeAiText(raw?.preheader,300),summary:sanitizeAiText(raw?.summary,500),subjectVariants:(Array.isArray(raw?.subjectVariants)?raw.subjectVariants:[]).map((v)=>sanitizeAiText(v,200)).filter(Boolean).slice(0,8),document:normalizeEmailDocument({...current,blocks:blocks.length?blocks:current.blocks})};}

async function callProvider({ execution, behavior, prompt, currentDocument, meta, commerceContext }) {
  const provider = await generateStructuredAi({
    execution,
    behavior,
    input: [{
      role: "user",
      content: [{
        type: "input_text",
        text: `Email request:\n${String(prompt || "").slice(0, 8000)}\n\nCurrent metadata:\n${JSON.stringify(meta || {}).slice(0, 4000)}\n\nCurrent document summary:\n${JSON.stringify(normalizeEmailDocument(currentDocument || {})).slice(0, 28000)}\n\nAvailable Shopify commerce context:\n${JSON.stringify(commerceContext || {}).slice(0, 12000)}`,
      }],
    }],
    schema: EMAIL_AI_SCHEMA,
    schemaName: "vsn_email_studio",
    schemaDescription: "Safe structured VSN email plan",
  });
  return { result: normalizeEmailAiResult(provider.output, currentDocument), ...provider };
}

export async function runEmailAi({ db = dbDefault, shop, operation = "email", prompt, currentDocument, meta, commerceContext }) {
  const allowed = new Set(["email", "section", "rewrite", "subjects"]);
  if (!allowed.has(operation)) throw new Error("Unsupported AI Email operation.");

  const policy = getAiRuntimePolicy();
  const behavior = resolveAiBehavior({ surface: "email", operation, version: policy.behaviorVersions.email });
  const execution = createAiExecution({ behavior });
  const status = await aiUsageStatus({ db, shop });
  const started = Date.now();
  const usageRow = await reserveAiUsage({ db, shop, pageId: null, operation: `email-${operation}`, execution });

  try {
    const provider = await callProvider({ execution, behavior, prompt, currentDocument, meta, commerceContext });
    await db.builderAiUsage.update({
      where: { id: usageRow.id },
      data: {
        status: "completed",
        inputTokens: Number(provider.usage?.input_tokens || 0),
        outputTokens: Number(provider.usage?.output_tokens || 0),
        responseId: provider.responseId || null,
        durationMs: Date.now() - started,
      },
    }).catch(() => {});
    return {
      ok: true,
      ...provider.result,
      usage: {
        ...status,
        used: status.used + 1,
        remaining: Math.max(0, status.remaining - 1),
        provider: provider.provider,
        model: provider.model,
        behaviorVersion: provider.behaviorVersion,
        generationId: provider.generationId,
      },
    };
  } catch (error) {
    await db.builderAiUsage.update({
      where: { id: usageRow.id },
      data: { status: "failed", error: String(error?.message || error).slice(0, 1000), durationMs: Date.now() - started },
    }).catch(() => {});
    throw error;
  }
}
