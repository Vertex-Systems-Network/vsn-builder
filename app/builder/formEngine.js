export const FORM_ENGINE_SCHEMA_VERSION = 3;
const num=(v,f,min,max)=>{const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):f};
const text=(v,n=1000)=>String(v||"").trim().slice(0,n);
export function safeFormRedirectUrl(value=""){
  const raw=text(value,1500);if(!raw)return"";
  if(raw.startsWith("#"))return raw;
  if(raw.startsWith("/")&&!raw.startsWith("//"))return raw;
  try{const url=new URL(raw);return ["https:","http:"].includes(url.protocol)&&!url.username&&!url.password?url.toString():"";}catch{return"";}
}
export function normalizeFormAutomationSettings(input={}){const s=input&&typeof input==="object"?input:{};return{
  schemaVersion:FORM_ENGINE_SCHEMA_VERSION,
  enabled:s.enabled!==false,
  maxFiles:num(s.maxFiles,5,0,20),
  maxFileSizeMb:num(s.maxFileSizeMb,8,1,25),
  allowedFileTypes:text(s.allowedFileTypes||"image/jpeg,image/png,image/webp,application/pdf",1000),
  rateLimitPerHour:num(s.rateLimitPerHour,20,1,500),
  captchaMode:["none","turnstile","hcaptcha","recaptcha-v2","recaptcha-v3"].includes(s.captchaMode)?s.captchaMode:"none",
  turnstileSiteKey:text(s.turnstileSiteKey,300),
  hcaptchaSiteKey:text(s.hcaptchaSiteKey,300),
  recaptchaV3Threshold:num(s.recaptchaV3Threshold,0.5,0,1),
  recaptchaV3Action:(text(s.recaptchaV3Action||"form_submit",80).replace(/[^A-Za-z0-9_/]/g,"")||"form_submit"),
  notificationEmail:text(s.notificationEmail,254),
  autoresponderEnabled:s.autoresponderEnabled===true,
  autoresponderSubject:text(s.autoresponderSubject||"We received your message",200),
  autoresponderBody:text(s.autoresponderBody||"Thanks for contacting us. We received your submission.",5000),
  successAction:["message","redirect","popup-close","custom-event","coupon"].includes(s.successAction)?s.successAction:"message",
  successMessage:text(s.successMessage||"Thanks. Your submission has been received.",1000),
  redirectUrl:safeFormRedirectUrl(s.redirectUrl),
  customEventName:text(s.customEventName||"vsn:form-success",160),
  couponCode:text(s.couponCode,120),
  privacyStoreRequesterHash:s.privacyStoreRequesterHash!==false,
};}
export function csvValues(value){return String(value||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean)}
export function fileAllowed(file,settings){const allowed=csvValues(settings.allowedFileTypes);if(!allowed.length)return true;const mime=String(file?.type||"").toLowerCase();const name=String(file?.name||"").toLowerCase();return allowed.some(rule=>rule===mime||(rule.endsWith("/*")&&mime.startsWith(rule.slice(0,-1)))||(rule.startsWith(".")&&name.endsWith(rule)))}
export function formSuccessPayload(settings){return{type:settings.successAction,message:settings.successMessage,redirectUrl:safeFormRedirectUrl(settings.redirectUrl),eventName:settings.customEventName,couponCode:settings.couponCode}}
