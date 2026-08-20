(function(){
  function init(root=document){
    root.querySelectorAll('[data-vsn-countdown]').forEach((el)=>{
      if(el.dataset.vsnReady==='1')return;el.dataset.vsnReady='1';
      const end=Date.parse(el.dataset.vsnCountdown||''); if(!Number.isFinite(end))return;
      const tick=()=>{const left=Math.max(0,end-Date.now());const d=Math.floor(left/86400000),h=Math.floor(left/3600000)%24,m=Math.floor(left/60000)%60;el.querySelector('[data-vsn-days]')?.replaceChildren(String(d));el.querySelector('[data-vsn-hours]')?.replaceChildren(String(h).padStart(2,'0'));el.querySelector('[data-vsn-minutes]')?.replaceChildren(String(m).padStart(2,'0'));};tick();const timer=setInterval(tick,60000);el.dataset.vsnTimer=String(timer);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>init());else init();
  document.addEventListener('shopify:section:load',e=>init(e.target));
})();
