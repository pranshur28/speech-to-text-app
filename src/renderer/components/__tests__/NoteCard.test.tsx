import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NoteCard } from '../NoteCard';

describe('NoteCard', () => {
  const mockNote = {
    id: 1,
    text: 'This is a test transcription',
    timestamp: new Date('2024-11-30T10:30:00').getTime(),
    isFavorite: false,
    tags: ['meeting', 'important'],
  };

  describe('Rendering', () => {
    it('should render note text preview', () => {
      render(<NoteCard {...mockNote} />);

      expect(screen.getByText(mockNote.text)).toBeInTheDocument();
    });

    it('should render formatted date', () => {
      render(<NoteCard {...mockNote} />);

      expect(screen.getByText(/Nov 30, 2024/)).toBeInTheDocument();
    });

    it('should render favorite button', () => {
      render(<NoteCard {...mockNote} />);

      const favoriteButton = screen.getByLabelText('Add to favorites');
      expect(favoriteButton).toBeInTheDocument();
    });

    it('should render tags when provided', () => {
      render(<NoteCard {...mockNote} />);

      expect(screen.getByText('meeting')).toBeInTheDocument();
      expect(screen.getByText('important')).toBeInTheDocument();
    });

    it('should not render tags section when no tags provided', () => {
      render(<NoteCard {...mockNote} tags={[]} />);

      const tagsContainer = document.querySelector('.note-card-tags');
      expect(tagsContainer).not.toBeInTheDocument();
    });

    it('should render tags section without tags prop', () => {
      const { tags, ...noteWithoutTags } = mockNote;
      render(<NoteCard {...noteWithoutTags} />);

      const tagsContainer = document.querySelector('.note-card-tags');
      expect(tagsContainer).not.toBeInTheDocument();
    });

    it('should truncate long text preview', () => {
      const longText = 'a'.repeat(200);
      render(<NoteCard {...mockNote} text={longText} />);

      const preview = screen.getByText(/a{150}\.\.\./);
      expect(preview).toBeInTheDocument();
      expect(preview.textContent).toHaveLength(153); // 150 + '...'
    });

    it('should not truncate short text', () => {
      const shortText = 'Short text';
      render(<NoteCard {...mockNote} text={shortText} />);

      expect(screen.getByText(shortText)).toBeInTheDocument();
      expect(screen.queryByText(/\.\.\./)).not.toBeInTheDocument();
    });
  });

  describe('Favorite State', () => {
    it('should show inactive favorite when isFavorite is false', () => {
      render(<NoteCard {...mockNote} isFavorite={false} />);

      const favoriteButton = screen.getByLabelText('Add to favorites');
      expect(favoriteButton).not.toHaveClass('note-card-favorite--active');
    });

    it('should show active favorite when isFavorite is true', () => {
      render(<NoteCard {...mockNote} isFavorite={true} />);

      const favoriteButton = screen.getByLabelText('Remove from favorites');
      expect(favoriteButton).toHaveClass('note-card-favorite--active');
    });

    it('should render filled star icon when favorited', () => {
      const { container } = render(<NoteCard {...mockNote} isFavorite={true} />);

      const svg = container.querySelector('.note-card-favorite svg');
      expect(svg).toHaveAttribute('fill', 'currentColor');
    });

    it('should render unfilled star icon when not favorited', () => {
      const { container } = render(<NoteCard {...mockNote} isFavorite={false} />);

      const svg = container.querySelector('.note-card-favorite svg');
      expect(svg).toHaveAttribute('fill', 'none');
    });
  });

  describe('User Interactions', () => {
    it('should call onClick when card is clicked', () => {
      const handleClick = jest.fn();
      render(<NoteCard {...mockNote} onClick={handleClick} />);

      const card = screen.getByRole('button', { name: /Note from/ });
      fireEvent.click(card);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should call onToggleFavorite when favorite button is clicked', () => {
      const handleToggleFavorite = jest.fn();
      render(<NoteCard {...mockNote} onToggleFavorite={handleToggleFavorite} />);

      const favoriteButton = screen.getByLabelText('Add to favorites');
      fireEvent.click(favoriteButton);

      expect(handleToggleFavorite).toHaveBeenCalledWith(mockNote.id);
      expect(handleToggleFavorite).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when favorite button is clicked', () => {
      const handleClick = jest.fn();
      const handleToggleFavorite = jest.fn();

      render(
        <NoteCard
          {...mockNote}
          onClick={handleClick}
          onToggleFavorite={handleToggleFavorite}
        />
      );

      const favoriteButton = screen.getByLabelText('Add to favorites');
      fireEvent.click(favoriteButton);

      expect(handleClick).not.toHaveBeenCalled();
      expect(handleToggleFavorite).toHaveBeenCalledTimes(1);
    });

    it('should handle onClick when Enter key is pressed', () => {
      const handleClick = jest.fn();
      render(<NoteCard {...mockNote} onClick={handleClick} />);

      const card = screen.getByRole('button', { name: /Note from/ });
      fireEvent.keyDown(card, { key: 'Enter' });

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should handle onClick when Space key is pressed', () => {
      const handleClick = jest.fn();
      render(<NoteCard {...mockNote} onClick={handleClick} />);

      const card = screen.getByRole('button', { name: /Note from/ });
      fireEvent.keyDown(card, { key: ' ' });

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick for other keys', () => {
      const handleClick = jest.fn();
      render(<NoteCard {...mockNote} onClick={handleClick} />);

      const card = screen.getByRole('button', { name: /Note from/ });
      fireEvent.keyDown(card, { key: 'a' });

      expect(handleClick).not.toHaveBeenCalled();
    });

    it('should not error if onClick is not provided', () => {
      render(<NoteCard {...mockNote} />);

      const card = screen.getByRole('button', { name: /Note from/ });

      expect(() => {
        fireEvent.click(card);
        fireEvent.keyDown(card, { key: 'Enter' });
      }).not.toThrow();
    });

    it('should not error if onToggleFavorite is not provided', () => {
      render(<NoteCard {...mockNote} />);

      const favoriteButton = screen.getByLabelText('Add to favorites');

      expect(() => {
        fireEvent.click(favoriteButton);
      }).not.toThrow();
    });
  });

  describe('Selection State', () => {
    it('should apply selected class when isSelected is true', () => {
      const { container } = render(<NoteCard {...mockNote} isSelected={true} />);

      const card = container.querySelector('.note-card');
      expect(card).toHaveClass('note-card--selected');
    });

    it('should not apply selected class when isSelected is false', () => {
      const { container } = render(<NoteCard {...mockNote} isSelected={false} />);

      const card = container.querySelector('.note-card');
      expect(card).not.toHaveClass('note-card--selected');
    });

    it('should not apply selected class by default', () => {
      const { container } = render(<NoteCard {...mockNote} />);

      const card = container.querySelector('.note-card');
      expect(card).not.toHaveClass('note-card--selected');
    });
  });

  describe('Accessibility', () => {
    it('should have proper role and tabIndex', () => {
      render(<NoteCard {...mockNote} />);

      const card = screen.getByRole('button', { name: /Note from/ });
      expect(card).toHaveAttribute('tabIndex', '0');
    });

    it('should have descriptive aria-label', () => {
      render(<NoteCard {...mockNote} />);

      const card = screen.getByLabelText(/Note from Nov 30, 2024/);
      expect(card).toBeInTheDocument();
    });

    it('should have aria-label for favorite button (not favorited)', () => {
      render(<NoteCard {...mockNote} isFavorite={false} />);

      const favoriteButton = screen.getByLabelText('Add to favorites');
      expect(favoriteButton).toBeInTheDocument();
    });

    it('should have aria-label for favorite button (favorited)', () => {
      render(<NoteCard {...mockNote} isFavorite={true} />);

      const favoriteButton = screen.getByLabelText('Remove from favorites');
      expect(favoriteButton).toBeInTheDocument();
    });

    it('should have aria-label for tags section', () => {
      render(<NoteCard {...mockNote} />);

      const tagsSection = screen.getByLabelText('Tags');
      expect(tagsSection).toBeInTheDocument();
    });

    it('should have type="button" on favorite button', () => {
      render(<NoteCard {...mockNote} />);

      const favoriteButton = screen.getByLabelText('Add to favorites') as HTMLButtonElement;
      expect(favoriteButton.type).toBe('button');
    });
  });

  describe('Date Formatting', () => {
    it('should format date in correct format', () => {
      const timestamp = new Date('2024-01-15T14:45:00').getTime();
      render(<NoteCard {...mockNote} timestamp={timestamp} />);

      expect(screen.getByText(/Jan 15, 2024 • 2:45/)).toBeInTheDocument();
    });

    it('should handle different timestamps', () => {
      const timestamp = new Date('2023-12-25T09:15:00').getTime();
      render(<NoteCard {...mockNote} timestamp={timestamp} />);

      expect(screen.getByText(/Dec 25, 2023 • 9:15/)).toBeInTheDocument();
    });
  });

  describe('Multiple Tags', () => {
    it('should render all provided tags', () => {
      const manyTags = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'];
      render(<NoteCard {...mockNote} tags={manyTags} />);

      manyTags.forEach(tag => {
        expect(screen.getByText(tag)).toBeInTheDocument();
      });
    });

    it('should render single tag', () => {
      render(<NoteCard {...mockNote} tags={['solo-tag']} />);

      expect(screen.getByText('solo-tag')).toBeInTheDocument();
    });
  });
});
