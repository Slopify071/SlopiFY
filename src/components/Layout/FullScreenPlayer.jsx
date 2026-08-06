import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { usePlayer } from '../../context/PlayerContext'
import { uploadCoverImage } from '../../services/storage'
import { updateSongInFirestore } from '../../services/firestore'
import './FullScreenPlayer.css'

function parseLrc(lrcText) {
  if (!lrcText) return []
  const lines = lrcText.split('\n')
  const result = []
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/

  for (const line of lines) {
    const match = timeRegex.exec(line)
    if (match) {
      const min = parseInt(match[1], 10)
      const sec = parseInt(match[2], 10)
      const ms = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0
      const time = min * 60 + sec + ms / 1000
      const text = line.replace(timeRegex, '').trim()
      if (text) {
        result.push({ time, text })
      }
    }
  }

  const sorted = result.sort((a, b) => a.time - b.time)
  if (sorted.length === 0 || sorted[0].time > 1) {
    sorted.unshift({ time: 0, text: '•••', isInstrumental: true })
  }
  return sorted
}

function parseTrackTitleAndArtist(rawTitle = '', rawArtist = '') {
  let cleaned = (rawTitle || '')
    .replace(/\((audio|official video|official audio|lyric video|lyrics|audio video|hd|hq|remastered|\d{4} remaster)[^)]*\)/gi, '')
    .replace(/\[(audio|official video|official audio|lyric video|lyrics|audio video|hd|hq|remastered|\d{4} remaster)[^\]]*\]/gi, '')
    .trim()

  let trackName = cleaned
  let artistName = rawArtist && rawArtist.toLowerCase() !== 'unknown artist' ? rawArtist.trim() : ''

  if (cleaned.includes(' - ')) {
    const parts = cleaned.split(' - ')
    if (parts.length >= 2) {
      if (!artistName) {
        artistName = parts[0].trim()
      }
      trackName = parts.slice(1).join(' - ').trim()
    }
  }

  trackName = trackName.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim()
  artistName = artistName.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim()

  return { trackName: trackName || rawTitle, artistName: artistName || rawArtist }
}

function generateDefaultLyrics(song, totalDuration) {
  const dur = totalDuration > 0 ? totalDuration : 180
  const title = song?.title || 'Track'
  const artist = song?.artist || 'Artist'

  const fullSearchStr = `${title} ${artist}`.toLowerCase()
  const isLessIKnow = fullSearchStr.includes('less i know') || fullSearchStr.includes('tame impala')

  if (isLessIKnow) {
    return [
      { time: 0, text: '•••', isInstrumental: true },
      { time: 26.0, text: "Someone said they left together" },
      { time: 30.0, text: "I ran out the door to get her" },
      { time: 34.0, text: "She was holding hands with Trevor" },
      { time: 38.0, text: "Not the greatest feeling ever" },
      { time: 42.0, text: "Said, \"Pull yourself together" },
      { time: 46.0, text: "You should try your luck with Heather\"" },
      { time: 50.0, text: "Then I heard they slept together" },
      { time: 54.0, text: "Oh, the less I know the better" },
      { time: 58.0, text: "The less I know the better" },
      { time: 88.5, text: "Oh, my love" },
      { time: 92.5, text: "Can't you see yourself by my side?" },
      { time: 97.0, text: "No more running around" },
      { time: 101.2, text: "It was working 'til I saw you with him" },
      { time: 105.5, text: "In the middle of the night" },
      { time: 109.8, text: "Oh, the less I know the better" },
      { time: 114.0, text: "Hold on, let me take a breather" },
      { time: 118.2, text: "I was fine before I met her" }
    ]
  }

  const baseLines = [
    `Listen to "${title}"`,
    `By ${artist}`,
    "Feel the baseline moving through the sound",
    "Every beat a brand new spark",
    "Lost inside the melody tonight",
    "Everything is glowing in the light",
    "Taking steps into the unknown wave",
    "Echoes floating down the corridor",
    "Hold on to this feeling once again",
    "Where the quiet shadows turn to gold",
    "Spinning around in endless sound",
    "Nothing else matters right now",
    "Let the music carry us away",
    `Forever in tune with ${title}`
  ]

  const startTime = 10
  const endTime = Math.max(startTime + 15, dur - 6)
  const step = (endTime - startTime) / Math.max(1, baseLines.length - 1)

  const items = baseLines.map((text, idx) => ({
    time: Math.round((startTime + idx * step) * 10) / 10,
    text
  }))

  return [{ time: 0, text: '•••', isInstrumental: true }, ...items]
}

