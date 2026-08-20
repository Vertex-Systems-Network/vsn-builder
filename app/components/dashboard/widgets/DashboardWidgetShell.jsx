import { GripVertical } from 'lucide-react';

export default function DashboardWidgetShell({ id, title, subtitle, darkMode, children, onDragStart, onDragEnter, onDrop, onDragEnd, draggingId=null, className = '', toolbar = null }) {
  const border = darkMode ? '#2D3748' : '#E5E7EB';
  const text = darkMode ? '#F9FAFB' : '#1A1F36';
  const muted = darkMode ? '#9CA3AF' : '#6B7280';
  return <section
    className={`vsn-dashboard-widget ${draggingId===id?'is-dragging':''} ${draggingId&&draggingId!==id?'is-drag-target':''} ${className}`}
    data-widget-id={id}
    onDragEnter={(event) => { if(!draggingId||draggingId===id)return; event.preventDefault(); onDragEnter?.(id); }}
    onDragOver={(event) => { if(!draggingId)return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }}
    onDrop={(event) => { event.preventDefault(); onDrop?.(id); }}
    style={{ background: darkMode ? '#1A1F2E' : '#FFFFFF', border: `1px solid ${border}`, borderRadius: 12, boxShadow: darkMode ? 'none' : '0 1px 4px rgba(0,0,0,.04)', minWidth:0 }}
  >
    <header className="vsn-dashboard-widget-head">
      <div className="vsn-dashboard-widget-heading"><strong style={{ color:text }}>{title}</strong>{subtitle ? <span style={{ color:muted }}>{subtitle}</span> : null}</div>
      <div className="vsn-dashboard-widget-tools">{toolbar}<button type="button" draggable className="vsn-dashboard-drag-handle" aria-label={`Move ${title}`} title="Drag to move" onDragStart={(event)=>{event.stopPropagation();event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",id);onDragStart?.(id);}} onDragEnd={()=>onDragEnd?.()}><GripVertical size={15}/></button></div>
    </header>
    <div className="vsn-dashboard-widget-body">{children}</div>
  </section>;
}
