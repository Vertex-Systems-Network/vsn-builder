export const VSN_WIDGET_FIELD_TYPES = Object.freeze([
  { id:"text", label:"Text", group:"Basic", defaultValue:"" },
  { id:"textarea", label:"Multi-line Text", group:"Basic", defaultValue:"" },
  { id:"number", label:"Number", group:"Basic", defaultValue:0 },
  { id:"toggle", label:"Toggle / Checkbox", group:"Basic", defaultValue:false },
  { id:"select", label:"Dropdown Select", group:"Choice", defaultValue:"" },
  { id:"multi-select", label:"Multi Select", group:"Choice", defaultValue:[] },
  { id:"radio", label:"Radio Group", group:"Choice", defaultValue:"" },
  { id:"button-set", label:"Button Group", group:"Choice", defaultValue:"" },
  { id:"url", label:"URL / Link", group:"Content", defaultValue:"" },
  { id:"color", label:"Color", group:"Design", defaultValue:"#000000" },
  { id:"color-gradient", label:"Color / Gradient", group:"Design", defaultValue:{type:"color",color:"#000000"} },
  { id:"range", label:"Range Slider", group:"Numeric", defaultValue:0 },
  { id:"css-length", label:"CSS Length", group:"Design", defaultValue:"0px" },
  { id:"date", label:"Date", group:"Date & Time", defaultValue:"" },
  { id:"datetime", label:"Date & Time", group:"Date & Time", defaultValue:"" },
  { id:"time", label:"Time", group:"Date & Time", defaultValue:"" },
  { id:"dimensions", label:"Dimensions", group:"Design", defaultValue:{} },
  { id:"border-radius", label:"Border Radius", group:"Design", defaultValue:{} },
  { id:"typography", label:"Typography", group:"Design", defaultValue:{} },
  { id:"media", label:"Media Picker", group:"Content", defaultValue:{} },
  { id:"icon", label:"Icon Picker", group:"Content", defaultValue:{} },
]);

export const VSN_WIDGET_FIELD_BASE_IDS = Object.freeze(VSN_WIDGET_FIELD_TYPES.map((row)=>row.id));
export const VSN_WIDGET_FIELD_BASE_SET = new Set(VSN_WIDGET_FIELD_BASE_IDS);

export function widgetFieldMeta(type) {
  return VSN_WIDGET_FIELD_TYPES.find((row)=>row.id===String(type||"")) || VSN_WIDGET_FIELD_TYPES[0];
}

export function widgetFieldDefault(type) {
  const value=widgetFieldMeta(type).defaultValue;
  if (Array.isArray(value)) return [...value];
  if (value && typeof value === "object") return {...value};
  return value;
}

export function widgetFieldUsesOptions(type) {
  return ["select","multi-select","radio","button-set"].includes(String(type||""));
}

export function widgetFieldUsesNumberRules(type) {
  return ["number","range"].includes(String(type||""));
}
