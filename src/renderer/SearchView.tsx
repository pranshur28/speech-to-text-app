import React, { useState, useEffect, useCallback } from 'react';
import { SearchBar } from './components/SearchBar';
import { NoteList, Note } from './components/NoteList';
import { FilterPanel } from './components/FilterPanel';
import { NoteDetailModal } from './components/NoteDetailModal';

interface SearchViewProps {
  onClose?: () => void;
}

export const SearchView: React.FC<SearchViewProps> = ({ onClose }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNote, setSelectedNote] = useState<any | null>(null);
  const [filters, setFilters] = useState<{
    isFavorite?: boolean;
    startDate?: number;
    endDate?: number;
    tags?: string[];
  }>({});
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
      }
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filters]);

  // Load notes when query or filters change
  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleNoteClick = async (note: Note) => {
    try {
      const result = await window.electronAPI.dbGetTranscription(note.id);
      if (result.success) {
        setSelectedNote({
          ...result.transcription,
          text: result.transcription.formatted_text,
          rawText: result.transcription.raw_text,
        });
      }
    } catch (error) {
      console.error('Error loading note details:', error);
    }
  };

  const handleToggleFavorite = async (id: number) => {
    try {
      await window.electronAPI.dbToggleFavorite(id);
      // Reload notes to reflect the change
      loadNotes();
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleCopy = () => {
    if (selectedNote) {
      navigator.clipboard.writeText(selectedNote.text);
      // Could add a toast notification here
    }
  };

  const handleDelete = async () => {
    if (selectedNote) {
      try {
        await window.electronAPI.dbDeleteTranscription(selectedNote.id);
        setSelectedNote(null);
        loadNotes();
      } catch (error) {
        console.error('Error deleting note:', error);
      }
    }
  };

  const handleModalToggleFavorite = async () => {
    if (selectedNote) {
      await handleToggleFavorite(selectedNote.id);
      // Update the selected note's favorite status
      setSelectedNote({
        ...selectedNote,
        isFavorite: !selectedNote.isFavorite,
      });
    }
  };

  return (
    <div className="search-view">
      <div className="search-view-header">
        <h1>Search Transcriptions</h1>
        {onClose && (
          <button onClick={onClose} className="search-view-close" type="button">
            ← Back to Recording
          </button>
        )}
      </div>

      <div className="search-view-main">
        <div className="search-view-sidebar">
          <FilterPanel
            onFilterChange={setFilters}
            availableTags={availableTags}
            currentFilters={filters}
          />
        </div>

        <div className="search-view-content">
          <SearchBar onSearch={setSearchQuery} />

          {isLoading ? (
            <div className="search-view-loading">Loading...</div>
          ) : (
            <NoteList
              notes={notes}
              onNoteClick={handleNoteClick}
              onToggleFavorite={handleToggleFavorite}
              selectedNoteId={selectedNote?.id}
              height={window.innerHeight - 200}
              emptyMessage={
                searchQuery
                  ? `No results found for "${searchQuery}"`
                  : 'No transcriptions yet'
              }
            />
          )}
        </div>
      </div>

      <NoteDetailModal
        note={selectedNote}
        onClose={() => setSelectedNote(null)}
        onCopy={handleCopy}
        onDelete={handleDelete}
        onToggleFavorite={handleModalToggleFavorite}
      />
    </div>
  );
};
