import { useEffect, useRef } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Link2, List, ListOrdered, RemoveFormatting, Strikethrough, Underline } from "lucide-react";
import { EMAIL_BINDING_GROUPS } from "../../email/emailBindings.js";
import { richTextFromPlainText, sanitizeEmailRichText } from "../../email/emailRichText.js";

function command(name,value=null){try{window.document.execCommand(name,false,value);return true}catch{return false}}

export function EmailRichTextEditor({label="Rich text",value="",plainFallback="",onChange}){
  const editorRef=useRef(null);const html=sanitizeEmailRichText(value||richTextFromPlainText(plainFallback||""));
  useEffect(()=>{const node=editorRef.current;if(node&&node!==window.document.activeElement&&node.innerHTML!==html)node.innerHTML=html},[html]);
  const commit=()=>{const next=sanitizeEmailRichText(editorRef.current?.innerHTML||"");if(next!==value)onChange?.(next)};
  const run=(name,arg=null)=>{editorRef.current?.focus();command(name,arg);commit()};
  const insertToken=(token)=>{editorRef.current?.focus();command("insertText",token);commit()};
  const addLink=()=>{const url=window.prompt("Link URL","https://");if(url)run("createLink",url)}
  return <div className="vsn-email-rte-field"><span className="vsn-email-rte-label">{label}</span><div className="vsn-email-rte-toolbar">
    <button type="button" title="Bold" onMouseDown={(e)=>e.preventDefault()} onClick={()=>run("bold")}><Bold size={13}/></button>
    <button type="button" title="Italic" onMouseDown={(e)=>e.preventDefault()} onClick={()=>run("italic")}><Italic size={13}/></button>
    <button type="button" title="Underline" onMouseDown={(e)=>e.preventDefault()} onClick={()=>run("underline")}><Underline size={13}/></button>
    <button type="button" title="Strikethrough" onMouseDown={(e)=>e.preventDefault()} onClick={()=>run("strikeThrough")}><Strikethrough size={13}/></button>
    <span/>
    <button type="button" title="Bulleted list" onMouseDown={(e)=>e.preventDefault()} onClick={()=>run("insertUnorderedList")}><List size={13}/></button>
    <button type="button" title="Numbered list" onMouseDown={(e)=>e.preventDefault()} onClick={()=>run("insertOrderedList")}><ListOrdered size={13}/></button>
    <button type="button" title="Add link" onMouseDown={(e)=>e.preventDefault()} onClick={addLink}><Link2 size={13}/></button>
    <button type="button" title="Align left" onMouseDown={(e)=>e.preventDefault()} onClick={()=>run("justifyLeft")}><AlignLeft size={13}/></button>
    <button type="button" title="Align center" onMouseDown={(e)=>e.preventDefault()} onClick={()=>run("justifyCenter")}><AlignCenter size={13}/></button>
    <button type="button" title="Align right" onMouseDown={(e)=>e.preventDefault()} onClick={()=>run("justifyRight")}><AlignRight size={13}/></button>
    <button type="button" title="Clear formatting" onMouseDown={(e)=>e.preventDefault()} onClick={()=>run("removeFormat")}><RemoveFormatting size={13}/></button>
    <select aria-label="Insert dynamic data" value="" onChange={(e)=>{if(e.target.value)insertToken(`{{ ${e.target.value} }}`)}}><option value="">+ Data</option>{EMAIL_BINDING_GROUPS.map(group=><optgroup key={group.key} label={group.label}>{group.tokens.map(([path,label])=><option key={path} value={path}>{label}</option>)}</optgroup>)}<optgroup label="Loop"><option value="item.title">Item title</option><option value="item.price">Item price</option><option value="item.url">Item URL</option><option value="loop.index">Loop index</option></optgroup></select>
  </div><div ref={editorRef} className="vsn-email-rte-editor" contentEditable suppressContentEditableWarning spellCheck onInput={commit} onBlur={commit} dangerouslySetInnerHTML={{__html:html}}/></div>;
}
