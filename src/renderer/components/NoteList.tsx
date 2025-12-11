import React, { useCallback } from 'react';
import { FixedSizeList } from 'react-window';
import { NoteCard } from './NoteCard';

export interface Note {
  id: number;
  text: string;
  timestamp: number;
  isFavorite: boolean;
  tags?: string[];
}

export interface NoteListProps {
  notes: Note[];
  onNoteClick: (note: Note) => void;
  onToggleFavorite: (id: number) => void;
  selectedNoteId?: number;
  height?: number;
  width?: string | number;
  itemHeight?: number;
  emptyMessage?: string;
}

export const NoteList: React.FC<NoteListProps> = ({
  notes,
  onNoteClick,
  onToggleFavorite,
  selectedNoteId,
  height = 600,
  width = '100%',
  itemHeight = 120,
  emptyMessage = 'No transcriptions found',
}) => {
  const Row = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const note = notes[index];

      return (
        <div style={style} className="note-list-item">
          <NoteCard
            id={note.id}
            text={note.text}
            timestamp={note.timestamp}
            isFavorite={note.isFavorite}
            tags={note.tags}
            onClick={() => onNoteClick(note)}
            onToggleFavorite={onToggleFavorite}
            isSelected={note.id === selectedNoteId}
          />
        </div>
      );
    },
    [notes, onNoteClick, onToggleFavorite, selectedNoteId]
  );

  if (notes.length === 0) {
    return (
      <div className="note-list-empty" role="status">
        <svg
          width="64"
          height="64"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="32"
            cy="32"
            r="30"
            stroke="currentColor"
            strokeWidth="2"
            opacity="0.2"
          />
          <path
            d="M32 20v16M32 44h.02"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="note-list" role="list" aria-label="Transcription notes">
      <FixedSizeList
        height={height}
        itemCount={notes.length}
        itemSize={itemHeight}
        width={width}
        overscanCount={5}
      >
        {Row}
      </FixedSizeList>
    </div>
  );
};
