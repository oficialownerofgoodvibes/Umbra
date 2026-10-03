import React, { useState } from 'react';
import { VaultData, AutoTestResult, EncryptedVaultRecord } from '../types';
import { runCryptoAutotest, encryptVaultRecord, decryptVaultRecord } from '../crypto';
import { saveEncryptedVault, clearVaultStorage } from '../storage';
import { showToast, copyWithAutoClean } from './Toast';

interface StealthTabProps {
  vaultData: VaultData;
  encryptedRecord: EncryptedVaultRecord | null;
  lastUnlockTime: Date;
  onLock: () => void;
  onUpdateVault: (newData: VaultData, newPassword?: string) => Promise<void>;
  onResetVault: () => void;
}

export const StealthTab: React.FC<StealthTabProps> = ({
  vaultData,
  encryptedRecord,
  lastUnlockTime,
  onLock,
  onUpdateVault,
  onResetVault
}) => {
  // Autotest state
  const [autotestRunning, setAutotestRunning] = useState(false);
  const [autotestResults, setAutotestResults] = useState<AutoTestResult[] | null>(null);

  // Change Password state
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changePasswordWorking, setChangePasswordWorking] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState('');

  // Import Backup state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [importWorking, setImportWorking] = useState(false);
  const [importError, setImportError] = useState('');

  // Wipe All state
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState('');

  // Calculate statistics
  const totalConversations = vaultData.conversations.length;
  const totalMessages = vaultData.conversations.reduce((sum, c) => sum + c.messages.length, 0);
  const totalPasswords = vaultData.passwords.length;
  const totalNotes = vaultData.notes.length;

  // Run autotest
  const handleRunAutotest = async () => {
    setAutotestRunning(true);
    try {
      const results = await runCryptoAutotest();
      setAutotestResults(results);
      const allPassed = results.every(r => r.passed);
      if (allPassed) {
        showToast('Autotest superado: los 4 vectores criptográficos son válidos', 'success');
      } else {
        showToast('Algunos vectores fallaron en el autotest', 'error');
      }
    } catch (err: any) {
      showToast('Error al ejecutar autotest: ' + err.message, 'error');
    } finally {
      setAutotestRunning(false);
    }
  };

  // Idle timeout change
  const handleIdleChange = async (ms: number) => {
    const updated: VaultData = {
      ...vaultData,
      settings: {
        ...vaultData.settings,
        idleMs: ms
      },
      updatedAt: new Date().toISOString()
    };
    await onUpdateVault(updated);
    showToast('Tiempo de bloqueo por inactividad actualizado', 'info');
  };

  // Export encrypted backup
  const handleExportBackup = () => {
    if (!encryptedRecord) {
      showToast('No hay registro cifrado disponible para exportar', 'error');
      return;
    }

    const jsonStr = JSON.stringify(encryptedRecord, null, 2);
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `umbra-vault-backup-${dateStr}.json`;

    // Check Android native bridge first
    const androidBridge = (window as any).UmbraAndroid;
    if (androidBridge && typeof androidBridge.saveText === 'function') {
      try {
        androidBridge.saveText(filename, 'application/json', jsonStr);
        return;
      } catch (err) {
        console.warn('Fallo en puente Android, intentando descarga web:', err);
      }
    }

    // Web download fallback
    try {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Copia cifrada exportada: ' + filename, 'success');
    } catch (e: any) {
      showToast('Error al exportar: ' + e.message, 'error');
    }
  };

  // Process Import Backup
  const handleProcessImportBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError('');

    if (!importJsonText.trim()) {
      setImportError('Pega el contenido JSON de la copia de seguridad');
      return;
    }
    if (!importPassword) {
      setImportError('Introduce la contraseña maestra de esa copia');
      return;
    }

    setImportWorking(true);
    try {
      const parsed = JSON.parse(importJsonText.trim()) as EncryptedVaultRecord;
      if (parsed.umbra !== 1 || !parsed.blob || !parsed.salt) {
        throw new Error('El JSON no corresponde a una copia válida de Umbra (versión 1)');
      }

      // Test decrypting with provided password
      const decrypted = await decryptVaultRecord(parsed, importPassword);

      // Save new record
      await saveEncryptedVault(parsed);
      await onUpdateVault(decrypted, importPassword);

      showToast('Copia de seguridad restaurada correctamente', 'success');
      setShowImportModal(false);
      setImportJsonText('');
      setImportPassword('');
    } catch (err: any) {
      setImportError(err.message || 'Error al restaurar la copia');
    } finally {
      setImportWorking(false);
    }
  };

  // Change master password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError('');

    if (!currentPassword) {
      setChangePasswordError('Introduce la contraseña actual');
      return;
    }
    if (newPassword.length < 10) {
      setChangePasswordError('La nueva contraseña debe tener al menos 10 caracteres');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setChangePasswordError('Las nuevas contraseñas no coinciden');
      return;
    }

    setChangePasswordWorking(true);
    try {
      if (!encryptedRecord) {
        throw new Error('No se encontró el registro cifrado');
      }

      // Verify current password by decrypting
      await decryptVaultRecord(encryptedRecord, currentPassword);

      // Re-encrypt whole vault with new password, new salt and 600,000 iterations
      const updatedVault: VaultData = {
        ...vaultData,
        updatedAt: new Date().toISOString()
      };

      const { record: newRecord } = await encryptVaultRecord(updatedVault, newPassword);
      await saveEncryptedVault(newRecord);
      await onUpdateVault(updatedVault, newPassword);

      showToast('Contraseña maestra cambiada exitosamente', 'success');
      setShowChangePasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      setChangePasswordError(err.message || 'Contraseña actual incorrecta');
    } finally {
      setChangePasswordWorking(false);
    }
  };

  // Wipe All
  const handleWipeAll = async () => {
    if (wipeConfirmText !== 'BORRAR') {
      showToast('Debes escribir BORRAR en mayúsculas para confirmar', 'warn');
      return;
    }

    await clearVaultStorage();
    showToast('Bóveda eliminada por completo', 'info');
    onResetVault();
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#ecece4' }}>Sigilo e Identidad</h2>
        <div style={{ fontSize: '12px', color: '#8a8b84' }}>
          Arquitectura criptográfica local, diagnóstico y control de bóveda
        </div>
      </div>

      {/* Summary Card */}
      <div style={{
        backgroundColor: '#141512',
        border: '1px solid #2a2b24',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#8a8b84', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Identidad local
            </div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#ecece4', marginTop: '2px' }}>
              {vaultData.displayName}
            </div>
          </div>

          <button
            onClick={() => copyWithAutoClean(vaultData.identity.fingerprint, 30, 'Huella copiada')}
            style={{
              backgroundColor: '#1c1d19',
              border: '1px solid #2a2b24',
              color: '#d4d0c4',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
            title="Copiar huella criptográfica"
          >
            <span>{vaultData.identity.fingerprint}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
        </div>

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '12px',
          paddingTop: '16px',
          borderTop: '1px solid #1c1d19'
        }}>
          <div style={{ backgroundColor: '#1c1d19', padding: '12px', borderRadius: '10px', border: '1px solid #2a2b24' }}>
            <div style={{ fontSize: '11px', color: '#8a8b84' }}>Conversaciones</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#ecece4', marginTop: '4px' }}>{totalConversations}</div>
          </div>
          <div style={{ backgroundColor: '#1c1d19', padding: '12px', borderRadius: '10px', border: '1px solid #2a2b24' }}>
            <div style={{ fontSize: '11px', color: '#8a8b84' }}>Mensajes totales</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#ecece4', marginTop: '4px' }}>{totalMessages}</div>
          </div>
          <div style={{ backgroundColor: '#1c1d19', padding: '12px', borderRadius: '10px', border: '1px solid #2a2b24' }}>
            <div style={{ fontSize: '11px', color: '#8a8b84' }}>Claves guardadas</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#ecece4', marginTop: '4px' }}>{totalPasswords}</div>
          </div>
          <div style={{ backgroundColor: '#1c1d19', padding: '12px', borderRadius: '10px', border: '1px solid #2a2b24' }}>
            <div style={{ fontSize: '11px', color: '#8a8b84' }}>Notas cifradas</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#ecece4', marginTop: '4px' }}>{totalNotes}</div>
          </div>
        </div>

        <div style={{ fontSize: '11px', color: '#8a8b84', marginTop: '14px', textAlign: 'right' }}>
          Último desbloqueo: {lastUnlockTime.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })} a las {lastUnlockTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* Technical Algorithms Card */}
      <div style={{
        backgroundColor: '#141512',
        border: '1px solid #2a2b24',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#ecece4' }}>
            Especificaciones Criptográficas
          </h3>

          <button
            onClick={handleRunAutotest}
            disabled={autotestRunning}
            style={{
              backgroundColor: '#1c1d19',
              border: '1px solid #2a2b24',
              color: autotestRunning ? '#8a8b84' : '#8faf89',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: autotestRunning ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>{autotestRunning ? 'Probando...' : 'Ejecutar Autotest'}</span>
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #1c1d19' }}>
              <td style={{ padding: '8px 0', color: '#8a8b84' }}>Cifrado de datos</td>
              <td style={{ padding: '8px 0', color: '#ecece4', textAlign: 'right' }}>AES-256-CTR (IV 128-bit)</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #1c1d19' }}>
              <td style={{ padding: '8px 0', color: '#8a8b84' }}>Integridad / MAC</td>
              <td style={{ padding: '8px 0', color: '#ecece4', textAlign: 'right' }}>HMAC-SHA-256 (Encrypt-then-MAC)</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #1c1d19' }}>
              <td style={{ padding: '8px 0', color: '#8a8b84' }}>Derivación de claves</td>
              <td style={{ padding: '8px 0', color: '#ecece4', textAlign: 'right' }}>PBKDF2 600.000 iteraciones (SHA-256)</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #1c1d19' }}>
              <td style={{ padding: '8px 0', color: '#8a8b84' }}>Identidad asimétrica</td>
              <td style={{ padding: '8px 0', color: '#ecece4', textAlign: 'right' }}>Curva NIST P-256 (ECDH)</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: '#8a8b84' }}>Protocolo de mensajes</td>
              <td style={{ padding: '8px 0', color: '#ecece4', textAlign: 'right' }}>Ratchet HMAC dual-chain (Forward Secrecy)</td>
            </tr>
          </tbody>
        </table>

        {/* Autotest live results */}
        {autotestResults && (
          <div style={{
            marginTop: '16px',
            backgroundColor: '#1c1d19',
            borderRadius: '12px',
            padding: '14px',
            border: '1px solid #2a2b24'
          }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#ecece4', marginBottom: '8px' }}>
              Resultados del Autotest en memoria:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {autotestResults.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: r.passed ? '#8faf89' : '#c45c4a', fontWeight: 'bold' }}>
                      {r.passed ? '✓' : '✗'}
                    </span>
                    <span style={{ color: '#ecece4' }}>{r.name}</span>
                    <span style={{ fontSize: '10px', color: '#8a8b84' }}>({r.durationMs} ms)</span>
                  </div>
                  <div style={{ fontSize: '11px', color: r.passed ? '#8a8b84' : '#c45c4a', textAlign: 'right' }}>
                    {r.details}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Settings Card */}
      <div style={{
        backgroundColor: '#141512',
        border: '1px solid #2a2b24',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#ecece4', marginBottom: '16px' }}>
          Ajustes de la Bóveda
        </h3>

        {/* Idle lock option */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', color: '#8a8b84', marginBottom: '8px' }}>
            Bloqueo automático por inactividad
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { label: '1 minuto', ms: 60000 },
              { label: '5 minutos', ms: 300000 },
              { label: '15 minutos', ms: 900000 },
              { label: 'Nunca', ms: 0 }
            ].map(opt => {
              const isActive = (vaultData.settings.idleMs || 300000) === opt.ms;
              return (
                <button
                  key={opt.ms}
                  onClick={() => handleIdleChange(opt.ms)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: isActive ? '#8faf89' : '#2a2b24',
                    backgroundColor: isActive ? '#22231e' : '#1c1d19',
                    color: isActive ? '#ecece4' : '#8a8b84',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Buttons Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
          <button
            onClick={onLock}
            style={{
              padding: '10px',
              backgroundColor: '#1c1d19',
              border: '1px solid #2a2b24',
              borderRadius: '10px',
              color: '#ecece4',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span>Bloquear ahora</span>
          </button>

          <button
            onClick={() => setShowChangePasswordModal(true)}
            style={{
              padding: '10px',
              backgroundColor: '#1c1d19',
              border: '1px solid #2a2b24',
              borderRadius: '10px',
              color: '#ecece4',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2l-2 2m-1.5 1.5L14 9M3 21l6-6M9 15l-3 3M15 9a4.24 4.24 0 1 1 6-6 4.24 4.24 0 0 1-6 6z" />
            </svg>
            <span>Cambiar contraseña</span>
          </button>

          <button
            onClick={handleExportBackup}
            style={{
              padding: '10px',
              backgroundColor: '#1c1d19',
              border: '1px solid #2a2b24',
              borderRadius: '10px',
              color: '#8faf89',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Exportar copia</span>
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            style={{
              padding: '10px',
              backgroundColor: '#1c1d19',
              border: '1px solid #2a2b24',
              borderRadius: '10px',
              color: '#ecece4',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Importar copia</span>
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div style={{
        backgroundColor: '#141512',
        border: '1px solid rgba(196, 92, 74, 0.4)',
        borderRadius: '16px',
        padding: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#c45c4a' }}>Zona de destrucción</h3>
            <p style={{ fontSize: '12px', color: '#8a8b84', marginTop: '2px' }}>
              Elimina todos los datos cifrados locales, identidades y claves de este dispositivo.
            </p>
          </div>

          <button
            onClick={() => setShowWipeModal(true)}
            style={{
              padding: '8px 16px',
              backgroundColor: 'rgba(196, 92, 74, 0.15)',
              border: '1px solid #c45c4a',
              borderRadius: '8px',
              color: '#c45c4a',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Borrar todo
          </button>
        </div>
      </div>

      {/* Modal: Change Password */}
      {showChangePasswordModal && (
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
            maxWidth: '400px',
            backgroundColor: '#141512',
            border: '1px solid #2a2b24',
            borderRadius: '20px',
            padding: '24px'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#ecece4', marginBottom: '14px' }}>
              Cambiar contraseña maestra
            </h3>

            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#8a8b84', marginBottom: '4px' }}>
                  Contraseña maestra actual
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="••••••••••••"
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
                  Nueva contraseña maestra (mín. 10 caracteres)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
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
                  Confirmar nueva contraseña
                </label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={e => setConfirmNewPassword(e.target.value)}
                  placeholder="••••••••••••"
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

              {changePasswordError && (
                <div style={{
                  padding: '8px 12px',
                  backgroundColor: 'rgba(196, 92, 74, 0.15)',
                  border: '1px solid #c45c4a',
                  borderRadius: '8px',
                  color: '#c45c4a',
                  fontSize: '12px'
                }}>
                  {changePasswordError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowChangePasswordModal(false)}
                  disabled={changePasswordWorking}
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
                  disabled={changePasswordWorking}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#ecece4',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#0b0c0a',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: changePasswordWorking ? 'not-allowed' : 'pointer'
                  }}
                >
                  {changePasswordWorking ? 'Recifrando (600k iter)...' : 'Actualizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Import Backup */}
      {showImportModal && (
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
            padding: '24px'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#ecece4', marginBottom: '8px' }}>
              Importar copia de seguridad cifrada
            </h3>
            <p style={{ fontSize: '12px', color: '#8a8b84', marginBottom: '14px' }}>
              Pega el contenido JSON de una copia exportada de Umbra.
            </p>

            <form onSubmit={handleProcessImportBackup} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <textarea
                value={importJsonText}
                onChange={e => setImportJsonText(e.target.value)}
                placeholder='{"umbra":1, "blob":"..."}'
                rows={5}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: '#1c1d19',
                  border: '1px solid #2a2b24',
                  borderRadius: '10px',
                  color: '#ecece4',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                  resize: 'none'
                }}
              />

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#8a8b84', marginBottom: '4px' }}>
                  Contraseña de la copia
                </label>
                <input
                  type="password"
                  value={importPassword}
                  onChange={e => setImportPassword(e.target.value)}
                  placeholder="••••••••••••"
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

              {importError && (
                <div style={{
                  padding: '8px 12px',
                  backgroundColor: 'rgba(196, 92, 74, 0.15)',
                  border: '1px solid #c45c4a',
                  borderRadius: '8px',
                  color: '#c45c4a',
                  fontSize: '12px'
                }}>
                  {importError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  disabled={importWorking}
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
                  disabled={importWorking}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#ecece4',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#0b0c0a',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: importWorking ? 'not-allowed' : 'pointer'
                  }}
                >
                  {importWorking ? 'Descifrando y validando...' : 'Restaurar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Wipe All Confirmation */}
      {showWipeModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          zIndex: 999
        }}>
          <div style={{
            width: '100%',
            maxWidth: '380px',
            backgroundColor: '#141512',
            border: '1px solid #c45c4a',
            borderRadius: '20px',
            padding: '24px'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#c45c4a', marginBottom: '8px' }}>
              ¿Eliminar toda la bóveda?
            </h3>
            <p style={{ fontSize: '13px', color: '#ecece4', lineHeight: 1.4, marginBottom: '14px' }}>
              Esta acción es permanente e irreversible. Se borrarán todas las conversaciones, claves, notas e identidades de la memoria y el almacenamiento local.
            </p>
            <p style={{ fontSize: '12px', color: '#8a8b84', marginBottom: '14px' }}>
              Escribe <strong>BORRAR</strong> en mayúsculas para confirmar:
            </p>

            <input
              type="text"
              value={wipeConfirmText}
              onChange={e => setWipeConfirmText(e.target.value)}
              placeholder="BORRAR"
              autoFocus
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: '#1c1d19',
                border: '1px solid #c45c4a',
                borderRadius: '10px',
                color: '#ecece4',
                fontSize: '14px',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
                marginBottom: '16px'
              }}
            />

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowWipeModal(false);
                  setWipeConfirmText('');
                }}
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
                onClick={handleWipeAll}
                disabled={wipeConfirmText !== 'BORRAR'}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#c45c4a',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ecece4',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: wipeConfirmText === 'BORRAR' ? 'pointer' : 'not-allowed',
                  opacity: wipeConfirmText === 'BORRAR' ? 1 : 0.5
                }}
              >
                Eliminar todo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
