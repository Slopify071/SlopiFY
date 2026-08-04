import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePlayer } from '../context/PlayerContext'
import { subscribeToUserPlaylists, deletePlaylist } from '../services/firestore'
import CreatePlaylistModal from '../components/Playlist/CreatePlaylistModal'
import ConfirmModal from '../components/Common/ConfirmModal'
import './Playlists.css'

export default function Playlists() {
  const { currentUser } = useAuth()
  const { showToast } = usePlayer()
  const navigate = useNavigate()
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [playlistToDelete, setPlaylistToDelete] = useState(null)

  useEffect(() => {
    let isMounted = true

    // Maximum 400ms skeleton loading cap so loading screen never hangs
    const skeletonTimer = setTimeout(() => {
      if (isMounted) setLoading(false)
    }, 400)

    const unsubscribe = subscribeToUserPlaylists(
      currentUser?.uid,
      (data) => {
        if (isMounted) {
          clearTimeout(skeletonTimer)
          setPlaylists(data)
          setLoading(false)
        }
      },
      (err) => {
        console.error('Failed to load playlists:', err)
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
  }, [currentUser?.uid])

  const handleDelete = (e, playlist) => {
    e.preventDefault()
    e.stopPropagation()
    setPlaylistToDelete(playlist)
  }

  const handleConfirmDeletePlaylist = async () => {
    if (!playlistToDelete) return
    const pl = playlistToDelete
    setPlaylistToDelete(null)
    try {
      await deletePlaylist(pl.id)
      showToast(`Playlist "${pl.name}" deleted`)
    } catch (err) {
      console.error('Error deleting playlist:', err)
      showToast('Failed to delete playlist')
    }
  }

  const handlePlaylistCreated = (newId) => {
    if (newId) {
      navigate(`/playlist/${newId}`)
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="playlists-header-row">
          <div>
            <h1>Playlists</h1>
            <p>Your personal & shared collections</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="playlists-grid">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="playlist-card card skeleton-card" style={{ height: 260 }}>
              <div className="skeleton-box" style={{ width: '100%', height: '70%' }} />
              <div style={{ padding: 12 }}>
                <div className="skeleton-box" style={{ width: '60%', height: 16, marginBottom: 8 }} />
                <div className="skeleton-box" style={{ width: '40%', height: 12 }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="playlists-grid">
          {playlists.map((playlist, index) => {
            const isOwner = playlist.ownerUid === currentUser?.uid || playlist.ownerUid === 'anonymous'
            const songCount = playlist.songs?.length || 0

            return (
              <Link
                key={playlist.id}
                to={`/playlist/${playlist.id}`}
                className="playlist-card card animate-fade-in-up"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className="playlist-card-cover">
                  {playlist.coverUrl ? (
                    <img src={playlist.coverUrl} alt={playlist.name} className="playlist-card-cover-img" />
                  ) : (
                    <div className="playlist-card-cover-placeholder">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18V5l12-2v13" />
                        <circle cx="6" cy="18" r="3" />
                        <circle cx="18" cy="16" r="3" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="playlist-card-info">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 className="playlist-card-name truncate">{playlist.name}</h3>
                    {isOwner && (
                      <button
                        className="btn-icon"
                        style={{ padding: 4, color: 'var(--text-muted)' }}
                        title="Delete playlist"
                        onClick={(e) => handleDelete(e, playlist)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="playlist-card-meta">
                    <span>{songCount} {songCount === 1 ? 'song' : 'songs'}</span>
                    {playlist.isCollaborative && (
                      <span className="badge">Collab</span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}

          {/* Create New Card */}
          <div
            className="playlist-card card playlist-card-new animate-fade-in-up"
            style={{ animationDelay: `${playlists.length * 60}ms` }}
            onClick={() => setIsModalOpen(true)}
          >
            <div className="playlist-card-new-content">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Create Playlist</span>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(playlistToDelete)}
        title="Delete Playlist?"
        message={`Are you sure you want to delete "${playlistToDelete?.name || ''}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={handleConfirmDeletePlaylist}
        onCancel={() => setPlaylistToDelete(null)}
      />

      <CreatePlaylistModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handlePlaylistCreated}
        currentUser={currentUser}
      />
    </div>
  )
}
