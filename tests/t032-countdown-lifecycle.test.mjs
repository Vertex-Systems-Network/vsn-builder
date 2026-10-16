import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const base="extensions/vsn-page-builder-theme/";
const script=readFileSync(base+"assets/native-blocks.js","utf8");
const liquid=readFileSync(base+"blocks/native-countdown.liquid","utf8");
const nodes=()=>Object.fromEntries(["days","hours","minutes"].map(n=>[n,{value:"--",replaceChildren(v){this.value=v;}}]));
function element(input){
 const outputs=nodes();
 return {dataset:{vsnCountdown:input},outputs,
   querySelector(selector){
     const match=/^\[data-vsn-(days|hours|minutes)\]$/.exec(selector);
     return match?outputs[match[1]]:null;
   }};
}
function harness(initial=[]){
 let now=Date.parse("2026-10-16T10:00:00Z"),next=0;
 const callbacks=new Map(),handlers=new Map(),originalDate=Date;
 class FakeDate extends originalDate {
  static now(){return now;}
  static parse(value){return originalDate.parse(value);}
 }
 const root=(els)=>({querySelectorAll(selector){
  assert.equal(selector,"[data-vsn-countdown]");return els;
 }});
 const document={readyState:"complete",
  querySelectorAll:root(initial).querySelectorAll,
  addEventListener(name,fn){handlers.set(name,fn);}
 };
 runInNewContext(script,{document,Date:FakeDate,
  setInterval(fn,ms){assert.equal(ms,60000);callbacks.set(++next,fn);return next;},
  clearInterval(id){callbacks.delete(id);}
 });
 return {
  tick(minutes=1){now+=minutes*60000;for(const fn of [...callbacks.values()])fn();},
  dispatch(name,els){assert(handlers.has(name));handlers.get(name)({target:root(els)});},
  liveTimers(){return callbacks.size},
 };
}
test("app block guards escaped ISO input and preserves Shopify theme editor attributes",()=>{
 assert.match(liquid,/data-vsn-countdown="{{ block.settings.end \| escape }}"/);
 assert.match(liquid,/data-vsn-native-instance="{{ block.id \| escape }}"/);
 assert.match(liquid,/{{ block.shopify_attributes }}/);
 assert.match(liquid,/role="timer" aria-label="Time remaining" aria-live="off"/);
 assert.match(liquid,/"javascript": "native-blocks.js"/);
});
test("valid ISO renders immediately and interval terminates at zero",()=>{
 const countdown=element("2026-10-16T10:02:00Z"),h=harness([countdown]);
 assert.deepEqual(Object.values(countdown.outputs).map(x=>x.value),["0","00","02"]);
 assert.equal(h.liveTimers(),1);
 h.tick();
 assert.equal(countdown.outputs.minutes.value,"01");
 h.tick();
 assert.equal(countdown.outputs.minutes.value,"00");
 assert.equal(h.liveTimers(),0,"expired timer must not keep executing");
});
test("invalid, localized and already expired countdowns never install timers",()=>{
 const els=[
  element('"><script>alert(1)</script>'),
  element("12/31/2027"),
  element("2026-10-16"),
  element("not a date"),
  element("2020-01-01T00:00:00Z")
 ];
 const h=harness(els);
 assert.equal(h.liveTimers(),0);
 for(const el of els.slice(0,4)){
  assert.equal(el.outputs.minutes.value,"--");
  assert.equal(el.dataset.vsnReady,"invalid");
 }
 assert.equal(els[4].outputs.minutes.value,"00");
});
test("repeat loads don't duplicate timers; Shopify section unload removes only scoped timers",()=>{
 const first=element("2026-10-16T10:05:00Z"),second=element("2026-10-16T10:10:00Z");
 const h=harness([first]);
 assert.equal(h.liveTimers(),1);
 h.dispatch("shopify:section:load",[first]);
 assert.equal(h.liveTimers(),1);
 h.dispatch("shopify:section:load",[second]);
 assert.equal(h.liveTimers(),2);
 h.dispatch("shopify:section:unload",[first]);
 assert.equal(h.liveTimers(),1);
 assert.equal(first.dataset.vsnReady,undefined);
 assert.equal(second.dataset.vsnReady,"1");
 h.dispatch("shopify:section:unload",[second]);
 assert.equal(h.liveTimers(),0);
 h.dispatch("shopify:section:load",[first]);
 assert.equal(h.liveTimers(),1,"reattached section initializes after cleanup");
});
