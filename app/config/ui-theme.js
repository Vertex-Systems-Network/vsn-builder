export const UI_COLOR_SCHEMES = Object.freeze([
  { id:"lime", label:"Lime", accent:"#95BF47" },
  { id:"emerald", label:"Emerald", accent:"#008060" },
  { id:"ocean", label:"Ocean", accent:"#2563EB" },
  { id:"violet", label:"Violet", accent:"#7C3AED" },
  { id:"sunset", label:"Sunset", accent:"#EA580C" },
  { id:"rose", label:"Rose", accent:"#E11D48" },
  { id:"graphite", label:"Graphite", accent:"#475569" },
  { id:"custom", label:"Custom", accent:null },
]);

const DEFAULT_ACCENT="#95BF47";
export function normalizeUiHex(value,fallback=DEFAULT_ACCENT){const raw=String(value||"").trim();const full=/^#[0-9a-f]{6}$/i.test(raw)?raw:/^#[0-9a-f]{3}$/i.test(raw)?`#${raw.slice(1).split("").map((c)=>c+c).join("")}`:"";return full?full.toUpperCase():fallback;}
function rgb(hex){const value=normalizeUiHex(hex).slice(1);return [0,2,4].map((i)=>parseInt(value.slice(i,i+2),16));}
function hex([r,g,b]){return `#${[r,g,b].map((v)=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,"0")).join("")}`.toUpperCase();}
function mix(a,b,ratio){const x=rgb(a),y=rgb(b),r=Math.max(0,Math.min(1,Number(ratio)||0));return hex(x.map((v,i)=>v*(1-r)+y[i]*r));}
function foreground(accent){const [r,g,b]=rgb(accent).map((v)=>{const c=v/255;return c<=0.03928?c/12.92:((c+0.055)/1.055)**2.4;});return 0.2126*r+0.7152*g+0.0722*b>0.46?"#17210D":"#FFFFFF";}
export function normalizeUiColorScheme(value){const id=String(value||"");return UI_COLOR_SCHEMES.some((item)=>item.id===id)?id:"lime";}
export function resolveUiTheme(scheme="lime",customAccent=DEFAULT_ACCENT){const id=normalizeUiColorScheme(scheme);const preset=UI_COLOR_SCHEMES.find((item)=>item.id===id);const accent=normalizeUiHex(id==="custom"?customAccent:preset?.accent||DEFAULT_ACCENT);const accentDark=mix(accent,"#000000",0.18);const accentSoft=mix(accent,"#FFFFFF",0.88);const [r,g,b]=rgb(accent);return{id,accent,accentDark,accentSoft,accentForeground:foreground(accent),accentRgb:`${r},${g},${b}`};}
