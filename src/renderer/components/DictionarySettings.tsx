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

interface KeytermSummary {
  count: number;
  estimatedTokens: number;
  dropped: number;
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
  const [keyterms, setKeyterms] = useState<KeytermSummary | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    setIsLoading(true);
    try {
      const [result, keytermResult] = await Promise.all([
        window.electronAPI.dictGetEntries(),
        window.electronAPI.dictGetKeyterms(),
      ]);
      if (result.success) {
        setEntries(result.entries);
      }
      if (keytermResult.success) {
        setKeyterms({
          count: keytermResult.terms.length,
          estimatedTokens: keytermResult.estimatedTokens,
          dropped: keytermResult.dropped,
        });
      }
    } catch (err) {
      console.error('Error loading dictionary entries:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhrase.trim() || !newReplacement.trim()) {
      setError('Both phrase and replacement are required');
      return;
    }

    const data = {
      spoken_phrase: newPhrase.trim(),
      replacement: newReplacement.trim(),
      is_case_sensitive: isCaseSensitive,
    };

    try {
      if (editingEntry) {
        await window.electronAPI.dictUpdateEntry(editingEntry.id, data);
      } else {
        const result = await window.electronAPI.dictAddEntry(data);
        if (!result.success) {
          setError(result.error || 'Failed to add entry');
          return;
        }
      }
      closeModal();
      loadEntries();
    } catch (err: any) {
      setError(err.message || 'Failed to save entry');
    }
  };

  const handleDeleteEntry = async (id: number) => {
    // Two-step delete: first click arms, second click deletes
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId((current) => (current === id ? null : current)), 3000);
      return;
    }
    setConfirmDeleteId(null);
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
    <section className="settings-section" aria-labelledby="settings-dictionary">
      <div className="section-heading-row">
        <h2 id="settings-dictionary" className="section-heading">Dictionary</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={openAddModal}>
          Add entry
        </button>
      </div>
      <p className="field-help">
        Replace what you say with your own text. Enabled entries are also sent to Deepgram as keyterms so names and
        jargon are recognized correctly. To just teach a word, add it with itself as the replacement
        (e.g. "Kubernetes" → "Kubernetes").
      </p>
      {keyterms && keyterms.count > 0 && (
        <p className={`field-help ${keyterms.dropped ? 'field-help--warning' : ''}`}>
          {keyterms.count} keyterm{keyterms.count === 1 ? '' : 's'} sent to Deepgram (~{keyterms.estimatedTokens} of 450 tokens)
          {keyterms.dropped > 0 && ` — ${keyterms.dropped} newer entr${keyterms.dropped === 1 ? 'y' : 'ies'} over the limit still apply as replacements but aren't sent as keyterms`}
        </p>
      )}

      {isLoading ? (
        <p className="empty-hint">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="empty-box">
          <p>No dictionary entries yet</p>
          <p className="field-help">Add your first replacement to get started.</p>
        </div>
      ) : (
        <ul className="dict-list">
          {entries.map((entry) => (
            <li key={entry.id} className={`dict-row ${entry.is_enabled ? '' : 'is-disabled'}`}>
              <div className="dict-row-main">
                <span className="dict-phrase" title={entry.spoken_phrase}>{entry.spoken_phrase}</span>
                <span className="dict-arrow" aria-hidden="true">→</span>
                <span className="dict-replacement" title={entry.replacement}>{entry.replacement}</span>
                {entry.is_case_sensitive ? <span className="badge">Aa</span> : null}
              </div>
              <div className="dict-row-actions">
                <Switch.Root
                  className="switch-root switch-root--sm"
                  checked={Boolean(entry.is_enabled)}
                  onCheckedChange={() => handleToggleEnabled(entry.id)}
                  aria-label={`${entry.is_enabled ? 'Disable' : 'Enable'} "${entry.spoken_phrase}"`}
                >
                  <Switch.Thumb className="switch-thumb" />
                </Switch.Root>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEditModal(entry)}>
                  Edit
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${confirmDeleteId === entry.id ? 'btn-danger' : 'btn-ghost'}`}
                  onClick={() => handleDeleteEntry(entry.id)}
                >
                  {confirmDeleteId === entry.id ? 'Confirm' : 'Delete'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add/Edit Modal */}
      <Dialog.Root open={isAddModalOpen || editingEntry !== null} onOpenChange={(open) => !open && closeModal()}>
        <Dialog.Portal>
          <Dialog.Overlay className="modal-overlay" />
          <Dialog.Content className="modal-content modal-content--narrow">
            <form onSubmit={handleSubmit}>
              <div className="modal-header">
                <Dialog.Title className="modal-title">
                  {editingEntry ? 'Edit entry' : 'Add entry'}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button className="modal-close" type="button" aria-label="Close">×</button>
                </Dialog.Close>
              </div>

              <div className="modal-body">
                <div className="field">
                  <label className="field-label" htmlFor="dict-phrase">When I say</label>
                  <input
                    id="dict-phrase"
                    type="text"
                    className="input"
                    placeholder="e.g. Kleene star"
                    value={newPhrase}
                    onChange={(e) => setNewPhrase(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="dict-replacement">Write</label>
                  <input
                    id="dict-replacement"
                    type="text"
                    className="input"
                    placeholder="e.g. K* (Unicode symbols are fine)"
                    value={newReplacement}
                    onChange={(e) => setNewReplacement(e.target.value)}
                  />
                </div>

                <div className="field field--row">
                  <div>
                    <label className="field-label" htmlFor="dict-case">Match case exactly</label>
                    <p className="field-help">When off, "kleene star" also matches "Kleene Star".</p>
                  </div>
                  <Switch.Root
                    id="dict-case"
                    className="switch-root"
                    checked={isCaseSensitive}
                    onCheckedChange={setIsCaseSensitive}
                  >
                    <Switch.Thumb className="switch-thumb" />
                  </Switch.Root>
                </div>

                {error && (
                  <div className="alert alert--error" role="alert">
                    <span>{error}</span>
                    <button type="button" className="alert-dismiss" onClick={() => setError(null)} aria-label="Dismiss">×</button>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={closeModal} type="button">
                  Cancel
                </button>
                <button className="btn btn-primary" type="submit">
                  {editingEntry ? 'Save changes' : 'Add entry'}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
};
