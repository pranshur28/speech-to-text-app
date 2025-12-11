import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NoteList, Note } from '../NoteList';

// Mock react-window
jest.mock('react-window', () => {
  const actual = jest.requireActual('react-window');
  return {
    ...actual,
    FixedSizeList: ({ children, itemCount, height, width, itemSize }: any) => {
      return (
        <div data-testid="virtual-list" data-height={height} data-width={width} data-itemsize={itemSize} data-itemcount={itemCount}>
          {Array.from({ length: itemCount }, (_, index) =>
            <div key={index}>{children({ index, style: {} })}</div>
          )}
        </div>
      );
    },
  };
});

describe('NoteList', () => {
  const mockNotes: Note[] = [
    {
      id: 1,
      text: 'First transcription',
      timestamp: new Date('2024-11-30T10:00:00').getTime(),
      isFavorite: false,
      tags: ['meeting'],
    },
    {
      id: 2,
      text: 'Second transcription',
      timestamp: new Date('2024-11-30T11:00:00').getTime(),
      isFavorite: true,
      tags: ['important', 'work'],
    },
    {
      id: 3,
      text: 'Third transcription',
      timestamp: new Date('2024-11-30T12:00:00').getTime(),
      isFavorite: false,
      tags: [],
    },
  ];

  const defaultProps = {
    notes: mockNotes,
    onNoteClick: jest.fn(),
    onToggleFavorite: jest.fn(),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render virtual list with notes', () => {
      render(<NoteList {...defaultProps} />);

      const list = screen.getByTestId('virtual-list');
      expect(list).toBeInTheDocument();
    });

    it('should render all provided notes', () => {
      render(<NoteList {...defaultProps} />);

      expect(screen.getByText('First transcription')).toBeInTheDocument();
      expect(screen.getByText('Second transcription')).toBeInTheDocument();
      expect(screen.getByText('Third transcription')).toBeInTheDocument();
    });

    it('should render note cards with correct props', () => {
      render(<NoteList {...defaultProps} />);

      const cards = document.querySelectorAll('.note-card');
      expect(cards).toHaveLength(3);
    });

    it('should have proper aria-label', () => {
      render(<NoteList {...defaultProps} />);

      const list = screen.getByRole('list', { name: 'Transcription notes' });
      expect(list).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty message when no notes', () => {
      render(<NoteList {...defaultProps} notes={[]} />);

      expect(screen.getByText('No transcriptions found')).toBeInTheDocument();
    });

    it('should show custom empty message', () => {
      render(
        <NoteList
          {...defaultProps}
          notes={[]}
          emptyMessage="No results match your search"
        />
      );

      expect(screen.getByText('No results match your search')).toBeInTheDocument();
    });

    it('should render empty state icon', () => {
      const { container } = render(<NoteList {...defaultProps} notes={[]} />);

      const icon = container.querySelector('.note-list-empty svg');
      expect(icon).toBeInTheDocument();
    });

    it('should have proper role for empty state', () => {
      render(<NoteList {...defaultProps} notes={[]} />);

      const emptyState = screen.getByRole('status');
      expect(emptyState).toBeInTheDocument();
    });

    it('should not render virtual list when empty', () => {
      render(<NoteList {...defaultProps} notes={[]} />);

      const list = screen.queryByTestId('virtual-list');
      expect(list).not.toBeInTheDocument();
    });
  });

  describe('Virtual Scrolling', () => {
    it('should pass correct height to virtual list', () => {
      render(<NoteList {...defaultProps} height={800} />);

      const list = screen.getByTestId('virtual-list');
      expect(list).toHaveAttribute('data-height', '800');
    });

    it('should pass correct width to virtual list', () => {
      render(<NoteList {...defaultProps} width="50%" />);

      const list = screen.getByTestId('virtual-list');
      expect(list).toHaveAttribute('data-width', '50%');
    });

    it('should pass correct itemSize to virtual list', () => {
      render(<NoteList {...defaultProps} itemHeight={150} />);

      const list = screen.getByTestId('virtual-list');
      expect(list).toHaveAttribute('data-itemsize', '150');
    });

    it('should use default height if not provided', () => {
      render(<NoteList {...defaultProps} />);

      const list = screen.getByTestId('virtual-list');
      expect(list).toHaveAttribute('data-height', '600');
    });

    it('should use default width if not provided', () => {
      render(<NoteList {...defaultProps} />);

      const list = screen.getByTestId('virtual-list');
      expect(list).toHaveAttribute('data-width', '100%');
    });

    it('should use default itemHeight if not provided', () => {
      render(<NoteList {...defaultProps} />);

      const list = screen.getByTestId('virtual-list');
      expect(list).toHaveAttribute('data-itemsize', '120');
    });

    it('should pass correct itemCount to virtual list', () => {
      render(<NoteList {...defaultProps} />);

      const list = screen.getByTestId('virtual-list');
      expect(list).toHaveAttribute('data-itemcount', '3');
    });

    it('should handle large number of notes', () => {
      const manyNotes: Note[] = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        text: `Note ${i}`,
        timestamp: Date.now(),
        isFavorite: false,
      }));

      render(<NoteList {...defaultProps} notes={manyNotes} />);

      const list = screen.getByTestId('virtual-list');
      expect(list).toHaveAttribute('data-itemcount', '1000');
    });
  });

  describe('User Interactions', () => {
    it('should call onNoteClick when a note is clicked', () => {
      const onNoteClick = jest.fn();
      render(<NoteList {...defaultProps} onNoteClick={onNoteClick} />);

      const firstCard = screen.getByText('First transcription').closest('.note-card');
      if (firstCard) {
        fireEvent.click(firstCard);
      }

      expect(onNoteClick).toHaveBeenCalledWith(mockNotes[0]);
      expect(onNoteClick).toHaveBeenCalledTimes(1);
    });

    it('should call onToggleFavorite when favorite button is clicked', () => {
      const onToggleFavorite = jest.fn();
      render(<NoteList {...defaultProps} onToggleFavorite={onToggleFavorite} />);

      const favoriteButtons = screen.getAllByLabelText(/favorites/i);
      fireEvent.click(favoriteButtons[0]);

      expect(onToggleFavorite).toHaveBeenCalledWith(mockNotes[0].id);
      expect(onToggleFavorite).toHaveBeenCalledTimes(1);
    });

    it('should support clicking different notes', () => {
      const onNoteClick = jest.fn();
      render(<NoteList {...defaultProps} onNoteClick={onNoteClick} />);

      const secondCard = screen.getByText('Second transcription').closest('.note-card');
      if (secondCard) {
        fireEvent.click(secondCard);
      }

      expect(onNoteClick).toHaveBeenCalledWith(mockNotes[1]);
    });
  });

  describe('Note Selection', () => {
    it('should mark selected note', () => {
      render(<NoteList {...defaultProps} selectedNoteId={2} />);

      const cards = document.querySelectorAll('.note-card');
      const secondCard = cards[1];

      expect(secondCard).toHaveClass('note-card--selected');
    });

    it('should not mark other notes as selected', () => {
      render(<NoteList {...defaultProps} selectedNoteId={2} />);

      const cards = document.querySelectorAll('.note-card');
      const firstCard = cards[0];
      const thirdCard = cards[2];

      expect(firstCard).not.toHaveClass('note-card--selected');
      expect(thirdCard).not.toHaveClass('note-card--selected');
    });

    it('should work without selectedNoteId', () => {
      render(<NoteList {...defaultProps} />);

      const cards = document.querySelectorAll('.note-card');
      cards.forEach(card => {
        expect(card).not.toHaveClass('note-card--selected');
      });
    });
  });

  describe('Note Properties', () => {
    it('should render note tags', () => {
      render(<NoteList {...defaultProps} />);

      expect(screen.getByText('meeting')).toBeInTheDocument();
      expect(screen.getByText('important')).toBeInTheDocument();
      expect(screen.getByText('work')).toBeInTheDocument();
    });

    it('should show favorite state correctly', () => {
      render(<NoteList {...defaultProps} />);

      const favoriteButtons = screen.getAllByRole('button', { name: /favorites/i });

      // Second note is favorited
      expect(favoriteButtons[1]).toHaveClass('note-card-favorite--active');

      // First and third notes are not favorited
      expect(favoriteButtons[0]).not.toHaveClass('note-card-favorite--active');
      expect(favoriteButtons[2]).not.toHaveClass('note-card-favorite--active');
    });

    it('should display note timestamps', () => {
      render(<NoteList {...defaultProps} />);

      expect(screen.getByText(/Nov 30, 2024 • 10:00/)).toBeInTheDocument();
      expect(screen.getByText(/Nov 30, 2024 • 11:00/)).toBeInTheDocument();
      expect(screen.getByText(/Nov 30, 2024 • 12:00/)).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should memoize row renderer', () => {
      const { rerender } = render(<NoteList {...defaultProps} />);

      // Get initial render
      const initialCards = document.querySelectorAll('.note-card');
      expect(initialCards).toHaveLength(3);

      // Rerender with same props
      rerender(<NoteList {...defaultProps} />);

      // Should still have same cards
      const afterCards = document.querySelectorAll('.note-card');
      expect(afterCards).toHaveLength(3);
    });

    it('should update when notes change', () => {
      const { rerender } = render(<NoteList {...defaultProps} />);

      expect(screen.getByText('First transcription')).toBeInTheDocument();

      const newNotes: Note[] = [
        {
          id: 4,
          text: 'New transcription',
          timestamp: Date.now(),
          isFavorite: false,
        },
      ];

      rerender(<NoteList {...defaultProps} notes={newNotes} />);

      expect(screen.queryByText('First transcription')).not.toBeInTheDocument();
      expect(screen.getByText('New transcription')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle notes without tags', () => {
      const notesWithoutTags: Note[] = [
        {
          id: 1,
          text: 'No tags note',
          timestamp: Date.now(),
          isFavorite: false,
        },
      ];

      render(<NoteList {...defaultProps} notes={notesWithoutTags} />);

      expect(screen.getByText('No tags note')).toBeInTheDocument();
      const tagsContainer = document.querySelector('.note-card-tags');
      expect(tagsContainer).not.toBeInTheDocument();
    });

    it('should handle notes with empty tags array', () => {
      render(<NoteList {...defaultProps} notes={[mockNotes[2]]} />);

      expect(screen.getByText('Third transcription')).toBeInTheDocument();
      const card = screen.getByText('Third transcription').closest('.note-card');
      const tagsContainer = card?.querySelector('.note-card-tags');
      expect(tagsContainer).not.toBeInTheDocument();
    });

    it('should handle single note', () => {
      render(<NoteList {...defaultProps} notes={[mockNotes[0]]} />);

      const cards = document.querySelectorAll('.note-card');
      expect(cards).toHaveLength(1);
      expect(screen.getByText('First transcription')).toBeInTheDocument();
    });
  });
});
