/**
 * MusicContext.jsx
 * Global state for the music player.
 * Manages search, playback (via AudioEngine + YouTube IFrame fallback), lyrics, and 8D controls.
 */

import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { searchTracks, getAudioStream, saveRecentSearch } from '../services/searchService';
import { audioEngine } from './AudioEngine';
import { fetchLyrics, getActiveLyricIndex } from './LyricsEngine';

const IS_CAPACITOR = typeof window !== 'undefined' && window?.Capacitor !== undefined;
const MusicContext = createContext(null);

export function MusicProvider({ children }) {
  // ── Playback State ───────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.85);
  const [isMuted, setIsMutedState] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // ── Search State ─────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // ── Queue ────────────────────────────────────────────────────
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(-1);

  // ── Lyrics ───────────────────────────────────────────────────
  const [lyrics, setLyrics] = useState({ synced: [], plain: '' });
  const [activeLyricIndex, setActiveLyricIndex] = useState(-1);

  // ── 8D Engine Params ─────────────────────────────────────────
  const [rotationSpeed, setRotationSpeedState] = useState(0.5);
  const [reverbAmount, setReverbAmountState] = useState(0.35);
  const [spatialRadius, setSpatialRadiusState] = useState(3);

  // ── YouTube IFrame fallback (for when Piped streams fail) ────
  const ytPlayerRef = useRef(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [usingIframe, setUsingIframe] = useState(false);
  const [activeTab, setActiveTab] = useState('player');

  const currentTrackRef = useRef(null);
  const isPlayerReadyRef = useRef(false);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  useEffect(() => {
    isPlayerReadyRef.current = isPlayerReady;
  }, [isPlayerReady]);

  // ── Setup AudioEngine callbacks ──────────────────────────────
  useEffect(() => {
    audioEngine.onTimeUpdate = (t) => {
      setCurrentTime(t);
    };
    audioEngine.onDurationChange = (d) => {
      if (isFinite(d)) setDuration(d);
    };
    audioEngine.onEnded = () => {
      handleTrackEnded();
    };
    audioEngine.onPlay = () => setIsPlaying(true);
    audioEngine.onPause = () => setIsPlaying(false);
    audioEngine.onLoadStart = () => setIsLoading(true);
    audioEngine.onCanPlay = () => setIsLoading(false);
    audioEngine.onError = (err) => {
      console.warn('AudioEngine error, falling back to YouTube IFrame:', err);
      setUsingIframe(true);
      setIsLoading(false);
      const track = currentTrackRef.current;
      if (track && ytPlayerRef.current && isPlayerReadyRef.current) {
        try {
          ytPlayerRef.current.loadVideoById(track.videoId);
        } catch (e) {
          console.error('Failed to load fallback video in iframe:', e);
        }
      }
    };
  }, []);

  // ── Update active lyric line ─────────────────────────────────
  useEffect(() => {
    if (lyrics.synced.length > 0) {
      const idx = getActiveLyricIndex(lyrics.synced, currentTime);
      setActiveLyricIndex(idx);
    }
  }, [currentTime, lyrics.synced]);

  // ── YouTube IFrame setup (fallback) ─────────────────────────
  useEffect(() => {
    const initYT = () => {
      if (!window.YT?.Player) {
        setTimeout(initYT, 200);
        return false;
      }
      if (ytPlayerRef.current) return true;

      const el = document.getElementById('yt-fallback-player');
      if (!el) {
        setTimeout(initYT, 200);
        return false;
      }

      try {
        ytPlayerRef.current = new window.YT.Player('yt-fallback-player', {
          height: '100%', width: '100%',
          videoId: '',
          playerVars: { 
            autoplay: 0, 
            controls: 0, 
            disablekb: 1, 
            rel: 0,
            origin: window.location.protocol === 'file:' ? 'https://www.youtube.com' : window.location.origin
          },
          events: {
            onReady: () => {
              setIsPlayerReady(true);
              console.log('YouTube Player is ready');
            },
            onStateChange: (e) => {
              if (e.data === window.YT.PlayerState.PLAYING) {
                setIsPlaying(true);
                setDuration(e.target.getDuration());
              } else if (e.data === window.YT.PlayerState.PAUSED) {
                setIsPlaying(false);
              } else if (e.data === window.YT.PlayerState.ENDED) {
                handleTrackEnded();
              }
            },
          },
        });
        return true;
      } catch (err) {
        console.error('Failed to create YouTube player instance:', err);
        setTimeout(initYT, 500);
        return false;
      }
    };

    if (!document.getElementById('yt-iframe-script')) {
      window.onYouTubeIframeAPIReady = initYT;
      const tag = document.createElement('script');
      tag.id = 'yt-iframe-script';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    } else {
      initYT();
    }

    // Poll current time for IFrame player
    const interval = setInterval(() => {
      if (usingIframe && ytPlayerRef.current?.getCurrentTime) {
        try {
          const t = ytPlayerRef.current.getCurrentTime();
          if (typeof t === 'number' && !isNaN(t)) setCurrentTime(t);
          const d = ytPlayerRef.current.getDuration();
          if (typeof d === 'number' && !isNaN(d)) setDuration(d);
        } catch {}
      }
    }, 500);

    return () => clearInterval(interval);
  }, [usingIframe]);

  // Load fallback video automatically when player is ready
  useEffect(() => {
    if (usingIframe && currentTrack && ytPlayerRef.current && isPlayerReady) {
      try {
        ytPlayerRef.current.loadVideoById(currentTrack.videoId);
      } catch (err) {
        console.error('Error loading video by ID:', err);
      }
    }
  }, [currentTrack, usingIframe, isPlayerReady]);

  // ─── Search ──────────────────────────────────────────────────

  const search = useCallback(async (query) => {
    if (!query?.trim()) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }
    setIsSearching(true);
    setSearchError(null);
    saveRecentSearch(query.trim());
    try {
      const results = await searchTracks(query);
      setSearchResults(results);
    } catch (err) {
      setSearchError(err.message);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // ─── Play a track ────────────────────────────────────────────

  const isNativeAndroid = typeof window !== 'undefined' && !!window.AndroidMediaSession;

  const playTrack = useCallback(async (track) => {
    if (!track) return;

    // Switch to player tab on mobile so player is instantly visible!
    setActiveTab('player');

    // Stop both playback engines immediately to prevent overlapping audio
    try {
      audioEngine.stop();
    } catch (e) {
      console.warn('Error stopping audioEngine:', e);
    }
    try {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.stopVideo === 'function') {
        ytPlayerRef.current.stopVideo();
      }
    } catch (e) {
      console.warn('Error stopping ytPlayer:', e);
    }

    setIsLoading(true);
    setCurrentTrack(track);
    setCurrentTime(0);
    setDuration(track.duration || 0);
    setLyrics({ synced: [], plain: '' });
    setActiveLyricIndex(-1);

    // Update queue index: add to queue if not present
    setQueue(prev => {
      const idx = prev.findIndex(t => t.videoId === track.videoId);
      if (idx !== -1) {
        setQueueIndex(idx);
        return prev;
      }
      const newQueue = [...prev, track];
      setQueueIndex(newQueue.length - 1);
      return newQueue;
    });

    // Try to get stream URL from Piped for full Web Audio API 8D processing
    try {
      const streamData = await getAudioStream(track.videoId);

      if (streamData?.audioUrl) {
        if (isNativeAndroid) {
          // Native Android play
          setUsingIframe(false);
          setIsLoading(false);
          window.AndroidMediaSession.playUri(
            streamData.audioUrl,
            track.title || 'Unknown Title',
            track.channel || track.uploader || 'Unknown Artist',
            track.thumbnail || track.artwork || '',
            track.duration || 0
          );
          // Sync volume and speed natively immediately
          window.AndroidMediaSession.setVolumeUri(volume);
          window.AndroidMediaSession.setRotationSpeedUri(rotationSpeed);
        } else {
          // Full 8D mode: load into AudioEngine
          setUsingIframe(false);
          let audioUrl = streamData.audioUrl;
          await audioEngine.loadUrl(audioUrl);
          await audioEngine.play();
          setIsLoading(false);
        }

        // Fetch lyrics in background (don't block playback)
        fetchLyrics(
          streamData.title || track.title,
          streamData.uploader || track.channel,
          streamData.duration || track.duration
        ).then(setLyrics).catch(() => {});

        return;
      }
    } catch (err) {
      console.warn('Piped stream failed, falling back to YouTube IFrame:', err);
    }

    // ⚠️ Fallback: YouTube IFrame (no Web Audio 8D, but at least plays)
    setUsingIframe(true);
    setIsLoading(false);

    if (ytPlayerRef.current && isPlayerReadyRef.current) {
      ytPlayerRef.current.loadVideoById(track.videoId);
    }

    // Still fetch lyrics
    fetchLyrics(track.title, track.channel, track.duration)
      .then(setLyrics)
      .catch(() => {});
  }, [queue, isNativeAndroid, volume, rotationSpeed]);

  // ─── Playback controls ───────────────────────────────────────

  const togglePlay = useCallback(async () => {
    if (!currentTrack) return;

    if (isNativeAndroid && !usingIframe) {
      if (isPlaying) {
        window.AndroidMediaSession.pauseUri();
      } else {
        window.AndroidMediaSession.resumeUri();
      }
    } else if (usingIframe) {
      if (isPlaying) {
        ytPlayerRef.current?.pauseVideo();
      } else {
        ytPlayerRef.current?.playVideo();
      }
    } else {
      if (isPlaying) {
        audioEngine.pause();
      } else {
        await audioEngine.play();
      }
    }
  }, [currentTrack, isPlaying, usingIframe, isNativeAndroid]);

  const seekTo = useCallback((time) => {
    setCurrentTime(time);
    if (isNativeAndroid && !usingIframe) {
      window.AndroidMediaSession.seekUri(time);
    } else if (usingIframe) {
      ytPlayerRef.current?.seekTo(time, true);
    } else {
      audioEngine.seek(time);
    }
  }, [usingIframe, isNativeAndroid]);

  const handleTrackEnded = useCallback(() => {
    if (isRepeat) {
      if (isNativeAndroid && !usingIframe) {
        window.AndroidMediaSession.seekUri(0);
        window.AndroidMediaSession.resumeUri();
      } else if (usingIframe) {
        ytPlayerRef.current?.seekTo(0, true);
        ytPlayerRef.current?.playVideo();
      } else {
        audioEngine.seek(0);
        audioEngine.play();
      }
      return;
    }
    playNextTrack();
  }, [isRepeat, usingIframe, isNativeAndroid]);

  const playNextTrack = useCallback(() => {
    if (!queue.length) return;
    let nextIdx = isShuffle
      ? Math.floor(Math.random() * queue.length)
      : (queueIndex + 1) % queue.length;
    const next = queue[nextIdx];
    if (next) {
      setQueueIndex(nextIdx);
      playTrack(next);
    }
  }, [queue, queueIndex, isShuffle, playTrack]);

  const playPrevTrack = useCallback(() => {
    if (!queue.length) return;
    // If past 3 seconds in, restart current track
    if (currentTime > 3) {
      seekTo(0);
      return;
    }
    const prevIdx = queueIndex > 0 ? queueIndex - 1 : queue.length - 1;
    const prev = queue[prevIdx];
    if (prev) {
      setQueueIndex(prevIdx);
      playTrack(prev);
    }
  }, [queue, queueIndex, currentTime, seekTo, playTrack]);

  const addToQueue = useCallback((track) => {
    if (!track) return;
    setQueue(prev => {
      // Prevent exact duplicate (same videoId)
      if (prev.some(t => t.videoId === track.videoId)) return prev;
      return [...prev, track];
    });
  }, []);

  const removeFromQueue = useCallback((videoId) => {
    setQueue(prev => prev.filter(t => t.videoId !== videoId));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setQueueIndex(-1);
  }, []);

  // ─── Volume ──────────────────────────────────────────────────

  const setVolume = useCallback((vol) => {
    setVolumeState(vol);
    if (isNativeAndroid) {
      window.AndroidMediaSession.setVolumeUri(vol);
    }
    audioEngine.setVolume(vol);
    if (ytPlayerRef.current?.setVolume) {
      ytPlayerRef.current.setVolume(vol * 100);
    }
  }, [isNativeAndroid]);

  const setMuted = useCallback((muted) => {
    setIsMutedState(muted);
    if (isNativeAndroid) {
      window.AndroidMediaSession.setVolumeUri(muted ? 0 : volume);
    }
    audioEngine.setMuted(muted);
    if (muted) ytPlayerRef.current?.mute();
    else ytPlayerRef.current?.unMute();
  }, [isNativeAndroid, volume]);

  // ─── 8D Engine controls ──────────────────────────────────────

  const setRotationSpeed = useCallback((hz) => {
    setRotationSpeedState(hz);
    if (isNativeAndroid) {
      window.AndroidMediaSession.setRotationSpeedUri(hz);
    }
    audioEngine.setRotationSpeed(hz);
  }, [isNativeAndroid]);

  const setReverbAmount = useCallback((amount) => {
    setReverbAmountState(amount);
    audioEngine.setReverbAmount(amount);
  }, []);

  const setSpatialRadius = useCallback((r) => {
    setSpatialRadiusState(r);
    audioEngine.setSpatialRadius(r);
  }, []);

  useEffect(() => {
    console.log("Bridge Detection - AndroidMediaSession defined:", typeof window !== 'undefined' && !!window.AndroidMediaSession);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.AndroidMediaSession) {
      window.AndroidMediaSession.setRepeatUri(isRepeat);
    }
  }, [isRepeat]);

  useEffect(() => {
    const handleRepeatActive = () => {
      setIsRepeat(true);
    };
    const handleRepeatInactive = () => {
      setIsRepeat(false);
    };

    window.addEventListener('mediaRepeatActive', handleRepeatActive);
    window.addEventListener('mediaRepeatInactive', handleRepeatInactive);
    return () => {
      window.removeEventListener('mediaRepeatActive', handleRepeatActive);
      window.removeEventListener('mediaRepeatInactive', handleRepeatInactive);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.AndroidMediaSession && usingIframe) {
      if (currentTrack) {
        console.log("Syncing metadata to AndroidMediaSession for:", currentTrack.title);
        window.AndroidMediaSession.startPlaybackService();
        window.AndroidMediaSession.updateMetadata(
          currentTrack.title || 'Unknown Title',
          currentTrack.channel || currentTrack.uploader || 'Unknown Artist',
          currentTrack.thumbnail || currentTrack.artwork || '',
          duration || 0
        );
      } else {
        console.log("Stopping playback service via AndroidMediaSession");
        window.AndroidMediaSession.stopPlaybackService();
      }
    }
  }, [currentTrack, duration, usingIframe]);

  const currentTimeRef = useRef(0);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.AndroidMediaSession && usingIframe) {
      if (currentTrack) {
        console.log("Syncing playback state to AndroidMediaSession. Playing:", isPlaying, "Position:", currentTimeRef.current);
        window.AndroidMediaSession.updatePlaybackState(isPlaying, currentTimeRef.current);
      }
    }
  }, [isPlaying, currentTrack, usingIframe]);

  // Listen to Native time updates
  useEffect(() => {
    const handleNativeTimeUpdate = (e) => {
      if (e.detail) {
        if (typeof e.detail.currentTime === 'number') {
          setCurrentTime(e.detail.currentTime);
        }
        if (typeof e.detail.duration === 'number' && isFinite(e.detail.duration) && e.detail.duration > 0) {
          setDuration(e.detail.duration);
        }
      }
    };

    window.addEventListener('nativeTimeUpdate', handleNativeTimeUpdate);
    return () => {
      window.removeEventListener('nativeTimeUpdate', handleNativeTimeUpdate);
    };
  }, []);

  // Listen to Native lockscreen controls callbacks
  useEffect(() => {
    const handlePlay = () => {
      setIsPlaying(true);
    };
    const handlePause = () => {
      setIsPlaying(false);
    };
    const handlePlayPause = () => {
      togglePlay();
    };
    const handleNext = () => {
      playNextTrack();
    };
    const handlePrev = () => {
      playPrevTrack();
    };
    const handleSeek = (e) => {
      if (e.detail !== undefined) {
        seekTo(e.detail);
      }
    };
    const handleEnded = () => {
      handleTrackEnded();
    };
    const handleError = () => {
      setIsLoading(false);
      playNextTrack();
    };

    window.addEventListener('mediaPlay', handlePlay);
    window.addEventListener('mediaPause', handlePause);
    window.addEventListener('mediaPlayPause', handlePlayPause);
    window.addEventListener('mediaNext', handleNext);
    window.addEventListener('mediaPrev', handlePrev);
    window.addEventListener('mediaSeek', handleSeek);
    window.addEventListener('mediaEnded', handleEnded);
    window.addEventListener('mediaError', handleError);

    return () => {
      window.removeEventListener('mediaPlay', handlePlay);
      window.removeEventListener('mediaPause', handlePause);
      window.removeEventListener('mediaPlayPause', handlePlayPause);
      window.removeEventListener('mediaNext', handleNext);
      window.removeEventListener('mediaPrev', handlePrev);
      window.removeEventListener('mediaSeek', handleSeek);
      window.removeEventListener('mediaEnded', handleEnded);
      window.removeEventListener('mediaError', handleError);
    };
  }, [togglePlay, playNextTrack, playPrevTrack, seekTo, handleTrackEnded]);

  // ── Sleep Timer ──────────────────────────────────────────────
  const [sleepTimeLeft, setSleepTimeLeft] = useState(null); // remaining seconds or null
  const sleepTimerIntervalRef = useRef(null);

  const startSleepTimer = useCallback((minutes) => {
    if (sleepTimerIntervalRef.current) {
      clearInterval(sleepTimerIntervalRef.current);
      sleepTimerIntervalRef.current = null;
    }

    if (!minutes || minutes <= 0) {
      setSleepTimeLeft(null);
      return;
    }

    setSleepTimeLeft(minutes * 60);

    sleepTimerIntervalRef.current = setInterval(() => {
      setSleepTimeLeft(prev => {
        if (prev === null) {
          clearInterval(sleepTimerIntervalRef.current);
          return null;
        }
        if (prev <= 1) {
          clearInterval(sleepTimerIntervalRef.current);
          // Pause all playback mechanisms immediately
          try {
            audioEngine.pause();
          } catch (e) {}
          try {
            ytPlayerRef.current?.pauseVideo();
          } catch (e) {}
          try {
            if (typeof window !== 'undefined' && window.AndroidMediaSession?.pauseUri) {
              window.AndroidMediaSession.pauseUri();
            }
          } catch (e) {}
          setIsPlaying(false);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Cleanup sleep timer on unmount
  useEffect(() => {
    return () => {
      if (sleepTimerIntervalRef.current) {
        clearInterval(sleepTimerIntervalRef.current);
      }
    };
  }, []);

  const value = useMemo(() => ({
    // Playback
    isPlaying, currentTrack, currentTime, duration,
    volume, isMuted, isRepeat, isShuffle, isLoading, usingIframe,
    // Tab switching
    activeTab, setActiveTab,
    // Search
    searchQuery, setSearchQuery, searchResults, isSearching, searchError, search,
    // Queue
    queue, queueIndex, addToQueue, removeFromQueue, clearQueue,
    // Lyrics
    lyrics, activeLyricIndex,
    // 8D params
    rotationSpeed, reverbAmount, spatialRadius,
    // Sleep Timer
    sleepTimeLeft, startSleepTimer,
    // Actions
    playTrack, togglePlay, seekTo, playNextTrack, playPrevTrack,
    setVolume, setMuted,
    setIsRepeat, setIsShuffle,
    setRotationSpeed, setReverbAmount, setSpatialRadius,
  }), [
    isPlaying, currentTrack, currentTime, duration,
    volume, isMuted, isRepeat, isShuffle, isLoading, usingIframe,
    activeTab,
    searchQuery, searchResults, isSearching, searchError,
    queue, queueIndex, addToQueue, removeFromQueue, clearQueue,
    lyrics, activeLyricIndex,
    rotationSpeed, reverbAmount, spatialRadius,
    sleepTimeLeft, startSleepTimer,
    playTrack, togglePlay, seekTo, playNextTrack, playPrevTrack,
    setVolume, setMuted, setRotationSpeed, setReverbAmount, setSpatialRadius,
  ]);

  return (
    <MusicContext.Provider value={value}>
      {children}
      <div
        aria-hidden={!usingIframe}
        style={{
          position: 'fixed',
          bottom: window.innerWidth <= 768 ? '-1000px' : '24px',
          right: '24px',
          width: window.innerWidth <= 768 ? '1px' : '280px',
          height: window.innerWidth <= 768 ? '1px' : '157px',
          overflow: 'hidden',
          borderRadius: '12px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.15)',
          zIndex: 9999,
          pointerEvents: usingIframe ? 'auto' : 'none',
          opacity: usingIframe ? (window.innerWidth <= 768 ? 0.01 : 1) : 0,
          transform: usingIframe ? 'scale(1)' : 'scale(0.8)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          backgroundColor: '#000',
        }}
      >
        <div id="yt-fallback-player" style={{ width: '100%', height: '100%' }} />
      </div>
    </MusicContext.Provider>
  );
}

export const useMusic = () => {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error('useMusic must be used within MusicProvider');
  return ctx;
};
