/**
 * searchService.js
 * Searches YouTube for 8D audio via Piped API with multi-instance failover.
 * No API key required. Auto-appends "8D audio" to every query.
 *
 * In Electron: uses direct HTTPS Piped instances (CORS is bypassed by Electron).
 * In browser dev: uses Vite proxy paths (/piped-1, /piped-2, /piped-3) to avoid CORS.
 */

// Detect Electron environment
const IS_ELECTRON = typeof window !== 'undefined' && window?.electronAPI?.isElectron === true;

// Detect Capacitor (Android/iOS) environment
const IS_CAPACITOR = typeof window !== 'undefined' && window?.Capacitor !== undefined;

// In browser web dev: use Vite proxy paths (/piped-1, /piped-2, /piped-3) to avoid CORS.
// In Electron & Capacitor: use direct HTTPS instances.
const PIPED_INSTANCES = (IS_ELECTRON || IS_CAPACITOR)
  ? [
      'https://api.piped.private.coffee',
      'https://api.piped.projectsegfau.lt',
      'https://pipedapi.adminforge.de',
      'https://piped-api.garudalinux.org',
      'https://piped-api.kavin.rocks',
      'https://piped-api.litesync.org',
    ]
  : [
      // Proxied through Vite dev server — no CORS issues
      '/piped-1',
      '/piped-2',
      '/piped-3',
    ];

const TIMEOUT_MS = 6000;

// Cache: Map<query → { results, timestamp }>
const searchCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '–:––';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function extractVideoId(url) {
  if (!url) return null;
  // Piped returns '/watch?v=ID'
  const match = url.match(/[?&]v=([^&]+)/);
  return match ? match[1] : url.replace('/watch?v=', '');
}

function mapPipedItem(item) {
  const videoId = extractVideoId(item.url);
  if (!videoId) return null;
  return {
    videoId,
    title: item.title || 'Unknown Title',
    channel: item.uploaderName || item.uploaderUrl?.replace('/channel/', '') || 'Unknown Channel',
    duration: item.duration || 0,
    durationStr: formatDuration(item.duration),
    // Use YouTube's own CDN for thumbnails — always works, no CORS
    thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    views: item.views || 0,
    uploaded: item.uploadedDate || '',
  };
}

async function fetchFromInstance(instance, query) {
  const url = `${instance}/search?q=${encodeURIComponent(query)}&filter=videos`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.items || [])
    .filter(item => item.type === 'stream' || item.duration > 30) // filter shorts
    .map(mapPipedItem)
    .filter(Boolean)
    .slice(0, 15);
}

/**
 * Search for 8D audio tracks by song name.
 * Automatically appends "8D audio" to the query.
 * @param {string} songName - Song name from user input
 * @returns {Promise<Array>} Array of track objects
 */
export async function searchTracks(songName) {
  if (!songName?.trim()) return [];

  // Always search with 8D audio suffix — that's the whole point of this app
  const query = `${songName.trim()} 8D audio`;

  // Return from cache if fresh
  const cached = searchCache.get(query);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.results;
  }

  const errors = [];

  for (const instance of PIPED_INSTANCES) {
    try {
      const results = await fetchFromInstance(instance, query);
      if (results.length > 0) {
        searchCache.set(query, { results, timestamp: Date.now() });
        return results;
      }
    } catch (err) {
      errors.push(`${instance}: ${err.message}`);
      continue;
    }
  }

  console.warn('All Piped instances failed:', errors);
  throw new Error('Could not reach search service. Check your internet connection and try again.');
}

/**
 * Get the best audio stream URL for a YouTube video via Piped.
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<{audioUrl: string, title: string, uploader: string, thumbnail: string}>}
 */
export async function getAudioStream(videoId) {
  // Try local yt-dlp extraction first if in Electron
  if (IS_ELECTRON && window.electronAPI?.getStreamUrl) {
    try {
      console.log(`[Local Extraction] Requesting yt-dlp extraction for video: ${videoId}`);
      const localUrl = await window.electronAPI.getStreamUrl(videoId);
      if (localUrl) {
        console.log('[Local Extraction] Stream extracted successfully via local yt-dlp!');
        return {
          audioUrl: localUrl,
          title: '',
          uploader: '',
          thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          duration: 0,
        };
      }
    } catch (err) {
      console.warn('[Local Extraction] local yt-dlp failed, falling back to public Piped loop', err);
    }
  }

  const errors = [];

  for (const instance of PIPED_INSTANCES) {
    try {
      const url = `${instance}/streams/${videoId}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Pick highest bitrate audio stream
      const audioStreams = (data.audioStreams || []).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      if (!audioStreams.length) throw new Error('No audio streams');

      const best = audioStreams[0];
      return {
        audioUrl: best.url,
        title: data.title || '',
        uploader: data.uploader || '',
        thumbnail: data.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        duration: data.duration || 0,
      };
    } catch (err) {
      errors.push(`${instance}: ${err.message}`);
      continue;
    }
  }

  console.warn('All Piped stream fetch attempts failed:', errors);
  // Return null — caller will fall back to YouTube IFrame
  return null;
}

/**
 * Get cached recent searches from localStorage
 */
export function getRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem('spatialx-recent') || '[]');
  } catch { return []; }
}

/**
 * Save a search term to recent searches
 */
export function saveRecentSearch(term) {
  try {
    const recents = getRecentSearches().filter(r => r !== term).slice(0, 7);
    localStorage.setItem('spatialx-recent', JSON.stringify([term, ...recents]));
  } catch { /* ignore */ }
}

/**
 * Delete a search term from recent searches
 */
export function deleteRecentSearch(term) {
  try {
    const recents = getRecentSearches().filter(r => r !== term);
    localStorage.setItem('spatialx-recent', JSON.stringify(recents));
  } catch { /* ignore */ }
}
