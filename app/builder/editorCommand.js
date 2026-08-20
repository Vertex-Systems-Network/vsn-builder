function uid(){return `cmd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;}
export function createEditorCommand(elements,{label='Updated element',icon='•',kind='mutation'}={}){
  return {commandId:uid(),kind,label,icon,time:Date.now(),elements};
}
export function editorHistoryEntry(command){return {commandId:command.commandId,kind:command.kind,label:command.label,icon:command.icon,time:command.time,elements:command.elements};}
