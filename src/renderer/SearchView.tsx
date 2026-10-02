import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SearchBar } from './components/SearchBar';
import { NoteList, Note } from './components/NoteList';
import { FilterPanel, Filters } from './components/FilterPanel';
import { NoteDetailModal, NoteDetail } from './components/NoteDetailModal';

// Row height for the virtualized list: date line + up to 3 lines of preview + spacing
const NOTE_ROW_HEIGHT = 112;

interface SearchViewProps {
  /** True while the History tab is visible; used to refresh after new dictations. */
  isActive: boolean;
}

// Track an element's height so the virtualized list fills the available space
function useElementHeight<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setHeight(Math.floor(entry.contentRect.height)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, height];
}

export const SearchView: React.FC<SearchViewProps> = ({ isActive }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNote, setSelectedNote] = useState<NoteDetail | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [availableTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [listRef, listHeight] = useElementHeight<HTMLDivElement>();

  // Load notes based on search query and filters
  const loadNotes = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = searchQuery
        ? await window.electronAPI.dbSearch(searchQuery, filters)
        : await window.electronAPI.dbGetTranscriptions(filters);

      if (result.success) {
        const formattedNotes: Note[] = result.transcriptions.map((t: any) => ({
          id: t.id,
          text: t.formatted_text,
          timestamp: t.timestamp,
          isFavorite: Boolean(t.is_favorite),
          tags: [], // Tags will be populated when we implement tag functionality
        }));
        setNotes(formattedNotes);
        setTotal('total' in result ? (result as { total: number }).total : formattedNotes.length);
      }
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filters]);

  // Reload when query/filters change or the tab becomes visible
  useEffect(() => {
    if (isActive) loadNotes();
  }, [loadNotes, isActive]);

  const handleNoteClick = async (note: Note) => {
    try {
      const result = await window.electronAPI.dbGetTranscription(note.id);
      if (result.success && result.transcription) {
        const t = result.transcription;
        setSelectedNote({
          id: t.id,
          text: t.formatted_text,
          rawText: t.raw_text,
          timestamp: t.timestamp,
          isFavorite: Boolean(t.is_favorite),
          tags: [],
        });
      }
    } catch (error) {
      console.error('Error loading note details:', error);
    }
  };

  const handleToggleFavorite = async (id: number) => {
    try {
      await window.electronAPI.dbToggleFavorite(id);
      loadNotes();
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedNote) return;
    try {
      await window.electronAPI.dbDeleteTranscription(selectedNote.id);
      setSelectedNote(null);
      loadNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const handleModalToggleFavorite = async () => {
    if (!selectedNote) return;
    await handleToggleFavorite(selectedNote.id);
    setSelectedNote({ ...selectedNote, isFavorite: !selectedNote.isFavorite });
  };

  const hasFilters = !!(searchQuery || filters.isFavorite || filters.startDate || filters.endDate);
  const countText = total === null
    ? ''
    : total > notes.length
      ? `Showing ${notes.length} of ${total}`
      : `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`;

  return (
    <div className="history">
      <div className="history-header">
        <h1 className="large-title">History</h1>
        <span className="history-count" aria-live="polite">{isLoading && notes.length === 0 ? 'Loading…' : countText}</span>
      </div>
      <div className="history-toolbar">
        <SearchBar onSearch={setSearchQuery} />
        <FilterPanel
          onFilterChange={setFilters}
          availableTags={availableTags}
          currentFilters={filters}
        />
      </div>


      <div className="history-list" ref={listRef}>
        {listHeight > 0 && (
          <NoteList
            notes={notes}
            onNoteClick={handleNoteClick}
            onToggleFavorite={handleToggleFavorite}
            selectedNoteId={selectedNote?.id}
            height={listHeight}
            itemHeight={NOTE_ROW_HEIGHT}
            emptyMessage={
              hasFilters
                ? searchQuery ? `No results for "${searchQuery}"` : 'No notes match these filters'
                : 'No transcriptions yet'
            }
          />
        )}
      </div>

      <NoteDetailModal
        note={selectedNote}
        onClose={() => setSelectedNote(null)}
        onDelete={handleDelete}
        onToggleFavorite={handleModalToggleFavorite}
      />
    </div>
  );
};
