import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import * as Dialog from '@radix-ui/react-dialog';

export interface NoteDetail {
  id: number;
  text: string;
  rawText: string;
  timestamp: number;
  isFavorite: boolean;
  tags?: string[];
}

export interface NoteDetailModalProps {
  note: NoteDetail | null;
  onClose: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}

export const NoteDetailModal: React.FC<NoteDetailModalProps> = ({
  note,
  onClose,
  onDelete,
  onToggleFavorite,
}) => {
  const [copied, setCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Reset transient button states when a different note opens
  useEffect(() => {
    setCopied(false);
    setConfirmingDelete(false);
  }, [note?.id]);

  const formattedDate = note
    ? format(new Date(note.timestamp), 'MMMM d, yyyy • h:mm a')
    : '';

  const handleCopy = async () => {
    if (!note) return;
    try {
      await navigator.clipboard.writeText(note.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const handleDelete = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    onDelete();
  };

  return (
    <Dialog.Root open={!!note} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal-content">
          <div className="modal-header">
            <div>
              <Dialog.Title className="modal-title">Transcription</Dialog.Title>
              <Dialog.Description className="modal-subtitle">{formattedDate}</Dialog.Description>
            </div>
            <div className="modal-header-actions">
              {note && (
                <button
                  className={`icon-btn ${note.isFavorite ? 'icon-btn--favorite' : ''}`}
                  onClick={onToggleFavorite}
                  aria-label={note.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  aria-pressed={note.isFavorite}
                  type="button"
                >
                  <svg viewBox="0 0 20 20" width="18" height="18" fill={note.isFavorite ? 'currentColor' : 'none'} aria-hidden="true">
                    <path d="M10 15.27L16.18 19l-1.64-7.03L20 7.24l-7.19-.61L10 0 7.19 6.63 0 7.24l5.46 4.73L3.82 19z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
              <Dialog.Close asChild>
                <button className="modal-close" aria-label="Close" type="button">×</button>
              </Dialog.Close>
            </div>
          </div>

          {note && (
            <>
              <div className="modal-body">
                {note.tags && note.tags.length > 0 && (
                  <div className="modal-tags">
                    {note.tags.map((tag, index) => (
                      <span key={index} className="chip">#{tag}</span>
                    ))}
                  </div>
                )}

                <p className="modal-text">{note.text}</p>

                {note.rawText !== note.text && (
                  <details className="modal-raw">
                    <summary>Original transcript</summary>
                    <p className="modal-text modal-text--muted">{note.rawText}</p>
                  </details>
                )}
              </div>

              <div className="modal-footer">
                <button
                  onClick={handleDelete}
                  onBlur={() => setConfirmingDelete(false)}
                  className={`btn ${confirmingDelete ? 'btn-danger' : 'btn-ghost'}`}
                  type="button"
                >
                  {confirmingDelete ? 'Click again to delete' : 'Delete'}
                </button>
                <button onClick={handleCopy} className={`btn ${copied ? 'btn-success' : 'btn-primary'}`} type="button">
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
