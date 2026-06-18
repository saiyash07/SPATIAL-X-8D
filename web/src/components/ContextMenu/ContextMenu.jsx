import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Right-click context menu rendered in a portal.
 * Props:
 *  - items: [{ label, icon, onClick, divider, danger }]
 *  - position: { x, y }
 *  - onClose: () => void
 */
export default function ContextMenu({ items, position, onClose }) {
  const ref = useRef(null);

  // Close on click outside or Escape
  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Keep menu within viewport
  const menuWidth = 220;
  const menuHeight = items.length * 36 + 16;
  const x = Math.min(position.x, window.innerWidth - menuWidth - 8);
  const y = Math.min(position.y, window.innerHeight - menuHeight - 8);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label="Track options"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 10000,
        width: menuWidth,
        background: 'rgba(16, 18, 32, 0.97)',
        backdropFilter: 'blur(30px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 14,
        padding: '6px 0',
        boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,58,237,0.2)',
        animation: 'ctx-menu-in 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
        fontFamily: 'Outfit, sans-serif',
      }}
    >
      {items.map((item, i) => {
        if (item.divider) {
          return (
            <div
              key={`divider-${i}`}
              style={{
                height: 1,
                background: 'rgba(255,255,255,0.08)',
                margin: '4px 0',
              }}
            />
          );
        }
        return (
          <button
            key={i}
            role="menuitem"
            onClick={() => { item.onClick?.(); onClose(); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '9px 14px',
              background: 'none',
              border: 'none',
              color: item.danger ? '#f87171' : '#fff',
              fontSize: 13,
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 500,
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'background 0.12s',
              borderRadius: 4,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = item.danger
                ? 'rgba(248,113,113,0.12)'
                : 'rgba(124,58,237,0.2)';
            }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
          >
            {item.icon && <span style={{ fontSize: 15, flexShrink: 0 }}>{item.icon}</span>}
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.suffix && (
              <span style={{ fontSize: 11, opacity: 0.5 }}>{item.suffix}</span>
            )}
          </button>
        );
      })}
      <style>{`
        @keyframes ctx-menu-in {
          from { opacity: 0; transform: scale(0.95) translateY(-4px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
}
