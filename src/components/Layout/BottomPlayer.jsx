import { useState } from 'react'
import './BottomPlayer.css'

export default function BottomPlayer() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(35)

  // Placeholder song data — will be wired to PlayerContext in Phase 5
  const currentSong = {
    title: 'No song playing',
    artist: 'Select a song to start',
    coverArt: null,
  }

  const hasSong = false

  return (
    <div className={`bottom-player ${hasSong ? 'has-song' : ''}`}>
      {/* Song Info */}
      <div className="player-song-info">
        <div className="player-cover-art">
          {currentSong.coverArt ? (
            <img src={currentSong.coverArt} alt="Cover" />
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
          <span className="player-song-title truncate">{currentSong.title}</span>
          <span className="player-song-artist truncate">{currentSong.artist}</span>
        </div>
      </div>

      {/* Player Controls */}
      <div className="player-controls">
        <div className="player-buttons">
          {/* Shuffle */}
          <button className="btn-icon player-btn-secondary" aria-label="Shuffle">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16,3 21,3 21,8" />
              <line x1="4" y1="20" x2="21" y2="3" />
              <polyline points="21,16 21,21 16,21" />
              <line x1="15" y1="15" x2="21" y2="21" />
              <line x1="4" y1="4" x2="9" y2="9" />
            </svg>
          </button>

          {/* Previous */}
          <button className="btn-icon player-btn-secondary" aria-label="Previous">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          {/* Play/Pause */}
          <button
            className="btn-icon player-btn-play"
            onClick={() => setIsPlaying(!isPlaying)}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Next */}
          <button className="btn-icon player-btn-secondary" aria-label="Next">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>

          {/* Repeat */}
          <button className="btn-icon player-btn-secondary" aria-label="Repeat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17,1 21,5 17,9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7,23 3,19 7,15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
          </button>
        </div>

        {/* Seek Bar */}
        <div className="player-seek">
          <span className="player-time">0:00</span>
          <div className="player-seek-bar">
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
          <span className="player-time">0:00</span>
        </div>
      </div>

      {/* Volume & Extras */}
      <div className="player-extras">
        {/* Queue button */}
        <button className="btn-icon player-btn-secondary" aria-label="Queue">
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
          <button className="btn-icon player-btn-secondary" aria-label="Volume">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          </button>
          <div className="player-volume-bar">
            <div className="player-volume-track">
              <div className="player-volume-fill" style={{ width: '70%' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
