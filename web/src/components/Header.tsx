import React from 'react';

interface HeaderProps {
  displayName?: string;
  fingerprint?: string;
  onLock: () => void;
  idleRemainingSeconds?: number;
}

export const ShieldLogoIcon: React.FC<{ size?: number; color?: string }> = ({ size = 26, color = '#ecece4' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12 2L4 5V11.5C4 16.5 7.4 21.1 12 22C16.6 21.1 20 16.5 20 11.5V5L12 2Z"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 7V17M9 11L12 7L15 11"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const Header: React.FC<HeaderProps> = ({ onLock, idleRemainingSeconds }) => {
  return (
    <header style={{
      height: '60px',
      backgroundColor: '#141512',
      borderBottom: '1px solid #2a2b24',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          backgroundColor: '#1c1d19',
          border: '1px solid #2a2b24',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <ShieldLogoIcon size={20} color="#ecece4" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{
              fontFamily: 'var(--font-logo)',
              fontSize: '18px',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: '#ecece4'
            }}>
              Umbra
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: '#8a8b84',
              letterSpacing: '0.04em'
            }}>
              ODS · &quot;bubbas&quot;
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {idleRemainingSeconds !== undefined && idleRemainingSeconds > 0 && (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: '#8a8b84',
            backgroundColor: '#1c1d19',
            padding: '4px 8px',
            borderRadius: '6px',
            border: '1px solid #2a2b24'
          }} title="Tiempo restante antes del bloqueo automático">
            {Math.floor(idleRemainingSeconds / 60)}:{(idleRemainingSeconds % 60).toString().padStart(2, '0')}
          </span>
        )}
        <button
          onClick={onLock}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#1c1d19',
            border: '1px solid #2a2b24',
            color: '#ecece4',
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          title="Bloquear bóveda"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span>Bloquear</span>
        </button>
      </div>
    </header>
  );
};
