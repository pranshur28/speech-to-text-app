import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SearchBar } from '../SearchBar';

describe('SearchBar', () => {
  jest.useFakeTimers();

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Rendering', () => {
    it('should render with default placeholder', () => {
      const mockOnSearch = jest.fn();
      render(<SearchBar onSearch={mockOnSearch} />);

      const input = screen.getByPlaceholderText('Search transcriptions...');
      expect(input).toBeInTheDocument();
    });

    it('should render with custom placeholder', () => {
      const mockOnSearch = jest.fn();
      render(<SearchBar onSearch={mockOnSearch} placeholder="Find notes..." />);

      const input = screen.getByPlaceholderText('Find notes...');
      expect(input).toBeInTheDocument();
    });

    it('should render search icon', () => {
      const mockOnSearch = jest.fn();
      render(<SearchBar onSearch={mockOnSearch} />);

      const searchIcon = document.querySelector('.search-bar-icon');
      expect(searchIcon).toBeInTheDocument();
    });

    it('should show keyboard hint', () => {
      const mockOnSearch = jest.fn();
      render(<SearchBar onSearch={mockOnSearch} />);

      expect(screen.getByText(/Press/i)).toBeInTheDocument();
      expect(screen.getByText('⌘F')).toBeInTheDocument();
      expect(screen.getByText(/to focus/i)).toBeInTheDocument();
    });

    it('should not show clear button when input is empty', () => {
      const mockOnSearch = jest.fn();
      render(<SearchBar onSearch={mockOnSearch} />);

      const clearButton = document.querySelector('.search-bar-clear');
      expect(clearButton).not.toBeInTheDocument();
    });

    it('should show clear button when input has text', () => {
      const mockOnSearch = jest.fn();
      render(<SearchBar onSearch={mockOnSearch} />);

      const input = screen.getByPlaceholderText('Search transcriptions...');
      fireEvent.change(input, { target: { value: 'test query' } });

      const clearButton = document.querySelector('.search-bar-clear');
      expect(clearButton).toBeInTheDocument();
    });
  });

  describe('User Input', () => {
    it('should update input value on change', () => {
      const mockOnSearch = jest.fn();
      render(<SearchBar onSearch={mockOnSearch} />);

      const input = screen.getByPlaceholderText('Search transcriptions...') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'test query' } });

      expect(input.value).toBe('test query');
    });

    it('should clear input when clear button is clicked', () => {
      const mockOnSearch = jest.fn();
      render(<SearchBar onSearch={mockOnSearch} />);

      const input = screen.getByPlaceholderText('Search transcriptions...') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'test query' } });

      const clearButton = document.querySelector('.search-bar-clear') as HTMLButtonElement;
      fireEvent.click(clearButton);

      expect(input.value).toBe('');
    });

    it('should clear input and blur when Escape is pressed', () => {
      const mockOnSearch = jest.fn();
      render(<SearchBar onSearch={mockOnSearch} />);

      const input = screen.getByPlaceholderText('Search transcriptions...') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'test query' } });
      input.focus();

      fireEvent.keyDown(input, { key: 'Escape' });

      expect(input.value).toBe('');
      expect(input).not.toHaveFocus();
    });
  });

  describe('Debounced Search', () => {
    it('should call onSearch after debounce delay', async () => {
      const mockOnSearch = jest.fn();
      render(<SearchBar onSearch={mockOnSearch} debounceMs={300} />);

      const input = screen.getByPlaceholderText('Search transcriptions...');
      fireEvent.change(input, { target: { value: 'test' } });

      // Should not call immediately
      expect(mockOnSearch).not.toHaveBeenCalled();

      // Fast-forward time
      jest.advanceTimersByTime(300);

      // Should call after debounce
      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalledWith('test');
        expect(mockOnSearch).toHaveBeenCalledTimes(1);
      });
    });

    it('should debounce multiple rapid changes', async () => {
      const mockOnSearch = jest.fn();
      render(<SearchBar onSearch={mockOnSearch} debounceMs={300} />);

      const input = screen.getByPlaceholderText('Search transcriptions...');

      // Type rapidly
      fireEvent.change(input, { target: { value: 't' } });
      jest.advanceTimersByTime(100);

      fireEvent.change(input, { target: { value: 'te' } });
      jest.advanceTimersByTime(100);

      fireEvent.change(input, { target: { value: 'tes' } });
      jest.advanceTimersByTime(100);

      fireEvent.change(input, { target: { value: 'test' } });

      // Should not have called yet
      expect(mockOnSearch).not.toHaveBeenCalled();

      // Fast-forward to complete debounce
      jest.advanceTimersByTime(300);

      // Should only call once with final value
      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalledWith('test');
        expect(mockOnSearch).toHaveBeenCalledTimes(1);
      });
    });

    it('should use custom debounce delay', async () => {
      const mockOnSearch = jest.fn();
      render(<SearchBar onSearch={mockOnSearch} debounceMs={500} />);

      const input = screen.getByPlaceholderText('Search transcriptions...');
      fireEvent.change(input, { target: { value: 'test' } });

      // Should not call before custom delay
      jest.advanceTimersByTime(300);
      expect(mockOnSearch).not.toHaveBeenCalled();

      // Should call after custom delay
      jest.advanceTimersByTime(200);

      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalledWith('test');
      });
    });

    it('should call onSearch with empty string when cleared', async () => {
      const mockOnSearch = jest.fn();
      render(<SearchBar onSearch={mockOnSearch} debounceMs={300} />);

      const input = screen.getByPlaceholderText('Search transcriptions...');

      // Type something first
      fireEvent.change(input, { target: { value: 'test' } });
      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalledWith('test');
      });

      mockOnSearch.mockClear();

      // Clear the input
      const clearButton = document.querySelector('.search-bar-clear') as HTMLButtonElement;
      fireEvent.click(clearButton);

      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalledWith('');
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should focus input when Cmd+F is pressed', () => {
      const mockOnSearch = jest.fn();
      render(<SearchBar onSearch={mockOnSearch} />);

      const input = screen.getByPlaceholderText('Search transcriptions...') as HTMLInputElement;

      // Simulate Cmd+F
      fireEvent.keyDown(window, { key: 'f', metaKey: true });

      expect(input).toHaveFocus();
    });

    it('should focus input when Ctrl+F is pressed', () => {
      const mockOnSearch = jest.fn();
      render(<SearchBar onSearch={mockOnSearch} />);

      const input = screen.getByPlaceholderText('Search transcriptions...') as HTMLInputElement;

      // Simulate Ctrl+F
      fireEvent.keyDown(window, { key: 'f', ctrlKey: true });

      expect(input).toHaveFocus();
    });

    it('should prevent default browser search when Cmd+F is pressed', () => {
      const mockOnSearch = jest.fn();
      render(<SearchBar onSearch={mockOnSearch} />);

      const event = new KeyboardEvent('keydown', {
        key: 'f',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
      window.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('Auto Focus', () => {
    it('should auto focus when autoFocus prop is true', () => {
      const mockOnSearch = jest.fn();
      render(<SearchBar onSearch={mockOnSearch} autoFocus={true} />);

      const input = screen.getByPlaceholderText('Search transcriptions...') as HTMLInputElement;
      expect(input).toHaveFocus();
    });

    it('should not auto focus when autoFocus prop is false', () => {
      const mockOnSearch = jest.fn();
      render(<SearchBar onSearch={mockOnSearch} autoFocus={false} />);

      const input = screen.getByPlaceholderText('Search transcriptions...') as HTMLInputElement;
      expect(input).not.toHaveFocus();
    });

    it('should not auto focus by default', () => {
      const mockOnSearch = jest.fn();
      render(<SearchBar onSearch={mockOnSearch} />);

      const input = screen.getByPlaceholderText('Search transcriptions...') as HTMLInputElement;
      expect(input).not.toHaveFocus();
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label on input', () => {
      const mockOnSearch = jest.fn();
      render(<SearchBar onSearch={mockOnSearch} />);

      const input = screen.getByLabelText('Search transcriptions');
      expect(input).toBeInTheDocument();
    });

    it('should have proper aria-label on clear button', () => {
      const mockOnSearch = jest.fn();
      render(<SearchBar onSearch={mockOnSearch} />);

      const input = screen.getByPlaceholderText('Search transcriptions...');
      fireEvent.change(input, { target: { value: 'test' } });

      const clearButton = screen.getByLabelText('Clear search');
      expect(clearButton).toBeInTheDocument();
    });

    it('should have type="button" on clear button to prevent form submission', () => {
      const mockOnSearch = jest.fn();
      render(<SearchBar onSearch={mockOnSearch} />);

      const input = screen.getByPlaceholderText('Search transcriptions...');
      fireEvent.change(input, { target: { value: 'test' } });

      const clearButton = screen.getByLabelText('Clear search') as HTMLButtonElement;
      expect(clearButton.type).toBe('button');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup debounce timeout on unmount', () => {
      const mockOnSearch = jest.fn();
      const { unmount } = render(<SearchBar onSearch={mockOnSearch} debounceMs={300} />);

      const input = screen.getByPlaceholderText('Search transcriptions...');
      fireEvent.change(input, { target: { value: 'test' } });

      unmount();

      jest.advanceTimersByTime(300);

      // Should not call after unmount
      expect(mockOnSearch).not.toHaveBeenCalled();
    });

    it('should cleanup keyboard event listener on unmount', () => {
      const mockOnSearch = jest.fn();
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

      const { unmount } = render(<SearchBar onSearch={mockOnSearch} />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });
});
