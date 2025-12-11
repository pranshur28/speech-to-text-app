import React from 'react';
import { format } from 'date-fns';

export interface NoteCardProps {
  id: number;
  text: string;
  timestamp: number;
  isFavorite: boolean;
  tags?: string[];
  onClick?: () => void;
  onToggleFavorite?: (id: number) => void;
  isSelected?: boolean;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  id,
  text,
  timestamp,
  isFavorite,
  tags = [],
  onClick,
  onToggleFavorite,
  isSelected = false,
}) => {
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite?.(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  // Preview text (max 150 chars)
  const preview = text.length > 150 ? `${text.substring(0, 150)}...` : text;

  // Format date
  const formattedDate = format(new Date(timestamp), 'MMM d, yyyy • h:mm a');

  return (
    <div
      className={`note-card ${isSelected ? 'note-card--selected' : ''}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Note from ${formattedDate}`}
    >
      <div className="note-card-header">
        <span className="note-card-date">{formattedDate}</span>
        <button
          className={`note-card-favorite ${isFavorite ? 'note-card-favorite--active' : ''}`}
          onClick={handleFavoriteClick}
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          type="button"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill={isFavorite ? 'currentColor' : 'none'}
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M10 15.27L16.18 19l-1.64-7.03L20 7.24l-7.19-.61L10 0 7.19 6.63 0 7.24l5.46 4.73L3.82 19z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="note-card-preview">{preview}</div>

      {tags.length > 0 && (
        <div className="note-card-tags" aria-label="Tags">
          {tags.map((tag, index) => (
            <span key={index} className="note-card-tag">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
