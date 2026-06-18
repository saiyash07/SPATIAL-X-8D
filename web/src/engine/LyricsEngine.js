/**
 * LyricsEngine.js
 * Fetches synchronized lyrics from LRClib.net (free, no API key required).
 * Parses .lrc format timestamps and provides the active line for current playback time.
 */

const LRCLIB_BASE = 'https://lrclib.net/api';

/**
 * Parse LRC formatted lyrics string into array of { time, text } objects.
 * LRC format: [mm:ss.xx] Lyric line text
 */
function parseLRC(lrcText) {
  if (!lrcText) return [];

  const lines = lrcText.split('\n');
  const result = [];
  const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

  for (const line of lines) {
    const text = line.replace(/\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/g, '').trim();
    if (!text) continue;

    timeRegex.lastIndex = 0;
    let match;
    while ((match = timeRegex.exec(line)) !== null) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const ms = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0;
      const time = minutes * 60 + seconds + ms / 1000;
      result.push({ time, text });
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

/**
 * Fetch synchronized lyrics for a track.
 * Tries with artist name if available, falls back to song name only.
 *
 * @param {string} trackName - Song title
 * @param {string} [artistName] - Artist / channel name (optional)
 * @param {number} [duration] - Track duration in seconds (improves accuracy)
 * @returns {Promise<{ synced: Array, plain: string }>}
 */
export async function fetchLyrics(trackName, artistName = '', duration = 0) {
  if (!trackName) return { synced: [], plain: '' };

  // Clean up common "8D audio" artifacts from titles for better lyrics matching
  const cleanTitle = trackName
    .replace(/\s*[\[\(]?\s*8d\s*(audio|mix|surround)?\s*[\]\)]?/gi, '')
    .replace(/\s*[\[\(]?\s*(bass boost|slowed|reverb|extended|hq|hd)\s*[\]\)]?/gi, '')
    .replace(/\s*[-|]\s*[^-|]+$/, '') // remove "- Topic", "- Official Video" etc
    .trim();

  const queries = [];

  // Try with artist name first (more accurate)
  if (artistName && artistName !== cleanTitle) {
    const cleanArtist = artistName
      .replace(/\s*(VEVO|Topic|Official|Music)\s*/gi, '')
      .trim();
    if (cleanArtist) {
      queries.push({ trackName: cleanTitle, artistName: cleanArtist });
    }
  }

  // Fallback: title only
  queries.push({ trackName: cleanTitle, artistName: '' });

  for (const q of queries) {
    try {
      const params = new URLSearchParams({ track_name: q.trackName });
      if (q.artistName) params.set('artist_name', q.artistName);
      if (duration > 0) params.set('duration', Math.round(duration).toString());

      const res = await fetch(`${LRCLIB_BASE}/get?${params}`, {
        signal: AbortSignal.timeout(5000),
        headers: { 'User-Agent': 'SPATIALX8D/1.0 (personal music player)' },
      });

      if (!res.ok) continue;

      const data = await res.json();

      const synced = data.syncedLyrics ? parseLRC(data.syncedLyrics) : [];
      const plain = data.plainLyrics || '';

      if (synced.length > 0 || plain) {
        return { synced, plain };
      }
    } catch (err) {
      // Try next query
      continue;
    }
  }

  return { synced: [], plain: '' };
}

/**
 * Get the index of the currently active lyric line based on playback time.
 * @param {Array} lines - Array of { time, text } objects
 * @param {number} currentTime - Current playback position in seconds
 * @returns {number} Index of the active line (-1 if before start)
 */
export function getActiveLyricIndex(lines, currentTime) {
  if (!lines?.length) return -1;

  let activeIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= currentTime) {
      activeIdx = i;
    } else {
      break;
    }
  }
  return activeIdx;
}
