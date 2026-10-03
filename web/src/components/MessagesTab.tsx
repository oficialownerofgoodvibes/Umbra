import React, { useState, useEffect } from 'react';
import { Conversation, MessageItem } from '../types';
import {
  bytesToBase64Url,
  base64UrlToBytes,
  deriveInitialChain,
  encryptRatchetMessage,
  decryptRatchetMessage
} from '../crypto';
import { showToast, copyWithAutoClean } from './Toast';

interface MessagesTabProps {
  conversations: Conversation[];
  onUpdateConversations: (conversations: Conversation[]) => void;
}

export const MessagesTab: React.FC<MessagesTabProps> = ({ conversations, onUpdateConversations }) => {
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportPackModal, setShowExportPackModal] = useState(false);
  const [currentPackText, setCurrentPackText] = useState('');

  // New Thread fields
  const [newThreadName, setNewThreadName] = useState('');
  const [isSharedThread, setIsSharedThread] = useState(false);

  // Import Dialog text
  const [importText, setImportText] = useState('');

  // Active chat state
  const [inputText, setInputText] = useState('');
  const [expiryOption, setExpiryOption] = useState<'none' | '30s' | '5m' | '1h' | '1d'>('none');

  const selectedConv = conversations.find(c => c.id === selectedConvId);

  // Purge expired messages every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      let hasChanges = false;

      const updated = conversations.map(conv => {
        const filtered = conv.messages.filter(m => !m.expiresAt || m.expiresAt > now);
        if (filtered.length !== conv.messages.length) {
          hasChanges = true;
          return { ...conv, messages: filtered };
        }
        return conv;
      });

      if (hasChanges) {
        onUpdateConversations(updated);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [conversations, onUpdateConversations]);

  // Spanish relative time
  const getRelativeTime = (timestamp: number): string => {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return 'hace un momento';
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
    if (diff < 172800) return 'ayer';
    return `hace ${Math.floor(diff / 86400)} d`;
  };

  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (name.slice(0, 2) || 'UM').toUpperCase();
  };

  // Create new conversation
  const handleCreateThread = async () => {
    if (!newThreadName.trim()) {
      showToast('Introduce un nombre para el hilo', 'warn');
      return;
    }

    const convId = 'c-' + Math.random().toString(36).slice(2, 10);
    let newConv: Conversation;

    if (isSharedThread) {
      // Alice initiates shared conversation
      const rootBytes = crypto.getRandomValues(new Uint8Array(32));
      const rootKeyBase64 = bytesToBase64Url(rootBytes);

      // Chains
      const sendChain = await deriveInitialChain(rootBytes, 'umbra-chain:alice');
      const recvChain = await deriveInitialChain(rootBytes, 'umbra-chain:bob');

      newConv = {
        id: convId,
        name: newThreadName.trim(),
        isShared: true,
        sharedState: {
          rootKeyBase64,
          myRole: 'alice',
          sendChainBase64: bytesToBase64Url(sendChain),
          recvChainBase64: bytesToBase64Url(recvChain),
          nextSendSeq: 1,
          lastRecvSeq: 0
        },
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // Generate invitation capsule
      const invitePayload = {
        v: 1,
        type: 'invite',
        convId,
        name: newThreadName.trim(),
        root: rootKeyBase64,
        youAre: 'bob'
      };
      const inviteCode = 'UMBRA-INVITE-1.' + bytesToBase64Url(new TextEncoder().encode(JSON.stringify(invitePayload)));

      copyWithAutoClean(inviteCode, 60, 'Hilo creado e invitación copiada. El portapapeles se limpia en 60 s.');
    } else {
      // Local thread
      newConv = {
        id: convId,
        name: newThreadName.trim(),
        isShared: false,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      showToast('Hilo local creado', 'success');
    }

    const updated = [newConv, ...conversations];
    onUpdateConversations(updated);
    setSelectedConvId(newConv.id);
    setShowNewModal(false);
    setNewThreadName('');
    setIsSharedThread(false);
  };

  // Copy invitation of selected shared thread
  const handleCopyInvite = () => {
    if (!selectedConv || !selectedConv.sharedState) return;
    const invitePayload = {
      v: 1,
      type: 'invite',
      convId: selectedConv.id,
      name: selectedConv.name,
      root: selectedConv.sharedState.rootKeyBase64,
      youAre: selectedConv.sharedState.myRole === 'alice' ? 'bob' : 'alice'
    };
    const code = 'UMBRA-INVITE-1.' + bytesToBase64Url(new TextEncoder().encode(JSON.stringify(invitePayload)));
    copyWithAutoClean(code, 60, 'Invitación copiada. El portapapeles se limpia en 60 s.');
  };

  // Send message
  const handleSendMessage = async () => {
    if (!selectedConv || !inputText.trim()) return;

    let expiresAt: number | null = null;
    const now = Date.now();
    if (expiryOption === '30s') expiresAt = now + 30000;
    else if (expiryOption === '5m') expiresAt = now + 300000;
    else if (expiryOption === '1h') expiresAt = now + 3600000;
    else if (expiryOption === '1d') expiresAt = now + 86400000;

    let seq = selectedConv.messages.length + 1;
    let updatedSharedState = selectedConv.sharedState;

    if (selectedConv.isShared && updatedSharedState) {
      seq = updatedSharedState.nextSendSeq;
      // We advance send chain
      const currentChain = base64UrlToBytes(updatedSharedState.sendChainBase64);
      const { nextChain } = await encryptRatchetMessage(currentChain, inputText.trim());

      updatedSharedState = {
        ...updatedSharedState,
        nextSendSeq: seq + 1,
        sendChainBase64: bytesToBase64Url(nextChain)
      };
    }

    const newMsg: MessageItem = {
      id: 'm-' + Math.random().toString(36).slice(2, 9),
      seq,
      sender: 'me',
      text: inputText.trim(),
      createdAt: now,
      expiresAt
    };

    const updatedConv: Conversation = {
      ...selectedConv,
      sharedState: updatedSharedState,
      messages: [...selectedConv.messages, newMsg],
      updatedAt: now
    };

    const nextList = conversations.map(c => (c.id === updatedConv.id ? updatedConv : c));
    // Sort by latest update
    nextList.sort((a, b) => b.updatedAt - a.updatedAt);
    onUpdateConversations(nextList);
    setInputText('');
  };

  // Generate encrypted pack for sharing
  const handleGeneratePack = async () => {
    if (!selectedConv || !selectedConv.sharedState) return;

    // We pack all outgoing messages that have seq >= 1
    const myMessages = selectedConv.messages.filter(m => m.sender === 'me');
    if (myMessages.length === 0) {
      showToast('No hay mensajes propios para empaquetar', 'warn');
      return;
    }

    // Prepare pack items
    // Re-derive encryption for messages using initial chain or pack container
    const items = [];
    const rootBytes = base64UrlToBytes(selectedConv.sharedState.rootKeyBase64);
    const chainLabel = selectedConv.sharedState.myRole === 'alice' ? 'umbra-chain:alice' : 'umbra-chain:bob';
    let chain = await deriveInitialChain(rootBytes, chainLabel);

    for (let s = 1; s <= selectedConv.sharedState.nextSendSeq - 1; s++) {
      const msg = myMessages.find(m => m.seq === s);
      if (msg) {
        const { blobBase64Url, nextChain } = await encryptRatchetMessage(chain, msg.text);
        items.push({
          seq: msg.seq,
          blob: blobBase64Url,
          createdAt: msg.createdAt,
          expiresAt: msg.expiresAt
        });
        chain = nextChain;
      }
    }

    const packPayload = {
      v: 1,
      type: 'pack',
      convId: selectedConv.id,
      fromRole: selectedConv.sharedState.myRole,
      startN: 1,
      items
    };

    const packCode = 'UMBRA-PACK-1.' + bytesToBase64Url(new TextEncoder().encode(JSON.stringify(packPayload)));
    setCurrentPackText(packCode);
    setShowExportPackModal(true);
  };

  // Import Invitation or Pack
  const handleProcessImport = async () => {
    const raw = importText.trim();
    if (!raw) {
      showToast('Pega un código de invitación o paquete', 'warn');
      return;
    }

    if (raw.startsWith('UMBRA-INVITE-1.')) {
      try {
        const b64 = raw.substring('UMBRA-INVITE-1.'.length);
        const jsonStr = new TextDecoder().decode(base64UrlToBytes(b64));
        const payload = JSON.parse(jsonStr);

        if (payload.v !== 1 || payload.type !== 'invite' || !payload.root || !payload.convId) {
          throw new Error('Estructura de invitación inválida');
        }

        // Check if exists
        if (conversations.some(c => c.id === payload.convId)) {
          showToast('Esta conversación ya existe en tu bóveda', 'warn');
          return;
        }

        const rootBytes = base64UrlToBytes(payload.root);
        const role = payload.youAre || 'bob';

        // Set chains
        const sendChain = await deriveInitialChain(
          rootBytes,
          role === 'bob' ? 'umbra-chain:bob' : 'umbra-chain:alice'
        );
        const recvChain = await deriveInitialChain(
          rootBytes,
          role === 'bob' ? 'umbra-chain:alice' : 'umbra-chain:bob'
        );

        const newConv: Conversation = {
          id: payload.convId,
          name: payload.name || 'Hilo compartido',
          isShared: true,
          sharedState: {
            rootKeyBase64: payload.root,
            myRole: role,
            sendChainBase64: bytesToBase64Url(sendChain),
            recvChainBase64: bytesToBase64Url(recvChain),
            nextSendSeq: 1,
            lastRecvSeq: 0
          },
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        onUpdateConversations([newConv, ...conversations]);
        setSelectedConvId(newConv.id);
        setShowImportModal(false);
        setImportText('');
        showToast('Invitación importada con éxito', 'success');
      } catch (err: any) {
        showToast('Error al importar invitación: ' + err.message, 'error');
      }
    } else if (raw.startsWith('UMBRA-PACK-1.')) {
      try {
        const b64 = raw.substring('UMBRA-PACK-1.'.length);
        const jsonStr = new TextDecoder().decode(base64UrlToBytes(b64));
        const payload = JSON.parse(jsonStr);

        if (payload.v !== 1 || payload.type !== 'pack' || !payload.convId || !Array.isArray(payload.items)) {
          throw new Error('Estructura de paquete inválida');
        }

        const targetConv = conversations.find(c => c.id === payload.convId);
        if (!targetConv || !targetConv.sharedState) {
          throw new Error('Conversación no encontrada en este dispositivo');
        }

        if (payload.fromRole === targetConv.sharedState.myRole) {
          throw new Error('Rechazado: el paquete fue emitido por este mismo dispositivo');
        }

        // Decrypt incoming items with Ratchet
        const rootBytes = base64UrlToBytes(targetConv.sharedState.rootKeyBase64);
        const peerRole = targetConv.sharedState.myRole === 'alice' ? 'bob' : 'alice';
        const peerChainLabel = peerRole === 'alice' ? 'umbra-chain:alice' : 'umbra-chain:bob';

        let peerChain = await deriveInitialChain(rootBytes, peerChainLabel);
        const newMessages = [...targetConv.messages];
        let importedCount = 0;

        for (const item of payload.items) {
          // Decrypt step
          const { text, nextChain } = await decryptRatchetMessage(peerChain, item.blob);
          peerChain = nextChain;

          // Check if already present by seq
          const exists = newMessages.some(m => m.seq === item.seq && m.sender === 'peer');
          if (!exists) {
            newMessages.push({
              id: 'm-in-' + item.seq + '-' + Math.random().toString(36).slice(2, 6),
              seq: item.seq,
              sender: 'peer',
              text,
              createdAt: item.createdAt || Date.now(),
              expiresAt: item.expiresAt || null
            });
            importedCount++;
          }
        }

        // Sort messages by sequence
        newMessages.sort((a, b) => a.seq - b.seq);

        const updatedConv: Conversation = {
          ...targetConv,
          messages: newMessages,
          updatedAt: Date.now()
        };

        const nextList = conversations.map(c => (c.id === updatedConv.id ? updatedConv : c));
        nextList.sort((a, b) => b.updatedAt - a.updatedAt);
        onUpdateConversations(nextList);

        setShowImportModal(false);
        setImportText('');
        showToast(`Paquete procesado: ${importedCount} mensaje(s) nuevos`, 'success');
      } catch (err: any) {
        showToast('Error al importar paquete: ' + err.message, 'error');
      }
    } else {
      showToast('Formato no reconocido. Debe iniciar con UMBRA-INVITE-1. o UMBRA-PACK-1.', 'warn');
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', position: 'relative' }}>
      {/* Thread List Pane */}
      <div style={{
        maxWidth: selectedConv ? '340px' : '100%',
        display: selectedConv && window.innerWidth < 768 ? 'none' : 'flex',
        flexDirection: 'column',
        height: '100%',
        borderRight: '1px solid #2a2b24',
        backgroundColor: '#0b0c0a',
        flexShrink: 0,
        width: selectedConv ? '320px' : '100%'
      }}>
        {/* Actions bar */}
        <div style={{
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #2a2b24',
          backgroundColor: '#141512'
        }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#ecece4' }}>Mensajes</h2>
            <div style={{ fontSize: '11px', color: '#8a8b84' }}>
              {conversations.length} {conversations.length === 1 ? 'conversación' : 'conversaciones'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowImportModal(true)}
              style={{
                backgroundColor: '#1c1d19',
                border: '1px solid #2a2b24',
                color: '#ecece4',
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Importar invitación o paquete"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 11 12 14 15 11" />
                <line x1="12" y1="2" x2="12" y2="14" />
                <path d="M20 21H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2z" />
              </svg>
              <span>Bandeja</span>
            </button>

            <button
              onClick={() => setShowNewModal(true)}
              style={{
                backgroundColor: '#ecece4',
                border: 'none',
                color: '#0b0c0a',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Nuevo hilo"
            >
              <span>+</span>
            </button>
          </div>
        </div>

        {/* Conversations list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {conversations.length === 0 ? (
            <div style={{
              padding: '48px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#1c1d19',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#8a8b84'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div style={{ fontSize: '15px', fontWeight: 500, color: '#ecece4' }}>Sin conversaciones</div>
              <div style={{ fontSize: '13px', color: '#8a8b84', maxWidth: '240px' }}>
                Crea un hilo local o invita a otro dispositivo con Umbra.
              </div>
            </div>
          ) : (
            conversations.map(conv => {
              const isSelected = conv.id === selectedConvId;
              const lastMsg = conv.messages[conv.messages.length - 1];

              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  style={{
                    padding: '14px 16px',
                    borderBottom: '1px solid #1c1d19',
                    backgroundColor: isSelected ? '#1c1d19' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    transition: 'background-color 0.15s ease'
                  }}
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    backgroundColor: conv.isShared ? '#22231e' : '#141512',
                    border: '1px solid #2a2b24',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: conv.isShared ? '#8faf89' : '#d4d0c4',
                    flexShrink: 0
                  }}>
                    {getInitials(conv.name)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 500, color: '#ecece4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conv.name}
                      </span>
                      <span style={{ fontSize: '11px', color: '#8a8b84', flexShrink: 0 }}>
                        {getRelativeTime(conv.updatedAt)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{
                        fontSize: '12px',
                        color: '#8a8b84',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1
                      }}>
                        {lastMsg ? lastMsg.text : (conv.isShared ? 'Listo para intercambiar' : 'Notas cifradas personales')}
                      </div>

                      <span style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: '#22231e',
                        color: conv.isShared ? '#8faf89' : '#8a8b84',
                        flexShrink: 0
                      }}>
                        {conv.isShared ? 'ratchet' : 'local'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Selected Conversation Detail */}
      {selectedConv ? (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          backgroundColor: '#0b0c0a'
        }}>
          {/* Thread Header */}
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#141512',
            borderBottom: '1px solid #2a2b24',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={() => setSelectedConvId(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#8a8b84',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px'
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>

              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#ecece4' }}>
                  {selectedConv.name}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: selectedConv.isShared ? '#8faf89' : '#8a8b84',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: selectedConv.isShared ? '#8faf89' : '#8a8b84'
                  }} />
                  <span>{selectedConv.isShared ? 'compartido · ratchet HMAC' : 'solo este dispositivo'}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {selectedConv.isShared && (
                <>
                  <button
                    onClick={handleCopyInvite}
                    style={{
                      backgroundColor: '#1c1d19',
                      border: '1px solid #2a2b24',
                      color: '#ecece4',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                    title="Copiar invitación (se limpia en 60s)"
                  >
                    Invitación
                  </button>
                  <button
                    onClick={handleGeneratePack}
                    style={{
                      backgroundColor: '#1c1d19',
                      border: '1px solid #2a2b24',
                      color: '#8faf89',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                    title="Generar paquete cifrado"
                  >
                    Exportar
                  </button>
                  <button
                    onClick={() => setShowImportModal(true)}
                    style={{
                      backgroundColor: '#1c1d19',
                      border: '1px solid #2a2b24',
                      color: '#ecece4',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                    title="Importar paquete recibido"
                  >
                    Importar
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Expiration Bar */}
          <div style={{
            padding: '6px 16px',
            backgroundColor: '#141512',
            borderBottom: '1px solid #1c1d19',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#8a8b84'
          }}>
            <span>Caducidad de mensajes:</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['none', '30s', '5m', '1h', '1d'] as const).map(opt => (
                <button
                  key={opt}
                  onClick={() => setExpiryOption(opt)}
                  style={{
                    background: expiryOption === opt ? '#22231e' : 'transparent',
                    border: '1px solid',
                    borderColor: expiryOption === opt ? '#8a8b84' : 'transparent',
                    color: expiryOption === opt ? '#ecece4' : '#8a8b84',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '10px',
                    cursor: 'pointer'
                  }}
                >
                  {opt === 'none' ? 'No' : opt}
                </button>
              ))}
            </div>
          </div>

          {/* Messages bubble list */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {selectedConv.messages.length === 0 ? (
              <div style={{
                margin: 'auto',
                textAlign: 'center',
                color: '#8a8b84',
                fontSize: '13px',
                maxWidth: '280px'
              }}>
                {selectedConv.isShared
                  ? 'Hilo cifrado punto a punto. Comparte una invitación o envía un mensaje y genera un paquete.'
                  : 'Este hilo es una nota personal cifrada. Esto nunca sale del dispositivo.'}
              </div>
            ) : (
              selectedConv.messages.map(msg => {
                const isMe = msg.sender === 'me';
                const remainingSec = msg.expiresAt ? Math.max(0, Math.floor((msg.expiresAt - Date.now()) / 1000)) : null;

                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isMe ? 'flex-end' : 'flex-start',
                      width: '100%'
                    }}
                  >
                    <div style={{
                      maxWidth: '82%',
                      backgroundColor: isMe ? '#22231e' : '#141512',
                      border: '1px solid #2a2b24',
                      borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      padding: '10px 14px',
                      color: '#ecece4',
                      fontSize: '14px',
                      lineHeight: 1.4,
                      wordBreak: 'break-word',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                    }}>
                      <div>{msg.text}</div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: '6px',
                        marginTop: '4px',
                        fontSize: '10px',
                        color: '#8a8b84'
                      }}>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>#{msg.seq}</span>
                        <span>•</span>
                        <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {remainingSec !== null && (
                          <span style={{ color: '#c4a56a', fontFamily: 'var(--font-mono)' }}>
                            ⌛ {remainingSec}s
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Message Input Box */}
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#141512',
            borderTop: '1px solid #2a2b24',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Escribe un mensaje cifrado..."
              style={{
                flex: 1,
                padding: '10px 14px',
                backgroundColor: '#1c1d19',
                border: '1px solid #2a2b24',
                borderRadius: '12px',
                color: '#ecece4',
                fontSize: '14px',
                outline: 'none'
              }}
            />

            <button
              onClick={handleSendMessage}
              disabled={!inputText.trim()}
              style={{
                backgroundColor: inputText.trim() ? '#ecece4' : '#1c1d19',
                color: inputText.trim() ? '#0b0c0a' : '#8a8b84',
                border: 'none',
                borderRadius: '12px',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: inputText.trim() ? 'pointer' : 'default',
                transition: 'all 0.15s ease'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          flex: 1,
          display: window.innerWidth < 768 ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#8a8b84',
          fontSize: '14px'
        }}>
          Selecciona una conversación o crea un nuevo hilo
        </div>
      )}

      {/* Modal: New Thread */}
      {showNewModal && (
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
            maxWidth: '380px',
            backgroundColor: '#141512',
            border: '1px solid #2a2b24',
            borderRadius: '20px',
            padding: '24px'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#ecece4', marginBottom: '16px' }}>
              Nuevo hilo cifrado
            </h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#8a8b84', marginBottom: '6px' }}>
                Nombre del hilo
              </label>
              <input
                type="text"
                value={newThreadName}
                onChange={e => setNewThreadName(e.target.value)}
                placeholder="Ana, trabajo, diario..."
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

            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px',
              backgroundColor: '#1c1d19',
              borderRadius: '10px',
              marginBottom: '20px'
            }}>
              <input
                type="checkbox"
                id="shareCheckbox"
                checked={isSharedThread}
                onChange={e => setIsSharedThread(e.target.checked)}
                style={{ marginTop: '2px', accentColor: '#8faf89' }}
              />
              <label htmlFor="shareCheckbox" style={{ fontSize: '13px', color: '#ecece4', cursor: 'pointer' }}>
                <div style={{ fontWeight: 500 }}>Compartir con otro dispositivo</div>
                <div style={{ fontSize: '11px', color: '#8a8b84', marginTop: '2px' }}>
                  {isSharedThread
                    ? 'Genera una cápsula de invitación para vincularse con Ratchet HMAC.'
                    : 'Esto nunca sale del dispositivo (notas cifradas personales).'}
                </div>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowNewModal(false)}
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
                onClick={handleCreateThread}
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
                Crear hilo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Import Invitation / Pack */}
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
            maxWidth: '420px',
            backgroundColor: '#141512',
            border: '1px solid #2a2b24',
            borderRadius: '20px',
            padding: '24px'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#ecece4', marginBottom: '12px' }}>
              Bandeja de importación
            </h3>
            <p style={{ fontSize: '12px', color: '#8a8b84', marginBottom: '14px' }}>
              Pega una invitación (<code>UMBRA-INVITE-1...</code>) o un paquete de mensajes cifrados (<code>UMBRA-PACK-1...</code>).
            </p>

            <textarea
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder="UMBRA-INVITE-1.... o UMBRA-PACK-1...."
              rows={5}
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: '#1c1d19',
                border: '1px solid #2a2b24',
                borderRadius: '10px',
                color: '#ecece4',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
                resize: 'none',
                marginBottom: '16px'
              }}
            />

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportText('');
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
                onClick={handleProcessImport}
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
                Procesar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Export Pack Dialog */}
      {showExportPackModal && (
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
              Paquete cifrado generado
            </h3>
            <p style={{ fontSize: '12px', color: '#8a8b84', marginBottom: '14px' }}>
              Copia este paquete y envíalo por cualquier medio (Signal, correo, QR). Solo el otro extremo con la clave de sesión podrá descifrarlo.
            </p>

            <textarea
              readOnly
              value={currentPackText}
              rows={6}
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: '#1c1d19',
                border: '1px solid #2a2b24',
                borderRadius: '10px',
                color: '#8faf89',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
                resize: 'none',
                marginBottom: '16px'
              }}
            />

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowExportPackModal(false)}
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
                  copyWithAutoClean(currentPackText, 60, 'Paquete copiado al portapapeles (se limpia en 60 s)');
                  setShowExportPackModal(false);
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
                Copiar paquete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
