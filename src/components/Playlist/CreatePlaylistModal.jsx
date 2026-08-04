import { useState } from 'react'
import { createPlaylist } from '../../services/firestore'
import './CreatePlaylistModal.css'

export default function CreatePlaylistModal({ isOpen, onClose, onSuccess, currentUser }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [isCollaborative, setIsCollaborative] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please provide a name for your playlist.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const playlistId = await createPlaylist({
        name,
        description,
        coverUrl,
        ownerUid: currentUser?.uid || 'anonymous',
        ownerName: currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Friend',
        isCollaborative,
      })

      setName('')
      setDescription('')
      setCoverUrl('')
      setIsCollaborative(false)
      if (onSuccess) onSuccess(playlistId)
      onClose()
    } catch (err) {
      console.error('Failed to create playlist:', err)
      setError(err?.message || 'Failed to create playlist. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="create-pl-backdrop" onClick={onClose}>
      <div className="create-pl-modal animate-fade-in-scale" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="create-pl-header">
          <div className="create-pl-header-title">
            <span className="create-pl-badge">New Collection</span>
            <h2>Create Playlist</h2>
          </div>
          <button className="create-pl-close-btn" onClick={onClose} aria-label="Close modal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="create-pl-body">
          {error && <div className="create-pl-error">{error}</div>}

          <div className="create-pl-grid">
            {/* Left: Artwork Preview */}
            <div className="create-pl-artwork-col">
              <div className="create-pl-artwork-preview">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt="Playlist artwork preview"
                    onError={(e) => {
                      e.target.onerror = null
                      e.target.style.display = 'none'
                      e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                ) : null}
                <div className="create-pl-artwork-placeholder" style={{ display: coverUrl ? 'none' : 'flex' }}>
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                  <span>Artwork Preview</span>
                </div>
              </div>
            </div>

            {/* Right: Input Fields */}
            <div className="create-pl-fields-col">
              <div className="create-pl-field">
                <label htmlFor="pl-name">Playlist Name *</label>
                <input
                  id="pl-name"
                  type="text"
                  className="create-pl-input"
                  placeholder="My Awesome Playlist"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="create-pl-field">
                <label htmlFor="pl-desc">Description</label>
                <textarea
                  id="pl-desc"
                  className="create-pl-input create-pl-textarea"
                  placeholder="Give your playlist a vibe description..."
                  rows="2"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="create-pl-field">
                <label htmlFor="pl-cover">Cover Image URL</label>
                <input
                  id="pl-cover"
                  type="url"
                  className="create-pl-input"
                  placeholder="https://images.unsplash.com/..."
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                />
              </div>

              <div className="create-pl-collab-row" onClick={() => setIsCollaborative(!isCollaborative)}>
                <div className={`create-pl-toggle ${isCollaborative ? 'is-active' : ''}`}>
                  <div className="create-pl-toggle-handle" />
                </div>
                <div className="create-pl-collab-text">
                  <strong>Collaborative Playlist</strong>
                  <span>Allow friends to add & remove tracks</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="create-pl-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary create-pl-submit-btn" disabled={loading}>
              {loading ? (
                <>
                  <span className="create-pl-spinner" />
                  Creating...
                </>
              ) : (
                'Create Playlist'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
