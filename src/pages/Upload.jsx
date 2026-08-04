import { useState, useEffect } from 'react'
// music-metadata is lazy-loaded via dynamic import() on first file parse
// to keep it out of the main bundle (~1MB savings)
import { Glass } from '@samasante/liquid-glass'
import { useAuth } from '../context/AuthContext'
import { uploadAudioFile, uploadCoverImage, getAudioStreamUrl } from '../services/storage'
import { addSongToFirestore, subscribeToStorageMeta } from '../services/firestore'
import './Upload.css'

export default function Upload() {
  const { user } = useAuth()
  const [isDragging, setIsDragging] = useState(false)
  const [fileList, setFileList] = useState([])
  const [activeTrackIndex, setActiveTrackIndex] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, percent: 0, stageText: '' })
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [completedCount, setCompletedCount] = useState(0)
  const [error, setError] = useState(null)
  const [storageMeta, setStorageMeta] = useState({ totalBytesUsed: 0, songCount: 0 })

  const glassOptics = {
    frost: 0.8,
    dispersion: 0.2,
    curvature: 0.1,
    bend: 0.1,
    depth: 0.5,
    glow: 0.05
  }

  useEffect(() => {
    const unsubscribe = subscribeToStorageMeta((meta) => {
      if (meta) setStorageMeta(meta)
    })
    return () => unsubscribe()
  }, [])

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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelect(e.dataTransfer.files)
    }
  }

  const handleFilesSelect = async (files) => {
    if (!files || files.length === 0) return
    setError(null)
    setUploadSuccess(false)

    const validFiles = Array.from(files).filter((file) =>
      /\.(mp3|m4a|wav|ogg|flac)$/i.test(file.name)
    )

    if (validFiles.length === 0) {
      setError('Please select valid audio files (.mp3, .m4a, .wav, .ogg, .flac).')
      return
    }

    const newItems = validFiles.map((file) => {
      const cleanName = file.name.replace(/\.[^/.]+$/, '')
      return {
        id: Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
        file,
        title: cleanName,
        artist: '',
        album: '',
        duration: 0,
        coverUrl: '',
        pictureBlob: null,
        parsing: true,
        status: 'pending', // 'pending' | 'uploading' | 'saving' | 'completed' | 'error'
        progress: 0,
      }
    })

    setFileList((prev) => [...prev, ...newItems])

    // Parse ID3 metadata for each selected file in parallel
    newItems.forEach(async (item) => {
      let title = item.title
      let artist = ''
      let album = ''
      let duration = 0
      let coverUrl = ''
      let pictureBlob = null

      try {
        const musicMetadata = await import('music-metadata')
        const parsed = await musicMetadata.parseBlob(item.file)
        if (parsed.common.title) title = parsed.common.title
        if (parsed.common.artist) artist = parsed.common.artist
        if (parsed.common.album) album = parsed.common.album
        if (parsed.format.duration) duration = Math.round(parsed.format.duration)

        if (parsed.common.picture && parsed.common.picture.length > 0) {
          const pic = parsed.common.picture[0]
          pictureBlob = new Blob([pic.data], { type: pic.format })
          coverUrl = URL.createObjectURL(pictureBlob)
        }
      } catch (err) {
        console.warn('ID3 parsing warning for ' + item.file.name, err)
      } finally {
        setFileList((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? { ...it, title, artist, album, duration, coverUrl, pictureBlob, parsing: false }
              : it
          )
        )
      }
    })
  }

  const handleMetadataChange = (id, field, value) => {
    setFileList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    )
  }

  const removeTrack = (id) => {
    setFileList((prev) => {
      const updated = prev.filter((item) => item.id !== id)
      if (activeTrackIndex >= updated.length) {
        setActiveTrackIndex(Math.max(0, updated.length - 1))
      }
      return updated
    })
  }

  const handleUpload = async () => {
    if (fileList.length === 0) return
    setUploading(true)
    setError(null)

    let successCount = 0
    const totalFiles = fileList.length

    for (let i = 0; i < totalFiles; i++) {
      const item = fileList[i]
      setActiveTrackIndex(i)

      setBatchProgress({
        current: i + 1,
        total: totalFiles,
        percent: 0,
        stageText: `Uploading track ${i + 1} of ${totalFiles}: "${item.title}"...`,
      })

      setFileList((prev) =>
        prev.map((it, idx) => (idx === i ? { ...it, status: 'uploading', progress: 0 } : it))
      )

      try {
        // 1. Upload audio file to Firebase Storage
        const result = await uploadAudioFile(item.file, user, (percent) => {
          setFileList((prev) =>
            prev.map((it, idx) =>
              idx === i
                ? {
                    ...it,
                    progress: percent,
                    status: percent === 100 ? 'saving' : 'uploading',
                  }
                : it
            )
          )
          setBatchProgress((prev) => ({
            ...prev,
            percent,
            stageText:
              percent === 100
                ? `Saving track details ${i + 1} of ${totalFiles}...`
                : `Uploading track ${i + 1} of ${totalFiles}: "${item.title}" (${percent}%)...`,
          }))
        })

        const audioUrl = getAudioStreamUrl(result)

        // Upload cover art blob if available to get permanent HTTPS URL
        let finalCoverUrl = item.coverUrl || ''
        if (item.pictureBlob) {
          const uploadedCoverUrl = await uploadCoverImage(item.pictureBlob, user)
          if (uploadedCoverUrl) finalCoverUrl = uploadedCoverUrl
        }

        // 2. Save song record to Firestore
        await addSongToFirestore({
          title: item.title || 'Untitled',
          artist: item.artist || 'Unknown Artist',
          album: item.album || '',
          duration: item.duration || 0,
          storagePath: result.storagePath,
          audioUrl: audioUrl,
          coverUrl: finalCoverUrl,
          fileSize: result.fileSize || item.file.size,
          uploaderUid: user?.uid || 'anonymous',
          uploaderName: user?.displayName || user?.email?.split('@')[0] || 'Friend',
        })

        successCount++
        setFileList((prev) =>
          prev.map((it, idx) => (idx === i ? { ...it, status: 'completed', progress: 100 } : it))
        )
      } catch (err) {
        console.error(`Upload error for track "${item.title}":`, err)
        setFileList((prev) =>
          prev.map((it, idx) => (idx === i ? { ...it, status: 'error' } : it))
        )
        setError(`Failed uploading "${item.title}". ${err.message || ''}`)
      }
    }

    setUploading(false)
    if (successCount > 0) {
      setCompletedCount(successCount)
      setUploadSuccess(true)
    }
  }

  const resetForm = () => {
    setFileList([])
    setActiveTrackIndex(0)
    setUploadSuccess(false)
    setCompletedCount(0)
    setError(null)
    setUploading(false)
  }

  const acceptedFormats = '.mp3,.m4a,.wav,.ogg,.flac'
  const totalStorageUsedGB = (storageMeta.totalBytesUsed / (1024 * 1024 * 1024)).toFixed(2)
  const maxStorageGB = 25

  const activeTrack = fileList[activeTrackIndex] || fileList[0]

  return (
    <div className="upload-page page-content">
      <div className="page-header">
        <h1>Upload Songs</h1>
        <p>Add new audio tracks to your communal SlopiFY library</p>
      </div>

      {/* Storage Bar */}
      <Glass className="upload-storage animate-fade-in-up" radius={18} optics={glassOptics}>
        <div className="upload-storage-inner">
          <div className="upload-storage-info">
            <span className="upload-storage-label">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
              </svg>
              Storage Used
            </span>
            <span className="upload-storage-value">
              {totalStorageUsedGB} GB / {maxStorageGB} GB
            </span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${Math.max(1, Math.min(100, (totalStorageUsedGB / maxStorageGB) * 100))}%` }}
            />
          </div>
        </div>
      </Glass>

      {error && (
        <div className="upload-alert upload-alert-error animate-fade-in">
          <span>{error}</span>
        </div>
      )}

      {uploadSuccess ? (
        <Glass className="upload-success-card animate-fade-in-up" radius={24} optics={glassOptics}>
          <div className="upload-success-card-inner">
            <div className="upload-success-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2>Upload Complete!</h2>
            <p>
              {completedCount} {completedCount === 1 ? 'track has' : 'tracks have'} been added to the communal library.
            </p>
            <button className="btn btn-primary btn-lg" onClick={resetForm}>
              Upload More Songs
            </button>
          </div>
        </Glass>
      ) : (
        <>
          {/* Drop Zone */}
          <div className="upload-dropzone-wrapper">
            <Glass
              className={`upload-dropzone animate-fade-in-up ${isDragging ? 'dragging' : ''} ${fileList.length > 0 ? 'has-file' : ''}`}
              radius={24} optics={glassOptics}
            >
              <div
                className="upload-dropzone-inner"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="upload-dropzone-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17,8 12,3 7,8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <h3 className="upload-dropzone-title">
                  {fileList.length > 0 ? 'Drag & drop more files to add' : 'Drag & drop your audio files'}
                </h3>
                <p className="upload-dropzone-subtitle">or click to browse multiple files</p>
                <p className="upload-dropzone-formats">MP3, M4A, WAV, OGG, FLAC (Multiple Selection Enabled)</p>
                <input
                  type="file"
                  multiple
                  className="upload-file-input"
                  accept={acceptedFormats}
                  disabled={uploading}
                  onChange={(e) => e.target.files && handleFilesSelect(e.target.files)}
                />
              </div>
            </Glass>
          </div>

          {/* Queue List & Edit Details */}
          {fileList.length > 0 && (
            <Glass className="upload-metadata animate-fade-in-up" radius={24} optics={glassOptics}>
              <div className="upload-metadata-inner">
                <div className="upload-queue-header">
                  <div>
                    <h3 className="upload-metadata-title">Selected Tracks ({fileList.length})</h3>
                    <p className="upload-metadata-subtitle">
                      Select a track below to edit metadata before uploading
                    </p>
                  </div>
                </div>

                {/* Track Queue List */}
                <div className="upload-queue-list">
                  {fileList.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`upload-queue-item ${idx === activeTrackIndex ? 'active' : ''}`}
                      onClick={() => setActiveTrackIndex(idx)}
                    >
                      {item.coverUrl ? (
                        <img src={item.coverUrl} alt="Cover Preview" className="upload-cover-preview" loading="lazy" />
                      ) : (
                        <div className="upload-file-icon">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 18V5l12-2v13" />
                            <circle cx="6" cy="18" r="3" />
                            <circle cx="18" cy="16" r="3" />
                          </svg>
                        </div>
                      )}
                      <div className="upload-queue-details">
                        <span className="upload-queue-title truncate">
                          {item.title || item.file.name}
                        </span>
                        <span className="upload-queue-meta">
                          {item.artist || 'Unknown Artist'} • {(item.file.size / (1024 * 1024)).toFixed(2)} MB{' '}
                          {item.parsing ? '• Parsing metadata...' : ''}
                        </span>
                      </div>
                      {item.status === 'completed' && <span className="upload-queue-status">✓ Completed</span>}
                      {item.status === 'uploading' && <span className="upload-queue-status">Uploading... {item.progress}%</span>}
                      {item.status === 'saving' && <span className="upload-queue-status">Saving...</span>}
                      {item.status === 'pending' && !uploading && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeTrack(item.id)
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Active Track Form */}
                {activeTrack && (
                  <div className="upload-form" style={{ marginTop: 'var(--space-6)' }}>
                    <h4 style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--weight-semibold)' }}>
                      Edit Details: {activeTrack.title}
                    </h4>

                    <div className="upload-form-group">
                      <label htmlFor="upload-title" className="upload-label">Title</label>
                      <input
                        id="upload-title"
                        type="text"
                        className="input"
                        placeholder="Song title"
                        value={activeTrack.title}
                        onChange={(e) => handleMetadataChange(activeTrack.id, 'title', e.target.value)}
                        disabled={uploading}
                      />
                    </div>

                    <div className="upload-form-group">
                      <label htmlFor="upload-artist" className="upload-label">Artist</label>
                      <input
                        id="upload-artist"
                        type="text"
                        className="input"
                        placeholder="Artist name"
                        value={activeTrack.artist}
                        onChange={(e) => handleMetadataChange(activeTrack.id, 'artist', e.target.value)}
                        disabled={uploading}
                      />
                    </div>

                    <div className="upload-form-group">
                      <label htmlFor="upload-album" className="upload-label">Album</label>
                      <input
                        id="upload-album"
                        type="text"
                        className="input"
                        placeholder="Album name (optional)"
                        value={activeTrack.album}
                        onChange={(e) => handleMetadataChange(activeTrack.id, 'album', e.target.value)}
                        disabled={uploading}
                      />
                    </div>

                    {uploading && (
                      <div className="upload-progress-container">
                        <div className="upload-progress-bar">
                          <div
                            className="upload-progress-fill"
                            style={{ width: `${batchProgress.percent}%` }}
                          ></div>
                        </div>
                        <span className="upload-progress-text">{batchProgress.stageText}</span>
                      </div>
                    )}

                    <button
                      className="btn btn-primary btn-lg upload-submit"
                      onClick={handleUpload}
                      disabled={fileList.length === 0 || uploading || fileList.some((f) => f.parsing)}
                    >
                      {uploading ? (
                        `Uploading (${batchProgress.current}/${batchProgress.total})...`
                      ) : (
                        <>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17,8 12,3 7,8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                          Upload {fileList.length} {fileList.length === 1 ? 'Track' : 'Tracks'} to Library
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </Glass>
          )}
        </>
      )}

    </div>
  )
}


