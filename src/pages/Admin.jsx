import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { nukeLibrary, subscribeToLibrary } from '../services/firestore'
import { usePlayer } from '../context/PlayerContext'
import './Admin.css'

/**
 * Format byte count into a human-readable string (e.g. "12.4 MB").
 */
function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

/**
 * Nuke Confirmation Modal — requires typing "NUKE" to unlock the confirm button.
 * Also shows live progress during deletion and a summary when done.
 */
function NukeModal({ isOpen, onCancel, onComplete }) {
  const [confirmInput, setConfirmInput] = useState('')
  const [phase, setPhase] = useState('confirm') // 'confirm' | 'progress' | 'done'
  const [progress, setProgress] = useState({ completed: 0, total: 0, currentTitle: '', phase: 'fetching' })
  const [result, setResult] = useState(null)

  const isMatched = confirmInput.trim().toUpperCase() === 'NUKE'

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setConfirmInput('')
      setPhase('confirm')
      setProgress({ completed: 0, total: 0, currentTitle: '', phase: 'fetching' })
      setResult(null)
    }
  }, [isOpen])

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return
      if (e.key === 'Escape' && phase !== 'progress') {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, phase, onCancel])

  const handleConfirmNuke = useCallback(async () => {
    if (!isMatched) return
    setPhase('progress')

    try {
      const nukeResult = await nukeLibrary((progressData) => {
        setProgress(progressData)
      })
      setResult(nukeResult)
      setPhase('done')
    } catch (err) {
      console.error('Nuke failed:', err)
      setPhase('done')
      setResult({ deletedCount: 0, freedBytes: 0, error: err.message })
    }
  }, [isMatched])

  const handleDone = useCallback(() => {
    onCancel()
    if (onComplete && result) {
      onComplete(result)
    }
  }, [onCancel, onComplete, result])

  if (!isOpen) return null

  const progressPercent = progress.total > 0
    ? Math.round((progress.completed / progress.total) * 100)
    : 0

  const phaseLabel = {
    fetching: 'Scanning library…',
    deleting: `Deleting track ${progress.completed + 1} of ${progress.total}…`,
    cleanup: 'Resetting storage metadata…',
    done: 'Complete!',
  }

  return createPortal(
    <div
      className="nuke-modal-overlay"
      onClick={phase !== 'progress' ? onCancel : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div className="nuke-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="nuke-modal-header">
          <div className="nuke-modal-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
              <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2.5" />
            </svg>
          </div>
          <div>
            <h3 className="nuke-modal-title">Nuke Entire Library</h3>
            <p className="nuke-modal-subtitle">Irreversible destructive action</p>
          </div>
        </div>

        {/* Phase: Confirm */}
        {phase === 'confirm' && (
          <div className="nuke-modal-body">
            <p className="nuke-modal-warning">
              This will <strong>permanently delete all songs</strong> from the SlopiFY library. Playlists will remain but appear empty.
              <br /><br />
              This action <strong>cannot be undone</strong>.
            </p>

            <div className="nuke-modal-input-group">
              <label className="nuke-modal-input-label" htmlFor="nuke-confirm-input">
                Type <code>NUKE</code> to confirm
              </label>
              <input
                id="nuke-confirm-input"
                type="text"
                className={`nuke-modal-input ${isMatched ? 'matched' : ''}`}
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="Type here…"
                autoComplete="off"
                autoFocus
              />
            </div>

            <div className="nuke-modal-actions">
              <button type="button" className="nuke-modal-cancel-btn" onClick={onCancel}>
                Cancel
              </button>
              <button
                type="button"
                className="nuke-modal-confirm-btn"
                disabled={!isMatched}
                onClick={handleConfirmNuke}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3,6 5,6 21,6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Nuke Library
              </button>
            </div>
          </div>
        )}

        {/* Phase: Progress */}
        {phase === 'progress' && (
          <div className="nuke-progress-section">
            <div className="nuke-progress-phase">
              <span className="spinner" />
              {phaseLabel[progress.phase] || 'Working…'}
            </div>

            {progress.currentTitle && (
              <div className="nuke-progress-track-name">
                🎵 {progress.currentTitle}
              </div>
            )}

            <div className="nuke-progress-bar-wrapper">
              <div
                className="nuke-progress-bar-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="nuke-progress-count">
              {progress.completed} / {progress.total} tracks deleted
            </div>
          </div>
        )}

        {/* Phase: Done */}
        {phase === 'done' && result && (
          <div className="nuke-done-section">
            <div className="nuke-done-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20,6 9,17 4,12" />
              </svg>
            </div>

            <h3 className="nuke-done-title">
              {result.error ? 'Nuke encountered errors' : 'Library nuked'}
            </h3>

            <div className="nuke-done-stats">
              <div className="nuke-done-stat">
                <span className="nuke-done-stat-value">{result.deletedCount}</span>
                <span className="nuke-done-stat-label">Tracks Deleted</span>
              </div>
              <div className="nuke-done-stat">
                <span className="nuke-done-stat-value">{formatBytes(result.freedBytes)}</span>
                <span className="nuke-done-stat-label">Storage Freed</span>
              </div>
            </div>

            <button type="button" className="nuke-done-close-btn" onClick={handleDone}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export default function Admin() {
  const { showToast } = usePlayer()
  const [showNukeModal, setShowNukeModal] = useState(false)
  const [songs, setSongs] = useState([])
  const [loadingSongs, setLoadingSongs] = useState(true)

  useEffect(() => {
    const unsub = subscribeToLibrary((allSongs) => {
      setSongs(allSongs)
      setLoadingSongs(false)
    })
    return () => unsub()
  }, [])

  const handleNukeClick = () => {
    if (!loadingSongs && songs.length === 0) {
      showToast('Library already empty')
      return
    }
    setShowNukeModal(true)
  }

  return (
    <div className="page-content">
      {/* Header */}
      <div className="admin-header">
        <h1>
          <span className="admin-header-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </span>
          Admin
        </h1>
        <p>Manage your SlopiFY instance</p>
      </div>

      {/* Danger Zone */}
      <div className="admin-danger-zone">
        <div className="admin-section-label">Danger Zone</div>

        <div className="admin-danger-card">
          <div className="admin-danger-card-header">
            <div className="admin-danger-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3,6 5,6 21,6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </div>
            <div className="admin-danger-card-info">
              <h3>Nuke Entire Library</h3>
              <p>
                Permanently delete <strong>all songs</strong> from the SlopiFY library.
                This removes every audio file and its metadata. Playlists will remain intact
                but will appear empty. This action cannot be undone.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="admin-nuke-btn"
            onClick={handleNukeClick}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3,6 5,6 21,6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Nuke Entire Library…
          </button>
        </div>
      </div>

      {/* Nuke Confirmation Modal */}
      <NukeModal
        isOpen={showNukeModal}
        onCancel={() => setShowNukeModal(false)}
        onComplete={() => {}}
      />
    </div>
  )
}