function extractColorsFromImage(imgUrl, callback) {
  if (!imgUrl) return
  const img = new Image()
  img.crossOrigin = 'Anonymous'
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = 40
      canvas.height = 40
      ctx.drawImage(img, 0, 0, 40, 40)
      const imageData = ctx.getImageData(0, 0, 40, 40).data

      let r1 = 0, g1 = 0, b1 = 0, c1 = 0
      let r2 = 0, g2 = 0, b2 = 0, c2 = 0

      for (let i = 0; i < imageData.length; i += 16) {
        if (i < imageData.length / 2) {
          r1 += imageData[i]
          g1 += imageData[i + 1]
          b1 += imageData[i + 2]
          c1++
        } else {
          r2 += imageData[i]
          g2 += imageData[i + 1]
          b2 += imageData[i + 2]
          c2++
        }
      }

      r1 = Math.floor(r1 / Math.max(1, c1))
      g1 = Math.floor(g1 / Math.max(1, c1))
      b1 = Math.floor(b1 / Math.max(1, c1))

      r2 = Math.floor(r2 / Math.max(1, c2))
      g2 = Math.floor(g2 / Math.max(1, c2))
      b2 = Math.floor(b2 / Math.max(1, c2))

      const primary = `rgba(${r1}, ${g1}, ${b1}, 0.75)`
      const secondary = `rgba(${r2}, ${g2}, ${b2}, 0.55)`
      const darkGrad = `radial-gradient(circle at 35% 45%, ${primary}, rgba(8, 6, 16, 0.95) 75%)`

      callback({ darkGrad, primary, secondary, r1, g1, b1, r2, g2, b2 })
    } catch (err) {
      console.warn('Canvas color extraction warning:', err)
    }
  }
  img.src = imgUrl
}

const MarqueeText = ({ text, className }) => {
  const containerRef = useRef(null)
  const textRef = useRef(null)
  const [isOverflowing, setIsOverflowing] = useState(false)

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        const textWidth = textRef.current.getBoundingClientRect().width
        const containerWidth = containerRef.current.getBoundingClientRect().width
        const overflow = textWidth > containerWidth + 2
        setIsOverflowing(overflow)
      }
    }
    checkOverflow()
    const timeout = setTimeout(checkOverflow, 200)
    const observer = new ResizeObserver(checkOverflow)
    if (containerRef.current) observer.observe(containerRef.current)
    if (textRef.current) observer.observe(textRef.current)
    return () => { 
      clearTimeout(timeout)
      observer.disconnect()
    }
  }, [text])

  return (
    <div className={`marquee-container ${className}`} ref={containerRef}>
      <div className={`marquee-content ${isOverflowing ? 'is-marquee' : ''}`}>
        <span ref={textRef} className="marquee-text">{text}</span>
        {isOverflowing && <span className="marquee-text">{text}</span>}
      </div>
    </div>
  )
}

