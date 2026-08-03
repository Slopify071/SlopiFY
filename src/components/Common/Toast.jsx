import { useEffect } from 'react'
import { usePlayer } from '../../context/PlayerContext'
import './Toast.css'

export default function Toast() {
  const { toast, hideToast } = usePlayer()

  useEffect(() => {
    if (!toast) return

    const timer = setTimeout(() => {
      hideToast()
    }, 2500)

    return () => clearTimeout(timer)
  }, [toast, hideToast])

  if (!toast) return null

  return (
    <div className="toast-container" key={toast.id}>
      <div className="toast-card animate-toast-slide">
        <div className="toast-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <span className="toast-message">{toast.message}</span>
        <button className="toast-close-btn" onClick={hideToast} aria-label="Close notification">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
