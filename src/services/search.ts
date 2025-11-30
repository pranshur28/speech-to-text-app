import { DatabaseService, Transcription, TranscriptionFilters } from './database';

export interface SearchOptions {
  query: string;
  filters?: {
    startDate?: Date;
    endDate?: Date;
    isFavorite?: boolean;
    tags?: string[];
  };
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  transcriptions: Transcription[];
  total: number;
  hasMore: boolean;
}

export class SearchService {
  constructor(private db: DatabaseService) {}

  /**
   * Parse a search query that may include special filters
   * Examples:
   *   - "meeting notes tag:work"
   *   - "budget #finance date:today"
   *   - "fav:true sarah"
   */
  parseQuery(rawQuery: string): { searchText: string; filters: TranscriptionFilters } {
    let searchText = rawQuery;
    const filters: TranscriptionFilters = {};

    // Extract tag filters (tag:work or #work)
    const tagMatches = rawQuery.match(/(?:tag:|#)(\w+)/g);
    if (tagMatches) {
      filters.tags = tagMatches.map(match => match.replace(/^(?:tag:|#)/, '').toLowerCase());
      searchText = searchText.replace(/(?:tag:|#)\w+/g, '').trim();
    }

    // Extract favorite filter (fav:true or fav:false)
    const favMatch = rawQuery.match(/fav:(true|false)/i);
    if (favMatch) {
      filters.isFavorite = favMatch[1].toLowerCase() === 'true';
      searchText = searchText.replace(/fav:(true|false)/i, '').trim();
    }

    // Extract date filters
    const dateMatch = rawQuery.match(/date:(\w+)/i);
    if (dateMatch) {
      const dateFilter = dateMatch[1].toLowerCase();
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

      switch (dateFilter) {
        case 'today':
          filters.startDate = startOfToday;
          break;
        case 'week':
          filters.startDate = startOfWeek;
          break;
        case 'month':
          filters.startDate = startOfMonth;
          break;
      }

      searchText = searchText.replace(/date:\w+/i, '').trim();
    }

    return { searchText, filters };
  }

  /**
   * Search transcriptions with full-text search and filters
   */
  search(options: SearchOptions): SearchResult {
    const { query, filters: userFilters, limit = 50, offset = 0 } = options;

    // Parse query to extract filters
    const { searchText, filters: parsedFilters } = this.parseQuery(query);

    // Merge user filters with parsed filters
    const combinedFilters: TranscriptionFilters = {
      ...parsedFilters,
      limit,
      offset
    };

    if (userFilters) {
      if (userFilters.startDate) {
        combinedFilters.startDate = userFilters.startDate.getTime();
      }
      if (userFilters.endDate) {
        combinedFilters.endDate = userFilters.endDate.getTime();
      }
      if (userFilters.isFavorite !== undefined) {
        combinedFilters.isFavorite = userFilters.isFavorite;
      }
      if (userFilters.tags) {
        combinedFilters.tags = [...(combinedFilters.tags || []), ...userFilters.tags];
      }
    }

    // Perform search
    const transcriptions = searchText.trim()
      ? this.db.searchTranscriptions(searchText, combinedFilters)
      : this.db.getTranscriptions(combinedFilters);

    // Get total count (for pagination)
    const total = this.db.getStats().total;

    return {
      transcriptions,
      total,
      hasMore: offset + transcriptions.length < total
    };
  }

  /**
   * Get recent transcriptions (no search query)
   */
  getRecent(limit: number = 20, offset: number = 0): Transcription[] {
    return this.db.getTranscriptions({ limit, offset });
  }

  /**
   * Get favorite transcriptions
   */
  getFavorites(limit: number = 50, offset: number = 0): Transcription[] {
    return this.db.getTranscriptions({ isFavorite: true, limit, offset });
  }

  /**
   * Get transcriptions by date range
   */
  getByDateRange(startDate: Date, endDate: Date, limit: number = 100): Transcription[] {
    return this.db.getTranscriptions({
      startDate: startDate.getTime(),
      endDate: endDate.getTime(),
      limit
    });
  }
}
