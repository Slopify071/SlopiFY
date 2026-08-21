import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useUpload } from '../../context/UploadContext'
import { isAdmin } from '../../config/admin'
import LazyGlass from '../Common/LazyGlass'
import './Sidebar.css'

const NAV_ITEMS = [
  {
    path: '/library',
    label: 'Library',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
  },
  {
    path: '/upload',
    label: 'Upload',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17,8 12,3 7,8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    path: '/playlists',
    label: 'Playlists',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
]

export default function Sidebar({ onLogoutRequest }) {
  const { user, logout } = useAuth()
  const { uploading, batchProgress } = useUpload()
  const [imgError, setImgError] = useState(false)

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Friend'
  const initial = displayName.charAt(0).toUpperCase()
  const handleLogout = onLogoutRequest || logout
  const showAdmin = isAdmin(user)

  return (
    <LazyGlass
      className="sidebar"
      radius={20}
      optics={{ frost: 0.3, dispersion: 0.2, curvature: 0.3, bend: 0.1, depth: 0.4, glow: 0.1 }}
    >
      <div className="sidebar-inner">
      {/* Logo / Header */}
      <div className="sidebar-logo">
        <Link to="/library" className="sidebar-logo-link" title="SlopiFY Home">
          <div className="sidebar-logo-icon">
            <img src="/logo.webp" alt="SlopiFY" width="34" height="34" style={{ borderRadius: '8px' }} />
          </div>
          <span className="sidebar-logo-text">SlopiFY</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? 'active' : ''}`
            }
          >
            <span className="sidebar-nav-icon">{item.icon}</span>
            <span className="sidebar-nav-label">{item.label}</span>
            {item.path === '/upload' && uploading && (
              <span className="sidebar-upload-badge" title="Uploading in background">
                <span className="sidebar-upload-pulse-dot" />
                <span className="sidebar-upload-badge-text">
                  {batchProgress.current}/{batchProgress.total}
                </span>
              </span>
            )}
          </NavLink>
        ))}

        {/* Admin — only visible to authorized admins */}
        {showAdmin && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? 'active' : ''}`
            }
          >
            <span className="sidebar-nav-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </span>
            <span className="sidebar-nav-label">Admin</span>
          </NavLink>
        )}
      </nav>

      {/* Footer / User */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            {user?.photoURL && !imgError ? (
              <img
                src={user.photoURL}
                alt=""
                className="user-avatar-img"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
              />
            ) : (
              <span className="user-initial">{initial}</span>
            )}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{displayName}</span>
            <span className="sidebar-user-status">Online</span>
          </div>
          <button
            className="sidebar-logout-btn"
            onClick={handleLogout}
            title="Sign Out"
            aria-label="Sign Out"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16,17 21,12 16,7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
      </div>
    </LazyGlass>
  )
}

