import React, { useState } from 'react';
import { ShieldLogoIcon } from './Header';

interface AccessScreenProps {
  hasExistingVault: boolean;
  knownFingerprint?: string;
  isWorking: boolean;
  statusText?: string;
  errorMessage?: string;
  onUnlock: (password: string) => Promise<void>;
  onCreateVault: (displayName: string, masterPassword: string) => Promise<void>;
}

export const AccessScreen: React.FC<AccessScreenProps> = ({
  hasExistingVault,
  knownFingerprint,
  isWorking,
  statusText,
  errorMessage,
  onUnlock,
  onCreateVault
}) => {
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setLocalError('Introduce la contraseña maestra');
      return;
    }
    setLocalError('');
    await onUnlock(password);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setLocalError('Introduce tu nombre o seudónimo');
      return;
    }
    if (password.length < 10) {
      setLocalError('La contraseña debe tener al menos 10 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Las contraseñas no coinciden');
      return;
    }
    setLocalError('');
    await onCreateVault(displayName.trim(), password);
  };

  const displayErr = errorMessage || localError;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      backgroundColor: '#0b0c0a'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        backgroundColor: '#141512',
        border: '1px solid #2a2b24',
        borderRadius: '24px',
        padding: '32px 24px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
      }}>
        {/* Logo & Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            backgroundColor: '#1c1d19',
            border: '1px solid #2a2b24',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px'
          }}>
            <ShieldLogoIcon size={32} color="#ecece4" />
          </div>

          <h1 style={{
            fontFamily: 'var(--font-logo)',
            fontSize: '28px',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: '#ecece4',
            lineHeight: 1.1
          }}>
            Umbra
          </h1>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: '#8a8b84',
            letterSpacing: '0.08em',
            marginTop: '4px'
          }}>
            ODS · &quot;bubbas&quot;
          </div>
        </div>

        {/* Form Body */}
        {hasExistingVault ? (
          <div>
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              <h2 style={{
                fontSize: '18px',
                fontWeight: 500,
                color: '#ecece4',
                marginBottom: '6px'
              }}>
                Bóveda sellada. Introduce la llave.
              </h2>
              {knownFingerprint && (
                <div style={{
                  display: 'inline-block',
                  backgroundColor: '#1c1d19',
                  border: '1px solid #2a2b24',
                  borderRadius: '8px',
                  padding: '4px 10px',
                  marginTop: '6px'
                }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: '#d4d0c4',
                    letterSpacing: '0.06em'
                  }}>
                    {knownFingerprint}
                  </span>
                </div>
              )}
            </div>

            <form onSubmit={handleUnlockSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#8a8b84', marginBottom: '6px' }}>
                  Contraseña maestra
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    disabled={isWorking}
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '12px 42px 12px 14px',
                      backgroundColor: '#1c1d19',
                      border: '1px solid #2a2b24',
                      borderRadius: '12px',
                      color: '#ecece4',
                      fontSize: '15px',
                      outline: 'none',
                      fontFamily: showPassword ? 'var(--font-mono)' : 'inherit'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#8a8b84',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {displayErr && (
                <div style={{
                  padding: '10px 12px',
                  backgroundColor: 'rgba(196, 92, 74, 0.12)',
                  border: '1px solid #c45c4a',
                  borderRadius: '10px',
                  color: '#c45c4a',
                  fontSize: '13px',
                  lineHeight: 1.4
                }}>
                  {displayErr}
                </div>
              )}

              <button
                type="submit"
                disabled={isWorking}
                style={{
                  width: '100%',
                  padding: '14px',
                  backgroundColor: '#ecece4',
                  color: '#0b0c0a',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: isWorking ? 'not-allowed' : 'pointer',
                  opacity: isWorking ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '4px'
                }}
              >
                {isWorking && (
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid #0b0c0a',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                )}
                <span>{isWorking ? (statusText || 'Trabajando...') : 'Desbloquear'}</span>
              </button>
            </form>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              <h2 style={{
                fontSize: '18px',
                fontWeight: 500,
                color: '#ecece4',
                marginBottom: '6px'
              }}>
                Crear bóveda
              </h2>
              <p style={{
                fontSize: '12px',
                color: '#8a8b84',
                lineHeight: 1.4
              }}>
                Cero servidores. Las claves nunca salen de la memoria de este dispositivo.
              </p>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#8a8b84', marginBottom: '6px' }}>
                  Cómo te llamas aquí
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="ej. bubbas"
                  disabled={isWorking}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    backgroundColor: '#1c1d19',
                    border: '1px solid #2a2b24',
                    borderRadius: '12px',
                    color: '#ecece4',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#8a8b84', marginBottom: '6px' }}>
                  Contraseña maestra (mín. 10 caracteres)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 10 caracteres"
                    disabled={isWorking}
                    style={{
                      width: '100%',
                      padding: '12px 42px 12px 14px',
                      backgroundColor: '#1c1d19',
                      border: '1px solid #2a2b24',
                      borderRadius: '12px',
                      color: '#ecece4',
                      fontSize: '14px',
                      outline: 'none',
                      fontFamily: showPassword ? 'var(--font-mono)' : 'inherit'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#8a8b84',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#8a8b84', marginBottom: '6px' }}>
                  Confirmar contraseña
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña"
                  disabled={isWorking}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    backgroundColor: '#1c1d19',
                    border: '1px solid #2a2b24',
                    borderRadius: '12px',
                    color: '#ecece4',
                    fontSize: '14px',
                    outline: 'none',
                    fontFamily: showPassword ? 'var(--font-mono)' : 'inherit'
                  }}
                />
              </div>

              {displayErr && (
                <div style={{
                  padding: '10px 12px',
                  backgroundColor: 'rgba(196, 92, 74, 0.12)',
                  border: '1px solid #c45c4a',
                  borderRadius: '10px',
                  color: '#c45c4a',
                  fontSize: '13px',
                  lineHeight: 1.4
                }}>
                  {displayErr}
                </div>
              )}

              <button
                type="submit"
                disabled={isWorking}
                style={{
                  width: '100%',
                  padding: '14px',
                  backgroundColor: '#ecece4',
                  color: '#0b0c0a',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: isWorking ? 'not-allowed' : 'pointer',
                  opacity: isWorking ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '6px'
                }}
              >
                {isWorking && (
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid #0b0c0a',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                )}
                <span>{isWorking ? (statusText || 'Derivando claves (600.000 iteraciones)...') : 'Crear bóveda'}</span>
              </button>
            </form>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
