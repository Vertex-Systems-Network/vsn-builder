import { useId, useRef } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
export default function Modal({ open, title, description, confirmLabel = 'Confirm', confirmDanger, onConfirm, onCancel, darkMode }) {
    const dialogRef = useRef(null);
    const titleId = useId();
    useFocusTrap(dialogRef, Boolean(open), { onEscape: onCancel });
    if (!open)
        return null;
    return (<div /* eslint-disable-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- modal backdrop dismiss / propagation guard, not a focusable control */ onClick={onCancel} style={{
            position: 'fixed', inset: 0, zIndex: 'var(--vsn-z-modal)',
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(2px)',
        }}>
      <div /* eslint-disable-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/no-noninteractive-element-interactions -- only stops event propagation; not an interactive control */ onClick={e => e.stopPropagation()} ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} style={{
            background: 'var(--vsn-surface)',
            borderRadius: 16,
            padding: 28,
            width: '100%',
            maxWidth: 420,
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            animation: 'modalIn 0.2s ease',
        }}>
        <style>{`
          @keyframes modalIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
        `}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          {confirmDanger && (<div style={{
                width: 40, height: 40, borderRadius: 10,
                background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
            }}>
              <AlertTriangle size={18} color="#DC2626"/>
            </div>)}
          <div style={{ flex: 1 }}>
            <h3 id={titleId} style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--vsn-ink)' }}>{title}</h3>
          </div>
          <button type="button" aria-label="Close" onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vsn-subtle)', padding: 4, borderRadius: 6 }}>
            <X size={16}/>
          </button>
        </div>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: darkMode ? '#9CA3AF' : '#4B5563', lineHeight: 1.6 }}>{description}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            border: '1px solid var(--vsn-border)',
            background: 'transparent', cursor: 'pointer',
            color: darkMode ? '#9CA3AF' : '#4B5563',
        }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{
            padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            border: 'none',
            background: confirmDanger ? '#DC2626' : 'var(--vsn-green)',
            color: 'white', cursor: 'pointer',
        }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>);
}
