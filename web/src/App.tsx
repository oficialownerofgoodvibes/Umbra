import React, { useState, useEffect, useRef } from 'react';
import { TabType, VaultData, EncryptedVaultRecord } from './types';
import { loadEncryptedVault, saveEncryptedVault } from './storage';
import {
  generateIdentity,
  encryptVaultRecord,
  decryptVaultRecord
} from './crypto';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { ToastContainer, showToast } from './components/Toast';
import { AccessScreen } from './components/AccessScreen';
import { MessagesTab } from './components/MessagesTab';
import { PasswordsTab } from './components/PasswordsTab';
import { NotesTab } from './components/NotesTab';
import { StealthTab } from './components/StealthTab';

export const App: React.FC = () => {
  // Vault state
  const [encryptedRecord, setEncryptedRecord] = useState<EncryptedVaultRecord | null>(null);
  const [vaultData, setVaultData] = useState<VaultData | null>(null);
  const [masterPassword, setMasterPassword] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [lastUnlockTime, setLastUnlockTime] = useState<Date>(new Date());

  // UI state
  const [currentTab, setCurrentTab] = useState<TabType>('messages');
  const [isWorking, setIsWorking] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

  // Auto-lock idle timer state
  const [idleRemainingSeconds, setIdleRemainingSeconds] = useState<number | undefined>(undefined);
  const lastActivityRef = useRef<number>(Date.now());

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load vault from storage on startup
  useEffect(() => {
    const init = async () => {
      setIsWorking(true);
      setStatusText('Leyendo almacenamiento seguro...');
      try {
        const record = await loadEncryptedVault();
        if (record) {
          setEncryptedRecord(record);
        }
      } catch (err: any) {
        console.error('Error al inicializar almacenamiento:', err);
      } finally {
        setIsWorking(false);
        setStatusText('');
      }
    };
    init();
  }, []);

  // Inactivity tracking (pointerdown, keydown, touchstart)
  useEffect(() => {
    if (!isUnlocked || !vaultData) return;

    const idleMs = vaultData.settings.idleMs ?? 300000;
    if (idleMs <= 0) {
      setIdleRemainingSeconds(undefined);
      return;
    }

    lastActivityRef.current = Date.now();

    const onUserActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('pointerdown', onUserActivity, { passive: true });
    window.addEventListener('keydown', onUserActivity, { passive: true });
    window.addEventListener('touchstart', onUserActivity, { passive: true });

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      const remainingMs = Math.max(0, idleMs - elapsed);
      const remainingSec = Math.ceil(remainingMs / 1000);
      setIdleRemainingSeconds(remainingSec);

      if (remainingMs <= 0) {
        lockVault();
        showToast('Bóveda bloqueada por inactividad', 'info');
      }
    }, 1000);

    return () => {
      window.removeEventListener('pointerdown', onUserActivity);
      window.removeEventListener('keydown', onUserActivity);
      window.removeEventListener('touchstart', onUserActivity);
      clearInterval(interval);
    };
  }, [isUnlocked, vaultData]);

  // Lock vault and wipe sensitive memory
  const lockVault = () => {
    setIsUnlocked(false);
    setVaultData(null);
    setMasterPassword(null);
    setErrorMessage('');
    setIdleRemainingSeconds(undefined);
  };

  // Unlock vault
  const handleUnlock = async (password: string) => {
    if (!encryptedRecord) return;
    setIsWorking(true);
    setStatusText('Derivando claves (600.000 iteraciones)...');
    setErrorMessage('');

    try {
      // Yield to let UI update spinner
      await new Promise(r => setTimeout(r, 50));
      const data = await decryptVaultRecord(encryptedRecord, password);

      setVaultData(data);
      setMasterPassword(password);
      setIsUnlocked(true);
      setLastUnlockTime(new Date());
      showToast('Bóveda desbloqueada', 'success');
    } catch (err: any) {
      setErrorMessage(err.message || 'Contraseña incorrecta');
    } finally {
      setIsWorking(false);
      setStatusText('');
    }
  };

  // Create new vault
  const handleCreateVault = async (displayName: string, masterPwd: string) => {
    setIsWorking(true);
    setStatusText('Generando identidad criptográfica...');
    setErrorMessage('');

    try {
      await new Promise(r => setTimeout(r, 50));
      const identity = await generateIdentity();

      const newVault: VaultData = {
        version: 1,
        displayName,
        identity,
        conversations: [],
        passwords: [],
        notes: [],
        settings: {
          idleMs: 300000, // 5 minutes default
          createdAt: new Date().toISOString()
        },
        updatedAt: new Date().toISOString()
      };

      setStatusText('Cifrando bóveda con PBKDF2 (600.000 iteraciones)...');
      await new Promise(r => setTimeout(r, 50));

      const { record } = await encryptVaultRecord(newVault, masterPwd);
      await saveEncryptedVault(record);

      setEncryptedRecord(record);
      setVaultData(newVault);
      setMasterPassword(masterPwd);
      setIsUnlocked(true);
      setLastUnlockTime(new Date());
      showToast('Bóveda creada y asegurada localmente', 'success');
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al crear la bóveda');
    } finally {
      setIsWorking(false);
      setStatusText('');
    }
  };

  // Update vault data and persist encrypted to storage
  const handleUpdateVault = async (updatedData: VaultData, newPassword?: string) => {
    const pwdToUse = newPassword || masterPassword;
    if (!pwdToUse) return;

    setVaultData(updatedData);

    try {
      const { record } = await encryptVaultRecord(updatedData, pwdToUse);
      await saveEncryptedVault(record);
      setEncryptedRecord(record);
      if (newPassword) {
        setMasterPassword(newPassword);
      }
    } catch (err) {
      console.error('Error al guardar bóveda actualizada:', err);
    }
  };

  // Update collections
  const handleUpdateConversations = (conversations: VaultData['conversations']) => {
    if (!vaultData) return;
    handleUpdateVault({
      ...vaultData,
      conversations,
      updatedAt: new Date().toISOString()
    });
  };

  const handleUpdatePasswords = (passwords: VaultData['passwords']) => {
    if (!vaultData) return;
    handleUpdateVault({
      ...vaultData,
      passwords,
      updatedAt: new Date().toISOString()
    });
  };

  const handleUpdateNotes = (notes: VaultData['notes']) => {
    if (!vaultData) return;
    handleUpdateVault({
      ...vaultData,
      notes,
      updatedAt: new Date().toISOString()
    });
  };

  const handleResetVault = () => {
    setEncryptedRecord(null);
    setVaultData(null);
    setMasterPassword(null);
    setIsUnlocked(false);
    setErrorMessage('');
  };

  // If locked, render AccessScreen
  if (!isUnlocked || !vaultData) {
    return (
      <>
        <AccessScreen
          hasExistingVault={Boolean(encryptedRecord)}
          knownFingerprint={vaultData?.identity?.fingerprint}
          isWorking={isWorking}
          statusText={statusText}
          errorMessage={errorMessage}
          onUnlock={handleUnlock}
          onCreateVault={handleCreateVault}
        />
        <ToastContainer />
      </>
    );
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      backgroundColor: '#0b0c0a',
      overflow: 'hidden'
    }}>
      {/* Desktop Sidebar (w >= 768px) */}
      {isDesktop && (
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          fingerprint={vaultData.identity.fingerprint}
          onLock={lockVault}
        />
      )}

      {/* Main Container */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minWidth: 0,
        position: 'relative'
      }}>
        {/* Mobile Header (hidden on desktop if sidebar is active) */}
        {!isDesktop && (
          <Header
            displayName={vaultData.displayName}
            fingerprint={vaultData.identity.fingerprint}
            onLock={lockVault}
            idleRemainingSeconds={idleRemainingSeconds}
          />
        )}

        {/* Content Pane */}
        <main style={{
          flex: 1,
          overflow: 'hidden',
          paddingBottom: isDesktop ? 0 : '64px',
          position: 'relative'
        }}>
          {currentTab === 'messages' && (
            <MessagesTab
              conversations={vaultData.conversations}
              onUpdateConversations={handleUpdateConversations}
            />
          )}

          {currentTab === 'passwords' && (
            <PasswordsTab
              passwords={vaultData.passwords}
              onUpdatePasswords={handleUpdatePasswords}
            />
          )}

          {currentTab === 'notes' && (
            <NotesTab
              notes={vaultData.notes}
              onUpdateNotes={handleUpdateNotes}
            />
          )}

          {currentTab === 'stealth' && (
            <StealthTab
              vaultData={vaultData}
              encryptedRecord={encryptedRecord}
              lastUnlockTime={lastUnlockTime}
              onLock={lockVault}
              onUpdateVault={handleUpdateVault}
              onResetVault={handleResetVault}
            />
          )}
        </main>

        {/* Mobile Bottom Navigation */}
        {!isDesktop && (
          <BottomNav currentTab={currentTab} onSelectTab={setCurrentTab} />
        )}
      </div>

      <ToastContainer />
    </div>
  );
};
