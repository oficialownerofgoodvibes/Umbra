import React from 'react';
import { TabType } from '../types';
import { ShieldLogoIcon } from './Header';

interface SidebarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  fingerprint?: string;
  onLock: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, fingerprint, onLock }) => {
  const tabs: Array<{ id: TabType; label: string; icon: React.ReactNode }> = [
    {
      id: 'messages',
      label: 'Mensajes',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      )
    },
    {
      id: 'passwords',
      label: 'Claves',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 2l-2 2m-1.5 1.5L14 9M3 21l6-6M9 15l-3 3M15 9a4.24 4.24 0 1 1 6-6 4.24 4.24 0 0 1-6 6z" />
        </svg>
      )
    },
    {
      id: 'notes',
      label: 'Notas',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3z" />
          <path d="M15 3v6h6" />
          <path d="M9 13h6" />
          <path d="M9 17h4" />
        </svg>
      )
    },
    {
      id: 'stealth',
      label: 'Sigilo',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      )
    }
  ];

  return (
    <aside style={{
      width: '240px',
      backgroundColor: '#141512',
      borderRight: '1px solid #2a2b24',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      flexShrink: 0
    }}>
      <div style={{
        padding: '24px 20px',
        borderBottom: '1px solid #2a2b24',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          backgroundColor: '#1c1d19',
          border: '1px solid #2a2b24',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <ShieldLogoIcon size={22} color="#ecece4" />
        </div>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-logo)',
            fontSize: '20px',
            fontWeight: 600,
            lineHeight: 1.1,
            color: '#ecece4'
          }}>
            Umbra
          </h1>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: '#8a8b84',
            marginTop: '2px'
          }}>
            ODS · &quot;bubbas&quot;
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {tabs.map(tab => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: isActive ? '#22231e' : 'transparent',
                color: isActive ? '#ecece4' : '#8a8b84',
                fontSize: '14px',
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{ color: isActive ? '#ecece4' : '#8a8b84' }}>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {fingerprint && (
        <div style={{
          padding: '12px 16px',
          margin: '0 12px 12px 12px',
          backgroundColor: '#1c1d19',
          borderRadius: '10px',
          border: '1px solid #2a2b24'
        }}>
          <div style={{ fontSize: '11px', color: '#8a8b84', marginBottom: '4px' }}>Huella local:</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#d4d0c4', letterSpacing: '0.05em' }}>
            {fingerprint}
          </div>
        </div>
      )}

      <div style={{ padding: '16px', borderTop: '1px solid #2a2b24' }}>
        <button
          onClick={onLock}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            padding: '10px',
            backgroundColor: '#1c1d19',
            border: '1px solid #2a2b24',
            borderRadius: '8px',
            color: '#ecece4',
            fontSize: '13px',
            cursor: 'pointer',
            minHeight: '44px'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span>Bloquear bóveda</span>
        </button>
      </div>
    </aside>
  );
};
