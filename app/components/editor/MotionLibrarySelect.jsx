import { useEffect, useMemo, useState } from "react";
import { VsnOption, VsnSelect } from "./EditorUi";

export default function MotionLibrarySelect({ label="Animation", value="", onChange, onPreset, includeNone=true }) {
  const [rows,setRows]=useState([]);
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    fetch("/app/builder-panel/animations",{credentials:"same-origin",headers:{Accept:"application/json"}})
      .then(async(response)=>({ok:response.ok,data:await response.json()}))
      .then(({ok,data})=>{if(!active)return;if(!ok)throw new Error(data?.error||"Motion Library could not be loaded.");setRows([...(data.builtins||[]),...(data.presets||[])]);setError("");})
      .catch((err)=>active&&setError(err instanceof Error?err.message:"Motion Library could not be loaded."));
    return()=>{active=false;};
  },[]);
  const options=useMemo(()=>rows.map((item)=>({id:item.id,label:`${item.builtin?"VSN · ":""}${item.name}`,item})),[rows]);
  return <div className="space-y-1"><VsnSelect label={label} value={value||""} onChange={(event)=>{const id=event.currentTarget.value;const preset=rows.find((item)=>item.id===id)||null;onChange?.(id);onPreset?.(preset);}}>{includeNone?<VsnOption value="">None</VsnOption>:null}{options.map((option)=><VsnOption key={option.id} value={option.id}>{option.label}</VsnOption>)}</VsnSelect>{error?<p className="text-[10px] leading-4 text-[#b42318]">{error}</p>:null}</div>;
}
