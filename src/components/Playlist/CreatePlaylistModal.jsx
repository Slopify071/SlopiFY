import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createPlaylist } from '../../services/firestore'
import { uploadCoverImage } from '../../services/storage'
import { Camera, Music, Upload, Users, Lock, Unlock, X, Plus } from 'lucide-react'
import './CreatePlaylistModal.css'

export default function CreatePlaylistModal({ isOpen, onClose, onSuccess, currentUser }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [isCollaborative, setIsCollaborative] = useState(false)
  const [isPublic, setIsPublic] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  if (!isOpen) return null

  const handleImageFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file.')
      return
    }
    setError('')
    setSelectedFile(file)
    setCoverUrl(URL.createObjectURL(file))
  }

  const handleArtworkClick = () => {
    fileInputRef.current?.click()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please provide a name for your playlist.')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      let finalCoverUrl = coverUrl
      if (selectedFile) {
        const uploadedUrl = await uploadCoverImage(selectedFile, currentUser)
        if (uploadedUrl) {
          finalCoverUrl = uploadedUrl
        }
      }

      const playlistId = await createPlaylist({
        name,
        description,
        coverUrl: finalCoverUrl,
        ownerUid: currentUser?.uid || 'anonymous',
        ownerName: currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Friend',
        isCollaborative,
        isPublic,
      })

      setName('')
      setDescription('')
      setCoverUrl('')
      setSelectedFile(null)
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

  return createPortal(
    <div className="create-pl-backdrop" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        className="create-pl-modal animate-fade-in-scale"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="create-pl-header">
          <div>
            <span className="create-pl-badge">New Collection</span>
            <h2>Create Playlist</h2>
          </div>
          <button type="button" className="create-pl-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="create-pl-body">
          {error && <div className="create-pl-error">{error}</div>}

          <div className="create-pl-grid">
            {/* Left: Artwork Preview */}
            <div className="create-pl-artwork-col">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageFileSelect}
                style={{ display: 'none' }}
              />
              <div
                className="create-pl-artwork-preview"
                onClick={handleArtworkClick}
                title="Click to choose cover image"
              >
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt="Playlist artwork preview"
                    onError={(e) => {
                      e.target.onerror = null
                      e.target.style.display = 'none'
                      if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                ) : null}
                <div className="create-pl-artwork-placeholder" style={{ display: coverUrl ? 'none' : 'flex' }}>
                  <Music size={36} color="var(--color-primary-subtle)" strokeWidth={1} style={{ opacity: 0.5 }} />
                  <span>Artwork Preview</span>
                </div>

                {/* Clickable + Icon Badge */}
                <div className="create-pl-artwork-add-btn" aria-label="Upload Image">
                  <Plus size={18} strokeWidth={2.5} />
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
                  onChange={(e) => {
                    setCoverUrl(e.target.value)
                    setSelectedFile(null)
                  }}
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
        </div>

        {/* Fixed Footer Actions */}
        <div className="create-pl-footer">
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
    </div>,
    document.body
  )
}
