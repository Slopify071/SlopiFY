import { useState, useRef, useCallback } from 'react'
import { usePlayer } from '../../context/PlayerContext'
import './BottomPlayer.css'

export default function BottomPlayer() {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    muted,
    shuffle,
    repeat,
    queue,
    togglePlay,
    playNext,
    playPrevious,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
  } = usePlayer()

  const [isSeeking, setIsSeeking] = useState(false)
  const seekBarRef = useRef(null)
  const volumeBarRef = useRef(null)

  const hasSong = !!currentSong

  const formatTime = (seconds) => {
    if (!seconds || !isFinite(seconds)) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const effectiveVolume = muted ? 0 : volume

  // --- Seek bar interaction ---
  const handleSeekClick = useCallback((e) => {
    if (!seekBarRef.current || !duration) return
    const rect = seekBarRef.current.getBoundingClientRect()
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seek(percent * duration)
  }, [duration, seek])

  const handleSeekMouseDown = useCallback((e) => {
    setIsSeeking(true)
    handleSeekClick(e)

    const onMove = (moveEvent) => {
      if (!seekBarRef.current || !duration) return
      const rect = seekBarRef.current.getBoundingClientRect()
      const percent = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width))
      seek(percent * duration)
    }
    const onUp = () => {
      setIsSeeking(false)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [duration, seek, handleSeekClick])

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

  return (
    <div className={`bottom-player ${hasSong ? 'has-song' : ''}`}>
      {/* Song Info */}
      <div className="player-song-info">
        <div className="player-cover-art">
          {currentSong?.coverUrl ? (
            <img src={currentSong.coverUrl} alt="Cover" />
          ) : (
            <div className="player-cover-placeholder">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
          )}
        </div>
        <div className="player-song-text">
          <span className="player-song-title truncate">
            {currentSong?.title || 'No song playing'}
          </span>
          <span className="player-song-artist truncate">
            {currentSong?.artist || 'Select a song to start'}
          </span>
        </div>
      </div>

      {/* Player Controls */}
      <div className="player-controls">
        <div className="player-buttons">
          {/* Shuffle */}
          <button
            className={`btn-icon player-btn-secondary ${shuffle ? 'player-btn-active' : ''}`}
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
          <button className="btn-icon player-btn-secondary" onClick={playPrevious} aria-label="Previous">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          {/* Play/Pause */}
          <button
            className={`btn-icon player-btn-play ${isPlaying ? 'is-playing' : ''}`}
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
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
          <button className="btn-icon player-btn-secondary" onClick={playNext} aria-label="Next">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>

          {/* Repeat */}
          <button
            className={`btn-icon player-btn-secondary ${repeat !== 'off' ? 'player-btn-active' : ''}`}
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
          <span className="player-time">{formatTime(currentTime)}</span>
          <div
            className="player-seek-bar"
            ref={seekBarRef}
            onMouseDown={handleSeekMouseDown}
          >
            <div className="player-seek-track">
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
          <span className="player-time">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Volume & Extras */}
      <div className="player-extras">
        {/* Queue button */}
        <button className="btn-icon player-btn-secondary" aria-label="Queue" title={`${queue.length} in queue`}>
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
  )
}
