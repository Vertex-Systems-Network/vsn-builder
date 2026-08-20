export const EMAIL_BINDING_GROUPS = Object.freeze([
  { key:"shop", label:"Shop", tokens:[
    ["shop.name","Shop name"],["shop.url","Store URL"],["shop.email","Shop email"],["shop.domain","Primary domain"],
  ]},
  { key:"customer", label:"Customer", tokens:[
    ["customer.first_name","First name"],["customer.last_name","Last name"],["customer.email","Email"],["customer.name","Full name"],
  ]},
  { key:"product", label:"Product", tokens:[
    ["product.title","Product title"],["product.price","Product price"],["product.url","Product URL"],["product.image","Product image"],["product.handle","Product handle"],
  ]},
  { key:"order", label:"Order", tokens:[
    ["order.name","Order name"],["order.total_price","Order total"],["order.status_url","Order status URL"],["order.line_items","Line items"],
  ]},
  { key:"cart", label:"Cart", tokens:[["cart.url","Cart URL"],["cart.item_count","Item count"]]},
  { key:"discount", label:"Discount", tokens:[["discount.code","Discount code"],["discount.value","Discount value"],["discount.url","Discount URL"]]},
  { key:"campaign", label:"Campaign", tokens:[["campaign.name","Campaign name"],["campaign.url","Campaign URL"]]},
  { key:"form", label:"Form", tokens:[["form.name","Form name"],["form.email","Submitted email"],["form.message","Submitted message"]]},
  { key:"loop", label:"Loop item", tokens:[["item.title","Item title"],["item.price","Item price"],["item.url","Item URL"],["item.image","Item image"],["loop.index","Loop index"]]},
]);

export const EMAIL_BINDING_TOKENS = Object.freeze(EMAIL_BINDING_GROUPS.flatMap((group)=>group.tokens.map(([path,label])=>({path,label,group:group.label,token:`{{ ${path} }}`}))));

export const EMAIL_SAMPLE_BINDINGS = Object.freeze({
  shop:{name:"Your Store",url:"https://example.com",email:"hello@example.com",domain:"example.com"},
  customer:{first_name:"Alex",last_name:"Morgan",name:"Alex Morgan",email:"alex@example.com"},
  product:{title:"Featured Product",price:"$49.00",url:"https://example.com/products/featured",image:"",handle:"featured-product"},
  order:{name:"#1001",total_price:"$89.00",status_url:"https://example.com/orders/1001",line_items:"Featured Product × 1",line_items_data:[{title:"Featured Product",price:"$49.00",url:"https://example.com/products/featured",image:""},{title:"Second Product",price:"$40.00",url:"https://example.com/products/second",image:""}]},
  cart:{url:"https://example.com/cart",item_count:"2",items:[{title:"Featured Product",price:"$49.00",url:"https://example.com/products/featured",image:""},{title:"Second Product",price:"$40.00",url:"https://example.com/products/second",image:""}]},
  products:[{title:"Featured Product",price:"$49.00",url:"https://example.com/products/featured",image:""},{title:"Second Product",price:"$40.00",url:"https://example.com/products/second",image:""},{title:"Third Product",price:"$29.00",url:"https://example.com/products/third",image:""}],
  discount:{code:"WELCOME10",value:"10%",url:"https://example.com/discount/WELCOME10"},
  campaign:{name:"Summer launch",url:"https://example.com"},
  form:{name:"Contact form",email:"alex@example.com",message:"I would like more information."},
});

function lookup(source,path){
  return String(path||"").split(".").reduce((value,key)=>value&&typeof value==="object"?value[key]:undefined,source);
}

export function resolveEmailTokens(value,bindings=EMAIL_SAMPLE_BINDINGS,{keepUnknown=true}={}){
  if(typeof value!=="string")return value;
  return value.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g,(match,path)=>{
    const resolved=lookup(bindings,path);
    if(resolved==null||resolved==="")return keepUnknown?match:"";
    if(Array.isArray(resolved))return resolved.join(", ");
    return String(resolved);
  });
}

export function mergeEmailBindings(base=EMAIL_SAMPLE_BINDINGS,override={}){
  const next={};
  for(const key of new Set([...Object.keys(base||{}),...Object.keys(override||{})])){
    const baseValue=base?.[key],overrideValue=override?.[key];
    if(Array.isArray(overrideValue))next[key]=overrideValue;
    else if(Array.isArray(baseValue))next[key]=baseValue;
    else if(baseValue&&typeof baseValue==="object"||overrideValue&&typeof overrideValue==="object")next[key]={...(baseValue||{}),...(overrideValue||{})};
    else next[key]=overrideValue??baseValue;
  }
  return next;
}
