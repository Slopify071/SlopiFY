// Audio Cache & Prefetch Engine for SlopiFY
// Proactively caches upcoming audio tracks in CacheStorage for instant, zero-buffer playback.

import { getAudioStreamUrl } from './storage'

const AUDIO_CACHE_NAME = 'slopify-audio-cache'
const inFlightPrefetches = new Set()
const warmedUrls = new Set()

/**
 * Check if the browser supports CacheStorage API
 */
function isCacheSupported() {
  return typeof window !== 'undefined' && 'caches' in window
}

/**
 * Check if an audio track is already cached locally
 * @param {Object|string} song
 * @returns {Promise<boolean>}
 */
export async function isSongCached(song) {
  if (!isCacheSupported() || !song) return false
  const url = getAudioStreamUrl(song)
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) return true

  try {
    const cache = await caches.open(AUDIO_CACHE_NAME)
    const match = await cache.match(url)
    return !!match
  } catch (e) {
    return false
  }
}

/**
 * Proactively fetch and cache an audio track in CacheStorage
 * @param {Object|string} song
 * @returns {Promise<boolean>}
 */
export async function preloadSongAudio(song) {
  if (!isCacheSupported() || !song) return false
  const url = getAudioStreamUrl(song)
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) return false
  if (warmedUrls.has(url) || inFlightPrefetches.has(url)) return true

  inFlightPrefetches.add(url)

  try {
    const cache = await caches.open(AUDIO_CACHE_NAME)
    const existing = await cache.match(url)
    if (existing) {
      warmedUrls.add(url)
      inFlightPrefetches.delete(url)
      return true
    }

    // Fetch the full audio track in the background with low network priority
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      // 'low' priority tells browser not to compete with the currently playing track
      priority: 'low',
    })

    if (response && (response.ok || response.status === 206 || response.status === 0)) {
      await cache.put(url, response)
      warmedUrls.add(url)
      return true
    }
  } catch (err) {
    // Network/CORS errors during background prefetch are non-fatal
    console.debug('[AudioCache] Background prefetch skipped for:', url, err?.message)
  } finally {
    inFlightPrefetches.delete(url)
  }

  return false
}

/**
 * Proactively prefetch the next N tracks in the playback queue
 * @param {Array<Object>} queue
 * @param {number} [limit=2]
 */
export async function preloadQueue(queue, limit = 2) {
  if (!Array.isArray(queue) || queue.length === 0) return

  const toPreload = queue.slice(0, limit)
  for (const song of toPreload) {
    if (song && song.id) {
      preloadSongAudio(song)
    }
  }
}

/**
 * Hover trigger: preloads track when user hovers or touches a song row
 * Throttled to prevent flooding on rapid scroll
 */
let hoverTimeout = null
export function preloadOnHover(song) {
  if (!song) return
  if (hoverTimeout) clearTimeout(hoverTimeout)

  hoverTimeout = setTimeout(() => {
    preloadSongAudio(song)
  }, 120) // 120ms hover intent delay
}
