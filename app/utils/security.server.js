import https from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const SAFE_PROTOCOLS = new Set(["https:"]);
const OUTBOUND_TIMEOUT_MS = 8000;
const OUTBOUND_MAX_RESPONSE_BYTES = 256 * 1024;
const OUTBOUND_MAX_BODY_BYTES = 512 * 1024;
const OUTBOUND_ABSOLUTE_MAX_BODY_BYTES = 32 * 1024 * 1024;
export function sanitizePlainText(value, max = 5000) { return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max); }

function privateIpv4(host) {
  const parts=String(host||"").split(".").map(Number);if(parts.length!==4||parts.some((n)=>!Number.isInteger(n)||n<0||n>255))return true;
  const [a,b,c]=parts;
  return a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||(b===0&&c===0)||(b===0&&c===2)||(b===88&&c===99)))||(a===198&&((b===18||b===19)||(b===51&&c===100)))||(a===203&&b===0&&c===113);
}
function ipv6BigInt(address){
  let input=String(address||"").toLowerCase().split("%")[0].replace(/^\[|\]$/g,"");
  if(input.includes(".")){
    const lastColon=input.lastIndexOf(":");const dotted=input.slice(lastColon+1);const parts=dotted.split(".").map(Number);
    if(parts.length!==4||parts.some((part)=>!Number.isInteger(part)||part<0||part>255))return null;
    input=`${input.slice(0,lastColon)}:${((parts[0]<<8)|parts[1]).toString(16)}:${((parts[2]<<8)|parts[3]).toString(16)}`;
  }
  const halves=input.split("::");if(halves.length>2)return null;
  const left=halves[0]?halves[0].split(":"):[];const right=halves.length===2&&halves[1]?halves[1].split(":"):[];
  if(halves.length===1&&left.length!==8)return null;
  const missing=8-left.length-right.length;if(missing<0||(halves.length===2&&missing<1))return null;
  const groups=[...left,...Array(missing).fill("0"),...right];if(groups.length!==8||groups.some((g)=>!/^[0-9a-f]{1,4}$/.test(g)))return null;
  return groups.reduce((value,group)=>(value<<16n)+BigInt(`0x${group}`),0n);
}
function privateIpv6(host) {
  const value=ipv6BigInt(host);if(value===null||value===0n||value===1n)return true;
  if((value>>121n)===0x7en)return true; // fc00::/7 unique-local
  if((value>>118n)===0x3fan||(value>>118n)===0x3fbn)return true; // link/site-local
  if((value>>120n)===0xffn)return true; // multicast
  if((value>>96n)===0x20010db8n||(value>>96n)===0x20010000n)return true; // docs/Teredo
  if((value>>32n)===0xffffn||(value>>32n)===0n){
    const low=Number(value&0xffffffffn);return privateIpv4(`${(low>>>24)&255}.${(low>>>16)&255}.${(low>>>8)&255}.${low&255}`);
  }
  if((value>>32n)===0x64ff9b0000000000000000n||(value>>80n)===0x64ff9b0001n)return true; // NAT64
  if((value>>112n)===0x2002n)return true; // 6to4
  return false;
}
function unsafeExternalHost(hostname) {
  const host=String(hostname||"").replace(/^\[|\]$/g,"").toLowerCase();
  if(!host||host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")||host.endsWith(".internal"))return true;
  const family=isIP(host);return family===4?privateIpv4(host):family===6?privateIpv6(host):false;
}
export function safeExternalUrl(value) {
  try {
    const url = new URL(String(value));
    if(!SAFE_PROTOCOLS.has(url.protocol)||url.username||url.password||unsafeExternalHost(url.hostname))return null;
    return url.toString();
  } catch { return null; }
}

export async function resolvePublicHttpsTarget(value) {
  const safe = safeExternalUrl(value);
  if (!safe) throw new Error("Outbound URL must be a public HTTPS URL without embedded credentials.");
  const url = new URL(safe);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let rows;
  if (isIP(host)) rows = [{ address: host, family: isIP(host) }];
  else {
    try { rows = await lookup(host, { all: true, verbatim: true }); }
    catch { throw new Error("Outbound hostname could not be resolved safely."); }
  }
  if (!rows.length || rows.some((row) => unsafeExternalHost(row.address))) throw new Error("Outbound URL resolved to a private or non-public network address.");
  return { url, target: rows.find((row) => row.family === 4) || rows[0] };
}

export async function publicHttpsRequest(value, { method = "POST", headers = {}, body = "", timeoutMs = OUTBOUND_TIMEOUT_MS, maxResponseBytes = OUTBOUND_MAX_RESPONSE_BYTES, maxBodyBytes = OUTBOUND_MAX_BODY_BYTES } = {}) {
  const { url, target } = await resolvePublicHttpsTarget(value);
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(String(body || ""));
  const bodyLimit = Math.max(0, Math.min(OUTBOUND_ABSOLUTE_MAX_BODY_BYTES, Number(maxBodyBytes) || OUTBOUND_MAX_BODY_BYTES));
  if (payload.byteLength > bodyLimit) throw new Error("Outbound request body is too large.");
  return new Promise((resolve, reject) => {
    let settled = false;
    const request = https.request(url, {
      method,
      headers: { ...headers, "content-length": String(payload.byteLength) },
      lookup(_hostname, options, callback) {
        if (options?.all) callback(null, [{ address: target.address, family: target.family }]);
        else callback(null, target.address, target.family);
      },
    }, (response) => {
      const chunks = []; let total = 0;
      response.on("data", (chunk) => {
        if (settled) return;
        total += chunk.length;
        if (total > maxResponseBytes) {
          settled = true; request.destroy(); response.destroy(); reject(new Error("Outbound response is too large.")); return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => {
        if (settled) return;
        settled = true;
        const status = Number(response.statusCode || 0);
        resolve({ ok: status >= 200 && status < 300, status, headers: response.headers || {}, body: Buffer.concat(chunks).toString("utf8") });
      });
      response.on("error", (error) => { if (!settled) { settled = true; reject(error); } });
    });
    request.setTimeout(Math.max(1000, Math.min(30000, Number(timeoutMs) || OUTBOUND_TIMEOUT_MS)), () => request.destroy(new Error("Outbound request timed out.")));
    request.on("error", (error) => { if (!settled) { settled = true; reject(error); } });
    if (payload.byteLength) request.write(payload);
    request.end();
  });
}

function stripDangerousSvgMarkup(value) {
  return String(value || "")
    .replace(/<\s*(script|iframe|object|embed|foreignObject|audio|video)[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|iframe|object|embed|foreignObject|audio|video)\b[^>]*\/?\s*>/gi, "")
    .replace(/\s+on[a-z0-9:_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(?:href|xlink:href)\s*=\s*(["'])\s*(?:javascript:|data:text\/html)[\s\S]*?\1/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/url\s*\(\s*(["']?)\s*(?:javascript:|data:text\/html)[^)]*\1\s*\)/gi, "none");
}

export function sanitizeSvg(svg) {
  let out = stripDangerousSvgMarkup(String(svg || "").slice(0, 200000));
  if (!/^\s*<svg[\s>]/i.test(out)) throw new Error("Only SVG markup is allowed.");
  if (/<\s*(script|iframe|object|embed|foreignObject)\b/i.test(out) || /\son[a-z0-9:_-]+\s*=/i.test(out) || /javascript\s*:/i.test(out)) {
    throw new Error("SVG contains executable or embedded document content that VSN cannot store safely.");
  }
  return out;
}
export function validateWebhookUrl(value) { const url = safeExternalUrl(value); if (!url) throw new Error("Webhook URL must be a public HTTPS URL without embedded credentials."); return url; }
export function detectSpam(fields = {}) {
  const text = Object.values(fields).map((v) => typeof v === "string" ? v : "").join(" ").toLowerCase();
  if (text.length > 30000) return "payload-too-large";
  const links = (text.match(/https?:\/\//g) || []).length; if (links > 5) return "too-many-links";
  if (/\b(viagra|casino|crypto giveaway|free money)\b/i.test(text)) return "keyword";
  return null;
}
