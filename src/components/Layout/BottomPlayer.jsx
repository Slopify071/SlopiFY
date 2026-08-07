import { useState, useRef, useCallback, useEffect } from 'react'
import { usePlayer } from '../../context/PlayerContext'
import LazyGlass from '../Common/LazyGlass'
import './BottomPlayer.css'

const MarqueeText = ({ text, className }) => {
  const containerRef = useRef(null)
  const textRef = useRef(null)
  const [isOverflowing, setIsOverflowing] = useState(false)

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        const textWidth = textRef.current.scrollWidth
        const containerWidth = containerRef.current.clientWidth
        setIsOverflowing(textWidth > containerWidth + 2)
      }
    }
    
    checkOverflow()
    const observer = new ResizeObserver(checkOverflow)
    if (containerRef.current) {
      observer.observe(containerRef.current)
    }
    return () => observer.disconnect()
  }, [text])

  return (
    <div 
      className={`marquee-container ${className || ''}`} 
      ref={containerRef}
      style={{ overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }}
    >
      <div 
        className={`marquee-content ${isOverflowing ? 'is-marquee' : ''}`}
        style={{ display: 'inline-flex', width: 'max-content' }}
      >
        <span ref={textRef} className="marquee-text" style={{ paddingRight: isOverflowing ? '48px' : '0' }}>
          {text}
        </span>
        {isOverflowing && (
          <span className="marquee-text-clone" aria-hidden="true" style={{ paddingRight: '48px' }}>
            {text}
          </span>
        )}
      </div>
    </div>
  )
}

