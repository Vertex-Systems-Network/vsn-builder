import { normalizeStructuredItems } from "../builder/structuredItems.js";
import { contentTypography } from "./contentWidgets.js";
import { toCssSize } from "./designTokens.js";
import { escapeAttribute, escapeHtml } from "./safeCss.js";

export function parseFormFields(value) {
  return String(value || "").split(/\r?\n/).map((line, index) => {
    const [type="text", name=`field_${index+1}`, label="Field", placeholder="", required="", options="", step="1"] = line.split("|").map((part)=>String(part||"").trim());
    return { type:type.toLowerCase(), name:name.replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,80), label, placeholder, required:/^(required|true|1|yes)$/i.test(required), options:options.split(",").map((x)=>x.trim()).filter(Boolean), step:Math.max(1, Number(step)||1) };
  }).filter((field)=>field.type && field.name);
}

export function renderFormBuilder(node, props, styles, renderContext = {}) {
  const formKey=String(props.formKey||"custom").trim()||"custom";
  const formSettings=renderContext?.formConfigs?.[formKey]||{};
  const captchaMode=formSettings.captchaMode||props.captchaMode||"none";
  const turnstileSiteKey=formSettings.turnstileSiteKey||props.turnstileSiteKey||"";
  const hcaptchaSiteKey=formSettings.hcaptchaSiteKey||props.hcaptchaSiteKey||"";
  const captchaV2=renderContext?.googleCaptcha?.v2||{}; const captchaV3=renderContext?.googleCaptcha?.v3||{};
  const recaptchaV2SiteKey=captchaV2.enabled!==false&&captchaV2.siteKeyConfigured?captchaV2.siteKey:"";
  const recaptchaV3SiteKey=captchaV3.enabled!==false&&captchaV3.siteKeyConfigured?captchaV3.siteKey:"";
  const recaptchaV3Threshold=Math.max(0,Math.min(1,Number(formSettings.recaptchaV3Threshold??props.recaptchaV3Threshold??captchaV3.threshold??0.5)));
  const recaptchaV3Action=String(formSettings.recaptchaV3Action||props.recaptchaV3Action||captchaV3.action||"form_submit").replace(/[^A-Za-z0-9_/]/g,"").slice(0,80)||"form_submit";
  const fields=parseFormFields(props.fieldsText);
  const maxStep=Math.max(1,...fields.map((field)=>field.step));
  const multi=props.multiStep===true && maxStep>1;
  const customer=renderContext?.customer||{}; const product=renderContext?.product||{};
  const fieldHtml=fields.map((field,index)=>{
    const id=`vsn-${escapeAttribute(node.id||"form")}-${index}`;
    const required=field.required?" required":"";
    let prefill=""; if(props.prefillCustomer!==false){if(field.name==="email"&&customer.email)prefill=customer.email;else if(["name","full_name","customer_name"].includes(field.name)&&customer.name)prefill=customer.name;} if(props.prefillProduct!==false){if(["product","product_title"].includes(field.name)&&product.title)prefill=product.title;else if(["product_handle","productHandle"].includes(field.name)&&product.handle)prefill=product.handle;}
    const common=`id="${id}" name="${escapeAttribute(field.name)}"${required}${prefill?` value="${escapeAttribute(prefill)}"`:""}`;
    let control="";
    if(field.type==="textarea") control=`<textarea ${common} placeholder="${escapeAttribute(field.placeholder)}" style="min-height:110px;padding:10px 12px;border:1px solid #d9d9d9;border-radius:8px;width:100%;box-sizing:border-box;"></textarea>`;
    else if(field.type==="select") control=`<select ${common} style="padding:10px 12px;border:1px solid #d9d9d9;border-radius:8px;width:100%;box-sizing:border-box;">${field.options.map((option)=>`<option value="${escapeAttribute(option)}">${escapeHtml(option)}</option>`).join("")}</select>`;
    else if(field.type==="radio") control=`<div style="display:flex;gap:12px;flex-wrap:wrap;">${field.options.map((option,i)=>`<label style="display:flex;gap:6px;align-items:center;"><input type="radio" name="${escapeAttribute(field.name)}" value="${escapeAttribute(option)}"${field.required&&i===0?" required":""}> ${escapeHtml(option)}</label>`).join("")}</div>`;
    else if(field.type==="checkbox") control=`<div style="display:grid;gap:6px;">${(field.options.length?field.options:[field.label]).map((option)=>`<label style="display:flex;gap:6px;align-items:center;"><input type="checkbox" name="${escapeAttribute(field.name)}" value="${escapeAttribute(option)}"> ${escapeHtml(option)}</label>`).join("")}</div>`;
    else if(field.type==="consent") control=`<label style="display:flex;gap:8px;align-items:flex-start;"><input type="checkbox" name="${escapeAttribute(field.name)}" value="yes"${required}> <span>${escapeHtml(field.label)}</span></label>`;
    else if(field.type==="rating") control=`<input ${common} type="number" min="1" max="5" step="1" placeholder="${escapeAttribute(field.placeholder||"1–5")}" style="padding:10px 12px;border:1px solid #d9d9d9;border-radius:8px;width:100%;box-sizing:border-box;">`;
    else if(field.type==="file") control=`<input ${common} type="file" ${props.fileMultiple!==false?"multiple":""} accept="${escapeAttribute(props.fileAccept||"image/*,.pdf")}" style="padding:10px 12px;border:1px solid #d9d9d9;border-radius:8px;width:100%;box-sizing:border-box;">`;
    else if(field.type==="hidden") return `<input type="hidden" name="${escapeAttribute(field.name)}" value="${escapeAttribute(field.placeholder)}" data-vsn-form-step="${field.step}">`;
    else { const allowed=["text","email","tel","number","date","time","datetime-local","url"]; const type=allowed.includes(field.type)?field.type:"text"; control=`<input ${common} type="${type}" placeholder="${escapeAttribute(field.placeholder)}" style="padding:10px 12px;border:1px solid #d9d9d9;border-radius:8px;width:100%;box-sizing:border-box;">`; }
    const label=props.showLabels===false||field.type==="consent"?"":`<label for="${id}" style="font-size:13px;font-weight:600;">${escapeHtml(field.label)}${field.required?" *":""}</label>`;
    return `<div class="vsn-form-field" data-vsn-form-step="${field.step}" style="display:${multi&&field.step!==1?"none":"grid"};gap:6px;">${label}${control}</div>`;
  }).join("");
  const gap=toCssSize(styles?.spacing?.gap,"12px");
  return `<form class="vsn-builder-form vsn-form-builder" data-vsn-id="${escapeAttribute(node.id||"")}" data-vsn-form-type="${escapeAttribute(formKey)}" data-vsn-captcha-mode="${escapeAttribute(captchaMode)}" data-vsn-recaptcha-v3-sitekey="${escapeAttribute(captchaMode==="recaptcha-v3"?recaptchaV3SiteKey:"")}" data-vsn-recaptcha-v3-action="${escapeAttribute(recaptchaV3Action)}" data-vsn-recaptcha-v3-threshold="${escapeAttribute(recaptchaV3Threshold)}" data-vsn-success="${escapeAttribute(props.successText||"Thanks. Your submission has been received.")}" data-vsn-error="${escapeAttribute(props.errorText||"Please check the form and try again.")}" data-vsn-multi-step="${multi?"1":"0"}" data-vsn-max-step="${maxStep}" data-vsn-current-step="1" data-vsn-conditional="${escapeAttribute(encodeURIComponent(props.conditionalRulesText||""))}" data-vsn-validation="${escapeAttribute(encodeURIComponent(props.validationRulesText||""))}" data-vsn-calculations="${escapeAttribute(encodeURIComponent(props.calculationsText||""))}" data-vsn-prefill-query="${props.prefillQuery!==false?"1":"0"}" data-vsn-success-action="${escapeAttribute(props.successAction||"message")}" data-vsn-redirect="${escapeAttribute(props.redirectUrl||"")}" data-vsn-event="${escapeAttribute(props.customEventName||"vsn:form-success")}" data-vsn-coupon="${escapeAttribute(props.couponCode||"")}" style="display:grid;gap:${gap};max-width:${toCssSize(styles?.size?.maxWidth,"680px")};">
    ${props.heading?`<h3 style="margin:0;">${escapeHtml(props.heading)}</h3>`:""}
    <input type="hidden" name="formType" value="${escapeAttribute(formKey)}">
    ${props.prefillProduct!==false&&product.handle?`<input type="hidden" name="productHandle" value="${escapeAttribute(product.handle)}">`:""}
    <input type="text" name="website" autocomplete="off" tabindex="-1" aria-hidden="true" style="position:absolute;left:-9999px;opacity:0;pointer-events:none;">
    ${fieldHtml}
    ${captchaMode==="turnstile"&&turnstileSiteKey?`<div class="cf-turnstile" data-sitekey="${escapeAttribute(turnstileSiteKey)}"></div>`:""}
    ${captchaMode==="hcaptcha"&&hcaptchaSiteKey?`<div class="h-captcha" data-sitekey="${escapeAttribute(hcaptchaSiteKey)}"></div>`:""}
    ${captchaMode==="recaptcha-v2"&&recaptchaV2SiteKey?`<div class="vsn-g-recaptcha" data-sitekey="${escapeAttribute(recaptchaV2SiteKey)}"></div>`:""}
    ${captchaMode==="recaptcha-v3"&&recaptchaV3SiteKey?`<div class="vsn-g-recaptcha-v3" data-sitekey="${escapeAttribute(recaptchaV3SiteKey)}" data-action="${escapeAttribute(recaptchaV3Action)}"></div>`:""}
    ${captchaMode==="recaptcha-v2"&&!recaptchaV2SiteKey?`<div class="vsn-form-captcha-error" role="alert">Google reCAPTCHA v2 is not configured.</div>`:""}
    ${captchaMode==="recaptcha-v3"&&!recaptchaV3SiteKey?`<div class="vsn-form-captcha-error" role="alert">Google reCAPTCHA v3 is not configured.</div>`:""}
    <div class="vsn-form-actions" style="display:flex;gap:8px;align-items:center;">
      ${multi?`<button type="button" class="vsn-form-prev" style="display:none;padding:10px 14px;border:1px solid #ddd;border-radius:8px;background:#fff;">${escapeHtml(props.previousText||"Back")}</button><button type="button" class="vsn-form-next" style="padding:10px 14px;border:0;border-radius:8px;background:#111;color:#fff;font-weight:600;">${escapeHtml(props.nextText||"Next")}</button>`:""}
      <button type="submit" class="vsn-form-submit" style="${multi?"display:none;":""}padding:10px 14px;border:0;border-radius:8px;background:#111;color:#fff;font-weight:600;">${escapeHtml(props.submitText||"Submit")}</button>
    </div>
    <div class="vsn-form-status" role="status" aria-live="polite" style="min-height:1.25em;font-size:13px;"></div>
  </form>`;
}

