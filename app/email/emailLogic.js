export const EMAIL_CONDITION_OPERATORS = Object.freeze([
  {value:"exists",label:"Exists / has a value"},
  {value:"equals",label:"Equals"},
  {value:"not-equals",label:"Does not equal"},
  {value:"contains",label:"Contains"},
  {value:"greater-than",label:"Greater than"},
  {value:"less-than",label:"Less than"},
  {value:"truthy",label:"Is truthy"},
  {value:"falsy",label:"Is false / empty"},
]);

export const EMAIL_REPEAT_SOURCES = Object.freeze([
  {path:"products",label:"Products",alias:"item"},
  {path:"order.line_items_data",label:"Order line items",alias:"item"},
  {path:"cart.items",label:"Cart items",alias:"item"},
]);

export function lookupEmailBinding(source,path){
  return String(path||"").split(".").filter(Boolean).reduce((value,key)=>value&&typeof value==="object"?value[key]:undefined,source);
}

function str(value){return String(value??"").trim();}
function number(value){const n=Number(value);return Number.isFinite(n)?n:null;}

export function normalizeEmailLogic(input={}){
  const source=input&&typeof input==="object"&&!Array.isArray(input)?input:{};
  const condition=source.condition&&typeof source.condition==="object"?source.condition:{};
  const repeat=source.repeat&&typeof source.repeat==="object"?source.repeat:{};
  const operator=EMAIL_CONDITION_OPERATORS.some((item)=>item.value===condition.operator)?condition.operator:"exists";
  const repeatSource=EMAIL_REPEAT_SOURCES.some((item)=>item.path===repeat.source)?repeat.source:"products";
  const fallbackAlias=EMAIL_REPEAT_SOURCES.find((item)=>item.path===repeatSource)?.alias||"item";
  return {
    condition:{enabled:Boolean(condition.enabled),path:str(condition.path),operator,value:str(condition.value)},
    repeat:{enabled:Boolean(repeat.enabled),source:repeatSource,alias:str(repeat.alias)||fallbackAlias,limit:Math.max(1,Math.min(12,Number(repeat.limit)||4))},
  };
}

export function evaluateEmailCondition(input,bindings){
  const condition=normalizeEmailLogic({condition:input}).condition;
  if(!condition.enabled||!condition.path)return true;
  const actual=lookupEmailBinding(bindings,condition.path);
  const expected=condition.value;
  if(condition.operator==="exists")return actual!=null&&String(actual).trim()!=="";
  if(condition.operator==="truthy")return Boolean(actual);
  if(condition.operator==="falsy")return !actual;
  if(condition.operator==="equals")return str(actual).toLowerCase()===str(expected).toLowerCase();
  if(condition.operator==="not-equals")return str(actual).toLowerCase()!==str(expected).toLowerCase();
  if(condition.operator==="contains")return str(actual).toLowerCase().includes(str(expected).toLowerCase());
  const left=number(actual),right=number(expected);
  if(left==null||right==null)return false;
  if(condition.operator==="greater-than")return left>right;
  if(condition.operator==="less-than")return left<right;
  return true;
}

export function getEmailRepeatItems(repeatInput,bindings){
  const repeat=normalizeEmailLogic({repeat:repeatInput}).repeat;
  if(!repeat.enabled)return [];
  const source=lookupEmailBinding(bindings,repeat.source);
  return Array.isArray(source)?source.slice(0,repeat.limit):[];
}

export function getEmailBlockLogicStatus(block,bindings){
  const logic=normalizeEmailLogic(block?.logic||{});
  const visible=evaluateEmailCondition(logic.condition,bindings||{});
  const items=getEmailRepeatItems(logic.repeat,bindings||{});
  return {logic,visible,repeatCount:logic.repeat.enabled?items.length:0,items};
}

export function materializeEmailBlocks(blocks=[],bindings=null){
  if(!bindings)return (Array.isArray(blocks)?blocks:[]).map((block)=>({block,bindings:null,repeatIndex:null}));
  const out=[];
  for(const block of Array.isArray(blocks)?blocks:[]){
    const logic=normalizeEmailLogic(block?.logic||{});
    if(!evaluateEmailCondition(logic.condition,bindings))continue;
    if(logic.repeat.enabled){
      const items=getEmailRepeatItems(logic.repeat,bindings);
      for(let index=0;index<items.length;index+=1){
        const local={...bindings,[logic.repeat.alias]:items[index],loop:{index:index+1,index0:index,first:index===0,last:index===items.length-1,length:items.length}};
        out.push({block,bindings:local,repeatIndex:index});
      }
      continue;
    }
    out.push({block,bindings,repeatIndex:null});
  }
  return out;
}

export function describeEmailLogic(block){
  const logic=normalizeEmailLogic(block?.logic||{});const labels=[];
  if(logic.condition.enabled&&logic.condition.path)labels.push(`If ${logic.condition.path} ${logic.condition.operator.replaceAll("-"," ")}${logic.condition.value?` ${logic.condition.value}`:""}`);
  if(logic.repeat.enabled)labels.push(`Repeat ${logic.repeat.source} as ${logic.repeat.alias} × ${logic.repeat.limit}`);
  return labels;
}
