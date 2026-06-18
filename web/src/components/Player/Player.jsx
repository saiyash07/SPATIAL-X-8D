import { useState, useRef, useCallback } from 'react';
import { useMusic } from '../../engine/MusicContext';
import LyricsPanel from '../LyricsPanel/LyricsPanel';
import Visualizer from '../Visualizer/Visualizer';

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function QueuePanel({ queue, queueIndex, playTrack, currentTrack, clearQueue }) {
  if (!queue.length) return <div className="lyrics-empty">Queue is empty</div>;
  return (
    <div className="queue-panel">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
        <button
          onClick={clearQueue}
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#F87171',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.22)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
          }}
        >
          🗑️ Clear Queue
        </button>
      </div>
      {queue.map((track, i) => {
        const isActive = currentTrack?.videoId === track.videoId;
        return (
          <div
            key={track.videoId + i}
            className={`queue-item${isActive ? ' active' : ''}`}
            onClick={() => playTrack(track)}
          >
            <div className="queue-num">{isActive ? '▶' : i + 1}</div>
            <img
              className="queue-thumb"
              src={track.thumbnail}
              alt={track.title}
              loading="lazy"
              onError={e => { e.target.style.display = 'none'; }}
            />
            <div className="queue-info">
              <div className="queue-title">{track.title}</div>
              <div className="queue-channel">{track.channel}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Player() {
  const {
    isPlaying, currentTrack, currentTime, duration,
    volume, isMuted, isRepeat, isShuffle, isLoading, usingIframe,
    togglePlay, seekTo, playNextTrack, playPrevTrack,
    setVolume, setMuted, setIsRepeat, setIsShuffle,
    rotationSpeed, reverbAmount, spatialRadius,
    setRotationSpeed, setReverbAmount, setSpatialRadius,
    queue, queueIndex, playTrack, clearQueue,
    sleepTimeLeft, startSleepTimer,
  } = useMusic();

  const [activeTab, setActiveTab] = useState('lyrics');
  const progressRef = useRef(null);

  const formatTimerSeconds = (sec) => {
    if (sec === null) return 'Sleep';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleTimerClick = () => {
    if (sleepTimeLeft === null) {
      startSleepTimer(10);
    } else if (sleepTimeLeft > 30 * 60) {
      startSleepTimer(0);
    } else if (sleepTimeLeft > 10 * 60) {
      startSleepTimer(60);
    } else {
      startSleepTimer(30);
    }
  };

  const handleProgressClick = useCallback((e) => {
    if (!duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(pct * duration);
  }, [duration, seekTo]);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isLong = currentTrack?.title?.length > 30;

  if (!currentTrack) {
    return (
      <div className="player-area">
        <div className="album-glow" style={{ opacity: 0.15 }} />
        <div className="no-track-state">
          <div className="no-track-orb">🎧</div>
          <div className="no-track-title">SPATIAL X 8D</div>
          <div className="no-track-sub">
            Search any song name on the left.<br />
            We'll find its 8D audio version and play it<br />
            with <strong style={{ color: 'var(--accent-bright)' }}>true HRTF spatial audio</strong> — sounds like it's spinning around your head.
          </div>
          <div style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            background: 'rgba(124,58,237,0.08)',
            border: '1px solid rgba(124,58,237,0.2)',
            borderRadius: '8px',
            padding: '8px 16px',
          }}>
            🎧 Wear headphones for the full 8D experience
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="player-area">
      {/* Ambient glow */}
      <div className="album-glow" style={{ opacity: isPlaying ? 0.35 : 0.15 }} />

      <div className="player-card">
        {/* Subtle gradient line at top */}
        {isPlaying && <div className="currently-playing-glow" />}



        {/* Mode badge */}
        <div style={{
          position: 'absolute',
          top: 16,
          right: 16,
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '1px',
          padding: '3px 8px',
          borderRadius: '999px',
          background: usingIframe ? 'rgba(251,191,36,0.15)' : 'rgba(124,58,237,0.2)',
          color: usingIframe ? '#FBB724' : 'var(--accent-bright)',
          border: `1px solid ${usingIframe ? 'rgba(251,191,36,0.3)' : 'rgba(124,58,237,0.3)'}`,
          zIndex: 10,
        }}>
          {usingIframe ? '⚡ COMPAT MODE' : '🎧 8D ACTIVE'}
        </div>

        {/* ── Vinyl ── */}
        <div className="vinyl-section">
          <div className="vinyl-outer">
            <div className={`vinyl-disc${isPlaying ? ' playing' : ''}`}>
              {currentTrack.thumbnail ? (
                <img
                  className="vinyl-art"
                  src={currentTrack.thumbnail}
                  alt={currentTrack.title}
                  onError={e => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div className="vinyl-art-placeholder">🎵</div>
              )}
              <div className="vinyl-groove" />
              <div className="vinyl-hole" />
            </div>
          </div>
        </div>

        {/* ── Track Info ── */}
        <div className="track-info">
          {isLong ? (
            <div className="marquee-container">
              <div className="track-title marquee-text">
                {currentTrack.title}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{currentTrack.title}
              </div>
            </div>
          ) : (
            <div className="track-title">{currentTrack.title}</div>
          )}
          <div className="track-channel">{currentTrack.channel}</div>
          {isLoading && (
            <div style={{ fontSize: '11px', color: 'var(--accent-bright)', marginTop: 4 }}>
              ⏳ Loading stream...
            </div>
          )}
        </div>

        {/* ── Visualizer ── */}
        <Visualizer isPlaying={isPlaying} barCount={40} height={28} />

        {/* ── Progress ── */}
        <div className="progress-section">
          <div className="progress-times">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div
            ref={progressRef}
            className="progress-bar-track"
            onClick={handleProgressClick}
            role="slider"
            aria-valuenow={currentTime}
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-label="Playback position"
          >
            <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* ── Controls ── */}
        <div className="controls-row">
          <button
            className={`ctrl-btn${isShuffle ? ' active' : ''}`}
            onClick={() => setIsShuffle(!isShuffle)}
            title="Shuffle"
            aria-label="Shuffle"
          >🔀</button>

          <button className="ctrl-btn" onClick={playPrevTrack} title="Previous" aria-label="Previous">⏮</button>

          <button
            className="ctrl-btn ctrl-btn-play"
            onClick={togglePlay}
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          <button className="ctrl-btn" onClick={playNextTrack} title="Next" aria-label="Next">⏭</button>

          <button
            className={`ctrl-btn${isRepeat ? ' active' : ''}`}
            onClick={() => setIsRepeat(!isRepeat)}
            title="Repeat"
            aria-label="Repeat"
          >🔁</button>
        </div>

        {/* ── Volume ── */}
        <div className="volume-row">
          <span
            className="volume-icon"
            onClick={() => setMuted(!isMuted)}
            title={isMuted ? 'Unmute' : 'Mute'}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {isMuted || volume === 0 ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
                <line x1="22" y1="9" x2="16" y2="15" />
                <line x1="16" y1="9" x2="22" y2="15" />
              </svg>
            ) : volume < 0.5 ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            )}
          </span>
          <input
            type="range"
            className="volume-slider"
            min="0" max="1" step="0.01"
            value={isMuted ? 0 : volume}
            onChange={e => setVolume(parseFloat(e.target.value))}
            aria-label="Volume"
          />
        </div>

        {/* ── Sleep Timer ── */}
        <div className="sleep-timer-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px' }}>⏰</span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>Sleep Timer</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {[10, 30, 60].map(mins => {
              const isActive = sleepTimeLeft !== null && Math.ceil(sleepTimeLeft / 60) === mins;
              return (
                <button
                  key={mins}
                  onClick={() => startSleepTimer(isActive ? 0 : mins)}
                  style={{
                    background: isActive ? 'var(--accent)' : 'var(--bg-surface)',
                    border: isActive ? '1px solid var(--accent)' : 'var(--glass-border)',
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                    padding: '4px 10px',
                    borderRadius: '10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    fontFamily: 'Outfit, sans-serif',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-surface)'; }}
                >
                  {mins}m
                </button>
              );
            })}
            {sleepTimeLeft !== null && (
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-bright)', marginLeft: '6px', fontVariantNumeric: 'tabular-nums' }}>
                {formatTimerSeconds(sleepTimeLeft)}
              </span>
            )}
          </div>
        </div>

        {/* ── 8D Engine Controls ── */}
        <div className="engine-panel">
          <div className="engine-header">
            <span className="engine-icon">🎧</span>
            <span className="engine-title">
              8D ENGINE {usingIframe ? '(Visual Only)' : ''}
            </span>
          </div>
          <div className="engine-controls">
            <div className="engine-row">
              <span className="engine-label">Speed</span>
              <input
                type="range" className="engine-slider"
                min="0.1" max="3" step="0.05"
                value={rotationSpeed}
                onChange={e => setRotationSpeed(parseFloat(e.target.value))}
                aria-label="8D rotation speed"
              />
              <span className="engine-value">{rotationSpeed.toFixed(1)}Hz</span>
            </div>
            <div className="engine-row">
              <span className="engine-label">Reverb</span>
              <input
                type="range" className="engine-slider"
                min="0" max="1" step="0.01"
                value={reverbAmount}
                onChange={e => setReverbAmount(parseFloat(e.target.value))}
                aria-label="Reverb amount"
              />
              <span className="engine-value">{Math.round(reverbAmount * 100)}%</span>
            </div>
            <div className="engine-row">
              <span className="engine-label">Width</span>
              <input
                type="range" className="engine-slider"
                min="0.5" max="8" step="0.25"
                value={spatialRadius}
                onChange={e => setSpatialRadius(parseFloat(e.target.value))}
                aria-label="Spatial width"
              />
              <span className="engine-value">{spatialRadius.toFixed(1)}m</span>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div>
          <div className="player-tabs">
            <button
              className={`player-tab${activeTab === 'lyrics' ? ' active' : ''}`}
              onClick={() => setActiveTab('lyrics')}
            >
              Lyrics
            </button>
            <button
              className={`player-tab${activeTab === 'queue' ? ' active' : ''}`}
              onClick={() => setActiveTab('queue')}
            >
              Queue {queue.length > 0 && `(${queue.length})`}
            </button>
          </div>

          <div style={{ marginTop: 8 }}>
            {activeTab === 'lyrics' && <LyricsPanel />}
            {activeTab === 'queue' && (
              <QueuePanel
                queue={queue}
                queueIndex={queueIndex}
                playTrack={playTrack}
                currentTrack={currentTrack}
                clearQueue={clearQueue}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