export function renderNavigationMenu(node, props, styles) {
	const items = normalizeStructuredItems("navigation-menu", props).map((item)=>({label:item.label||"",url:item.url||"#"}));
	const align = props.alignment === "left" ? "flex-start" : props.alignment === "center" ? "center" : "flex-end";
	const gap = toCssSize(styles?.spacing?.gap, "22px");
	const typography = contentTypography(styles, { fontSize: "14px", fontWeight: "600", color: "#1a1a1a" });
	return `<nav class="vsn-nav" data-vsn-id="${escapeAttribute(node.id || "")}" data-vsn-mobile="${props.mobileMenu !== false ? "1" : "0"}" style="${typography}">
		<button type="button" class="vsn-nav-toggle" aria-expanded="false" style="display:none;border:1px solid currentColor;background:transparent;color:inherit;padding:8px 12px;border-radius:8px;">${escapeHtml(props.mobileLabel || "Menu")}</button>
		<div class="vsn-nav-links" style="display:flex;justify-content:${align};align-items:center;gap:${gap};flex-wrap:wrap;">
			${items.map((item) => `<a href="${escapeAttribute(item.url)}" style="color:inherit;text-decoration:none;">${escapeHtml(item.label)}</a>`).join("")}
		</div>
	</nav>`;
}

