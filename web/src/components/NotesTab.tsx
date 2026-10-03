import React, { useState, useEffect, useRef } from 'react';
import { NoteEntry } from '../types';
import { showToast } from './Toast';

interface NotesTabProps {
  notes: NoteEntry[];
  onUpdateNotes: (notes: NoteEntry[]) => void;
}

export const NotesTab: React.FC<NotesTabProps> = ({ notes, onUpdateNotes }) => {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Active editor state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [autoSaveIndicator, setAutoSaveIndicator] = useState<string | null>(null);

  const selectedNote = notes.find(n => n.id === selectedNoteId);

  // Sync state when selected note changes
  useEffect(() => {
    if (selectedNote) {
      setTitle(selectedNote.title);
      setContent(selectedNote.content);
      setAutoSaveIndicator(null);
    } else {
      setTitle('');
      setContent('');
      setAutoSaveIndicator(null);
    }
  }, [selectedNoteId]);

  // Debounced auto-save
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const triggerAutoSave = (newTitle: string, newContent: string) => {
    if (!selectedNoteId) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const now = Date.now();
      const updated = notes.map(n =>
        n.id === selectedNoteId
          ? {
              ...n,
              title: newTitle.trim(),
              content: newContent,
              updatedAt: now
            }
          : n
      );
      // Sort notes by updatedAt desc
      updated.sort((a, b) => b.updatedAt - a.updatedAt);
      onUpdateNotes(updated);
      setAutoSaveIndicator('Guardado en la bóveda.');
      setTimeout(() => setAutoSaveIndicator(null), 2500);
    }, 600);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    triggerAutoSave(val, content);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    triggerAutoSave(title, val);
  };

  const handleCreateNote = () => {
    const newNote: NoteEntry = {
      id: 'n-' + Math.random().toString(36).slice(2, 9),
      title: '',
      content: '',
      updatedAt: Date.now()
    };
    onUpdateNotes([newNote, ...notes]);
    setSelectedNoteId(newNote.id);
  };

  const handleDeleteNote = (id: string) => {
    if (window.confirm('¿Eliminar esta nota de la bóveda?')) {
      const filtered = notes.filter(n => n.id !== id);
      onUpdateNotes(filtered);
      if (selectedNoteId === id) {
        setSelectedNoteId(null);
      }
      showToast('Nota eliminada', 'info');
    }
  };

  const filteredNotes = notes.filter(n => {
    const q = searchTerm.toLowerCase();
    return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
  });

  return (
    <div style={{ display: 'flex', height: '100%', position: 'relative' }}>
      {/* List Pane */}
      <div style={{
        maxWidth: selectedNote ? '320px' : '100%',
        display: selectedNote && window.innerWidth < 768 ? 'none' : 'flex',
        flexDirection: 'column',
        height: '100%',
        borderRight: '1px solid #2a2b24',
        backgroundColor: '#0b0c0a',
        flexShrink: 0,
        width: selectedNote ? '320px' : '100%'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #2a2b24',
          backgroundColor: '#141512'
        }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#ecece4' }}>Notas</h2>
            <div style={{ fontSize: '11px', color: '#8a8b84' }}>
              {notes.length} {notes.length === 1 ? 'nota cifrada' : 'notas cifradas'}
            </div>
          </div>

          <button
            onClick={handleCreateNote}
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
            title="Nueva nota"
          >
            <span>+</span>
            <span>Nota</span>
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #1c1d19' }}>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar notas..."
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#141512',
              border: '1px solid #2a2b24',
              borderRadius: '10px',
              color: '#ecece4',
              fontSize: '13px',
              outline: 'none'
            }}
          />
        </div>

        {/* Notes Items List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredNotes.length === 0 ? (
            <div style={{
              padding: '48px 24px',
              textAlign: 'center',
              color: '#8a8b84',
              fontSize: '13px'
            }}>
              {searchTerm ? 'No se encontraron notas' : 'No hay notas. Crea una nueva.'}
            </div>
          ) : (
            filteredNotes.map(n => {
              const isSelected = n.id === selectedNoteId;
              const displayTitle = n.title.trim() || 'Sin título';
              const displaySnippet = n.content.trim().slice(0, 70) || 'Vacía';

              return (
                <div
                  key={n.id}
                  onClick={() => setSelectedNoteId(n.id)}
                  style={{
                    padding: '14px 16px',
                    borderBottom: '1px solid #1c1d19',
                    backgroundColor: isSelected ? '#1c1d19' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease'
                  }}
                >
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: n.title.trim() ? '#ecece4' : '#8a8b84',
                    marginBottom: '4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {displayTitle}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#8a8b84',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginBottom: '6px'
                  }}>
                    {displaySnippet}
                  </div>
                  <div style={{ fontSize: '10px', color: '#666860' }}>
                    {new Date(n.updatedAt).toLocaleDateString([], { day: '2-digit', month: 'short' })} • {new Date(n.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Editor Pane */}
      {selectedNote ? (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          backgroundColor: '#0b0c0a'
        }}>
          {/* Editor Header Bar */}
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
                onClick={() => setSelectedNoteId(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#8a8b84',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              {autoSaveIndicator && (
                <span style={{ fontSize: '12px', color: '#8faf89', fontFamily: 'var(--font-mono)' }}>
                  ✓ {autoSaveIndicator}
                </span>
              )}
            </div>

            <button
              onClick={() => handleDeleteNote(selectedNote.id)}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid #2a2b24',
                color: '#c45c4a',
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Eliminar nota"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              <span>Eliminar</span>
            </button>
          </div>

          {/* Title input */}
          <div style={{ padding: '16px 20px 8px 20px' }}>
            <input
              type="text"
              value={title}
              onChange={handleTitleChange}
              placeholder="Título de la nota..."
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: '#ecece4',
                fontSize: '20px',
                fontWeight: 600,
                outline: 'none',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Body Textarea */}
          <div style={{ flex: 1, padding: '0 20px 20px 20px', display: 'flex' }}>
            <textarea
              value={content}
              onChange={handleContentChange}
              placeholder="Escribe aquí tu nota cifrada..."
              style={{
                width: '100%',
                height: '100%',
                background: 'transparent',
                border: 'none',
                color: '#ecece4',
                fontSize: '15px',
                lineHeight: 1.6,
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit'
              }}
            />
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
          Selecciona una nota para editar o crea una nueva
        </div>
      )}
    </div>
  );
};
