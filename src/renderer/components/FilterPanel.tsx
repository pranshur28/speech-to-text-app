import React from 'react';
import * as Checkbox from '@radix-ui/react-checkbox';
import * as Label from '@radix-ui/react-label';

export interface FilterPanelProps {
  onFilterChange: (filters: {
    isFavorite?: boolean;
    startDate?: number;
    endDate?: number;
    tags?: string[];
  }) => void;
  availableTags?: string[];
  currentFilters: {
    isFavorite?: boolean;
    startDate?: number;
    endDate?: number;
    tags?: string[];
  };
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  onFilterChange,
  availableTags = [],
  currentFilters,
}) => {
  const handleFavoriteToggle = (checked: boolean) => {
    onFilterChange({
      ...currentFilters,
      isFavorite: checked ? true : undefined,
    });
  };

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    const timestamp = value ? new Date(value).getTime() : undefined;

    onFilterChange({
      ...currentFilters,
      [type === 'start' ? 'startDate' : 'endDate']: timestamp,
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

  const handleClearFilters = () => {
    onFilterChange({});
  };

  const hasActiveFilters =
    currentFilters.isFavorite ||
    currentFilters.startDate ||
    currentFilters.endDate ||
    (currentFilters.tags && currentFilters.tags.length > 0);

  return (
    <div className="filter-panel">
      <div className="filter-panel-header">
        <h3>Filters</h3>
        {hasActiveFilters && (
          <button
            className="filter-clear"
            onClick={handleClearFilters}
            type="button"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="filter-section">
        <div className="filter-checkbox-row">
          <Checkbox.Root
            className="checkbox-root"
            checked={currentFilters.isFavorite || false}
            onCheckedChange={handleFavoriteToggle}
            id="favorites-filter"
          >
            <Checkbox.Indicator className="checkbox-indicator">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </Checkbox.Indicator>
          </Checkbox.Root>
          <Label.Root className="checkbox-label" htmlFor="favorites-filter">
            Favorites only
          </Label.Root>
        </div>
      </div>

      <div className="filter-section">
        <h4>Date Range</h4>
        <div className="filter-date">
          <label className="filter-date-label">
            <span>From:</span>
            <input
              type="date"
              className="filter-date-input"
              value={
                currentFilters.startDate
                  ? new Date(currentFilters.startDate).toISOString().split('T')[0]
                  : ''
              }
              onChange={(e) => handleDateChange('start', e.target.value)}
            />
          </label>
          <label className="filter-date-label">
            <span>To:</span>
            <input
              type="date"
              className="filter-date-input"
              value={
                currentFilters.endDate
                  ? new Date(currentFilters.endDate).toISOString().split('T')[0]
                  : ''
              }
              onChange={(e) => handleDateChange('end', e.target.value)}
            />
          </label>
        </div>
      </div>

      {availableTags.length > 0 && (
        <div className="filter-section">
          <h4>Tags</h4>
          <div className="filter-tags">
            {availableTags.map((tag) => (
              <button
                key={tag}
                className={`filter-tag ${
                  currentFilters.tags?.includes(tag) ? 'filter-tag--active' : ''
                }`}
                onClick={() => handleTagToggle(tag)}
                type="button"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
