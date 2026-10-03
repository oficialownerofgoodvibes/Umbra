import React, { useState, useEffect } from 'react';
import { PasswordEntry } from '../types';
import { generatePassword, evaluatePasswordStrength } from '../password';
import { computeTOTP, getTotpRemainingSeconds, generateBase32Secret } from '../totp';
import { showToast, copyWithAutoClean } from './Toast';

interface PasswordsTabProps {
  passwords: PasswordEntry[];
  onUpdatePasswords: (passwords: PasswordEntry[]) => void;
}

export const PasswordsTab: React.FC<PasswordsTabProps> = ({ passwords, onUpdatePasswords }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PasswordEntry | null>(null);

  // Live TOTP codes state
  const [totpCodes, setTotpCodes] = useState<Record<string, string>>({});
  const [totpSecondsRemaining, setTotpSecondsRemaining] = useState(30);

  // Password Generator State
  const [genLength, setGenLength] = useState(20);
  const [genLower, setGenLower] = useState(true);
  const [genUpper, setGenUpper] = useState(true);
  const [genDigits, setGenDigits] = useState(true);
  const [genSymbols, setGenSymbols] = useState(true);
  const [generatedPassword, setGeneratedPassword] = useState('');

  // Form fields for Add/Edit
  const [fTitle, setFTitle] = useState('');
  const [fUsername, setFUsername] = useState('');
  const [fPassword, setFPassword] = useState('');
  const [fUrl, setFUrl] = useState('');
  const [fTotpSecret, setFTotpSecret] = useState('');
  const [fNotes, setFNotes] = useState('');

  // Refresh generated password on options change
  useEffect(() => {
    const pwd = generatePassword({
      length: genLength,
      useLower: genLower,
      useUpper: genUpper,
      useDigits: genDigits,
      useSymbols: genSymbols
    });
    setGeneratedPassword(pwd);
  }, [genLength, genLower, genUpper, genDigits, genSymbols]);

  // Update live TOTP codes every second
  useEffect(() => {
    let isMounted = true;

    const updateCodes = async () => {
      const { seconds } = getTotpRemainingSeconds();
      if (isMounted) {
        setTotpSecondsRemaining(seconds);
      }

      const codes: Record<string, string> = {};
      for (const entry of passwords) {
        if (entry.totpSecret && entry.totpSecret.trim().length > 4) {
          try {
            const raw = await computeTOTP(entry.totpSecret);
            codes[entry.id] = raw.slice(0, 3) + ' ' + raw.slice(3, 6);
          } catch {
            codes[entry.id] = 'Error';
          }
        }
      }

      if (isMounted) {
        setTotpCodes(codes);
      }
    };

    updateCodes();
    const interval = setInterval(updateCodes, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [passwords]);

  const toggleVisibility = (id: string) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopy = (text: string, label = 'Contraseña') => {
    copyWithAutoClean(text, 30, `${label} copiada. El portapapeles se limpia en 30 s.`);
  };

  const handleOpenAdd = () => {
    setEditingEntry(null);
    setFTitle('');
    setFUsername('');
    setFPassword('');
    setFUrl('');
    setFTotpSecret('');
    setFNotes('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (entry: PasswordEntry) => {
    setEditingEntry(entry);
    setFTitle(entry.title);
    setFUsername(entry.username);
    setFPassword(entry.password);
    setFUrl(entry.url);
    setFTotpSecret(entry.totpSecret);
    setFNotes(entry.notes);
    setShowAddModal(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Eliminar esta clave de la bóveda?')) {
      const next = passwords.filter(p => p.id !== id);
      onUpdatePasswords(next);
      showToast('Clave eliminada', 'info');
    }
  };

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fTitle.trim()) {
      showToast('El título es requerido', 'warn');
      return;
    }
    if (!fPassword) {
      showToast('La contraseña es requerida', 'warn');
      return;
    }

    if (editingEntry) {
      const updated = passwords.map(p =>
        p.id === editingEntry.id
          ? {
              ...p,
              title: fTitle.trim(),
              username: fUsername.trim(),
              password: fPassword,
              url: fUrl.trim(),
              totpSecret: fTotpSecret.trim().toUpperCase(),
              notes: fNotes.trim(),
              updatedAt: Date.now()
            }
          : p
      );
      onUpdatePasswords(updated);
      showToast('Clave actualizada', 'success');
    } else {
      const newEntry: PasswordEntry = {
        id: 'p-' + Math.random().toString(36).slice(2, 9),
        title: fTitle.trim(),
        username: fUsername.trim(),
        password: fPassword,
        url: fUrl.trim(),
        totpSecret: fTotpSecret.trim().toUpperCase(),
        notes: fNotes.trim(),
        updatedAt: Date.now()
      };
      onUpdatePasswords([newEntry, ...passwords]);
      showToast('Nueva clave guardada', 'success');
    }

    setShowAddModal(false);
  };

  const filtered = passwords.filter(p => {
    const q = searchTerm.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.username.toLowerCase().includes(q) ||
      p.url.toLowerCase().includes(q) ||
      p.notes.toLowerCase().includes(q)
    );
  });

  const strength = evaluatePasswordStrength(generatedPassword);

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      {/* Top Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#ecece4' }}>Gestor de Claves</h2>
          <div style={{ fontSize: '12px', color: '#8a8b84' }}>
            {passwords.length} {passwords.length === 1 ? 'clave almacenada' : 'claves almacenadas'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowGeneratorModal(true)}
            style={{
              backgroundColor: '#1c1d19',
              border: '1px solid #2a2b24',
              color: '#ecece4',
              padding: '8px 14px',
              borderRadius: '10px',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2l-2 2m-1.5 1.5L14 9M3 21l6-6M9 15l-3 3M15 9a4.24 4.24 0 1 1 6-6 4.24 4.24 0 0 1-6 6z" />
            </svg>
            <span>Generador</span>
          </button>

          <button
            onClick={handleOpenAdd}
            style={{
              backgroundColor: '#ecece4',
              border: 'none',
              color: '#0b0c0a',
              padding: '8px 16px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>+</span>
            <span>Nueva clave</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Buscar por título, usuario, URL o notas..."
          style={{
            width: '100%',
            padding: '12px 14px 12px 38px',
            backgroundColor: '#141512',
            border: '1px solid #2a2b24',
            borderRadius: '12px',
            color: '#ecece4',
            fontSize: '14px',
            outline: 'none'
          }}
        />
        <div style={{
          position: 'absolute',
          left: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#8a8b84'
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
      </div>

      {/* Passwords List */}
      {filtered.length === 0 ? (
        <div style={{
          padding: '48px 24px',
          textAlign: 'center',
          backgroundColor: '#141512',
          borderRadius: '16px',
          border: '1px solid #2a2b24'
        }}>
          <div style={{ fontSize: '15px', color: '#ecece4', marginBottom: '6px' }}>
            {searchTerm ? 'No se encontraron resultados' : 'No hay claves guardadas'}
          </div>
          <div style={{ fontSize: '13px', color: '#8a8b84' }}>
            {searchTerm ? 'Intenta con otro término de búsqueda' : 'Haz clic en "+ Nueva clave" para añadir una credencial'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map(entry => {
            const isVisible = visiblePasswords[entry.id];
            const totpCode = totpCodes[entry.id];

            return (
              <div
                key={entry.id}
                style={{
                  backgroundColor: '#141512',
                  border: '1px solid #2a2b24',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#ecece4' }}>
                      {entry.title}
                    </h3>
                    {entry.username && (
                      <div style={{
                        fontSize: '13px',
                        color: '#8a8b84',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginTop: '2px'
                      }}>
                        <span>{entry.username}</span>
                        <button
                          onClick={() => handleCopy(entry.username, 'Usuario')}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#8a8b84',
                            cursor: 'pointer',
                            padding: '2px'
                          }}
                          title="Copiar usuario"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => handleOpenEdit(entry)}
                      style={{
                        background: '#1c1d19',
                        border: '1px solid #2a2b24',
                        color: '#8a8b84',
                        padding: '6px',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
                      title="Editar clave"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      style={{
                        background: '#1c1d19',
                        border: '1px solid #2a2b24',
                        color: '#c45c4a',
                        padding: '6px',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
                      title="Eliminar clave"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Password field row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#1c1d19',
                  border: '1px solid #2a2b24',
                  borderRadius: '10px',
                  padding: '8px 12px'
                }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '13px',
                    color: isVisible ? '#8faf89' : '#ecece4',
                    letterSpacing: isVisible ? '0.04em' : '0.15em'
                  }}>
                    {isVisible ? entry.password : '••••••••••••••••'}
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => toggleVisibility(entry.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#8a8b84',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                      title={isVisible ? 'Ocultar' : 'Mostrar'}
                    >
                      {isVisible ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>

                    <button
                      onClick={() => handleCopy(entry.password, 'Contraseña')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ecece4',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                      title="Copiar contraseña (se limpia en 30s)"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* TOTP Preview if available */}
                {totpCode && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#1c1d19',
                    border: '1px solid #2a2b24',
                    borderRadius: '10px',
                    padding: '8px 12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: '#8a8b84' }}>TOTP:</span>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '15px',
                        fontWeight: 600,
                        color: '#d4d0c4',
                        letterSpacing: '0.1em'
                      }}>
                        {totpCode}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        color: totpSecondsRemaining <= 5 ? '#c45c4a' : '#8a8b84'
                      }}>
                        {totpSecondsRemaining}s
                      </span>
                      <button
                        onClick={() => handleCopy(totpCode.replace(/\s/g, ''), 'Código TOTP')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#8a8b84',
                          cursor: 'pointer',
                          padding: '4px'
                        }}
                        title="Copiar código TOTP"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {/* Additional info: URL or Notes */}
                {(entry.url || entry.notes) && (
                  <div style={{ fontSize: '12px', color: '#8a8b84', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {entry.url && (
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        🔗 {entry.url}
                      </div>
                    )}
                    {entry.notes && (
                      <div style={{ fontStyle: 'italic', color: '#8a8b84' }}>
                        &ldquo;{entry.notes}&rdquo;
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Generator */}
      {showGeneratorModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          zIndex: 999
        }}>
          <div style={{
            width: '100%',
            maxWidth: '420px',
            backgroundColor: '#141512',
            border: '1px solid #2a2b24',
            borderRadius: '20px',
            padding: '24px'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#ecece4', marginBottom: '16px' }}>
              Generador de contraseñas
            </h3>

            {/* Generated display */}
            <div style={{
              backgroundColor: '#1c1d19',
              border: '1px solid #2a2b24',
              borderRadius: '12px',
              padding: '14px',
              marginBottom: '16px',
              position: 'relative'
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '15px',
                color: '#8faf89',
                wordBreak: 'break-all',
                letterSpacing: '0.05em',
                marginBottom: '10px'
              }}>
                {generatedPassword}
              </div>

              {/* 5-bar strength meter */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[0, 1, 2, 3, 4].map(idx => (
                    <div
                      key={idx}
                      style={{
                        flex: 1,
                        height: '4px',
                        borderRadius: '2px',
                        backgroundColor: idx <= strength.score ? strength.color : '#2a2b24'
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#8a8b84' }}>
                  <span>Fortaleza: <strong style={{ color: strength.color }}>{strength.label}</strong></span>
                  <span>{genLength} caracteres</span>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#8a8b84', marginBottom: '6px' }}>
                  <span>Longitud</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#ecece4' }}>{genLength}</span>
                </div>
                <input
                  type="range"
                  min={12}
                  max={48}
                  value={genLength}
                  onChange={e => setGenLength(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#8faf89' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#ecece4', cursor: 'pointer' }}>
                  <input type="checkbox" checked={genLower} onChange={e => setGenLower(e.target.checked)} style={{ accentColor: '#8faf89' }} />
                  <span>Minúsculas (a-z)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#ecece4', cursor: 'pointer' }}>
                  <input type="checkbox" checked={genUpper} onChange={e => setGenUpper(e.target.checked)} style={{ accentColor: '#8faf89' }} />
                  <span>Mayúsculas (A-Z)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#ecece4', cursor: 'pointer' }}>
                  <input type="checkbox" checked={genDigits} onChange={e => setGenDigits(e.target.checked)} style={{ accentColor: '#8faf89' }} />
                  <span>Dígitos (2-9)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#ecece4', cursor: 'pointer' }}>
                  <input type="checkbox" checked={genSymbols} onChange={e => setGenSymbols(e.target.checked)} style={{ accentColor: '#8faf89' }} />
                  <span>Símbolos (!@#$)</span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowGeneratorModal(false)}
                style={{
                  padding: '8px 14px',
                  backgroundColor: 'transparent',
                  border: '1px solid #2a2b24',
                  borderRadius: '8px',
                  color: '#8a8b84',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  handleCopy(generatedPassword, 'Contraseña generada');
                  setShowGeneratorModal(false);
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#ecece4',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#0b0c0a',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Copiar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Entry */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          zIndex: 999
        }}>
          <div style={{
            width: '100%',
            maxWidth: '440px',
            backgroundColor: '#141512',
            border: '1px solid #2a2b24',
            borderRadius: '20px',
            padding: '24px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#ecece4', marginBottom: '16px' }}>
              {editingEntry ? 'Editar clave' : 'Nueva clave'}
            </h3>

            <form onSubmit={handleSaveEntry} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#8a8b84', marginBottom: '4px' }}>
                  Título / Servicio *
                </label>
                <input
                  type="text"
                  value={fTitle}
                  onChange={e => setFTitle(e.target.value)}
                  placeholder="ej. GitHub, Proton, Banco..."
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: '#1c1d19',
                    border: '1px solid #2a2b24',
                    borderRadius: '10px',
                    color: '#ecece4',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#8a8b84', marginBottom: '4px' }}>
                  Usuario o Correo
                </label>
                <input
                  type="text"
                  value={fUsername}
                  onChange={e => setFUsername(e.target.value)}
                  placeholder="ej. bubbas@umbra.local"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: '#1c1d19',
                    border: '1px solid #2a2b24',
                    borderRadius: '10px',
                    color: '#ecece4',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '12px', color: '#8a8b84' }}>
                    Contraseña *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const pwd = generatePassword({ length: 20, useLower: true, useUpper: true, useDigits: true, useSymbols: true });
                      setFPassword(pwd);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#8faf89',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    Generar aleatoria
                  </button>
                </div>
                <input
                  type="text"
                  value={fPassword}
                  onChange={e => setFPassword(e.target.value)}
                  placeholder="Contraseña segura"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: '#1c1d19',
                    border: '1px solid #2a2b24',
                    borderRadius: '10px',
                    color: '#ecece4',
                    fontSize: '14px',
                    fontFamily: 'var(--font-mono)',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#8a8b84', marginBottom: '4px' }}>
                  URL del sitio
                </label>
                <input
                  type="text"
                  value={fUrl}
                  onChange={e => setFUrl(e.target.value)}
                  placeholder="https://..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: '#1c1d19',
                    border: '1px solid #2a2b24',
                    borderRadius: '10px',
                    color: '#ecece4',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '12px', color: '#8a8b84' }}>
                    Secreto TOTP (Base32, opcional)
                  </label>
                  <button
                    type="button"
                    onClick={() => setFTotpSecret(generateBase32Secret(20))}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#8faf89',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    Crear nuevo secreto
                  </button>
                </div>
                <input
                  type="text"
                  value={fTotpSecret}
                  onChange={e => setFTotpSecret(e.target.value.toUpperCase())}
                  placeholder="JBSWY3DPEHPK3PXP"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: '#1c1d19',
                    border: '1px solid #2a2b24',
                    borderRadius: '10px',
                    color: '#ecece4',
                    fontSize: '13px',
                    fontFamily: 'var(--font-mono)',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#8a8b84', marginBottom: '4px' }}>
                  Notas adicionales
                </label>
                <textarea
                  value={fNotes}
                  onChange={e => setFNotes(e.target.value)}
                  placeholder="Preguntas de seguridad, pines, detalles..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: '#1c1d19',
                    border: '1px solid #2a2b24',
                    borderRadius: '10px',
                    color: '#ecece4',
                    fontSize: '13px',
                    outline: 'none',
                    resize: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: 'transparent',
                    border: '1px solid #2a2b24',
                    borderRadius: '8px',
                    color: '#8a8b84',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#ecece4',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#0b0c0a',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {editingEntry ? 'Guardar cambios' : 'Añadir clave'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
