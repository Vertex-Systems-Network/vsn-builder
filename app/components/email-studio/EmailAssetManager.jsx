import { useMemo, useState } from "react";
import { Check, Image as ImageIcon, Plus, Search, Trash2 } from "lucide-react";
import { VsnButton, VsnInput } from "../ui/VsnToolkit.jsx";

function normalizePickedIds(value){return Array.isArray(value)?[...new Set(value.map((item)=>typeof item==="string"?item:item?.id||item?.value||"").map(String).map((item)=>item.trim()).filter(Boolean))]:[]}

async function resolveShopifyFiles(ids){
  const response=await fetch("/app/editor-media",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({ids,mediaTypes:["MediaImage"]})});
  const contentType=response.headers.get("content-type")||"";if(!contentType.includes("application/json"))throw new Error(`Shopify media resolver returned HTTP ${response.status}.`);
  const data=await response.json();if(!response.ok||(!data?.ok&&!data?.files?.length))throw new Error(data?.error||"Could not resolve selected Shopify Files.");return Array.isArray(data.files)?data.files:[];
}

async function pickShopifyImages(){
  if(typeof window==="undefined"||!window.shopify?.intents?.invoke)throw new Error("Shopify Files picker is only available inside Shopify Admin.");
  const activity=await window.shopify.intents.invoke("pick:shopify/File",{data:{mediaTypes:["MediaImage"],multiSelect:true,selectedFiles:[]}});const result=await activity.complete;
  if(result?.code==="closed")return [];if(result?.code==="error")throw new Error(result?.message||"Shopify Files picker failed.");const ids=normalizePickedIds(result?.data?.ids||[]);if(!ids.length)return [];return resolveShopifyFiles(ids);
}

export function EmailAssetManager({assets=[],onAssetsChange,onUseAsset,selectedCanUseAsset=false}){
  const [query,setQuery]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [url,setUrl]=useState("");const [selected,setSelected]=useState("");
  const rows=useMemo(()=>{const q=query.trim().toLowerCase();return (Array.isArray(assets)?assets:[]).filter((asset)=>!q||`${asset.name} ${asset.alt} ${asset.url} ${asset.source}`.toLowerCase().includes(q))},[assets,query]);
  const commit=(items)=>{const unique=new Map();for(const item of items||[]){const key=item.id||item.url;if(key)unique.set(key,item)}onAssetsChange?.([...unique.values()].slice(0,120))};
  const addShopify=async()=>{setBusy(true);setError("");try{const files=await pickShopifyImages();if(files.length){const next=files.map(file=>({id:file.id||file.url,name:file.fileName||"Shopify image",url:file.url||file.previewUrl,previewUrl:file.previewUrl||file.url,alt:file.alt||"",width:file.width||null,height:file.height||null,source:"shopify"}));commit([...(assets||[]),...next]);setSelected(next[0]?.id||"")}}catch(e){setError(e instanceof Error?e.message:"Could not open Shopify Files.")}finally{setBusy(false)}};
  const addUrl=()=>{const clean=url.trim();if(!/^https?:\/\//i.test(clean)){setError("Enter a valid https:// image URL.");return}const item={id:`url-${Date.now().toString(36)}`,name:clean.split("/").pop()?.split("?")[0]||"External image",url:clean,previewUrl:clean,alt:"",source:"url"};commit([...(assets||[]),item]);setSelected(item.id);setUrl("");setError("")};
  const active=(assets||[]).find((item)=>item.id===selected)||null;
  return <div className="vsn-email-studio-side-scroll"><div className="vsn-email-asset-tools"><div className="vsn-email-studio-search"><Search size={14}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search assets"/></div><div className="vsn-email-asset-actions"><VsnButton size="xs" loading={busy} icon={<ImageIcon size={13}/>} onClick={addShopify}>Shopify Files</VsnButton></div><div className="vsn-email-asset-url"><VsnInput hideLabel label="Image URL" value={url} onChange={(e)=>setUrl(e.target.value)} placeholder="https://cdn…"/><button type="button" onClick={addUrl} title="Add URL"><Plus size={13}/></button></div>{error?<div className="vsn-email-asset-error">{error}</div>:null}</div><div className="vsn-email-asset-grid">{rows.map(asset=><button type="button" key={asset.id||asset.url} className={selected===(asset.id||asset.url)?"is-selected":""} onClick={()=>setSelected(asset.id||asset.url)}><span>{asset.previewUrl||asset.url?<img src={asset.previewUrl||asset.url} alt={asset.alt||""}/>:<ImageIcon size={18}/>}</span><b>{asset.name||"Image"}</b><small>{asset.source||"asset"}</small>{selected===(asset.id||asset.url)?<i><Check size={11}/></i>:null}</button>)}{!rows.length?<div className="vsn-email-studio-empty">No assets yet. Choose Shopify Files or add an external CDN URL.</div>:null}</div>{active?<div className="vsn-email-asset-footer"><div><strong>{active.name||"Selected image"}</strong><small>{active.width&&active.height?`${active.width} × ${active.height} · `:""}{active.source}</small></div><div>{selectedCanUseAsset?<VsnButton size="xs" variant="primary" onClick={()=>onUseAsset?.(active)}>Use image</VsnButton>:null}<button type="button" className="vsn-email-mini-danger" title="Remove asset" onClick={()=>{commit((assets||[]).filter(item=>(item.id||item.url)!==(active.id||active.url)));setSelected("")}}><Trash2 size={13}/></button></div></div>:null}</div>;
}