export default function FullScreenPlayer() {
  const {
    currentSong,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    shuffle,
    repeat,
    isFullscreen,
    setFullscreen,
    togglePlay,
    playNext,
    playPrevious,
    seek,
    toggleShuffle,
    cycleRepeat,
    audioRef,
    queue,
    playSong,
    removeFromQueue,
    updateCurrentSong,
  } = usePlayer()

  const lyricsContainerRef = useRef(null)
  const activeLineRef = useRef(null)
  const coverInputRef = useRef(null)
  const isSeekingRef = useRef(false)
  const [seekTime, setSeekTime] = useState(null)
  const [dynamicBg, setDynamicBg] = useState(null)
  const [meshColors, setMeshColors] = useState(null)
  const [viewMode, setViewMode] = useState('immersive') // 'immersive' | 'split'
  const [translateYOffset, setTranslateYOffset] = useState(0)
  const [fetchedLyrics, setFetchedLyrics] = useState(null)
  const [activeRightView, setActiveRightView] = useState('lyrics') // 'lyrics' or 'queue'
  const [localCoverUrl, setLocalCoverUrl] = useState(null)

  useEffect(() => {
    setLocalCoverUrl(null)
  }, [currentSong?.id])

  const handleCoverImageChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !currentSong) return
    const newCoverUrl = URL.createObjectURL(file)
    setLocalCoverUrl(newCoverUrl)
    currentSong.coverUrl = newCoverUrl
    extractColorsFromImage(newCoverUrl, (res) => {
      setDynamicBg(res.darkGrad)
      setMeshColors(res)
    })

    try {
      const uploadedUrl = await uploadCoverImage(file)
      if (uploadedUrl) {
        updateCurrentSong({ coverUrl: uploadedUrl })
        await updateSongInFirestore(currentSong.id, { coverUrl: uploadedUrl })
      }
    } catch (err) {
      console.error('Failed to upload and save cover image:', err)
    }
  }

  const displayCoverUrl = localCoverUrl || currentSong?.coverUrl

  const effectiveDuration = duration > 0 ? duration : (currentSong?.duration || 0)

  // 60 FPS High-Precision Audio Time Sampling directly from HTML5 Audio Element
  const [smoothTime, setSmoothTime] = useState(currentTime)

  useEffect(() => {
    if (!isFullscreen) return

    let animId
    const sampleTime = () => {
      if (audioRef?.current && !audioRef.current.paused && !isSeekingRef.current) {
        setSmoothTime(audioRef.current.currentTime)
      } else if (!isSeekingRef.current) {
        setSmoothTime(currentTime)
      }
      animId = requestAnimationFrame(sampleTime)
    }

    animId = requestAnimationFrame(sampleTime)
    return () => {
      if (animId) cancelAnimationFrame(animId)
    }
  }, [isFullscreen, isPlaying, currentTime, audioRef])

  const activeTime = isSeekingRef.current && seekTime !== null ? seekTime : smoothTime
  const progress = effectiveDuration > 0 ? Math.min(100, Math.max(0, (activeTime / effectiveDuration) * 100)) : 0

  const formatTime = (seconds) => {
    if (!seconds || !isFinite(seconds)) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Dynamic color extraction from artwork
  useEffect(() => {
    if (currentSong?.coverUrl) {
      extractColorsFromImage(currentSong.coverUrl, (res) => {
        setDynamicBg(res.darkGrad)
        setMeshColors(res)
      })
    } else {
      setDynamicBg(null)
      setMeshColors(null)
    }
  }, [currentSong?.coverUrl])

  // Fetch real synced lyrics from LRCLIB API with search fallback and state reset
  useEffect(() => {
    // ALWAYS reset stale lyrics from previous song immediately
    setFetchedLyrics(null)

    if (!currentSong?.title) return
    if (currentSong?.lyrics) return

    let isMounted = true

    const fetchLrc = async () => {
      try {
        const { trackName, artistName } = parseTrackTitleAndArtist(currentSong.title, currentSong.artist)

        if (!trackName) return

        let data = null

        // 1. Try exact match API first with parsed track & artist
        try {
          const exactUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(trackName)}${artistName ? `&artist_name=${encodeURIComponent(artistName)}` : ''}`
          const res = await fetch(exactUrl)
          if (res.ok) {
            data = await res.json()
          }
        } catch (err) {
          // ignore exact match fetch error, fallback to search
        }

        // 2. If exact match fails/404, fallback to search query API
        if (!data) {
          try {
            const query = `${trackName} ${artistName}`.trim()
            const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`
            const searchRes = await fetch(searchUrl)
            if (searchRes.ok) {
              const results = await searchRes.json()
              if (Array.isArray(results) && results.length > 0) {
                // Find result with synced lyrics or plain lyrics
                data = results.find((r) => r.syncedLyrics || r.plainLyrics) || results[0]
              }
            }
          } catch (err) {
            // ignore search fetch error
          }
        }

        if (data && isMounted) {
          if (data.syncedLyrics) {
            const parsed = parseLrc(data.syncedLyrics)
            if (parsed.length > 0) {
              setFetchedLyrics(parsed)
              return
            }
          }
          if (data.plainLyrics) {
            const lines = data.plainLyrics.split('\n').filter((l) => l.trim())
            const dur = effectiveDuration || 180
            const step = dur / Math.max(1, lines.length)
            setFetchedLyrics(lines.map((t, idx) => ({ time: Math.round(idx * step * 10) / 10, text: t })))
          }
        }
      } catch (e) {
        console.warn('LRCLIB lyrics fetch warning:', e)
      }
    }

    fetchLrc()
    return () => {
      isMounted = false
    }
  }, [currentSong?.id, currentSong?.title, currentSong?.artist, effectiveDuration, currentSong?.lyrics])

  // Parse or generate lyrics array
  const lyricsList = useMemo(() => {
    if (!currentSong) return []
    if (Array.isArray(currentSong.lyrics) && currentSong.lyrics.length > 0) {
      return currentSong.lyrics
    }
    if (typeof currentSong.lyrics === 'string') {
      const parsed = parseLrc(currentSong.lyrics)
      if (parsed.length > 0) return parsed
    }
    if (fetchedLyrics && fetchedLyrics.length > 0) {
      return fetchedLyrics
    }
    return []
  }, [currentSong, effectiveDuration, fetchedLyrics])

  // Determine active lyric index based on activeTime
  const activeLineIndex = useMemo(() => {
    if (!lyricsList || lyricsList.length === 0) return -1
    let foundIndex = -1
    for (let i = 0; i < lyricsList.length; i++) {
      if (activeTime >= lyricsList[i].time) {
        foundIndex = i
      } else {
        break
      }
    }
    return foundIndex
  }, [lyricsList, activeTime])

  // Track user manual scrolling to pause auto-scroll temporarily
  const [isUserScrolling, setIsUserScrolling] = useState(false)
  const userScrollTimeoutRef = useRef(null)

  const handleContainerScroll = useCallback(() => {
    if (!lyricsContainerRef.current) return
    setIsUserScrolling(true)

    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current)
    }

    userScrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false)
    }, 4500)
  }, [])



