import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react'
import { useAuth } from '../context/AuthContext'
import { usePlayer } from '../context/PlayerContext'
import {
  subscribeToPlaylistDetail,
  removeSongFromPlaylist,
  reorderPlaylistSongs,
  togglePlaylistCollaboration,
  deletePlaylist,
} from '../services/firestore'
import AddSongModal from '../components/Playlist/AddSongModal'
import './PlaylistDetail.css'

export default function PlaylistDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const { playSong, playAll, showToast } = usePlayer()

  const [playlist, setPlaylist] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let isMounted = true
    setLoading(true)

    // Maximum 400ms skeleton loading cap so page never hangs
    const skeletonTimer = setTimeout(() => {
      if (isMounted) setLoading(false)
    }, 400)

    const unsubscribe = subscribeToPlaylistDetail(
      id,
      (data) => {
        if (isMounted) {
          clearTimeout(skeletonTimer)
          setPlaylist(data)
          setLoading(false)
        }
      },
      (err) => {
        console.error('Failed to load playlist detail:', err)
        if (isMounted) {
          clearTimeout(skeletonTimer)
          setLoading(false)
        }
      }
    )

    return () => {
      isMounted = false
      clearTimeout(skeletonTimer)
      unsubscribe()
    }
  }, [id])

  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const isOwner = playlist?.ownerUid === currentUser?.uid || playlist?.ownerUid === 'anonymous' || !playlist?.ownerUid
  const canEdit = isOwner || playlist?.isCollaborative

  const handlePlayAll = () => {
    if (!playlist?.songs || playlist.songs.length === 0) return
    playAll(playlist.songs, 0)
  }

  const handleShare = async () => {
    const shareCode = playlist?.shareCode || playlist?.id
    const shareUrl = `${window.location.origin}/playlist/${shareCode}`
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      showToast('Share link copied to clipboard!')
      setTimeout(() => setCopied(false), 3000)
    } catch (err) {
      console.error('Failed to copy share link:', err)
      showToast(`Share URL: ${shareUrl}`)
    }
  }

  const handleRemoveSong = async (e, songId) => {
    e.stopPropagation()
    if (!canEdit) return
    try {
      await removeSongFromPlaylist(playlist.id, songId)
      showToast('Song removed from playlist')
    } catch (err) {
      console.error('Failed to remove song:', err)
      showToast('Failed to remove song')
    }
  }

  const handleMoveSong = async (e, index, direction) => {
    e.stopPropagation()
    if (!canEdit || !playlist?.songs) return

    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= playlist.songs.length) return

    const updatedSongs = [...playlist.songs]
    const [moved] = updatedSongs.splice(index, 1)
    updatedSongs.splice(newIndex, 0, moved)

    try {
      await reorderPlaylistSongs(playlist.id, updatedSongs)
    } catch (err) {
      console.error('Failed to reorder playlist songs:', err)
    }
  }

  const handleToggleCollab = async () => {
    if (!isOwner || !playlist) return
    try {
      const nextState = !playlist.isCollaborative
      await togglePlaylistCollaboration(playlist.id, nextState)
      showToast(nextState ? 'Collaborative mode enabled!' : 'Collaborative mode disabled')
    } catch (err) {
      console.error('Failed to toggle collaboration:', err)
    }
  }

  const handleDeletePlaylist = async () => {
    if (!isOwner || !playlist) return
    if (window.confirm(`Are you sure you want to delete "${playlist.name}"?`)) {
      try {
        await deletePlaylist(playlist.id)
        showToast('Playlist deleted')
        navigate('/playlists')
      } catch (err) {
        console.error('Failed to delete playlist:', err)
      }
    }
  }

  if (loading) {
    return (
      <div className="page-content">
        <div className="playlist-detail-header animate-fade-in-up">
          <div className="playlist-detail-cover skeleton-box" style={{ width: 200, height: 200 }} />
          <div className="playlist-detail-info" style={{ flex: 1 }}>
            <div className="skeleton-box" style={{ width: 100, height: 16, marginBottom: 8 }} />
            <div className="skeleton-box" style={{ width: '50%', height: 32, marginBottom: 12 }} />
            <div className="skeleton-box" style={{ width: '30%', height: 16 }} />
          </div>
        </div>
      </div>
    )
  }

  if (!playlist) {
    return (
      <div className="page-content">
        <div className="playlist-detail-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          <h2>Playlist Not Found</h2>
          <p>This playlist may have been deleted or the share code is invalid.</p>
          <button className="btn btn-primary" onClick={() => navigate('/playlists')}>
            Back to Playlists
          </button>
        </div>
      </div>
    )
  }

  const songs = playlist.songs || []

  return (
    <div className="page-content">
      {/* Playlist Header */}
      <div className="playlist-detail-header animate-fade-in-up">
        <div className="playlist-detail-cover">
          {playlist.coverUrl ? (
            <img src={playlist.coverUrl} alt={playlist.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div className="playlist-detail-cover-placeholder">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
          )}
        </div>
        <div className="playlist-detail-info">
          <span className="playlist-detail-type">Playlist</span>
          <h1 className="playlist-detail-name">{playlist.name}</h1>
          {playlist.description && (
            <p className="playlist-detail-description">{playlist.description}</p>
          )}
          <div className="playlist-detail-meta">
            <span>Created by {playlist.ownerName || 'Friend'}</span>
            <span className="playlist-detail-dot">•</span>
            <span>{songs.length} {songs.length === 1 ? 'song' : 'songs'}</span>
            {playlist.isCollaborative && <span className="badge">Collaborative</span>}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="playlist-detail-actions animate-fade-in-up delay-1">
        <button className="btn btn-primary btn-lg" onClick={handlePlayAll} disabled={songs.length === 0}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          Play All
        </button>

        {canEdit && (
          <button className="btn btn-secondary" onClick={() => setIsAddModalOpen(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Songs
          </button>
        )}

        <button className="btn btn-secondary" onClick={handleShare}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          {copied ? 'Link Copied!' : 'Share'}
        </button>

        {isOwner && (
          <>
            <button
              className={`btn ${playlist.isCollaborative ? 'btn-primary' : 'btn-secondary'}`}
              onClick={handleToggleCollab}
              title="Toggle collaborative mode"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              {playlist.isCollaborative ? 'Collab Active' : 'Collab Off'}
            </button>

            <button className="btn btn-secondary" onClick={handleDeletePlaylist} title="Delete Playlist">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Delete
            </button>
          </>
        )}
      </div>

      {/* Song List */}
      {songs.length === 0 ? (
        <div className="playlist-detail-empty">
          <p>No songs in this playlist yet.</p>
          {canEdit && (
            <button className="btn btn-primary btn-sm" onClick={() => setIsAddModalOpen(true)}>
              Add Your First Song
            </button>
          )}
        </div>
      ) : (
        <div className="playlist-detail-songs">
          {songs.map((song, index) => (
            <div
              key={song.id || index}
              className="playlist-detail-song-row animate-fade-in-up"
              style={{ animationDelay: `${(index + 2) * 40}ms` }}
              onClick={() => playSong(song)}
            >
              <div className="playlist-detail-song-index">{index + 1}</div>

              <div className="playlist-detail-song-cover">
                {song.coverUrl ? (
                  <img src={song.coverUrl} alt={song.title} className="library-song-cover-img" />
                ) : (
                  <div className="library-song-cover-placeholder">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18V5l12-2v13" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="18" cy="16" r="3" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="playlist-detail-song-info">
                <span className="playlist-detail-song-title truncate">{song.title}</span>
                <span className="playlist-detail-song-artist truncate">{song.artist || 'Unknown Artist'}</span>
              </div>

              <span className="playlist-detail-song-duration">{formatDuration(song.duration)}</span>

              {canEdit && (
                <div className="playlist-detail-reorder-btns" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="playlist-detail-reorder-btn"
                    disabled={index === 0}
                    onClick={(e) => handleMoveSong(e, index, -1)}
                    aria-label="Move Up"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </button>
                  <button
                    className="playlist-detail-reorder-btn"
                    disabled={index === songs.length - 1}
                    onClick={(e) => handleMoveSong(e, index, 1)}
                    aria-label="Move Down"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </div>
              )}

              {canEdit && (
                <button
                  className="btn-icon"
                  style={{ color: 'var(--text-muted)', padding: 4 }}
                  onClick={(e) => handleRemoveSong(e, song.id)}
                  title="Remove from playlist"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Song Modal */}
      <AddSongModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        playlistId={playlist.id}
        existingSongIds={songs.map((s) => s.id)}
      />
    </div>
  )
}
