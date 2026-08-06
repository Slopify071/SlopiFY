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

  // 60 FPS High-Precision Continuous Time Interpolation Loop
  const [smoothTime, setSmoothTime] = useState(currentTime)
  const lastTimeRef = useRef(currentTime)
  const lastFrameRef = useRef(null)

  useEffect(() => {
    lastTimeRef.current = currentTime
    setSmoothTime(currentTime)
  }, [currentTime])

  useEffect(() => {
    if (!isPlaying) {
      setSmoothTime(currentTime)
      lastFrameRef.current = null
      return
    }

    let animId
    const step = (now) => {
      if (lastFrameRef.current !== null) {
        const dt = (now - lastFrameRef.current) / 1000
        setSmoothTime((prev) => {
          if (Math.abs(prev - lastTimeRef.current) > 0.4) {
            return lastTimeRef.current
          }
          return prev + dt
        })
      }
      lastFrameRef.current = now
      animId = requestAnimationFrame(step)
    }

    lastFrameRef.current = null
    animId = requestAnimationFrame(step)

    return () => {
      if (animId) cancelAnimationFrame(animId)
    }
  }, [isPlaying, currentTime])

  const activeTime = isSeekingRef.current && seekTime !== null ? seekTime : (isPlaying ? smoothTime : currentTime)
  const progress = effectiveDuration > 0 ? Math.min(100, Math.max(0, (activeTime / effectiveDuration) * 100)) : 0

  const formatTime = (seconds) => {
    if (!seconds || !isFinite(seconds)) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Fetch real synced lyrics from LRCLIB API if track has no custom lyrics
  useEffect(() => {
    if (!currentSong?.title) {
      setFetchedLyrics(null)
      return
    }
    if (currentSong?.lyrics) {
      setFetchedLyrics(null)
      return
    }

    let isMounted = true
    const fetchLrc = async () => {
      try {
        const title = encodeURIComponent(currentSong.title.replace(/\([^)]*\)/g, '').trim())
        const artist = encodeURIComponent((currentSong.artist || '').replace(/\([^)]*\)/g, '').trim())
        const url = `https://lrclib.net/api/get?track_name=${title}${artist ? `&artist_name=${artist}` : ''}`
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          if (isMounted) {
            if (data.syncedLyrics) {
              setFetchedLyrics(parseLrc(data.syncedLyrics))
            } else if (data.plainLyrics) {
              const lines = data.plainLyrics.split('\n').filter((l) => l.trim())
              const dur = effectiveDuration || 180
              const step = dur / Math.max(1, lines.length)
              setFetchedLyrics(lines.map((t, idx) => ({ time: Math.round(idx * step * 10) / 10, text: t })))
            }
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

  // Auto-scroll lyrics container to keep active line centered
  useEffect(() => {
    if (!isFullscreen) return
    if (activeLineRef.current && lyricsContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  }, [activeLineIndex, isFullscreen])

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

  if (!isFullscreen) return null

  return (
    <div className="fullscreen-overlay animated-fade-in">
      {/* Dynamic Ambient Background */}
      <div className="fullscreen-bg">
        {displayCoverUrl && (
          <div
            className="fullscreen-bg-image"
            style={{ backgroundImage: `url(${displayCoverUrl})` }}
          />
        )}
      </div>

      {/* Top Right Close Button */}
      <button
        className="fullscreen-close-btn"
        onClick={() => setFullscreen(false)}
        aria-label="Close full screen player"
        title="Close (Esc)"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {/* Main Content Layout */}
      <div className="fullscreen-content-grid">
        {/* Left Side: Artwork, Info & Player Controls */}
        <div className="fullscreen-left-panel">
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
            <h1 className="fullscreen-song-title truncate">
              {currentSong?.title || 'No Song Playing'}
            </h1>
            <h2 className="fullscreen-song-artist truncate">
              {currentSong?.artist || 'Unknown Artist'}
            </h2>
          </div>

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

        {/* Right Side: Lyrics or Queue */}
        <div className="fullscreen-right-panel">
          {activeRightView === 'lyrics' ? (
            <div className="fullscreen-lyrics-scroll-area" ref={lyricsContainerRef}>
              {lyricsList.length > 0 ? (
              lyricsList.map((item, index) => {
                const isActive = index === activeLineIndex
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

                let lineProgress = 0
                if (isActive && !isDots) {
                  const nextItem = lyricsList[index + 1]
                  const startTime = item.time
                  const endTime = nextItem ? nextItem.time : (effectiveDuration || startTime + 4)
                  const lineDur = Math.max(0.5, endTime - startTime)
                  const elapsed = Math.max(0, activeTime - startTime)
                  lineProgress = Math.min(100, Math.max(0, (elapsed / lineDur) * 100))
                }

                const chars = Array.from(item.text || '')
                const totalChars = chars.length
                const charProgress = lineProgress / 100

                if (isDots) {
                  return (
                    <div
                      key={index}
                      ref={isActive ? activeLineRef : null}
                      className="fullscreen-lyric-dots-wrapper"
                    >
                      <span className="fullscreen-lyric-dots">
                        <span className={`dot dot-1 ${dot1Lit ? 'is-lit' : ''}`}>•</span>
                        <span className={`dot dot-2 ${dot2Lit ? 'is-lit' : ''}`}>•</span>
                        <span className={`dot dot-3 ${dot3Lit ? 'is-lit' : ''}`}>•</span>
                      </span>
                    </div>
                  )
                }

                return (
                  <p
                    key={index}
                    ref={isActive ? activeLineRef : null}
                    className={`fullscreen-lyric-line ${isActive ? 'is-active' : ''}`}
                    style={isActive ? { '--line-progress': `${lineProgress.toFixed(1)}%` } : undefined}
                    onClick={() => seek(item.time)}
                    title={`Jump to ${formatTime(item.time)}`}
                  >
                    {item.text}
                  </p>
                )
              })
            ) : (
              <div className="fullscreen-lyrics-empty">
                <p>No lyrics available for this song.</p>
              </div>
            )}
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
