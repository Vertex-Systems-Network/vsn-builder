import { normalizeEmailDocument } from "./emailSchema.js";

function template(key,title,category,description,subject,preheader,blocks,{planTier="core",tags=[]}={}){
  return Object.freeze({key,title,category,description,subject,preheader,planTier,tags:Object.freeze(tags),document:normalizeEmailDocument({blocks})});
}

export const EMAIL_MARKETPLACE_CATALOG=Object.freeze([
  template("collection-launch","Collection Launch","Commerce","Launch a new collection with editorial hierarchy, featured products and a focused CTA.","New collection: {{ shop.name }}","A first look at the latest collection.",[
    {type:"logo"},{type:"navbar"},{type:"hero",content:{heading:"The new collection has arrived",text:"A considered edit of new pieces, ready to explore.",buttonText:"Shop the collection",buttonUrl:"{{ shop.url }}"},style:{background:"#f6f1e8",headingSize:38,padding:"42px 34px"}},
    {type:"product-grid",content:{heading:"Selected for you",count:4,buttonText:"View the collection",url:"{{ shop.url }}"}},{type:"testimonial"},{type:"footer"}
  ],{planTier:"core",tags:["launch","collection","commerce"]}),
  template("flash-sale","Flash Sale","Promotion","High-urgency promotional email with offer framing, coupon and product recommendations.","Ends soon: a limited offer","Limited-time savings while availability lasts.",[
    {type:"header"},{type:"hero",content:{heading:"Limited time. Clear value.",text:"Keep the offer easy to understand and the next step impossible to miss.",buttonText:"Shop the offer",buttonUrl:"{{ shop.url }}"},style:{background:"#111827",color:"#ffffff",buttonBackground:"#95bf47",buttonColor:"#132008"}},
    {type:"coupon",content:{label:"Use code",code:"SAVE20"},style:{background:"#f8fafc"}},{type:"product-grid",content:{heading:"Popular right now",count:3}},{type:"footer"}
  ],{planTier:"core",tags:["sale","discount","conversion"]}),
  template("editorial-digest","Editorial Digest","Newsletter","Premium editorial newsletter for stories, launches, education and brand updates.","A note from {{ shop.name }}","Stories, ideas and updates worth opening.",[
    {type:"logo"},{type:"navbar"},{type:"image-text",content:{heading:"A story worth sharing",text:"Use an image-led editorial opening for a launch story, founder note or seasonal narrative.",buttonText:"Read the story",buttonUrl:"{{ shop.url }}"}},
    {type:"divider"},{type:"columns",content:{columns:[{heading:"Insight one",text:"A compact editorial story.",width:50},{heading:"Insight two",text:"A second focused story.",width:50}],mobileStack:true}},{type:"footer"}
  ],{planTier:"pro",tags:["newsletter","editorial","brand"]}),
  template("vip-winback","VIP Win-back","Lifecycle","Re-engage high-value customers with a personalized message and curated offer.","We saved something for you, {{ customer.first_name }}","A personal invitation from {{ shop.name }}.",[
    {type:"logo"},{type:"text",content:{heading:"We’d love to see you again",text:"{{ customer.first_name }}, here is a thoughtful reason to come back."}},
    {type:"coupon",content:{label:"Your private code",code:"WELCOME15"}},{type:"product-grid",content:{heading:"A few picks for you",count:3}},{type:"button",content:{text:"Return to {{ shop.name }}",url:"{{ shop.url }}"}},{type:"footer"}
  ],{planTier:"pro",tags:["retention","vip","lifecycle"]}),
  template("post-purchase-care","Post-purchase Care","Transactional","Follow-up email that combines order reassurance, education and a subtle next purchase path.","Thanks for your order {{ order.name }}","Everything you need after checkout.",[
    {type:"header"},{type:"text",content:{heading:"Thanks — your order is confirmed",text:"We’re preparing {{ order.name }}. Here is what happens next."}},{type:"order-summary"},
    {type:"section",content:{heading:"Get the most from your purchase",text:"Use this section for care instructions, setup guidance or helpful resources.",buttonText:"Read the guide",buttonUrl:"{{ shop.url }}"}},{type:"footer"}
  ],{planTier:"core",tags:["order","transactional","care"]}),
  template("back-in-stock-pro","Back in Stock Pro","Commerce","Availability alert with a strong product focus and related recommendations.","Back in stock: {{ product.title }}","The item you wanted is available again.",[
    {type:"logo"},{type:"hero",content:{heading:"It’s back",text:"The product you were waiting for is available again. Inventory can move quickly.",buttonText:"Shop now",buttonUrl:"{{ product.url }}"}},{type:"product"},{type:"product-grid",content:{heading:"You may also like",count:3}},{type:"footer"}
  ],{planTier:"pro",tags:["restock","product","commerce"]}),
  template("gift-guide","Seasonal Gift Guide","Commerce","A polished gift-guide layout with multiple product groups and editorial guidance.","The {{ shop.name }} gift guide","Thoughtful picks for every kind of recipient.",[
    {type:"logo"},{type:"hero",content:{heading:"A better way to gift",text:"Curated ideas, clear categories and products customers can act on quickly.",buttonText:"Explore gifts",buttonUrl:"{{ shop.url }}"},style:{background:"#faf7f2"}},
    {type:"product-grid",content:{heading:"Most gifted",count:4}},{type:"divider"},{type:"image-text",content:{heading:"For someone special",text:"Use this editorial split for a gift category, occasion or recipient story.",buttonText:"Shop the edit",buttonUrl:"{{ shop.url }}"}},{type:"footer"}
  ],{planTier:"pro",tags:["seasonal","gift","commerce"]}),
  template("founder-letter","Founder Letter","Brand","Human, editorial founder-note template with supporting CTA and social proof.","A personal note from {{ shop.name }}","A short letter about what we’re building and why.",[
    {type:"logo"},{type:"text",content:{heading:"A note from the founder",text:"Write with clarity, warmth and a specific point of view. Keep the message personal and useful."},style:{headingSize:30,padding:"40px 42px"}},
    {type:"testimonial",content:{heading:"What customers tell us",text:"Use one concise quote to reinforce the message.",author:"A customer",role:"Verified buyer"}},{type:"button",content:{text:"Visit {{ shop.name }}",url:"{{ shop.url }}"}},{type:"footer"}
  ],{planTier:"core",tags:["founder","brand","editorial"]}),
]);

export function findEmailMarketplaceTemplate(key){return EMAIL_MARKETPLACE_CATALOG.find((item)=>item.key===String(key||""))||null;}
