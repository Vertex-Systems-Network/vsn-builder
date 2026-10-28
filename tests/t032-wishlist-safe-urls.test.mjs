import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const source=readFileSync("extensions/vsn-page-builder-theme/assets/vsn-wishlist.js","utf8");
const from=source.indexOf("  function clean(value, max = 700)");
const to=source.indexOf("  function merge(local, server)",from);
assert(from>=0&&to>from,"actual wishlist normalization source must be present");
const code=source.slice(from,to);
function runtime(origin="https://merchant.myshopify.com"){
 const sandbox={URL,Date,Number,String,Array,Set,JSON,encodeURIComponent,
  MAX_ITEMS:500,window:{location:{origin}}};
 runInNewContext(code+"\nthis.safeProductUrl=safeProductUrl;this.safeMediaUrl=safeMediaUrl;this.normalize=normalize;",sandbox,{timeout:1000});
 return sandbox;
}
const sample={handle:"hoodie",productId:"123",title:"Hoodie",addedAt:"2026-10-16T00:00:00Z"};
test("real wishlist normalizer refuses malicious off-origin product links",()=>{
 const x=runtime();
 for(const url of [
  "javascript:alert(1)","JaVaScRiPt:alert(1)","data:text/html,<script>1</script>",
  "blob:https://merchant.myshopify.com/1",
  "//attacker.example.com/path",
  "https://attacker.example.com/products/hoodie",
  "https://merchant.myshopify.com.evil.test/products/hoodie",
  "http://merchant.myshopify.com/products/hoodie",
  "https://reader:pass@merchant.myshopify.com/products/hoodie",
  "\\\\attacker.example.com/products/hoodie",
 ]){
  const normalized=x.normalize([{...sample,url}])[0];
  assert.equal(normalized.url,"/products/hoodie",url);
 }
});
test("same-origin product and market/collection paths work while absolute links become relative",()=>{
 const x=runtime();
 for(const [input,expected] of [
  ["/products/hoodie?variant=2","/products/hoodie?variant=2"],
  ["https://merchant.myshopify.com/en/collections/winter/products/hoodie?variant=2#details",
   "/en/collections/winter/products/hoodie?variant=2#details"],
  ["","/products/hoodie"],
 ]){
  assert.equal(x.normalize([{...sample,url:input}])[0].url,expected);
 }
 assert.equal(x.safeProductUrl("javascript:bad",""),"#");
 assert.equal(x.safeProductUrl("", "../external"),"/products/..%2Fexternal");
});
test("untrusted images refuse executable and insecure schemes; safe Shopify CDN is supported",()=>{
 const x=runtime();
 for(const image of [
  "javascript:alert(1)","data:image/svg+xml,<svg/onload=alert(1)>",
  "blob:https://merchant.myshopify.com/fake","file:///etc/passwd",
  "http://attacker.example.com/tracker.png",
  "https://alice:password@cdn.shopify.com/s/files/1/a.png",
 ]){
  assert.equal(x.normalize([{...sample,image}])[0].image,"",image);
 }
 assert.equal(x.safeMediaUrl("//cdn.shopify.com/s/files/1/hoodie.png"),"https://cdn.shopify.com/s/files/1/hoodie.png");
 assert.equal(x.safeMediaUrl("/cdn/shop/files/hoodie.png?width=320"),"/cdn/shop/files/hoodie.png?width=320");
});
test("both wishlist click sinks revalidate links even when normalize is bypassed",()=>{
 const cardStart=source.indexOf("  function cardFor(item, grid) {");
 const cardEnd=source.indexOf("  function renderGrid(grid, items)",cardStart);
 assert(cardStart>to&&cardEnd>cardStart);
 const cardCode=source.slice(cardStart,cardEnd);
 const x=runtime();
 const nodes=[];
 function makeElement(tag,cls,txt){
  const node={tag,cls,textContent:txt??"",dataset:{},style:{},children:[],
    appendChild(child){this.children.push(child)},
    setAttribute(name,value){this[name]=value}};
  nodes.push(node);return node;
 }
 const sandbox={URL,Date,Number,String,Array,Set,JSON,encodeURIComponent,
  window:{location:{origin:"https://merchant.myshopify.com"}},
  safeProductUrl:x.safeProductUrl,safeMediaUrl:x.safeMediaUrl,
  itemKey:()=> "hoodie",element:makeElement,money:()=>"$10"};
 runInNewContext(cardCode+"\nthis.renderCard=cardFor;",sandbox,{timeout:1000});
 const card=sandbox.renderCard({...sample,
  url:"javascript:alert(1)",image:"data:image/svg+xml,<svg/onload=alert(1)>",
  price:"",available:true}, {dataset:{vsnWishlistShowRemove:"0"}});
 assert.equal(card.tag,"article");
 const anchors=nodes.filter(n=>n.tag==="a");
 assert(anchors.length>0);
 assert(anchors.every(n=>n.href==="/products/hoodie"));
 assert.equal(nodes.filter(n=>n.tag==="img").length,0);
});
test("wishlist DOM image loading sets no-referrer even for valid remote HTTPS image",()=>{
 assert.match(source,/const url = safeProductUrl\(item.url, item.handle\)/);
 assert.match(source,/const image = safeMediaUrl\(item.image\)/);
 assert.match(source,/img\.src = image/);
 assert.match(source,/img\.referrerPolicy = "no-referrer"/);
 assert.doesNotMatch(source,/link\.href = item\.url|title\.href = item\.url/);
});
