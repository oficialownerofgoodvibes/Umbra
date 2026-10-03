import React, { useState, useEffect } from 'react';

export interface ToastMessage {
  id: string;
  text: string;
  type?: 'info' | 'success' | 'warn' | 'error';
  duration?: number;
}

let toastListeners: Array<(msg: ToastMessage) => void> = [];

export function showToast(text: string, type: 'info' | 'success' | 'warn' | 'error' = 'info', duration = 3500) {
  const msg: ToastMessage = {
    id: Math.random().toString(36).slice(2),
    text,
    type,
    duration
  };
  toastListeners.forEach(listener => listener(msg));
}

// Helper to copy text and auto-clean after specified seconds
export function copyWithAutoClean(text: string, cleanSeconds = 30, message = `Copiado. El portapapeles se limpia en ${cleanSeconds} s`) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(message, 'success', 3500);

    setTimeout(() => {
      // Clean clipboard if still contains the same or overwrite
      navigator.clipboard.writeText('').catch(() => {});
    }, cleanSeconds * 1000);
  }).catch(() => {
    showToast('Error al acceder al portapapeles', 'error');
  });
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handler = (msg: ToastMessage) => {
      setToasts(prev => [...prev, msg]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== msg.id));
      }, msg.duration || 3500);
    };

    toastListeners.push(handler);
    return () => {
      toastListeners = toastListeners.filter(l => l !== handler);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '76px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      maxWidth: '90vw',
      pointerEvents: 'none'
    }}>
      {toasts.map(toast => {
        let borderColor = '#2a2b24';
        let icon = '•';
        let textColor = '#ecece4';

        if (toast.type === 'success') {
          borderColor = '#8faf89';
          icon = '✓';
        } else if (toast.type === 'error') {
          borderColor = '#c45c4a';
          icon = '✕';
          textColor = '#c45c4a';
        } else if (toast.type === 'warn') {
          borderColor = '#c4a56a';
          icon = '⚠';
          textColor = '#c4a56a';
        }

        return (
          <div
            key={toast.id}
            className="animate-fade-in"
            style={{
              backgroundColor: '#141512',
              color: textColor,
              border: `1px solid ${borderColor}`,
              borderRadius: '12px',
              padding: '10px 16px',
              fontSize: '13px',
              fontFamily: 'var(--font-sans)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <span style={{ fontWeight: 'bold' }}>{icon}</span>
            <span>{toast.text}</span>
          </div>
        );
      })}
    </div>
  );
};
