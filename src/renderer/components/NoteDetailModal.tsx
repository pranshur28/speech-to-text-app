import React from 'react';
import { format } from 'date-fns';
import * as Dialog from '@radix-ui/react-dialog';

export interface NoteDetailModalProps {
  note: {
    id: number;
    text: string;
    rawText: string;
    timestamp: number;
    isFavorite: boolean;
    tags?: string[];
  } | null;
  onClose: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}

export const NoteDetailModal: React.FC<NoteDetailModalProps> = ({
  note,
  onClose,
  onCopy,
  onDelete,
  onToggleFavorite,
}) => {
  const formattedDate = note
    ? format(new Date(note.timestamp), 'MMMM d, yyyy • h:mm a')
    : '';

  return (
    <Dialog.Root open={!!note} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal-content">
          <div className="modal-header">
            <Dialog.Title className="modal-title">
              Transcription Details
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="modal-close"
                aria-label="Close modal"
                type="button"
              >
                ×
              </button>
            </Dialog.Close>
          </div>

          {note && (
            <>
              <div className="modal-body">
                <div className="modal-meta">
                  <span className="modal-date">{formattedDate}</span>
                  <button
                    className={`modal-favorite ${note.isFavorite ? 'modal-favorite--active' : ''}`}
                    onClick={onToggleFavorite}
                    aria-label={note.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    type="button"
                  >
                    ★
                  </button>
                </div>

                {note.tags && note.tags.length > 0 && (
                  <div className="modal-tags">
                    {note.tags.map((tag, index) => (
                      <span key={index} className="modal-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="modal-text">
                  <h3>Formatted Text</h3>
                  <p>{note.text}</p>
                </div>

                {note.rawText !== note.text && (
                  <div className="modal-text">
                    <h3>Original Text</h3>
                    <p>{note.rawText}</p>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button onClick={onCopy} className="modal-btn modal-btn--primary" type="button">
                  Copy
                </button>
                <button onClick={onDelete} className="modal-btn modal-btn--danger" type="button">
                  Delete
                </button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
