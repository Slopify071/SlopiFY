import { useState, useRef, useEffect } from 'react'
import { subscribeToUserPlaylists, addSongToPlaylist } from '../../services/firestore'
import { getCoverArtUrl } from '../../services/storage'
import { preloadOnHover } from '../../services/audioCache'
import { usePlayer } from '../../context/PlayerContext'
import ConfirmModal from '../Common/ConfirmModal'
import './SongCard.css'

export default function SongCard({ song, index, currentUserId, onPlay, onDelete, onEnqueue }) {
  const [showMenu, setShowMenu] = useState(false)
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false)
  const [userPlaylists, setUserPlaylists] = useState([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [openAbove, setOpenAbove] = useState(false)
  const { showToast } = usePlayer()
  const menuRef = useRef(null)
  const menuBtnRef = useRef(null)

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
        setShowPlaylistMenu(false)
      }
    }
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu])



  // Fetch playlists when playlist submenu opens
  useEffect(() => {
    if (!showPlaylistMenu) return
    const unsubscribe = subscribeToUserPlaylists(currentUserId, (playlists) => {
      setUserPlaylists(playlists)
    })
    return () => unsubscribe()
  }, [showPlaylistMenu, currentUserId])

  const handleDeleteClick = (e) => {
    e.stopPropagation()
    setShowMenu(false)
    setShowDeleteConfirm(true)
  }

  const handleConfirmDelete = async () => {
    setShowDeleteConfirm(false)
    setDeleting(true)
    try {
      if (onDelete) await onDelete(song)
    } catch (err) {
      console.error('Failed to delete song:', err)
      showToast('Failed to delete song')
    } finally {
      setDeleting(false)
    }
  }

  const handleAddToPlaylist = async (e, playlist) => {
    e.stopPropagation()
    try {
      await addSongToPlaylist(playlist.id, song)
      showToast(`Added to "${playlist.name}"`)
      setShowMenu(false)
      setShowPlaylistMenu(false)
    } catch (err) {
      console.error('Failed to add song to playlist:', err)
      showToast('Failed to add song to playlist')
    }
  }

  const isOwner = song.uploaderUid === currentUserId || song.uploaderUid === 'anonymous' || !song.uploaderUid

  return (
    <>
      <div
      data-song-id={song.id}
      className={`library-song-row animate-fade-in-up ${deleting ? 'deleting' : ''} ${showMenu ? 'menu-open' : ''}`}
      onClick={() => onPlay && onPlay(song)}
      onMouseEnter={() => preloadOnHover(song)}
      onTouchStart={() => preloadOnHover(song)}
    >
      <div className="library-song-index">{index + 1}</div>
      <div className="library-song-cover">
        {song.coverUrl ? (
          <img src={getCoverArtUrl(song.coverUrl)} alt={song.title} className="library-song-cover-img" loading="lazy" decoding="async" width="44" height="44" />
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
          ref={menuBtnRef}
          className="btn-icon library-song-more"
          aria-label="More options"
          onClick={() => {
            if (!showMenu && menuBtnRef.current) {
              const btnRect = menuBtnRef.current.getBoundingClientRect()
              const spaceBelow = window.innerHeight - btnRect.bottom
              // Estimated menu height (~220px) + bottom player (~90px)
              setOpenAbove(spaceBelow < 310)
            }
            setShowMenu(!showMenu)
            setShowPlaylistMenu(false)
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>

        {showMenu && (
          <div className={`song-card-menu animate-fade-in-scale ${openAbove ? 'song-card-menu--above' : ''}`}>
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

            <button className="song-menu-item" onClick={() => setShowPlaylistMenu(!showPlaylistMenu)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              Add to Playlist ▸
            </button>

            {showPlaylistMenu && (
              <div className="song-card-submenu">
                {userPlaylists.length === 0 ? (
                  <div className="song-submenu-empty">No playlists created</div>
                ) : (
                  userPlaylists.map((pl) => (
                    <button key={pl.id} className="song-menu-item truncate" onClick={(e) => handleAddToPlaylist(e, pl)}>
                      {pl.name}
                    </button>
                  ))
                )}
              </div>
            )}

            <button
              className="song-menu-item"
              onClick={() => {
                if (song.audioUrl) {
                  navigator.clipboard.writeText(song.audioUrl)
                  showToast('Audio URL copied to clipboard')
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
              <button className="song-menu-item song-menu-item-danger" onClick={handleDeleteClick}>
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

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Track?"
        message={`Are you sure you want to delete "${song.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  )
}
