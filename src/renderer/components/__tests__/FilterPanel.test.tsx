import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterPanel, dayStart, dayEnd, toDateInput } from '../FilterPanel';

describe('date helpers', () => {
  test('dayStart is local midnight of the chosen day', () => {
    const ts = dayStart('2024-03-10')!;
    const d = new Date(ts);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2024, 2, 10, 0, 0]);
  });

  test('dayEnd includes the whole chosen day', () => {
    const d = new Date(dayEnd('2024-03-10')!);
    expect([d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([10, 23, 59, 59]);
  });

  test('round-trips through the date input format in local time', () => {
    expect(toDateInput(dayStart('2024-12-31'))).toBe('2024-12-31');
    expect(toDateInput(dayEnd('2024-01-01'))).toBe('2024-01-01');
  });

  test('empty values clear the filter', () => {
    expect(dayStart('')).toBeUndefined();
    expect(dayEnd('')).toBeUndefined();
    expect(toDateInput(undefined)).toBe('');
  });
});

describe('FilterPanel', () => {
  test('favorites chip toggles the favorite filter', () => {
    const onFilterChange = jest.fn();
    const { rerender } = render(<FilterPanel onFilterChange={onFilterChange} currentFilters={{}} />);

    const chip = screen.getByRole('button', { name: /Favorites/ });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(chip);
    expect(onFilterChange).toHaveBeenLastCalledWith({ isFavorite: true });

    rerender(<FilterPanel onFilterChange={onFilterChange} currentFilters={{ isFavorite: true }} />);
    fireEvent.click(screen.getByRole('button', { name: /Favorites/ }));
    expect(onFilterChange).toHaveBeenLastCalledWith({ isFavorite: undefined });
  });

  test('Clear only appears with active filters and resets them', () => {
    const onFilterChange = jest.fn();
    const { rerender } = render(<FilterPanel onFilterChange={onFilterChange} currentFilters={{}} />);
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();

    rerender(<FilterPanel onFilterChange={onFilterChange} currentFilters={{ startDate: 1 }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onFilterChange).toHaveBeenLastCalledWith({});
  });
});
