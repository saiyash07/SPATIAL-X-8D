import { useRef, useEffect } from 'react';
import { useMusic } from '../../engine/MusicContext';

export default function LyricsPanel() {
  const { lyrics, activeLyricIndex, seekTo } = useMusic();
  const activeLyricRef = useRef(null);
  const containerRef = useRef(null);

  // Auto-scroll to active lyric line
  useEffect(() => {
    if (activeLyricRef.current && containerRef.current) {
      activeLyricRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLyricIndex]);

  const { synced, plain } = lyrics;

  if (synced.length > 0) {
    return (
      <div ref={containerRef} className="lyrics-panel" role="region" aria-label="Lyrics">
        {synced.map((line, i) => {
          const isActive = i === activeLyricIndex;
          const isPast = i < activeLyricIndex;
          return (
            <div
              key={i}
              ref={isActive ? activeLyricRef : null}
              className={`lyric-line${isActive ? ' active' : isPast ? ' past' : ''}`}
              onClick={() => seekTo(line.time)}
              title="Click to seek"
            >
              {line.text}
            </div>
          );
        })}
      </div>
    );
  }

  if (plain) {
    return (
      <div ref={containerRef} className="lyrics-panel" role="region" aria-label="Lyrics">
        {plain.split('\n').filter(Boolean).map((line, i) => (
          <div key={i} className="lyric-line" style={{ fontSize: '13px' }}>
            {line}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="lyrics-empty">
      🎵 Lyrics not found for this track
    </div>
  );
}
