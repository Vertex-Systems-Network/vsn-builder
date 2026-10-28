// Theme app-block script, no package imports or unsafe HTML injection.
// Shopify re-renders sections in its editor. Timers must not outlive blocks.
(function(){
  const timers=new WeakMap();
  // Do not accept browser-specific Date.parse of localized/ambiguous values.
  const ISO_8601=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
  function stop(el){
    const timer=timers.get(el);
    if(timer!==undefined){clearInterval(timer);timers.delete(el)}
    delete el.dataset.vsnReady;
  }
  function initialize(root=document){
    if(!root || typeof root.querySelectorAll!=="function")return;
    root.querySelectorAll("[data-vsn-countdown]").forEach(el=>{
      if(el.dataset.vsnReady==="1")return;
      const value=el.dataset.vsnCountdown||"";
      const end=ISO_8601.test(value)?Date.parse(value):NaN;
      if(!Number.isFinite(end)){
        el.dataset.vsnReady="invalid";
        return; // preserve "--" when merchant enters invalid text
      }
      const parts=["days","hours","minutes"].map(k=>el.querySelector("[data-vsn-"+k+"]"));
      if(parts.some(x=>!x))return; // do not start timer without all three outputs
      el.dataset.vsnReady="1";
      const tick=()=>{
        const remaining=Math.max(0,end-Date.now());
        const days=Math.floor(remaining/86400000);
        const hours=Math.floor(remaining/3600000)%24;
        const mins=Math.floor(remaining/60000)%60;
        parts[0].replaceChildren(String(days));
        parts[1].replaceChildren(String(hours).padStart(2,"0"));
        parts[2].replaceChildren(String(mins).padStart(2,"0"));
        if(remaining===0){
          const active=timers.get(el);
          if(active!==undefined){clearInterval(active);timers.delete(el)}
        }
        return remaining;
      };
      // Render immediately. Expired timestamps never install an interval.
      if(tick()>0)timers.set(el,setInterval(tick,60000));
    });
  }
  function dispose(root){
    if(!root || typeof root.querySelectorAll!=="function")return;
    root.querySelectorAll("[data-vsn-countdown]").forEach(stop);
  }
  if(document.readyState==="loading")
    document.addEventListener("DOMContentLoaded",()=>initialize(),{once:true});
  else initialize();
  document.addEventListener("shopify:section:load",e=>initialize(e.target));
  document.addEventListener("shopify:section:unload",e=>dispose(e.target));
})();
