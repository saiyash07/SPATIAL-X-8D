import { useState, useEffect, useRef, useCallback } from 'react';
import { useMusic } from '../../engine/MusicContext';
import { getRecentSearches, deleteRecentSearch } from '../../services/searchService';

export default function SearchBar() {
  const { searchQuery, setSearchQuery, search, isSearching } = useMusic();
  const [inputValue, setInputValue] = useState('');
  const [recents, setRecents] = useState([]);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Sync state input with external changes
  useEffect(() => {
    setInputValue(searchQuery);
  }, [searchQuery]);

  // Load and refresh recents list
  const refreshRecents = useCallback(() => {
    setRecents(getRecentSearches());
  }, []);

  useEffect(() => {
    refreshRecents();
  }, [isSearching, refreshRecents]);

  const handleChange = useCallback((e) => {
    const val = e.target.value;
    setInputValue(val);
    setSearchQuery(val);

    clearTimeout(debounceRef.current);
    if (val.trim().length >= 2) {
      debounceRef.current = setTimeout(() => {
        search(val);
      }, 450);
    }
  }, [search, setSearchQuery]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      clearTimeout(debounceRef.current);
      search(inputValue);
      inputRef.current?.blur();
    }
  };

  const handleClear = () => {
    setInputValue('');
    setSearchQuery('');
    inputRef.current?.focus();
  };

  const handleRecentClick = (term) => {
    setInputValue(term);
    setSearchQuery(term);
    search(term);
  };

  const handleDeleteRecent = (e, term) => {
    e.stopPropagation();
    deleteRecentSearch(term);
    refreshRecents();
  };

  return (
    <div className="search-wrapper">
      <div className="search-label">Search Song</div>

      <div className="search-input-row">
        {/* Search icon or spinner */}
        <span className="search-icon">
          {isSearching ? '⏳' : '🔍'}
        </span>

        <input
          ref={inputRef}
          id="search-input"
          type="text"
          className="search-input"
          placeholder="Song name..."
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck="false"
        />

        <span className="search-badge-8d">8D AUTO</span>

        {inputValue && (
          <button
            className="search-clear"
            onClick={handleClear}
            title="Clear"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Persistent Recent searches list when search input is empty */}
      {!inputValue && recents.length > 0 && (
        <div style={{
          marginTop: '16px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '12px',
          padding: '12px',
        }}>
          <div style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '1.5px',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            marginBottom: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>Search History</span>
            <span style={{ fontSize: '9px', fontWeight: 'normal' }}>({recents.length})</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {recents.map((term) => (
              <div
                key={term}
                onClick={() => handleRecentClick(term)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                }}
                className="search-history-item-row"
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'none';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: '11px', opacity: 0.6 }}>🕐</span>
                  <span>{term}</span>
                </div>
                <button
                  onClick={(e) => handleDeleteRecent(e, term)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '11px',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.stopPropagation();
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                    e.currentTarget.style.color = '#ef4444';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'none';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }}
                  title={`Delete "${term}" from history`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
