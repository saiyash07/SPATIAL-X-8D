import { useState } from 'react';
import { usePlaylists } from '../../contexts/PlaylistContext';
import { useMusic } from '../../engine/MusicContext';
import { showToast } from '../../utils/toast';

function formatCount(n) {
  return n === 1 ? '1 track' : `${n} tracks`;
}

function CreatePlaylistModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
    }}
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'rgba(20,20,36,0.97)',
        border: '1px solid rgba(124,58,237,0.25)',
        borderRadius: 20,
        padding: 28,
        width: 320,
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        animation: 'modal-in 0.25s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
          🎵 New Playlist
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>
          Give your playlist a name
        </div>
        <input
          autoFocus
          type="text"
          placeholder="My 8D Playlist..."
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && name.trim()) { onCreate(name); onClose(); }
            if (e.key === 'Escape') onClose();
          }}
          style={{
            width: '100%', padding: '10px 14px',
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(124,58,237,0.35)',
            borderRadius: 10, color: '#fff',
            fontSize: 14, fontFamily: 'Outfit, sans-serif',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '9px', borderRadius: 10,
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)', fontSize: 13,
              fontFamily: 'Outfit, sans-serif', cursor: 'pointer',
            }}
          >Cancel</button>
          <button
            onClick={() => { if (name.trim()) { onCreate(name); onClose(); } }}
            disabled={!name.trim()}
            style={{
              flex: 1, padding: '9px', borderRadius: 10,
              background: name.trim()
                ? 'linear-gradient(135deg, #7C3AED, #9D5CFF)'
                : 'rgba(124,58,237,0.2)',
              border: 'none', color: '#fff', fontSize: 13,
              fontFamily: 'Outfit, sans-serif', fontWeight: 600,
              cursor: name.trim() ? 'pointer' : 'not-allowed',
            }}
          >Create</button>
        </div>
      </div>
      <style>{`
        @keyframes modal-in {
          from { opacity:0; transform: scale(0.9) translateY(10px); }
          to   { opacity:1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

function PlaylistDetail({ playlist, onBack }) {
  const { removeTrackFromPlaylist, deletePlaylist } = usePlaylists();
  const { playTrack, addToQueue } = useMusic();

  const handleDelete = () => {
    if (confirm(`Delete "${playlist.name}"?`)) {
      deletePlaylist(playlist.id);
      onBack();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', fontSize: 20, padding: '2px 6px',
            display: 'flex', alignItems: 'center',
          }}
          title="Back"
        >←</button>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {playlist.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {formatCount(playlist.tracks.length)}
          </div>
        </div>
        <button
          onClick={handleDelete}
          style={{
            background: 'none', border: 'none', color: 'rgba(248,113,113,0.7)',
            cursor: 'pointer', fontSize: 14, padding: '4px 6px',
          }}
          title="Delete playlist"
        >🗑</button>
      </div>

      {/* Tracks */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
        {playlist.tracks.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 10, padding: '40px 20px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, opacity: 0.4 }}>🎵</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              No tracks yet.<br />Right-click a search result to add.
            </div>
          </div>
        ) : (
          playlist.tracks.map((track, i) => (
            <div
              key={track.videoId + i}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 6px', borderRadius: 10, cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <img
                src={track.thumbnail}
                alt={track.title}
                style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                onError={e => { e.target.style.display = 'none'; }}
              />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {track.title}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{track.channel}</div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => { playTrack(track); showToast('Playing now'); }}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-bright)', cursor: 'pointer', fontSize: 14, padding: '2px' }}
                  title="Play"
                >▶</button>
                <button
                  onClick={() => { addToQueue(track); showToast('Added to queue'); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: '2px' }}
                  title="Add to queue"
                >+</button>
                <button
                  onClick={() => removeTrackFromPlaylist(playlist.id, track.videoId)}
                  style={{ background: 'none', border: 'none', color: 'rgba(248,113,113,0.6)', cursor: 'pointer', fontSize: 12, padding: '2px' }}
                  title="Remove"
                >✕</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Play all button */}
      {playlist.tracks.length > 0 && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <button
            onClick={() => {
              if (playlist.tracks.length > 0) {
                playTrack(playlist.tracks[0]);
                // Add rest to queue
                playlist.tracks.slice(1).forEach(t => addToQueue(t));
                showToast(`Playing ${playlist.name}`);
              }
            }}
            style={{
              width: '100%', padding: '9px',
              background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(14,165,233,0.2))',
              border: '1px solid rgba(124,58,237,0.3)',
              borderRadius: 10, color: 'var(--accent-bright)',
              fontSize: 13, fontWeight: 600, fontFamily: 'Outfit, sans-serif',
              cursor: 'pointer',
            }}
          >
            ▶ Play All ({playlist.tracks.length})
          </button>
        </div>
      )}
    </div>
  );
}

export default function PlaylistManager() {
  const { playlists, createPlaylist } = usePlaylists();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);

  // If viewing a specific playlist, find its latest version (tracks may have changed)
  const livePlaylist = selectedPlaylist
    ? playlists.find(p => p.id === selectedPlaylist.id)
    : null;

  if (livePlaylist) {
    return (
      <>
        <PlaylistDetail
          playlist={livePlaylist}
          onBack={() => setSelectedPlaylist(null)}
        />
        {showCreate && (
          <CreatePlaylistModal
            onClose={() => setShowCreate(false)}
            onCreate={(name) => {
              createPlaylist(name);
              showToast('Playlist created!');
            }}
          />
        )}
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '2px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Your Library
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {playlists.length === 0 ? 'No playlists yet' : `${playlists.length} playlist${playlists.length !== 1 ? 's' : ''}`}
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          title="Create playlist"
          style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'linear-gradient(135deg, rgba(124,58,237,0.4), rgba(14,165,233,0.3))',
            border: '1px solid rgba(124,58,237,0.3)',
            color: 'var(--accent-bright)', fontSize: 18, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >+</button>
      </div>

      {/* Playlist list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {playlists.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 14, padding: '48px 20px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, opacity: 0.4 }}>🎵</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
              No playlists yet
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Create a playlist, then right-click any search result to add songs.
            </div>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                padding: '10px 20px', borderRadius: 10,
                background: 'linear-gradient(135deg, #7C3AED, #0EA5E9)',
                border: 'none', color: '#fff', fontSize: 13, fontWeight: 600,
                fontFamily: 'Outfit, sans-serif', cursor: 'pointer',
              }}
            >
              + Create First Playlist
            </button>
          </div>
        ) : (
          playlists.map(pl => (
            <div
              key={pl.id}
              onClick={() => setSelectedPlaylist(pl)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 8px', borderRadius: 12, cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              {/* Playlist icon / mini mosaic */}
              <div style={{
                width: 46, height: 46, borderRadius: 10, flexShrink: 0,
                background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(14,165,233,0.2))',
                border: '1px solid rgba(124,58,237,0.25)',
                display: 'grid',
                gridTemplateColumns: pl.tracks.length >= 4 ? '1fr 1fr' : '1fr',
                overflow: 'hidden',
              }}>
                {pl.tracks.slice(0, 4).map((t, i) => (
                  <img
                    key={i}
                    src={t.thumbnail}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                ))}
                {pl.tracks.length === 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, color: 'rgba(124,58,237,0.6)', gridColumn: '1/-1',
                  }}>🎵</div>
                )}
              </div>

              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {pl.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {formatCount(pl.tracks.length)}
                </div>
              </div>

              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>›</span>
            </div>
          ))
        )}
      </div>

      {showCreate && (
        <CreatePlaylistModal
          onClose={() => setShowCreate(false)}
          onCreate={(name) => {
            createPlaylist(name);
            showToast('✨ Playlist created!');
          }}
        />
      )}
    </div>
  );
}
