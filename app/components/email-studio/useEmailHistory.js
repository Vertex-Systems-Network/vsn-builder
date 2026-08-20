import { useCallback, useMemo, useRef, useState } from "react";

const clone=(value)=>JSON.parse(JSON.stringify(value));

export function useEmailHistory(initialValue,{limit=80}={}){
  const initial=useMemo(()=>clone(initialValue),[]);
  const [state,setState]=useState(initial);
  const past=useRef([]);const future=useRef([]);

  const commit=useCallback((updater)=>{
    setState(current=>{
      const next=typeof updater==="function"?updater(clone(current)):updater;
      const normalized=clone(next);
      if(JSON.stringify(normalized)===JSON.stringify(current))return current;
      past.current=[...past.current.slice(-(limit-1)),clone(current)];
      future.current=[];
      return normalized;
    });
  },[limit]);

  const undo=useCallback(()=>{
    setState(current=>{
      const previous=past.current.pop();
      if(!previous)return current;
      future.current=[clone(current),...future.current].slice(0,limit);
      return clone(previous);
    });
  },[limit]);

  const redo=useCallback(()=>{
    setState(current=>{
      const next=future.current.shift();
      if(!next)return current;
      past.current=[...past.current.slice(-(limit-1)),clone(current)];
      return clone(next);
    });
  },[limit]);

  const reset=useCallback((next)=>{past.current=[];future.current=[];setState(clone(next));},[]);
  return {state,setState:commit,undo,redo,reset,canUndo:past.current.length>0,canRedo:future.current.length>0};
}
