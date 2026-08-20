(function(){
  "use strict";

  var config=window.__VSN_GLOBAL_CODE_RUNTIME__||{};
  if(config.disabled===true)return;

  var endpoint=String(config.endpoint||"/apps/vsn-builder/runtime");
  var context=config.context&&typeof config.context==="object"?config.context:{};

  function runtimeUrl(kind){
    var params=new URLSearchParams();
    params.set("globalCode",kind);
    ["template","visitorPath","language","country","market"].forEach(function(key){
      var value=context[key];
      if(value!==undefined&&value!==null&&String(value)!=="")params.set(key,String(value));
    });
    return endpoint+(endpoint.indexOf("?")>=0?"&":"?")+params.toString();
  }

  if(!document.querySelector("link[data-vsn-global-code='css']")){
    var css=document.createElement("link");
    css.rel="stylesheet";
    css.href=runtimeUrl("css");
    css.dataset.vsnGlobalCode="css";
    css.addEventListener("error",function(){console.warn("VSN Global CSS could not be loaded.");},{once:true});
    (document.head||document.documentElement).appendChild(css);
  }

  if(!document.querySelector("script[data-vsn-global-code='js']")){
    var js=document.createElement("script");
    js.src=runtimeUrl("js");
    js.dataset.vsnGlobalCode="js";
    js.async=false;
    js.addEventListener("error",function(){console.warn("VSN Global JavaScript could not be loaded.");},{once:true});
    (document.body||document.head||document.documentElement).appendChild(js);
  }
})();
