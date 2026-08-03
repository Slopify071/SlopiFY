import { useState, useRef, useEffect } from 'react'
import './SongCard.css'

export default function SongCard({ song, index, currentUserId, onPlay, onDelete, onEnqueue }) {
  const [showMenu, setShowMenu] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const menuRef = useRef(null)

  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false)
      }
    }
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu])

  const handleDelete = async (e) => {
    e.stopPropagation()
    setShowMenu(false)
    if (window.confirm(`Are you sure you want to delete "${song.title}"?`)) {
      setDeleting(true)
      try {
        if (onDelete) await onDelete(song)
      } catch (err) {
        console.error('Failed to delete song:', err)
      } finally {
        setDeleting(false)
      }
    }
  }

  const isOwner = song.uploaderUid === currentUserId || song.uploaderUid === 'anonymous' || !song.uploaderUid

  return (
    <div
      data-song-id={song.id}
      className={`library-song-row animate-fade-in-up ${deleting ? 'deleting' : ''} ${showMenu ? 'menu-open' : ''}`}
      onClick={() => onPlay && onPlay(song)}
    >
      <div className="library-song-index">{index + 1}</div>
      <div className="library-song-cover">
        {song.coverUrl ? (
          <img src={song.coverUrl} alt={song.title} className="library-song-cover-img" />
        ) : (
          <div className="library-song-cover-placeholder">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
        )}
        <div className="library-song-play-overlay">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>

      <div className="library-song-info">
        <span className="library-song-title truncate">{song.title}</span>
        <span className="library-song-artist truncate">
          {song.artist || 'Unknown Artist'}
          {song.uploaderName && (
            <span className="library-song-uploader"> · {song.uploaderName}</span>
          )}
        </span>
      </div>

      <span className="library-song-album truncate">{song.album || 'Single'}</span>
      <span className="library-song-duration">{formatDuration(song.duration)}</span>

      <div className={`song-card-menu-container ${showMenu ? 'is-active' : ''}`} ref={menuRef} onClick={(e) => e.stopPropagation()}>
        <button
          className="btn-icon library-song-more"
          aria-label="More options"
          onClick={() => setShowMenu(!showMenu)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>

        {showMenu && (
          <div className="song-card-menu animate-fade-in-scale">
            <button className="song-menu-item" onClick={() => { onPlay && onPlay(song); setShowMenu(false); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Play Track
            </button>
            <button className="song-menu-item" onClick={() => { onEnqueue && onEnqueue(song); setShowMenu(false); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add to Queue
            </button>
            <button
              className="song-menu-item"
              onClick={() => {
                if (song.audioUrl) {
                  navigator.clipboard.writeText(song.audioUrl)
                }
                setShowMenu(false)
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy Audio Link
            </button>
            {isOwner && (
              <button className="song-menu-item song-menu-item-danger" onClick={handleDelete}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Delete Track
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