export function renderFormWidget(node, props, styles, type, ctx) {
	const newsletter = type === "newsletter-form";
	const inquiry = type === "product-inquiry-form";
	const formType = newsletter ? "newsletter" : inquiry ? "product-inquiry" : "contact";
	const gap = toCssSize(styles?.spacing?.gap, "12px");
	const heading = props.heading || (newsletter ? "Join our newsletter" : inquiry ? "Product inquiry" : "Contact us");
	const submit = props.submitText || (newsletter ? "Subscribe" : "Send message");
	const success = props.successText || (newsletter ? "Thanks for subscribing." : "Thanks. Your message has been received.");
	const error = props.errorText || "Please check the form and try again.";
	return `<form class="vsn-builder-form" data-vsn-id="${escapeAttribute(node.id || "")}" data-vsn-form-type="${formType}" data-vsn-success="${escapeAttribute(success)}" data-vsn-error="${escapeAttribute(error)}" style="display:grid;gap:${gap};max-width:${toCssSize(styles?.size?.maxWidth, "640px")};">
		${heading ? `<h3 style="margin:0;">${escapeHtml(heading)}</h3>` : ""}
		<input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;opacity:0;pointer-events:none;">
		${newsletter ? "" : `<label>Name<input required name="name" type="text" autocomplete="name" style="display:block;width:100%;margin-top:5px;padding:10px;border:1px solid #d9d9d9;border-radius:8px;"></label>`}
		<label>${newsletter ? "Email" : "Email"}<input required name="email" type="email" autocomplete="email" placeholder="${escapeAttribute(props.placeholder || "Email address")}" style="display:block;width:100%;margin-top:5px;padding:10px;border:1px solid #d9d9d9;border-radius:8px;"></label>
		${!newsletter && props.showPhone !== false ? `<label>Phone<input name="phone" type="tel" autocomplete="tel" style="display:block;width:100%;margin-top:5px;padding:10px;border:1px solid #d9d9d9;border-radius:8px;"></label>` : ""}
		${newsletter ? "" : `<label>Message<textarea required name="message" rows="5" style="display:block;width:100%;margin-top:5px;padding:10px;border:1px solid #d9d9d9;border-radius:8px;resize:vertical;"></textarea></label>`}
		<input type="hidden" name="formType" value="${formType}">
		<input type="hidden" name="productHandle" value="${escapeAttribute(ctx?.product?.handle || "")}">
		<button type="submit" style="justify-self:start;padding:11px 18px;border:0;border-radius:8px;background:var(--vsn-button-bg,#1a1a1a);color:var(--vsn-button-color,#fff);font-weight:600;cursor:pointer;">${escapeHtml(submit)}</button>
		<div class="vsn-form-status" role="status" aria-live="polite" style="min-height:1.25em;font-size:13px;"></div>
	</form>`;
}