// Helper to render word-by-word karaoke text with character-weighted timing interpolation
function renderWordByWord(itemText, lineStartTime, lineEndTime, activeTime, isPast, isUpcoming) {
  if (!itemText) return null
  const words = itemText.trim().split(/\s+/)
  if (words.length === 0) return itemText

  if (isPast) {
    return words.map((w, i) => (
      <span key={i} className="lyric-word is-spoken">{w} </span>
    ))
  }

  if (isUpcoming) {
    return words.map((w, i) => (
      <span key={i} className="lyric-word is-upcoming-word">{w} </span>
    ))
  }

  // Active line: calculate word timing windows weighted by word length
  const totalChars = words.reduce((acc, w) => acc + w.length, 0)
  const duration = Math.max(0.5, lineEndTime - lineStartTime)

  let accumTime = lineStartTime
  return words.map((word, i) => {
    const charRatio = totalChars > 0 ? word.length / totalChars : 1 / words.length
    const wordDur = Math.max(0.12, duration * charRatio)
    const wordStart = accumTime
    const wordEnd = wordStart + wordDur
    accumTime = wordEnd

    const isSpoken = activeTime >= wordEnd
    const isActiveWord = activeTime >= wordStart && activeTime < wordEnd

    let wordClass = 'is-upcoming-word'
    if (isSpoken) wordClass = 'is-spoken'
    else if (isActiveWord) wordClass = 'is-active-word'

    return (
      <span key={i} className={`lyric-word ${wordClass}`}>
        {word}{' '}
      </span>
    )
  })
}

