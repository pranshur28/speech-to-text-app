import React from 'react';

export interface Filters {
  isFavorite?: boolean;
  startDate?: number;
  endDate?: number;
  tags?: string[];
}

export interface FilterPanelProps {
  onFilterChange: (filters: Filters) => void;
  availableTags?: string[];
  currentFilters: Filters;
}

// <input type="date"> values are local calendar days; convert to/from local timestamps
export function dayStart(value: string): number | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function dayEnd(value: string): number | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

export function toDateInput(timestamp?: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  onFilterChange,
  availableTags = [],
  currentFilters,
}) => {
  const handleFavoriteToggle = () => {
    onFilterChange({
      ...currentFilters,
      isFavorite: currentFilters.isFavorite ? undefined : true,
    });
  };

  const handleTagToggle = (tag: string) => {
    const currentTags = currentFilters.tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];

    onFilterChange({
      ...currentFilters,
      tags: newTags.length > 0 ? newTags : undefined,
    });
  };

  const hasActiveFilters =
    currentFilters.isFavorite ||
    currentFilters.startDate ||
    currentFilters.endDate ||
    (currentFilters.tags && currentFilters.tags.length > 0);

  return (
    <div className="filter-bar" role="group" aria-label="Filters">
      <button
        type="button"
        className={`chip ${currentFilters.isFavorite ? 'is-active' : ''}`}
        aria-pressed={!!currentFilters.isFavorite}
        onClick={handleFavoriteToggle}
      >
        <svg viewBox="0 0 20 20" width="14" height="14" fill={currentFilters.isFavorite ? 'currentColor' : 'none'} aria-hidden="true">
          <path d="M10 15.27L16.18 19l-1.64-7.03L20 7.24l-7.19-.61L10 0 7.19 6.63 0 7.24l5.46 4.73L3.82 19z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
        Favorites
      </button>

      <label className="date-field">
        <span>From</span>
        <input
          type="date"
          className="input input--compact"
          value={toDateInput(currentFilters.startDate)}
          max={toDateInput(currentFilters.endDate) || undefined}
          onChange={(e) => onFilterChange({ ...currentFilters, startDate: dayStart(e.target.value) })}
        />
      </label>

      <label className="date-field">
        <span>To</span>
        <input
          type="date"
          className="input input--compact"
          value={toDateInput(currentFilters.endDate)}
          min={toDateInput(currentFilters.startDate) || undefined}
          onChange={(e) => onFilterChange({ ...currentFilters, endDate: dayEnd(e.target.value) })}
        />
      </label>

      {availableTags.map((tag) => (
        <button
          key={tag}
          type="button"
          className={`chip ${currentFilters.tags?.includes(tag) ? 'is-active' : ''}`}
          aria-pressed={!!currentFilters.tags?.includes(tag)}
          onClick={() => handleTagToggle(tag)}
        >
          #{tag}
        </button>
      ))}

      {hasActiveFilters && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onFilterChange({})}>
          Clear
        </button>
      )}
    </div>
  );
};
