import { useState } from 'react'
import './Upload.css'

export default function Upload() {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [metadata, setMetadata] = useState({
    title: '',
    artist: '',
    album: '',
  })

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const handleFileSelect = (file) => {
    setSelectedFile(file)
    // Placeholder: Phase 4 will add music-metadata-browser parsing
    setMetadata({
      title: file.name.replace(/\.[^/.]+$/, ''),
      artist: '',
      album: '',
    })
  }

  const handleInputChange = (e) => {
    setMetadata({ ...metadata, [e.target.name]: e.target.value })
  }

  const handleUpload = () => {
    console.log('Upload will be implemented in Phase 4')
    console.log('File:', selectedFile)
    console.log('Metadata:', metadata)
  }

  const acceptedFormats = '.mp3,.m4a,.wav,.ogg,.flac'

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Upload</h1>
        <p>Add new songs to the communal library</p>
      </div>

      {/* Drop Zone */}
      <div
        className={`upload-dropzone animate-fade-in-up ${isDragging ? 'dragging' : ''} ${selectedFile ? 'has-file' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {!selectedFile ? (
          <>
            <div className="upload-dropzone-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17,8 12,3 7,8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <h3 className="upload-dropzone-title">Drag & drop your audio files</h3>
            <p className="upload-dropzone-subtitle">or click to browse</p>
            <p className="upload-dropzone-formats">MP3, M4A, WAV, OGG, FLAC</p>
            <input
              type="file"
              className="upload-file-input"
              accept={acceptedFormats}
              onChange={(e) => e.target.files[0] && handleFileSelect(e.target.files[0])}
            />
          </>
        ) : (
          <div className="upload-file-preview">
            <div className="upload-file-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <div className="upload-file-details">
              <span className="upload-file-name truncate">{selectedFile.name}</span>
              <span className="upload-file-size">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </span>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setSelectedFile(null); setMetadata({ title: '', artist: '', album: '' }) }}
            >
              Remove
            </button>
          </div>
        )}
      </div>

      {/* Metadata Form */}
      {selectedFile && (
        <div className="upload-metadata animate-fade-in-up">
          <h3 className="upload-metadata-title">Song Details</h3>
          <p className="upload-metadata-subtitle">
            Edit the auto-detected metadata below
          </p>

          <div className="upload-form">
            <div className="upload-form-group">
              <label htmlFor="upload-title" className="upload-label">Title</label>
              <input
                id="upload-title"
                type="text"
                name="title"
                className="input"
                placeholder="Song title"
                value={metadata.title}
                onChange={handleInputChange}
              />
            </div>

            <div className="upload-form-group">
              <label htmlFor="upload-artist" className="upload-label">Artist</label>
              <input
                id="upload-artist"
                type="text"
                name="artist"
                className="input"
                placeholder="Artist name"
                value={metadata.artist}
                onChange={handleInputChange}
              />
            </div>

            <div className="upload-form-group">
              <label htmlFor="upload-album" className="upload-label">Album</label>
              <input
                id="upload-album"
                type="text"
                name="album"
                className="input"
                placeholder="Album name (optional)"
                value={metadata.album}
                onChange={handleInputChange}
              />
            </div>

            <button
              className="btn btn-primary btn-lg upload-submit"
              onClick={handleUpload}
              disabled={!metadata.title}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17,8 12,3 7,8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload to Library
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
