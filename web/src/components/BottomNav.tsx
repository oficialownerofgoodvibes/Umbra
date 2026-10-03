import React from 'react';
import { TabType } from '../types';

interface BottomNavProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab }) => {
  const tabs: Array<{ id: TabType; label: string; icon: React.ReactNode }> = [
    {
      id: 'messages',
      label: 'Mensajes',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      )
    },
    {
      id: 'passwords',
      label: 'Claves',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 2l-2 2m-1.5 1.5L14 9M3 21l6-6M9 15l-3 3M15 9a4.24 4.24 0 1 1 6-6 4.24 4.24 0 0 1-6 6z" />
        </svg>
      )
    },
    {
      id: 'notes',
      label: 'Notas',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      )
    }
  ];

  return (
    <nav style={{
      height: '64px',
      backgroundColor: '#141512',
      borderTop: '1px solid #2a2b24',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 100
    }}>
      {tabs.map(tab => {
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              background: 'none',
              border: 'none',
              color: isActive ? '#ecece4' : '#8a8b84',
              cursor: 'pointer',
              padding: '6px 12px',
              minWidth: '64px',
              minHeight: '48px',
              transition: 'color 0.15s ease'
            }}
          >
            <div style={{
              padding: '4px 12px',
              borderRadius: '16px',
              backgroundColor: isActive ? '#22231e' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {tab.icon}
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: isActive ? 600 : 400,
              letterSpacing: '0.01em'
            }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
