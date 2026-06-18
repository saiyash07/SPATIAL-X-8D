import { createPortal } from 'react-dom';
import { useToasts } from '../../utils/toast';

const ICONS = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };

export default function Toast() {
  const toasts = useToasts();

  return createPortal(
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      pointerEvents: 'none',
    }}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 16px',
            borderRadius: 12,
            background: 'rgba(20, 20, 35, 0.92)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'Outfit, sans-serif',
            maxWidth: 300,
            animation: 'toast-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <span style={{ fontSize: 16 }}>{ICONS[toast.type] || ICONS.info}</span>
          <span>{toast.message}</span>
        </div>
      ))}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(12px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>,
    document.body
  );
}
