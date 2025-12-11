import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Switch from '@radix-ui/react-switch';

interface DictionaryEntry {
  id: number;
  spoken_phrase: string;
  replacement: string;
  is_case_sensitive: number;
  is_enabled: number;
  created_at: number;
  updated_at: number;
}

export const DictionarySettings: React.FC = () => {
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DictionaryEntry | null>(null);
  const [newPhrase, setNewPhrase] = useState('');
  const [newReplacement, setNewReplacement] = useState('');
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.dictGetEntries();
      if (result.success) {
        setEntries(result.entries);
      }
    } catch (err) {
      console.error('Error loading dictionary entries:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddEntry = async () => {
    if (!newPhrase.trim() || !newReplacement.trim()) {
      setError('Both phrase and replacement are required');
      return;
    }

    try {
      const result = await window.electronAPI.dictAddEntry({
        spoken_phrase: newPhrase.trim(),
        replacement: newReplacement.trim(),
        is_case_sensitive: isCaseSensitive,
      });

      if (result.success) {
        closeModal();
        loadEntries();
      } else {
        setError(result.error || 'Failed to add entry');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add entry');
    }
  };

  const handleUpdateEntry = async () => {
    if (!editingEntry) return;
    if (!newPhrase.trim() || !newReplacement.trim()) {
      setError('Both phrase and replacement are required');
      return;
    }

    try {
      await window.electronAPI.dictUpdateEntry(editingEntry.id, {
        spoken_phrase: newPhrase.trim(),
        replacement: newReplacement.trim(),
        is_case_sensitive: isCaseSensitive,
      });

      closeModal();
      loadEntries();
    } catch (err: any) {
      setError(err.message || 'Failed to update entry');
    }
  };

  const handleDeleteEntry = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;

    try {
      await window.electronAPI.dictDeleteEntry(id);
      loadEntries();
    } catch (err) {
      console.error('Error deleting entry:', err);
    }
  };

  const handleToggleEnabled = async (id: number) => {
    try {
      await window.electronAPI.dictToggleEnabled(id);
      loadEntries();
    } catch (err) {
      console.error('Error toggling entry:', err);
    }
  };

  const openEditModal = (entry: DictionaryEntry) => {
    setEditingEntry(entry);
    setNewPhrase(entry.spoken_phrase);
    setNewReplacement(entry.replacement);
    setIsCaseSensitive(Boolean(entry.is_case_sensitive));
    setError(null);
  };

  const openAddModal = () => {
    setIsAddModalOpen(true);
    setNewPhrase('');
    setNewReplacement('');
    setIsCaseSensitive(false);
    setError(null);
  };

  const closeModal = () => {
    setIsAddModalOpen(false);
    setEditingEntry(null);
    setNewPhrase('');
    setNewReplacement('');
    setIsCaseSensitive(false);
    setError(null);
  };

  return (
    <div className="setting-group">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <label className="setting-label" style={{ marginBottom: 0 }}>Custom Dictionary</label>
        <button
          className="btn-primary"
          style={{ width: 'auto', marginTop: 0, padding: '8px 16px', fontSize: '13px' }}
          onClick={openAddModal}
        >
          + Add Entry
        </button>
      </div>
      <div className="setting-description" style={{ marginBottom: '16px' }}>
        Define custom phrase replacements. When you say a phrase, it will be replaced with your custom text.
      </div>

      {isLoading ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading...
        </div>
      ) : entries.length === 0 ? (
        <div style={{
          padding: '24px',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          background: 'var(--glass-bg-light)',
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--glass-border-subtle)'
        }}>
          <div style={{ marginBottom: '8px' }}>No dictionary entries yet</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Add your first custom replacement to get started
          </div>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxHeight: '280px',
          overflowY: 'auto',
          paddingRight: '4px'
        }}>
          {entries.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px',
                background: 'var(--glass-bg-light)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--glass-border-subtle)',
                opacity: entry.is_enabled ? 1 : 0.5,
                transition: 'opacity 0.15s ease'
              }}
            >
              <div style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '4px'
                }}>
                  <span style={{
                    color: 'var(--text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '120px'
                  }} title={entry.spoken_phrase}>
                    "{entry.spoken_phrase}"
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>→</span>
                  <span style={{
                    color: 'var(--accent-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '120px'
                  }} title={entry.replacement}>
                    "{entry.replacement}"
                  </span>
                </div>
                {entry.is_case_sensitive ? (
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Case-sensitive
                  </span>
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                <Switch.Root
                  className="switch-root"
                  checked={Boolean(entry.is_enabled)}
                  onCheckedChange={() => handleToggleEnabled(entry.id)}
                  style={{ width: '36px', height: '20px' }}
                >
                  <Switch.Thumb className="switch-thumb" style={{ width: '16px', height: '16px' }} />
                </Switch.Root>
                <button
                  className="reset-btn"
                  onClick={() => openEditModal(entry)}
                  title="Edit"
                  style={{ padding: '6px' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  className="reset-btn"
                  onClick={() => handleDeleteEntry(entry.id)}
                  title="Delete"
                  style={{ padding: '6px', color: 'var(--accent-danger)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog.Root open={isAddModalOpen || editingEntry !== null} onOpenChange={(open) => !open && closeModal()}>
        <Dialog.Portal>
          <Dialog.Overlay className="modal-overlay" />
          <Dialog.Content className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <Dialog.Title className="modal-title">
                {editingEntry ? 'Edit Dictionary Entry' : 'Add Dictionary Entry'}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button className="modal-close" type="button">×</button>
              </Dialog.Close>
            </div>

            <div className="modal-body" style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label className="setting-label" style={{ fontSize: '13px' }}>Spoken Phrase</label>
                <input
                  type="text"
                  className="setting-input"
                  placeholder="e.g., Kleene Star"
                  value={newPhrase}
                  onChange={(e) => setNewPhrase(e.target.value)}
                  autoFocus
                />
                <div className="setting-description" style={{ marginTop: '4px' }}>
                  The phrase as you speak it
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="setting-label" style={{ fontSize: '13px' }}>Replacement Text</label>
                <input
                  type="text"
                  className="setting-input"
                  placeholder="e.g., K* or ∗"
                  value={newReplacement}
                  onChange={(e) => setNewReplacement(e.target.value)}
                />
                <div className="setting-description" style={{ marginTop: '4px' }}>
                  The text to replace it with (supports Unicode symbols)
                </div>
              </div>

              <div className="switch-row" style={{ marginBottom: '8px' }}>
                <label className="switch-label" style={{ fontSize: '13px' }}>Case Sensitive</label>
                <Switch.Root
                  className="switch-root"
                  checked={isCaseSensitive}
                  onCheckedChange={setIsCaseSensitive}
                >
                  <Switch.Thumb className="switch-thumb" />
                </Switch.Root>
              </div>
              <div className="setting-description">
                When off, "kleene star" will match "Kleene Star"
              </div>

              {error && (
                <div className="error-message" style={{ marginTop: '16px' }}>
                  {error}
                  <button
                    onClick={() => setError(null)}
                    style={{
                      marginLeft: '8px',
                      background: 'none',
                      border: 'none',
                      color: 'inherit',
                      cursor: 'pointer'
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ padding: '16px 20px', gap: '12px' }}>
              <button
                className="modal-btn"
                onClick={closeModal}
                type="button"
                style={{ background: 'var(--bg-tertiary)', flex: 1 }}
              >
                Cancel
              </button>
              <button
                className="modal-btn modal-btn--primary"
                onClick={editingEntry ? handleUpdateEntry : handleAddEntry}
                type="button"
                style={{ flex: 1 }}
              >
                {editingEntry ? 'Save Changes' : 'Add Entry'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
};
