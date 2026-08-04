import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { subscribeToLibrary, addSongToPlaylist } from '../../services/firestore'
import './AddSongModal.css'

export default function AddSongModal({ isOpen, onClose, playlistId, existingSongIds = [] }) {
  const [songs, setSongs] = useState([])
  const [search, setSearch] = useState('')
  const [addedIds, setAddedIds] = useState(new Set(existingSongIds))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setAddedIds(new Set(existingSongIds))
  }, [existingSongIds])

  useEffect(() => {
    if (!isOpen) return
    const unsubscribe = subscribeToLibrary((fetchedSongs) => {
      setSongs(fetchedSongs)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [isOpen])

  if (!isOpen) return null

  const filteredSongs = songs.filter((s) => {
    const q = search.toLowerCase()
    return (
      s.title?.toLowerCase().includes(q) ||
      s.artist?.toLowerCase().includes(q) ||
      s.album?.toLowerCase().includes(q)
    )
  })

  const handleAdd = async (song) => {
    try {
      setAddedIds((prev) => new Set([...prev, song.id]))
      await addSongToPlaylist(playlistId, song)
    } catch (err) {
      console.error('Failed to add song to playlist:', err)
    }
  }

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content add-song-modal animate-fade-in-scale" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Songs to Playlist</h2>
          <button className="btn-icon modal-close-btn" onClick={onClose} aria-label="Close modal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="add-song-search-container">
          <input
            type="text"
            className="input-field"
            placeholder="Search tracks in library by title or artist..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="add-song-list">
          {loading ? (
            <div className="add-song-loading">Loading library tracks...</div>
          ) : filteredSongs.length === 0 ? (
            <div className="add-song-empty">No tracks found in library.</div>
          ) : (
            filteredSongs.map((song) => {
              const isAdded = addedIds.has(song.id)
              return (
                <div key={song.id} className="add-song-row">
                  <div className="add-song-cover">
                    {song.coverUrl ? (
                      <img src={song.coverUrl} alt={song.title} className="add-song-cover-img" loading="lazy" />
                    ) : (
                      <div className="add-song-cover-placeholder">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 18V5l12-2v13" />
                          <circle cx="6" cy="18" r="3" />
                          <circle cx="18" cy="16" r="3" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="add-song-info">
                    <span className="add-song-title truncate">{song.title}</span>
                    <span className="add-song-artist truncate">{song.artist || 'Unknown Artist'}</span>
                  </div>
                  <span className="add-song-duration">{formatDuration(song.duration)}</span>
                  <button
                    className={`btn btn-sm ${isAdded ? 'btn-secondary' : 'btn-primary'}`}
                    disabled={isAdded}
                    onClick={() => handleAdd(song)}
                  >
                    {isAdded ? 'Added' : 'Add'}
                  </button>
                </div>
              )
            })
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