export default function BottomPlayer() {
  const {
    currentSong,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    volume,
    muted,
    shuffle,
    repeat,
    queue,
    isQueueOpen,
    isFullscreen,
    togglePlay,
    playNext,
    playPrevious,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    toggleQueue,
    toggleFullscreen,
  } = usePlayer()

  const volumeBarRef = useRef(null)

  const formatTime = (seconds) => {
    if (!seconds || !isFinite(seconds)) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const [seekTime, setSeekTime] = useState(null)
  const isSeekingRef = useRef(false)

  const effectiveDuration = duration > 0 ? duration : (currentSong?.duration || 0)
  const activeTime = isSeekingRef.current && seekTime !== null ? seekTime : currentTime
  const progress = effectiveDuration > 0 ? Math.min(100, Math.max(0, (activeTime / effectiveDuration) * 100)) : 0
  const effectiveVolume = muted ? 0 : volume

  const getClientX = (e) => {
    if (e.touches && e.touches.length > 0) {
      return e.touches[0].clientX
    }
    if (e.changedTouches && e.changedTouches.length > 0) {
      return e.changedTouches[0].clientX
    }
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

  // --- Volume bar interaction ---
  const handleVolumeClick = useCallback((e) => {
    if (!volumeBarRef.current) return
    const rect = volumeBarRef.current.getBoundingClientRect()
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setVolume(percent)
  }, [setVolume])

  const handleVolumeMouseDown = useCallback((e) => {
    handleVolumeClick(e)

    const onMove = (moveEvent) => {
      if (!volumeBarRef.current) return
      const rect = volumeBarRef.current.getBoundingClientRect()
      const percent = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width))
      setVolume(percent)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [setVolume, handleVolumeClick])

  // Volume icon based on level
  const VolumeIcon = () => {
    if (muted || effectiveVolume === 0) {
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      )
    }
    if (effectiveVolume < 0.5) {
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      )
    }
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
      </svg>
    )
  }

  const hasSong = !!currentSong

  return (
    <LazyGlass
      className={`bottom-player ${hasSong ? 'has-song' : ''}`}
      radius={16}
      optics={{ frost: 0.3, dispersion: 0.2, curvature: 0.1, bend: 0.1, depth: 0.2, glow: 0.1 }}
    >
      <div className="bottom-player-inner">
      <div className="player-song-info">
        <div 
          className="player-cover-art"
          onClick={() => toggleFullscreen()}
        >
          {currentSong?.coverUrl ? (
            <img src={currentSong.coverUrl} alt="Cover" loading="eager" decoding="async" />
          ) : (
            <div className="player-cover-placeholder">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
          )}
          <div className="fullscreen-hover-overlay">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9"></polyline>
              <polyline points="9 21 3 21 3 15"></polyline>
              <line x1="21" y1="3" x2="14" y2="10"></line>
              <line x1="3" y1="21" x2="10" y2="14"></line>
            </svg>
          </div>
        </div>
        <div className="player-song-text" onClick={() => {
          if (window.matchMedia('(max-width: 768px)').matches) {
            toggleFullscreen()
          }
        }}>
          <MarqueeText 
            text={currentSong?.title || 'No song playing'} 
            className="player-song-title" 
          />
          <span className="player-song-artist truncate">
            {currentSong?.artist || 'Select a song to start'}
            {hasSong && (
              <span className="mobile-time-badge">
                {' '}· {formatTime(activeTime)} / {formatTime(effectiveDuration)}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Player Controls */}
      <div className="player-controls">
        <div className="player-buttons">
          {/* Shuffle */}
          <button
            className={`btn-icon player-btn-secondary player-btn-shuffle ${shuffle ? 'player-btn-active' : ''}`}
            onClick={toggleShuffle}
            aria-label="Shuffle"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16,3 21,3 21,8" />
              <line x1="4" y1="20" x2="21" y2="3" />
              <polyline points="21,16 21,21 16,21" />
              <line x1="15" y1="15" x2="21" y2="21" />
              <line x1="4" y1="4" x2="9" y2="9" />
            </svg>
          </button>

          {/* Previous */}
          <button className="btn-icon player-btn-secondary player-btn-prev" onClick={playPrevious} aria-label="Previous">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          {/* Play/Pause */}
          <button
            className={`btn-icon player-btn-play ${isPlaying ? 'is-playing' : ''} ${isBuffering ? 'is-buffering' : ''}`}
            onClick={togglePlay}
            aria-label={isBuffering ? 'Buffering' : isPlaying ? 'Pause' : 'Play'}
          >
            {isBuffering ? (
              <svg className="spinner-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
              </svg>
            ) : isPlaying ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Next */}
          <button className="btn-icon player-btn-secondary player-btn-next" onClick={playNext} aria-label="Next">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>

          {/* Repeat */}
          <button
            className={`btn-icon player-btn-secondary player-btn-repeat ${repeat !== 'off' ? 'player-btn-active' : ''}`}
            onClick={cycleRepeat}
            aria-label={`Repeat: ${repeat}`}
          >
            {repeat === 'one' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17,1 21,5 17,9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7,23 3,19 7,15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                <text x="12" y="15" textAnchor="middle" fill="currentColor" stroke="none" fontSize="8" fontWeight="bold">1</text>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17,1 21,5 17,9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7,23 3,19 7,15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            )}
          </button>
        </div>

        {/* Seek Bar */}
        <div className="player-seek">
          <span className="player-time">{formatTime(effectiveDuration > 0 ? Math.min(activeTime, effectiveDuration) : activeTime)}</span>
          <div
            className="player-seek-bar"
            onMouseDown={handleSeekStart}
            onTouchStart={handleSeekStart}
          >
            <div className={`player-seek-track ${isBuffering ? 'is-buffering' : ''}`}>
              <div
                className="player-seek-fill"
                style={{ width: `${progress}%` }}
              />
              <div
                className="player-seek-thumb"
                style={{ left: `${progress}%` }}
              />
            </div>
          </div>
          <span className="player-time">{formatTime(effectiveDuration)}</span>
        </div>
      </div>

      {/* Volume & Extras */}
      <div className="player-extras">
        {/* Queue button */}
        <button
          className={`btn-icon player-btn-secondary player-btn-queue ${isQueueOpen ? 'player-btn-active' : ''}`}
          onClick={toggleQueue}
          aria-label="Queue"
          title={`Queue (${queue.length} track${queue.length !== 1 ? 's' : ''})`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </button>

        {/* Volume */}
        <div className="player-volume">
          <button className="btn-icon player-btn-secondary" onClick={toggleMute} aria-label="Volume">
            <VolumeIcon />
          </button>
          <div
            className="player-volume-bar"
            ref={volumeBarRef}
            onMouseDown={handleVolumeMouseDown}
          >
            <div className="player-volume-track">
              <div className="player-volume-fill" style={{ width: `${effectiveVolume * 100}%` }} />
            </div>
          </div>
        </div>
      </div>
      </div>
      {/* Mobile Player Progress Bar */}
      <div className="mobile-player-progress" onMouseDown={handleSeekStart} onTouchStart={handleSeekStart}>
        <div className="mobile-player-progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </LazyGlass>
  )
}
