import { Link } from 'react-router-dom'
import { useUpload } from '../context/UploadContext'
import './Upload.css'

export default function Upload() {
  const {
    isDragging,
    fileList,
    activeTrackIndex,
    setActiveTrackIndex,
    uploading,
    batchProgress,
    uploadSuccess,
    completedCount,
    skippedCount,
    error,
    storageMeta,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFilesSelect,
    handleMetadataChange,
    removeTrack,
    handleUpload,
    resetForm,
  } = useUpload()

  const acceptedFormats = '.mp3,.m4a,.wav,.ogg,.flac'
  const totalStorageUsedGB = (storageMeta.totalBytesUsed / (1024 * 1024 * 1024)).toFixed(2)
  const maxStorageGB = 1000
  const isServerOnline = storageMeta.online !== false && Boolean(storageMeta.endpointUrl)

  const activeTrack = fileList[activeTrackIndex] || fileList[0]

  return (
    <div className="upload-page page-content">
      <div className="page-header">
        <h1>Upload Songs</h1>
        <p>Add new audio tracks to your communal SlopiFY library</p>
      </div>

      {/* Storage Bar */}
      <div className="upload-storage animate-fade-in-up">
        <div className="upload-storage-inner">
          <div className="upload-storage-info">
            <span className="upload-storage-label">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" />
                <line x1="6" y1="18" x2="6.01" y2="18" />
              </svg>
              1TB Storage Server ({isServerOnline ? '🟢 Online' : '🟡 Connecting...'})
            </span>
            <span className="upload-storage-value">
              {totalStorageUsedGB} GB / {maxStorageGB} GB ({storageMeta.songCount || 0} songs)
            </span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${Math.max(1, Math.min(100, (totalStorageUsedGB / maxStorageGB) * 100))}%` }}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="upload-alert upload-alert-error animate-fade-in">
          <span>{error}</span>
        </div>
      )}

      {/* VIEW 1: ACTIVE UPLOADING (Clean, uncluttered, focused progress bar) */}
      {uploading ? (
        <div className="upload-active-card animate-fade-in-up">
          <div className="upload-active-card-inner">
            {/* Header Badge */}
            <div className="upload-active-header">
              <div className="upload-active-pulse-badge">
                <span className="upload-active-pulse-dot" />
                <span>Uploading in Background</span>
              </div>
              <span className="upload-active-safe-hint">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Safe to browse tabs
              </span>
            </div>

            {/* Main Batch Headline */}
            <div className="upload-active-batch-header">
              <h2 className="upload-active-title">
                Uploading Track {batchProgress.current} of {batchProgress.total}
              </h2>
              <span className="upload-active-percent-text">{batchProgress.overallPercent}%</span>
            </div>

            {/* Overall Progress Bar */}
            <div className="upload-active-overall-bar">
              <div
                className="upload-active-overall-fill"
                style={{ width: `${Math.max(2, Math.min(100, batchProgress.overallPercent))}%` }}
              />
            </div>

            {/* Current Active Track Preview Card */}
            <div className="upload-active-track-box">
              <div className="upload-active-track-media">
                {batchProgress.currentCoverUrl ? (
                  <img
                    src={batchProgress.currentCoverUrl}
                    alt="Cover"
                    className="upload-active-track-cover"
                  />
                ) : (
                  <div className="upload-active-track-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18V5l12-2v13" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="18" cy="16" r="3" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="upload-active-track-info">
                <div className="upload-active-track-titles">
                  <span className="upload-active-track-name truncate">
                    {batchProgress.currentTrackTitle || 'Current Track'}
                  </span>
                  <span className="upload-active-track-artist truncate">
                    {batchProgress.currentTrackArtist || 'Unknown Artist'}
                    {batchProgress.currentFileSize > 0 &&
                      ` • ${(batchProgress.currentFileSize / (1024 * 1024)).toFixed(2)} MB`}
                  </span>
                </div>

                {/* Track Specific Sub-Progress Bar */}
                <div className="upload-active-sub-progress">
                  <div className="upload-active-sub-bar">
                    <div
                      className="upload-active-sub-fill"
                      style={{ width: `${Math.max(1, Math.min(100, batchProgress.percent))}%` }}
                    />
                  </div>
                  <span className="upload-active-sub-text">{batchProgress.stageText}</span>
                </div>
              </div>
            </div>

            {/* Summary Counters */}
            <div className="upload-active-stats">
              <div className="upload-stat-item">
                <span className="upload-stat-label">Uploaded</span>
                <span className="upload-stat-value">{completedCount} / {batchProgress.total}</span>
              </div>
              {skippedCount > 0 && (
                <div className="upload-stat-item">
                  <span className="upload-stat-label">Duplicates Skipped</span>
                  <span className="upload-stat-value">{skippedCount}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : uploadSuccess ? (
        /* VIEW 2: UPLOAD SUCCESS */
        <div className="upload-success-card animate-fade-in-up">
          <div className="upload-success-card-inner">
            <div className="upload-success-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2>Upload Complete!</h2>
            <p>
              {completedCount} {completedCount === 1 ? 'track has' : 'tracks have'} been added to your communal library.
              {skippedCount > 0 && ` (${skippedCount} duplicate ${skippedCount === 1 ? 'track was' : 'tracks were'} skipped)`}
            </p>
            <div className="upload-success-actions">
              <button className="btn btn-primary btn-lg" onClick={resetForm}>
                Upload More Songs
              </button>
              <Link to="/library" className="btn btn-secondary btn-lg" onClick={resetForm}>
                Go to Library
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* VIEW 3: SELECTION & METADATA EDITING */
        <>
          {/* Drop Zone */}
          <div className="upload-dropzone-wrapper">
            <div
              className={`upload-dropzone animate-fade-in-up ${isDragging ? 'dragging' : ''} ${fileList.length > 0 ? 'has-file' : ''}`}
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
            </div>
          </div>

          {/* Queue List & Edit Details */}
          {fileList.length > 0 && (
            <div className="upload-metadata animate-fade-in-up">
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
                      {item.status === 'skipped' && <span className="upload-queue-status">Duplicate Skipped</span>}
                      {item.status === 'pending' && (
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
                      />
                    </div>

                    <div className="upload-form-group">
                      <label htmlFor="upload-lyrics" className="upload-label">Lyrics (LRC or Plain Text)</label>
                      <textarea
                        id="upload-lyrics"
                        className="input"
                        style={{ height: '90px', resize: 'vertical', fontFamily: 'inherit', paddingTop: '8px' }}
                        placeholder="Optional LRC lyrics [00:12.30] or line-by-line lyrics..."
                        value={activeTrack.lyrics || ''}
                        onChange={(e) => handleMetadataChange(activeTrack.id, 'lyrics', e.target.value)}
                      />
                    </div>

                    <button
                      className="btn btn-primary btn-lg upload-submit"
                      onClick={handleUpload}
                      disabled={fileList.length === 0 || fileList.some((f) => f.parsing)}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17,8 12,3 7,8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      Upload {fileList.length} {fileList.length === 1 ? 'Track' : 'Tracks'} to Library
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
