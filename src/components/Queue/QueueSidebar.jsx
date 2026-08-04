import { useEffect, useRef } from 'react'
import { usePlayer } from '../../context/PlayerContext'
import './QueueSidebar.css'

export default function QueueSidebar() {
  const {
    isQueueOpen,
    setQueueOpen,
    currentSong,
    isPlaying,
    togglePlay,
    playSong,
    queue,
    removeFromQueue,
    clearQueue,
  } = usePlayer()

  const sidebarRef = useRef(null)

  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isQueueOpen && e.key === 'Escape') {
        setQueueOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isQueueOpen, setQueueOpen])

  return (
    <>
      {/* Backdrop overlay for mobile / click outside */}
      <div
        className={`queue-backdrop ${isQueueOpen ? 'is-visible' : ''}`}
        onClick={() => setQueueOpen(false)}
      />

      <aside
        ref={sidebarRef}
        className={`queue-sidebar ${isQueueOpen ? 'is-open' : ''}`}
        aria-label="Play Queue Sidebar"
      >
        <div className="queue-sidebar-inner">
          {/* Sidebar Header */}
          <div className="queue-header">
            <div className="queue-header-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              <h2>Play Queue</h2>
            </div>

            <div className="queue-header-actions">
              {queue.length > 0 && (
                <button
                  className="btn-clear-queue"
                  onClick={clearQueue}
                  title="Clear all queued songs"
                >
                  Clear
                </button>
              )}
              <button
                className="btn-icon queue-close-btn"
                onClick={() => setQueueOpen(false)}
                aria-label="Close queue"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Scrollable Container */}
          <div className="queue-body custom-scrollbar">
            {/* Now Playing Section */}
            <div className="queue-section">
              <h3 className="queue-section-title">Now Playing</h3>
              {currentSong ? (
                <div className="queue-now-playing-card">
                  <div className="queue-song-cover">
                    {currentSong.coverUrl ? (
                      <img src={currentSong.coverUrl} alt={currentSong.title} loading="lazy" />
                    ) : (
                      <div className="queue-cover-placeholder">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 18V5l12-2v13" />
                          <circle cx="6" cy="18" r="3" />
                          <circle cx="18" cy="16" r="3" />
                        </svg>
                      </div>
                    )}
                    <button
                      className="queue-play-btn"
                      onClick={togglePlay}
                      aria-label={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isPlaying ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>
                  </div>

                  <div className="queue-song-info">
                    <span className="queue-song-title truncate">{currentSong.title}</span>
                    <span className="queue-song-artist truncate">{currentSong.artist || 'Unknown Artist'}</span>
                  </div>

                  <div className="queue-playing-indicator">
                    {isPlaying ? (
                      <div className="playing-bars">
                        <span className="bar bar-1" />
                        <span className="bar bar-2" />
                        <span className="bar bar-3" />
                      </div>
                    ) : (
                      <span className="queue-duration">{formatDuration(currentSong.duration)}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="queue-empty-card">
                  <p>No track currently playing</p>
                </div>
              )}
            </div>

            {/* Up Next Section */}
            <div className="queue-section">
              <div className="queue-section-header">
                <h3 className="queue-section-title">Next In Queue</h3>
                {queue.length > 0 && <span className="queue-badge">{queue.length}</span>}
              </div>

              {queue.length > 0 ? (
                <div className="queue-list">
                  {queue.map((song, index) => (
                    <div key={`${song.id}-${index}`} className="queue-item">
                      <span className="queue-item-index">{index + 1}</span>

                      <div className="queue-song-cover" onClick={() => playSong(song)}>
                        {song.coverUrl ? (
                          <img src={song.coverUrl} alt={song.title} loading="lazy" />
                        ) : (
                          <div className="queue-cover-placeholder">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M9 18V5l12-2v13" />
                              <circle cx="6" cy="18" r="3" />
                              <circle cx="18" cy="16" r="3" />
                            </svg>
                          </div>
                        )}
                        <div className="queue-item-play-overlay">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>

                      <div className="queue-song-info" onClick={() => playSong(song)}>
                        <span className="queue-song-title truncate">{song.title}</span>
                        <span className="queue-song-artist truncate">{song.artist || 'Unknown Artist'}</span>
                      </div>

                      <span className="queue-duration">{formatDuration(song.duration)}</span>

                      <button
                        className="btn-icon queue-remove-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeFromQueue(index)
                        }}
                        title="Remove from queue"
                        aria-label="Remove from queue"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="queue-empty-state">
                  <div className="queue-empty-icon">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="8" y1="6" x2="21" y2="6" />
                      <line x1="8" y1="12" x2="21" y2="12" />
                      <line x1="8" y1="18" x2="21" y2="18" />
                      <line x1="3" y1="6" x2="3.01" y2="6" />
                      <line x1="3" y1="12" x2="3.01" y2="12" />
                      <line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                  </div>
                  <h4>Queue is empty</h4>
                  <p>Click "Add to Queue" on any track in your library to add songs here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
