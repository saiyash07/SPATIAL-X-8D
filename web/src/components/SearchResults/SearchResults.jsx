import { useState, useCallback } from 'react';
import { useMusic } from '../../engine/MusicContext';
import { usePlaylists } from '../../contexts/PlaylistContext';
import ContextMenu from '../ContextMenu/ContextMenu';
import { showToast } from '../../utils/toast';

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '–:––';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function SkeletonItem() {
  return (
    <div className="skeleton-item">
      <div className="skeleton" style={{ width: 50, height: 50, borderRadius: 8, flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="skeleton" style={{ height: 13, borderRadius: 4, width: '80%' }} />
        <div className="skeleton" style={{ height: 11, borderRadius: 4, width: '55%' }} />
      </div>
    </div>
  );
}

export default function SearchResults() {
  const {
    searchResults, isSearching, searchError, searchQuery,
    currentTrack, playTrack, addToQueue,
  } = useMusic();
  const { playlists, createPlaylist, addTrackToPlaylist } = usePlaylists();

  const [contextMenu, setContextMenu] = useState(null); // { track, x, y }

  const handleContextMenu = useCallback((e, track) => {
    e.preventDefault();
    setContextMenu({ track, x: e.clientX, y: e.clientY });
  }, []);

  const buildMenuItems = useCallback((track) => {
    const items = [
      {
        icon: '▶',
        label: 'Play now',
        onClick: () => {
          playTrack(track);
          showToast(`Playing ${track.title}`);
        },
      },
      {
        icon: '➕',
        label: 'Add to queue',
        onClick: () => {
          addToQueue(track);
          showToast('Added to queue');
        },
      },
    ];

    if (playlists.length > 0) {
      items.push({ divider: true });
      playlists.forEach(pl => {
        items.push({
          icon: '🎵',
          label: pl.name,
          suffix: `${pl.tracks.length}`,
          onClick: () => {
            const added = addTrackToPlaylist(pl.id, track);
            showToast(added ? `Added to ${pl.name}` : 'Already in playlist', added ? 'success' : 'info');
          },
        });
      });
    }

    items.push({ divider: true });
    items.push({
      icon: '✨',
      label: 'New playlist with this',
      onClick: () => {
        const name = prompt('Playlist name:');
        if (name?.trim()) {
          const pl = createPlaylist(name);
          addTrackToPlaylist(pl.id, track);
          showToast(`Created "${name}" with this track`);
        }
      },
    });

    return items;
  }, [playlists, playTrack, addToQueue, addTrackToPlaylist, createPlaylist]);

  if (isSearching) {
    return (
      <div className="results-container">
        <div className="results-section-label">Searching for "{searchQuery} 8D"...</div>
        {Array.from({ length: 6 }).map((_, i) => <SkeletonItem key={i} />)}
      </div>
    );
  }

  if (searchError) {
    return (
      <div className="results-container">
        <div className="search-error">
          <div className="search-error-icon">📡</div>
          <div className="search-error-text">{searchError}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 4 }}>
            Trying multiple servers... check your connection.
          </div>
        </div>
      </div>
    );
  }

  if (!searchQuery) {
    return (
      <div className="results-container">
        <div className="search-empty">
          <div className="search-empty-icon">🎧</div>
          <div className="search-empty-title">Search any song</div>
          <div className="search-empty-sub">
            Type a song name above.<br />
            We'll automatically find its<br />
            <strong style={{ color: 'var(--accent-bright)' }}>8D audio version</strong> for you.
          </div>
          <div style={{
            fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 4,
          }}>
            Tap ⋮ or right-click to add to queue or playlist
          </div>
        </div>
      </div>
    );
  }

  if (searchResults.length === 0) {
    return (
      <div className="results-container">
        <div className="search-empty">
          <div className="search-empty-icon">🔍</div>
          <div className="search-empty-title">No results</div>
          <div className="search-empty-sub">Try a different song name.</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="results-container">
        <div className="results-section-label">
          {searchResults.length} 8D results
          <span style={{ marginLeft: 6, fontSize: 9, opacity: 0.5 }}>tap ⋮ for options</span>
        </div>

        {searchResults.map((track, i) => {
          const isActive = currentTrack?.videoId === track.videoId;
          return (
            <div
              key={track.videoId + i}
              className={`result-item${isActive ? ' active' : ''}`}
              onClick={() => playTrack(track)}
              onContextMenu={(e) => handleContextMenu(e, track)}
              role="button"
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === 'Enter') playTrack(track);
                if (e.key === ' ') { e.preventDefault(); addToQueue(track); showToast('Added to queue'); }
              }}
              aria-label={`Play ${track.title}`}
              title="Click to play • Right-click for more options"
            >
              <div className="result-thumb-wrap">
                <img
                  className="result-thumb"
                  src={track.thumbnail}
                  alt={track.title}
                  loading="lazy"
                  onError={e => { e.target.style.display = 'none'; }}
                />
                <div className="result-play-overlay">
                  {isActive ? '🔊' : '▶'}
                </div>
              </div>

              <div className="result-info">
                <div className="result-title">{track.title}</div>
                <div className="result-meta">{track.channel}</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Add to queue button — visible on hover */}
                <button
                  className="result-queue-btn"
                  onClick={e => {
                    e.stopPropagation();
                    addToQueue(track);
                    showToast('Added to queue');
                  }}
                  title="Add to queue"
                  aria-label="Add to queue"
                  style={{
                    background: 'rgba(124,58,237,0.15)',
                    border: '1px solid rgba(124,58,237,0.25)',
                    borderRadius: 6,
                    color: 'var(--accent-bright)',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 700,
                    padding: '2px 7px',
                    opacity: 0,
                    transition: 'opacity 0.15s',
                    fontFamily: 'Outfit, sans-serif',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.3)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.15)'; }}
                >+</button>
                
                {/* Context Menu ⋮ Button */}
                <button
                  className="result-menu-trigger-btn"
                  onClick={e => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setContextMenu({ track, x: rect.left - 120, y: rect.bottom + 8 });
                  }}
                  title="Options"
                  aria-label="Options"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 6,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: 16,
                    padding: '1px 6px',
                    fontFamily: 'Outfit, sans-serif',
                  }}
                >⋮</button>
                
                <div className="result-duration">{track.durationStr}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CSS to show queue btn on hover */}
      <style>{`
        .result-item:hover .result-queue-btn { opacity: 1 !important; }
        .result-item.active .result-queue-btn { opacity: 0.7 !important; }
      `}</style>

      {/* Right-click Context Menu */}
      {contextMenu && (
        <ContextMenu
          items={buildMenuItems(contextMenu.track)}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
