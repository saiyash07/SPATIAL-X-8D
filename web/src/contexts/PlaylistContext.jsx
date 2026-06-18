import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const PlaylistContext = createContext(null);

function loadPlaylists() {
  try {
    return JSON.parse(localStorage.getItem('spatialx-playlists') || '[]');
  } catch { return []; }
}

export function PlaylistProvider({ children }) {
  const [playlists, setPlaylists] = useState(loadPlaylists);

  // Persist every time playlists change
  useEffect(() => {
    localStorage.setItem('spatialx-playlists', JSON.stringify(playlists));
  }, [playlists]);

  const createPlaylist = useCallback((name) => {
    const playlist = {
      id: Date.now().toString(),
      name: name.trim() || 'New Playlist',
      tracks: [],
      createdAt: new Date().toISOString(),
    };
    setPlaylists(prev => [...prev, playlist]);
    return playlist;
  }, []);

  const deletePlaylist = useCallback((id) => {
    setPlaylists(prev => prev.filter(p => p.id !== id));
  }, []);

  const renamePlaylist = useCallback((id, name) => {
    setPlaylists(prev =>
      prev.map(p => p.id === id ? { ...p, name: name.trim() || p.name } : p)
    );
  }, []);

  /**
   * Add a track to a playlist (deduped by videoId)
   * Returns false if already in playlist.
   */
  const addTrackToPlaylist = useCallback((playlistId, track) => {
    // Synchronously inspect current state to determine if duplicate
    const targetPlaylist = playlists.find(p => p.id === playlistId);
    if (!targetPlaylist) return false;
    if (targetPlaylist.tracks.some(t => t.videoId === track.videoId)) return false;

    setPlaylists(prev =>
      prev.map(p => {
        if (p.id !== playlistId) return p;
        return { ...p, tracks: [...p.tracks, track] };
      })
    );
    return true;
  }, [playlists]);

  const removeTrackFromPlaylist = useCallback((playlistId, videoId) => {
    setPlaylists(prev =>
      prev.map(p =>
        p.id !== playlistId
          ? p
          : { ...p, tracks: p.tracks.filter(t => t.videoId !== videoId) }
      )
    );
  }, []);

  const reorderTrack = useCallback((playlistId, fromIdx, toIdx) => {
    setPlaylists(prev =>
      prev.map(p => {
        if (p.id !== playlistId) return p;
        const tracks = [...p.tracks];
        const [moved] = tracks.splice(fromIdx, 1);
        tracks.splice(toIdx, 0, moved);
        return { ...p, tracks };
      })
    );
  }, []);

  return (
    <PlaylistContext.Provider value={{
      playlists,
      createPlaylist,
      deletePlaylist,
      renamePlaylist,
      addTrackToPlaylist,
      removeTrackFromPlaylist,
      reorderTrack,
    }}>
      {children}
    </PlaylistContext.Provider>
  );
}

export const usePlaylists = () => {
  const ctx = useContext(PlaylistContext);
  if (!ctx) throw new Error('usePlaylists must be used within PlaylistProvider');
  return ctx;
};