export function renderContentIconSvg(name = "star") {
	const icon = String(name || "star").toLowerCase();
	const paths = {
		star: '<path d="M12 2.8l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9L6.4 20l1.1-6.2L3 9.4l6.2-.9L12 2.8z"/>',
		heart: '<path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 5.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.4a5.5 5.5 0 0 0-.1-7.8z"/>',
		check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
		plus: '<path d="M12 5v14M5 12h14"/>',
		play: '<path d="M8 5v14l11-7z"/>',
		"arrow-right": '<path d="M5 12h14M13 6l6 6-6 6"/>',
		cart: '<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M3 4h2l2.4 10.2a2 2 0 0 0 2 1.5h7.9a2 2 0 0 0 2-1.6L21 8H7"/>',
		user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
		search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
		info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
		warning: '<path d="M10.3 3.6L2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
	};
	const body = paths[icon] || paths.star;
	return `<svg class="vsn-icon" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

export function renderIconWidget(node, props) {
	const label = String(props.label || props.alt || "").trim();
	return `<span data-vsn-id="${escapeAttribute(node.id || "")}" class="vsn-icon-widget"${label ? ` role="img" aria-label="${escapeAttribute(label)}"` : ' aria-hidden="true"'} style="display:inline-flex;align-items:center;justify-content:center;">${renderContentIconSvg(props.name || "star")}</span>`;
}
