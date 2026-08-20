import { useEffect } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';
export default function Toast({ toasts, onRemove, darkMode }) {
    return (<div style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
        }}>
      {toasts.map(t => (<ToastItem key={t.id} toast={t} onRemove={onRemove} darkMode={darkMode}/>))}
    </div>);
}
function ToastItem({ toast, onRemove, darkMode }) {
    useEffect(() => {
        const timer = setTimeout(() => onRemove(toast.id), 4000);
        return () => clearTimeout(timer);
    }, [toast.id, onRemove]);
    const colors = {
        success: { bg: '#F0FDF4', border: '#BBF7D0', icon: '#16A34A' },
        error: { bg: '#FEF2F2', border: '#FECACA', icon: '#DC2626' },
        info: { bg: '#EFF6FF', border: '#BFDBFE', icon: '#2563EB' },
    };
    const c = colors[toast.type];
    return (<div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            background: darkMode ? '#1F2937' : c.bg,
            border: `1px solid ${darkMode ? '#374151' : c.border}`,
            borderRadius: 10,
            padding: '12px 14px',
            minWidth: 280,
            maxWidth: 360,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            animation: 'slideInToast 0.25s ease',
        }}>
      <style>{`
        @keyframes slideInToast {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      {toast.type === 'success' ? <CheckCircle size={18} color={c.icon} style={{ flexShrink: 0, marginTop: 1 }}/> : <XCircle size={18} color={c.icon} style={{ flexShrink: 0, marginTop: 1 }}/>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? '#F9FAFB' : '#1A1F36' }}>{toast.title}</div>
        {toast.message && <div style={{ fontSize: 12, color: darkMode ? '#9CA3AF' : '#6B7280', marginTop: 2 }}>{toast.message}</div>}
      </div>
      <button onClick={() => onRemove(toast.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0, flexShrink: 0 }}>
        <X size={14}/>
      </button>
    </div>);
}
