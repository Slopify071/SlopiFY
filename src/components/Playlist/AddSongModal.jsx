import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { subscribeToLibrary, addSongToPlaylist } from '../../services/firestore'
import { Search, X, Check, Plus, Music } from 'lucide-react'
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

  const handleAddAll = async () => {
    const unadded = filteredSongs.filter((s) => !addedIds.has(s.id))
    if (unadded.length === 0) return

    const newSet = new Set(addedIds)
    unadded.forEach((s) => newSet.add(s.id))
    setAddedIds(newSet)

    try {
      await Promise.all(unadded.map((song) => addSongToPlaylist(playlistId, song)))
    } catch (err) {
      console.error('Failed to batch add songs to playlist:', err)
    }
  }

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const unaddedCount = filteredSongs.filter((s) => !addedIds.has(s.id)).length

  return createPortal(
    <div className="add-song-backdrop" onClick={onClose}>
      <div className="add-song-modal animate-fade-in-scale" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="add-song-header">
          <div>
            <span className="add-song-badge">Library Selection</span>
            <h2>Add Songs to Playlist</h2>
          </div>
          <div className="add-song-header-actions">
            {unaddedCount > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-primary add-all-songs-btn"
                onClick={handleAddAll}
                title="Add all matching songs to playlist at once"
              >
                <Plus size={14} />
                <span>Add All ({unaddedCount})</span>
              </button>
            )}
            <button type="button" className="add-song-close-btn" onClick={onClose} aria-label="Close modal">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="add-song-search-container">
          <div className="add-song-search-box">
            <Search className="add-song-search-icon" size={18} />
            <input
              type="text"
              className="add-song-search-input"
              placeholder="Search tracks in library by title or artist..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {search && (
              <button
                type="button"
                className="add-song-search-clear"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Song List */}
        <div className="add-song-list">
          {loading ? (
            <div className="add-song-loading">
              <div className="add-song-spinner" />
              <span>Loading library tracks...</span>
            </div>
          ) : filteredSongs.length === 0 ? (
            <div className="add-song-empty">
              <Music size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
              <p>{search ? 'No tracks matching your search.' : 'No tracks found in library.'}</p>
            </div>
          ) : (
            filteredSongs.map((song) => {
              const isAdded = addedIds.has(song.id)
              return (
                <div key={song.id} className={`add-song-row ${isAdded ? 'is-added' : ''}`}>
                  <div className="add-song-cover">
                    {song.coverUrl ? (
                      <img src={song.coverUrl} alt={song.title} className="add-song-cover-img" loading="lazy" />
                    ) : (
                      <div className="add-song-cover-placeholder">
                        <Music size={16} />
                      </div>
                    )}
                  </div>
                  <div className="add-song-info">
                    <span className="add-song-title truncate">{song.title}</span>
                    <span className="add-song-artist truncate">{song.artist || 'Unknown Artist'}</span>
                  </div>
                  <span className="add-song-duration">{formatDuration(song.duration)}</span>
                  <button
                    type="button"
                    className={`add-song-action-btn ${isAdded ? 'is-added-btn' : 'is-add-btn'}`}
                    disabled={isAdded}
                    onClick={() => handleAdd(song)}
                  >
                    {isAdded ? (
                      <>
                        <Check size={14} strokeWidth={2.5} />
                        <span>Added</span>
                      </>
                    ) : (
                      <>
                        <Plus size={14} strokeWidth={2.5} />
                        <span>Add</span>
                      </>
                    )}
                  </button>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="add-song-footer">
          <button type="button" className="btn btn-secondary add-song-done-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