// Physics-based Smooth RAF Auto-Scroll Algorithm
  const scrollToActiveLine = useCallback((immediate = false) => {
    const container = lyricsContainerRef.current
    const activeEl = activeLineRef.current
    if (!container || !activeEl) return

    const containerHeight = container.clientHeight
    const activeHeight = activeEl.offsetHeight
    const activeTop = activeEl.offsetTop

    // Center active line EXACTLY in the vertical middle of the viewport
    const targetScroll = activeTop - containerHeight / 2 + activeHeight / 2

    if (immediate) {
      container.scrollTop = targetScroll
      return
    }

    const startScroll = container.scrollTop
    const distance = targetScroll - startScroll
    if (Math.abs(distance) < 2) return

    let startTime = null
    const duration = 480 // ms for smooth spring-like easing

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp
      const elapsed = timestamp - startTime
      const progress = Math.min(1, elapsed / duration)
      const ease = 1 - Math.pow(1 - progress, 3)

      container.scrollTop = startScroll + distance * ease

      if (progress < 1) {
        requestAnimationFrame(step)
      }
    }

    requestAnimationFrame(step)
  }, [])

  // Trigger GPU translateY spring scroll using exact viewport getBoundingClientRect delta
  useEffect(() => {
    if (!isFullscreen) return
    if (isUserScrolling) return

    if (activeLineRef.current) {
      const rect = activeLineRef.current.getBoundingClientRect()
      const activeCenter = rect.top + rect.height / 2
      const screenCenter = window.innerHeight / 2
      const delta = activeCenter - screenCenter

      setTranslateYOffset((prev) => prev + delta)
    }
  }, [activeLineIndex, isFullscreen, isUserScrolling])

  // Keyboard shortcut listener (Escape key to exit fullscreen)
  useEffect(() => {
    if (!isFullscreen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setFullscreen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreen, setFullscreen])

  // Seek bar event handler
  const getClientX = (e) => {
    if (e.touches && e.touches.length > 0) return e.touches[0].clientX
    if (e.changedTouches && e.changedTouches.length > 0) return e.changedTouches[0].clientX
    return e.clientX
  }

  const getTargetTimeFromEvent = useCallback((e, barElement) => {
    if (!barElement || !effectiveDuration) return 0
    const rect = barElement.getBoundingClientRect()
    if (!rect || rect.width <= 0) return 0
    const clientX = getClientX(e)
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return percent * effectiveDuration
  }, [effectiveDuration])

  const handleSeekStart = useCallback((e) => {
    if (!effectiveDuration) return
    const barElement = e.currentTarget
    if (!barElement) return

    isSeekingRef.current = true
    const initialTime = getTargetTimeFromEvent(e, barElement)
    setSeekTime(initialTime)

    let latestTime = initialTime

    const onMove = (moveEvent) => {
      if (moveEvent.cancelable && moveEvent.type === 'touchmove') {
        moveEvent.preventDefault()
      }
      latestTime = getTargetTimeFromEvent(moveEvent, barElement)
      setSeekTime(latestTime)
    }

    const onUp = () => {
      isSeekingRef.current = false
      setSeekTime(null)
      seek(latestTime)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onUp)
      document.removeEventListener('touchcancel', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onUp)
    document.addEventListener('touchcancel', onUp)
  }, [effectiveDuration, seek, getTargetTimeFromEvent])

  return (
    <div className={`fullscreen-overlay animated-fade-in ${isFullscreen ? 'is-active' : ''} ${viewMode === 'immersive' ? 'is-immersive-mode' : ''}`}>
      {/* Dynamic Ambient Mesh Canvas Background */}
      <div className="fullscreen-bg">
        {displayCoverUrl && (
          <div
            className="fullscreen-bg-image"
            style={{ backgroundImage: `url(${displayCoverUrl})` }}
          />
        )}
        <div
          className="fullscreen-bg-gradient"
          style={dynamicBg ? { background: dynamicBg } : undefined}
        />
        {meshColors && (
          <div className="fullscreen-mesh-canvas">
            <div
              className="mesh-blob mesh-blob-1"
              style={{ background: meshColors.primary }}
            />
            <div
              className="mesh-blob mesh-blob-2"
              style={{ background: meshColors.secondary }}
            />
            <div
              className="mesh-blob mesh-blob-3"
              style={{ background: `rgba(${meshColors.r1}, ${meshColors.g2}, ${meshColors.b1}, 0.6)` }}
            />
          </div>
        )}
      </div>

      {/* Floating Top Header Controls */}
      <div className="fullscreen-header-actions">
        <div className="fullscreen-view-toggle">
          <button
            className={`view-toggle-btn ${viewMode === 'split' ? 'is-active' : ''}`}
            onClick={() => setViewMode('split')}
            title="Split View (Artwork + Lyrics)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="3" y="3" width="8" height="18" rx="2"/>
              <rect x="13" y="3" width="8" height="18" rx="2"/>
            </svg>
            <span>Split</span>
          </button>
          <button
            className={`view-toggle-btn ${viewMode === 'immersive' ? 'is-active' : ''}`}
            onClick={() => setViewMode('immersive')}
            title="Immersive View (Full Lyrics Focus)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="7" y1="8" x2="17" y2="8"/>
              <line x1="7" y1="12" x2="17" y2="12"/>
              <line x1="7" y1="16" x2="13" y2="16"/>
            </svg>
            <span>Immersive</span>
          </button>
        </div>

        <button
          className="fullscreen-close-btn"
          onClick={() => setFullscreen(false)}
          aria-label="Close full screen lyrics"
          title="Close (Esc)"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Main Content Layout */}
      <div className={`fullscreen-content-grid ${viewMode === 'immersive' ? 'view-mode-immersive' : ''}`}>
        {/* Left Side: Artwork, Info & Player Controls */}
        <div className="fullscreen-left-panel">
          <div className="fullscreen-top-section">
            <div
              className="fullscreen-cover-art-wrapper"
            onClick={() => coverInputRef.current?.click()}
            title="Click to change cover image"
          >
            <input
              type="file"
              ref={coverInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleCoverImageChange}
            />
            {displayCoverUrl ? (
              <img
                src={displayCoverUrl}
                alt={currentSong?.title || 'Cover'}
                className="fullscreen-cover-art"
              />
            ) : (
              <div className="fullscreen-cover-placeholder">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
            )}
            <div className="fullscreen-cover-overlay">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              <span>Change Cover</span>
            </div>
          </div>

          {/* Song Metadata */}
          <div className="fullscreen-meta">
            <MarqueeText 
              text={currentSong?.title || 'No Song Playing'} 
              className="fullscreen-song-title" 
            />
            <h2 className="fullscreen-song-artist truncate">
              {currentSong?.artist || 'Unknown Artist'}
            </h2>
          </div>
          </div>

          <div className="fullscreen-bottom-section">
          {/* Interactive Seek Bar */}
          <div className="fullscreen-seek-container">
            <div
              className="fullscreen-seek-bar"
              onMouseDown={handleSeekStart}
              onTouchStart={handleSeekStart}
            >
              <div className="fullscreen-seek-track">
                <div
                  className="fullscreen-seek-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <div className="fullscreen-seek-times">
              <span>{formatTime(activeTime)}</span>
              <span>{formatTime(effectiveDuration)}</span>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="fullscreen-controls">
            <button
              className={`fullscreen-ctrl-btn ${shuffle ? 'is-active' : ''}`}
              onClick={toggleShuffle}
              aria-label="Shuffle"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16,3 21,3 21,8" />
                <line x1="4" y1="20" x2="21" y2="3" />
                <polyline points="21,16 21,21 16,21" />
                <line x1="15" y1="15" x2="21" y2="21" />
                <line x1="4" y1="4" x2="9" y2="9" />
              </svg>
            </button>

            <button
              className="fullscreen-ctrl-btn"
              onClick={playPrevious}
              aria-label="Previous"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </button>

            <button
              className={`fullscreen-play-btn ${isPlaying ? 'is-playing' : ''}`}
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isBuffering ? (
                <svg className="spinner-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                </svg>
              ) : isPlaying ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <button
              className="fullscreen-ctrl-btn"
              onClick={playNext}
              aria-label="Next"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>

            <button
              className={`fullscreen-ctrl-btn ${repeat !== 'off' ? 'is-active' : ''}`}
              onClick={cycleRepeat}
              aria-label="Repeat"
            >
              {repeat === 'one' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="17,1 21,5 17,9" />
                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <polyline points="7,23 3,19 7,15" />
                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                  <text x="12" y="15" textAnchor="middle" fill="currentColor" stroke="none" fontSize="8" fontWeight="bold">1</text>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="17,1 21,5 17,9" />
                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <polyline points="7,23 3,19 7,15" />
                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
              )}
            </button>
          </div>
          </div>
        </div>

        {/* Right Side: Lyrics or Queue */}
        <div className="fullscreen-right-panel">
          {activeRightView === 'lyrics' ? (
            <div
              className="fullscreen-lyrics-scroll-area"
              ref={lyricsContainerRef}
              onScroll={handleContainerScroll}
            >
              <div
                className="fullscreen-lyrics-list-transform"
                style={{ transform: `translate3d(0, -${translateYOffset}px, 0)` }}
              >
                {lyricsList.length > 0 ? (
                  lyricsList.map((item, index) => {
                    const isActive = index === activeLineIndex
                    const isPast = index < activeLineIndex
                    const distance = Math.abs(index - activeLineIndex)
                    const isDots = item.isInstrumental || item.text === '•••'
                    
                    let dot1Lit = false
                    let dot2Lit = false
                    let dot3Lit = false

                    if (isDots && isActive) {
                      const nextItem = lyricsList[index + 1]
                      const nextTime = nextItem ? nextItem.time : 26.0
                      const remaining = nextTime - activeTime
                      // Lead-in countdown matching video (12.5s window before vocals)
                      if (remaining <= 12.5 && remaining > 0) dot1Lit = true
                      if (remaining <= 8.5 && remaining > 0) dot2Lit = true
                      if (remaining <= 4.5 && remaining > 0) dot3Lit = true
                    }

                    if (isDots) {
                      return (
                        <div
                          key={index}
                          ref={isActive ? activeLineRef : null}
                          className={`fullscreen-lyric-dots-wrapper ${isActive ? 'is-active' : ''} ${isPast ? 'is-past' : ''}`}
                        >
                          <span className="fullscreen-lyric-dots">
                            <span className={`dot dot-1 ${dot1Lit ? 'is-lit' : ''}`}>•</span>
                            <span className={`dot dot-2 ${dot2Lit ? 'is-lit' : ''}`}>•</span>
                            <span className={`dot dot-3 ${dot3Lit ? 'is-lit' : ''}`}>•</span>
                          </span>
                        </div>
                      )
                    }

                    // Distance class calculation for Apple Music / Spicetify focal depth blur
                    let distClass = 'distance-far'
                    if (isActive) distClass = 'distance-0'
                    else if (distance === 1) distClass = 'distance-1'
                    else if (distance === 2) distClass = 'distance-2'

                    const nextItem = lyricsList[index + 1]
                    const lineStartTime = item.time
                    const lineEndTime = nextItem ? nextItem.time : (effectiveDuration || lineStartTime + 4)
                    const isUpcoming = index > activeLineIndex

                    return (
                      <p
                        key={index}
                        ref={isActive ? activeLineRef : null}
                        className={`fullscreen-lyric-line ${isActive ? 'is-active' : ''} ${isPast ? 'is-past' : 'is-upcoming'} ${distClass}`}
                        onClick={() => {
                          seek(item.time)
                          setIsUserScrolling(false)
                        }}
                        title={`Jump to ${formatTime(item.time)}`}
                      >
                        {renderWordByWord(item.text, lineStartTime, lineEndTime, activeTime, isPast, isUpcoming)}
                      </p>
                    )
                  })
                ) : (
                  <div className="fullscreen-lyrics-empty">
                    <p>No lyrics available for this song.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="fullscreen-queue-area">
              <h3 className="fullscreen-queue-title">Playing Next</h3>
              <div className="fullscreen-queue-list">
                {queue.length > 0 ? (
                  queue.map((track, idx) => (
                    <div key={`${track.id}-${idx}`} className="fullscreen-queue-item" onClick={() => playSong(track)}>
                      <div className="fullscreen-queue-cover-container">
                        {track.coverUrl ? (
                          <img 
                            src={track.coverUrl} 
                            alt={track.title} 
                            className="fullscreen-queue-cover"
                            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                          />
                        ) : null}
                        <div className="fullscreen-queue-cover fallback" style={{ display: track.coverUrl ? 'none' : 'flex' }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 18V5l12-2v13"></path>
                            <circle cx="6" cy="18" r="3"></circle>
                            <circle cx="18" cy="16" r="3"></circle>
                          </svg>
                        </div>
                      </div>
                      <div className="fullscreen-queue-info">
                        <div className="fullscreen-queue-track-title truncate">{track.title}</div>
                        <div className="fullscreen-queue-track-artist truncate">{track.artist}</div>
                      </div>
                      <button className="fullscreen-queue-remove" onClick={(e) => { e.stopPropagation(); removeFromQueue(idx); }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="fullscreen-queue-empty">
                    <p>Queue is empty</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Right Toggles */}
      <div className="fullscreen-view-toggles">
        <button
          className={`fullscreen-view-toggle-btn ${activeRightView === 'lyrics' ? 'is-active' : ''}`}
          onClick={() => setActiveRightView('lyrics')}
          aria-label="Lyrics"
          title="Lyrics"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            <line x1="9" y1="10" x2="15" y2="10"></line>
            <line x1="9" y1="14" x2="15" y2="14"></line>
          </svg>
        </button>
        <button
          className={`fullscreen-view-toggle-btn ${activeRightView === 'queue' ? 'is-active' : ''}`}
          onClick={() => setActiveRightView('queue')}
          aria-label="Queue"
          title="Queue"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  )
}
