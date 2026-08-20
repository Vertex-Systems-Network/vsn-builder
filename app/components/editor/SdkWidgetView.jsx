import { Component, useEffect, useRef } from "react";
import { renderVsnEditorWidget } from "../../sdk/runtime.js";
import { getVsnWidgetHooks, reportVsnSdkError } from "../../sdk/registry.js";
import { sanitizeVsnDescriptorProps } from "../../sdk/renderDescriptor.js";

class SdkWidgetErrorBoundary extends Component {
  constructor(props){super(props);this.state={error:null};}
  static getDerivedStateFromError(error){return{error};}
  componentDidCatch(error){reportVsnSdkError("editor.boundary",this.props?.node?.type||"unknown",error);}
  render(){if(this.state.error)return <div data-vsn-sdk-error="1" style={{padding:12,border:"1px dashed #d72c0d",borderRadius:8,color:"#8a1f0d",background:"#fff4f4"}}>Plugin widget could not render. The rest of the page is isolated from this error.</div>;return this.props.children;}
}

export function renderSdkEditorValue(value, key = "sdk") {
  if (value == null || value === false) return null;
  if (typeof value === "string" || typeof value === "number") return value;
  if (Array.isArray(value)) return value.map((item,index)=>renderSdkEditorValue(item,`${key}-${index}`));
  if (value?.__vsnSdkDescriptor === true) {
    const allowedTags=new Set(["div","span","strong","em","small","p","section","article","aside","nav","a","button","ul","ol","li","figure","figcaption","img"]);
    const Tag=allowedTags.has(String(value.tag||""))?String(value.tag):"div"; const props={...sanitizeVsnDescriptorProps(value.props||{}),key};
    if(Tag==="img")return <img {...props}/>; if(Tag==="a")props.onClick=(event)=>event.preventDefault(); if(Tag==="button"&&!props.type)props.type="button";
    return <Tag {...props}>{renderSdkEditorValue(value.children||[],`${key}-child`)}</Tag>;
  }
  return value;
}

export default function SdkWidgetView({node,context={},style={},staticPreview=false}) {
  const mountRef=useRef(null); const hooks=getVsnWidgetHooks(node?.type); let previewNode=node;
  if(typeof hooks?.preview==="function"){try{previewNode=hooks.preview({node,context})||node;}catch(error){reportVsnSdkError("widget.preview",node?.type||"unknown",error);}}
  const result=renderVsnEditorWidget(previewNode,{...context,style});
  useEffect(()=>{if(staticPreview)return undefined;const element=mountRef.current;try{hooks?.mount?.({element,node:previewNode,context});}catch(error){reportVsnSdkError("widget.mount",node?.type||"unknown",error);}return()=>{try{hooks?.unmount?.({element,node:previewNode,context});}catch(error){reportVsnSdkError("widget.unmount",node?.type||"unknown",error);}};},[node?.id,node?.type,staticPreview]);
  if(!result.handled)return null;
  return <SdkWidgetErrorBoundary node={node}><div ref={mountRef} data-vsn-id={node.id} data-vsn-sdk-widget={node.type} style={style}>{result.error?<div data-vsn-sdk-error="1" style={{padding:12,border:"1px dashed #d72c0d",borderRadius:8,color:"#8a1f0d"}}>Plugin widget unavailable</div>:renderSdkEditorValue(result.value,node.id||node.type)}</div></SdkWidgetErrorBoundary>;
}
