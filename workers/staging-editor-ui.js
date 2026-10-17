// Small, explicit Staging-only merchant MVP. No secrets, token storage,
// storefront publishing, role shortcuts, or third-party network calls.
// This file is served only from the authenticated app's Staging Worker origin.
(() => {
  "use strict";
  const root=document.querySelector("[data-vsn-stage-editor]");
  if (!root) return;
  const shop=root.getAttribute("data-shop");
  const validShop=typeof shop==="string" &&
    /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop);
  if (!validShop) return;
  const status=document.querySelector("[data-vsn-editor-status]");
  const notice=text=>{if(status)status.textContent=String(text);};
  const path=(p)=>p+"?shop="+encodeURIComponent(shop);
  const validId=s=>typeof s==="string"&&/^[a-zA-Z0-9_-]{1,64}$/.test(s);
  let active=false;

  // Shopify's current App Bridge obtains a *fresh* user ID token for every
  // request. Never cache it, decode it, or send it to Shopify Admin GraphQL.
  async function call(url,{method="GET",body}={}) {
    if(!window.shopify || typeof window.shopify.idToken!=="function")
      throw Error("Open this page from the Shopify admin to authenticate.");
    const jwt=await window.shopify.idToken();
    if(typeof jwt!=="string" || !jwt || jwt.length>16000)
      throw Error("Shopify authentication is unavailable.");
    const headers={
      "authorization":"Bearer "+jwt,
      "accept":"application/json",
    };
    if(body!==undefined)headers["content-type"]="application/json";
    const response=await fetch(url,{
      method,headers,body:body===undefined?undefined:JSON.stringify(body),
      cache:"no-store",credentials:"omit",redirect:"manual",
    });
    if(response.type==="opaqueredirect" || response.status>=300&&response.status<400)
      throw Error("Shopify session renewal required. Reopen the app.");
    return response;
  }

  async function busy(button,task) {
    if(active)return;
    active=true;
    button.disabled=true;
    try{await task()}
    catch{notice("Request failed. Verify the Shopify session and try again.")}
    finally{active=false;button.disabled=false}
  }

  const form=root.querySelector("[data-vsn-create-form]");
  if(form){
    form.addEventListener("submit",event=>{
      event.preventDefault();
      const button=form.querySelector('button[type="submit"]');
      const field=form.querySelector('input[name="title"]');
      if(!button || !field)return;
      const title=field.value.trim();
      if(!title || title.length>120){notice("Enter a title of 1–120 characters.");return}
      void busy(button,async()=>{
        notice("Creating draft...");
        const result=await call(path("/app/__vsn/pages/create"),{
          method:"POST",body:{title},
        });
        if(result.status!==201){
          notice(result.status===403?"Plan or staff permission does not allow a new page.":
            result.status===503?"Staging editor is not enabled yet.":
            "Unable to create page (HTTP "+result.status+").");
          return;
        }
        const data=await result.json();
        if(!validId(data?.id)||data?.status!=="draft"||data?.version!==1){
          notice("Invalid page response; no navigation was performed.");
          return;
        }
        notice("Draft created. Opening editor...");
        window.location.assign(path("/app/__vsn/pages/"+encodeURIComponent(data.id)+"/view"));
      });
    });
    return;
  }

  const editor=root.querySelector("[data-vsn-block-editor]");
  if(!editor)return;
  const id=editor.getAttribute("data-page-id");
  if(!validId(id))return;
  const list=editor.querySelector("[data-vsn-block-list]");
  const preview=editor.querySelector("[data-vsn-preview]");
  const add=editor.querySelector("[data-vsn-add-text]");
  const save=editor.querySelector("[data-vsn-save]");
  const versionLabel=editor.querySelector("[data-vsn-version]");
  if(!list || !preview || !add || !save || !versionLabel)return;
  let elements=[],version=0,hydrated=false;

  function render(){
    list.replaceChildren();
    preview.replaceChildren();
    elements.forEach((node,index)=>{
      const row=document.createElement("div");
      row.className="editor-block";
      const type=typeof node?.type==="string"?node.type:"unknown";
      const label=document.createElement("label");
      label.textContent="Block "+(index+1)+" · "+type;
      row.append(label);
      if(type==="text" && typeof node?.props?.text==="string"){
        const input=document.createElement("textarea");
        input.maxLength=2000;
        input.rows=3;
        input.value=node.props.text;
        input.setAttribute("aria-label","Text for block "+(index+1));
        input.addEventListener("input",()=>{
          // Preserve every other field, custom block and sibling untouched.
          elements[index]={...elements[index],
            props:{...elements[index].props,text:input.value}};
          drawPreview();
        });
        row.append(input);
      }else{
        const note=document.createElement("p");
        note.textContent="Other block: preserved unchanged on save.";
        row.append(note);
      }
      list.append(row);
    });
    drawPreview();
  }
  function drawPreview(){
    preview.replaceChildren();
    for(const node of elements){
      if(node?.type==="text" && typeof node?.props?.text==="string"){
        const p=document.createElement("p");
        p.textContent=node.props.text;
        preview.append(p);
      }
    }
    if(!preview.childNodes.length)preview.textContent="No text blocks yet.";
  }

  add.addEventListener("click",()=>{
    if(!hydrated || elements.length>=5000){notice("Editor is unavailable or full.");return}
    elements.push({id:crypto.randomUUID(),type:"text",props:{text:""}});
    render();
    notice("New text block added. Save the draft to persist it.");
  });

  save.addEventListener("click",()=>void busy(save,async()=>{
    if(!hydrated){notice("Load the draft before saving.");return}
    notice("Saving version "+version+"...");
    const response=await call(path("/app/__vsn/pages/"+encodeURIComponent(id)+"/content"),{
      method:"POST",body:{expectedVersion:version,elements},
    });
    if(response.status===409){
      notice("Another edit changed this page. Reload to review before saving again.");
      return;
    }
    if(response.status!==200){
      notice(response.status===403?"Your plan or staff role cannot edit this page.":
        response.status===503?"Staging draft save is not enabled yet.":
        "Save failed (HTTP "+response.status+").");
      return;
    }
    const data=await response.json();
    if(data?.id!==id || !Number.isSafeInteger(data.version) ||
       data.version!==version+1){
      notice("Unexpected save acknowledgement. Reload to verify.");
      return;
    }
    version=data.version;
    versionLabel.textContent=String(version);
    notice("Draft saved. Reload this page to verify persistence.");
  }));

  async function hydrate(){
    save.disabled=true;
    add.disabled=true;
    try{
      notice("Loading authenticated draft...");
      const response=await call(path("/app/__vsn/pages/"+encodeURIComponent(id)+"/content"));
      if(response.status!==200){
        notice("Draft unavailable (HTTP "+response.status+").");
        return;
      }
      const data=(await response.json())?.page;
      if(data?.id!==id || !Number.isSafeInteger(data.version) ||
         data.version<1 || !Array.isArray(data.elements) ||
         data.elements.length>5000){
        notice("Draft is not valid. Editing is disabled.");
        return;
      }
      version=data.version;
      elements=data.elements;
      versionLabel.textContent=String(version);
      hydrated=true;
      render();
      save.disabled=false;
      add.disabled=false;
      notice("Draft loaded. Changes are not published until a future release.");
    }catch{
      notice("Unable to load editor. Check the Shopify session.");
    }
  }
  void hydrate();
})();
