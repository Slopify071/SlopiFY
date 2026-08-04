import { useState } from 'react'
import { createPortal } from 'react-dom'
import { createPlaylist } from '../../services/firestore'
import { Camera, Music, Upload, Users, Lock, Unlock, X } from 'lucide-react'
import './CreatePlaylistModal.css'

export default function CreatePlaylistModal({ isOpen, onClose, onSuccess, currentUser }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [isCollaborative, setIsCollaborative] = useState(false)
  const [isPublic, setIsPublic] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please provide a name for your playlist.')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const playlistId = await createPlaylist({
        name,
        description,
        coverUrl,
        ownerUid: currentUser?.uid || 'anonymous',
        ownerName: currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Friend',
        isCollaborative,
        isPublic,
      })

      setName('')
      setDescription('')
      setCoverUrl('')
      setIsCollaborative(false)
      setIsPublic(true)
      if (onSuccess) onSuccess(playlistId)
      onClose()
    } catch (err) {
      console.error('Failed to create playlist:', err)
      setError(err?.message || 'Failed to create playlist. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const modalContent = (
    <div className="create-pl-backdrop" onClick={onClose}>
      <div className="create-pl-modal animate-fade-in-scale" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="create-pl-header">
          <div>
            <span className="create-pl-badge">New Collection</span>
            <h2>Create Playlist</h2>
          </div>
          <button className="create-pl-close" onClick={onClose}>
            <X size={20} />
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
                  <Music size={40} color="var(--color-primary-subtle)" strokeWidth={1} style={{ opacity: 0.5 }} />
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
                  maxLength={60}
                  required
                  autoFocus
                />
              </div>

              <div className="create-pl-field">
                <label htmlFor="pl-desc">Description</label>
                <textarea
                  id="pl-desc"
                  className="create-pl-input create-pl-textarea"
                  placeholder="Give your playlist a vibe description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={300}
                  rows={2}
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

              <div className="create-pl-toggles-row" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                <div className={`create-pl-collab-row ${isCollaborative ? 'is-active' : ''}`} onClick={() => setIsCollaborative(!isCollaborative)}>
                  <div className={`create-pl-toggle ${isCollaborative ? 'is-active' : ''}`}>
                    <div className="create-pl-toggle-handle" />
                  </div>
                  <div className="create-pl-collab-text">
                    <strong>Collaborative Playlist</strong>
                    <span>Allow others to add & remove tracks</span>
                  </div>
                </div>

                <div className={`create-pl-collab-row ${isPublic ? 'is-active' : ''}`} onClick={() => setIsPublic(!isPublic)}>
                  <div className={`create-pl-toggle ${isPublic ? 'is-active' : ''}`}>
                    <div className="create-pl-toggle-handle" />
                  </div>
                  <div className="create-pl-collab-text">
                    <strong>Public Playlist</strong>
                    <span>Visible on your profile</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="create-pl-footer" style={{ marginTop: 'auto' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary create-pl-submit-btn" disabled={!name.trim() || isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="create-pl-spinner" />
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

  return createPortal(modalContent, document.body)
}
