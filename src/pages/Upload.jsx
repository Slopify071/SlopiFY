import { useState, useEffect } from 'react'
import * as musicMetadata from 'music-metadata'
import { useAuth } from '../context/AuthContext'
import { uploadAudioFile, getAudioStreamUrl } from '../services/storage'
import { addSongToFirestore, subscribeToStorageMeta } from '../services/firestore'
import './Upload.css'

export default function Upload() {
  const { user } = useAuth()
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [error, setError] = useState(null)
  const [storageMeta, setStorageMeta] = useState({ totalBytesUsed: 0, songCount: 0 })

  useEffect(() => {
    const unsubscribe = subscribeToStorageMeta((meta) => {
      if (meta) setStorageMeta(meta)
    })
    return () => unsubscribe()
  }, [])

  const [metadata, setMetadata] = useState({
    title: '',
    artist: '',
    album: '',
    duration: 0,
    coverUrl: '',
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

  const handleFileSelect = async (file) => {
    setSelectedFile(file)
    setParsing(true)
    setError(null)
    setUploadSuccess(false)

    const cleanName = file.name.replace(/\.[^/.]+$/, '')
    let title = cleanName
    let artist = ''
    let album = ''
    let duration = 0
    let coverUrl = ''

    try {
      const parsed = await musicMetadata.parseBlob(file)
      if (parsed.common.title) title = parsed.common.title
      if (parsed.common.artist) artist = parsed.common.artist
      if (parsed.common.album) album = parsed.common.album
      if (parsed.format.duration) duration = Math.round(parsed.format.duration)

      if (parsed.common.picture && parsed.common.picture.length > 0) {
        const pic = parsed.common.picture[0]
        const blob = new Blob([pic.data], { type: pic.format })
        coverUrl = URL.createObjectURL(blob)
      }
    } catch (err) {
      console.warn('ID3 metadata parsing fallback:', err)
    } finally {
      setParsing(false)
      setMetadata({ title, artist, album, duration, coverUrl })
    }
  }

  const handleInputChange = (e) => {
    setMetadata({ ...metadata, [e.target.name]: e.target.value })
  }

  const handleUpload = async () => {
    if (!selectedFile || !metadata.title) return
    setUploading(true)
    setUploadProgress(0)
    setError(null)

    try {
      // 1. Upload audio to Firebase Storage
      const result = await uploadAudioFile(selectedFile, user, (percent) => {
        setUploadProgress(percent)
      })

      const audioUrl = getAudioStreamUrl(result)

      // 2. Write song metadata record to Firestore
      await addSongToFirestore({
        title: metadata.title,
        artist: metadata.artist || 'Unknown Artist',
        album: metadata.album || '',
        duration: metadata.duration || 0,
        storagePath: result.storagePath,
        audioUrl: audioUrl,
        coverUrl: metadata.coverUrl || '',
        fileSize: result.fileSize || selectedFile.size,
        uploaderUid: user?.uid || 'anonymous',
        uploaderName: user?.displayName || user?.email?.split('@')[0] || 'Friend',
      })

      setUploadSuccess(true)
    } catch (err) {
      console.error('Upload error:', err)
      setError(err.message || 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const resetForm = () => {
    setSelectedFile(null)
    setMetadata({ title: '', artist: '', album: '', duration: 0, coverUrl: '' })
    setUploadSuccess(false)
    setError(null)
    setUploadProgress(0)
  }

  const acceptedFormats = '.mp3,.m4a,.wav,.ogg,.flac'

  const totalStorageUsedGB = (storageMeta.totalBytesUsed / (1024 * 1024 * 1024)).toFixed(2)
  const maxStorageGB = 25 // Cloudinary Free Monthly Credits allowance

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Upload</h1>
        <p>Add new tracks to the communal music library</p>
      </div>

      {/* Storage Bar */}
      <div className="upload-storage animate-fade-in-up">
        <div className="upload-storage-info">
          <span className="upload-storage-label">Cloudinary Storage Used</span>
          <span className="upload-storage-value">
            {totalStorageUsedGB} GB / {maxStorageGB} GB
          </span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-bar-fill"
            style={{ width: `${Math.min(100, (totalStorageUsedGB / maxStorageGB) * 100)}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="upload-alert upload-alert-error animate-fade-in">
          <span>{error}</span>
        </div>
      )}

      {uploadSuccess ? (
        <div className="upload-success-card animate-fade-in-up">
          <div className="upload-success-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h2>Upload Complete!</h2>
          <p>"{metadata.title}" has been added to the communal library.</p>
          <button className="btn btn-primary btn-lg" onClick={resetForm}>
            Upload Another Song
          </button>
        </div>
      ) : (
        <>
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
                {metadata.coverUrl ? (
                  <img src={metadata.coverUrl} alt="Cover Preview" className="upload-cover-preview" />
                ) : (
                  <div className="upload-file-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18V5l12-2v13" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="18" cy="16" r="3" />
                    </svg>
                  </div>
                )}
                <div className="upload-file-details">
                  <span className="upload-file-name truncate">{selectedFile.name}</span>
                  <span className="upload-file-size">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB {parsing ? '• Parsing metadata...' : ''}
                  </span>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={resetForm}
                  disabled={uploading}
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
                {parsing ? 'Auto-extracting metadata from audio file...' : 'Review and edit auto-detected metadata below'}
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
                    disabled={uploading}
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
                    disabled={uploading}
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
                    disabled={uploading}
                  />
                </div>

                {uploading && (
                  <div className="upload-progress-container">
                    <div className="upload-progress-bar">
                      <div
                        className="upload-progress-fill"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <span className="upload-progress-text">Uploading to Cloudinary... {uploadProgress}%</span>
                  </div>
                )}

                <button
                  className="btn btn-primary btn-lg upload-submit"
                  onClick={handleUpload}
                  disabled={!metadata.title || uploading || parsing}
                >
                  {uploading ? (
                    'Uploading...'
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17,8 12,3 7,8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      Upload to Library
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

