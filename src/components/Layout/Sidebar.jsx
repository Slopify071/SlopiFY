import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
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

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Friend'
  const initial = displayName.charAt(0).toUpperCase()
  const handleLogout = onLogoutRequest || logout

  return (
    <aside className="sidebar">
      <div className="sidebar-inner">
      {/* Logo / Header */}
      <div className="sidebar-logo">
        <Link to="/library" className="sidebar-logo-link" title="SlopiFY Home">
          <div className="sidebar-logo-icon">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <defs>
                <linearGradient id="logoGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6C5CE7" />
                  <stop offset="100%" stopColor="#A29BFE" />
                </linearGradient>
              </defs>
              <circle cx="12" cy="12" r="10" stroke="url(#logoGrad2)" strokeWidth="2" fill="none" />
              <circle cx="12" cy="12" r="3" fill="url(#logoGrad2)" />
              <path d="M12 2C6.48 2 2 6.48 2 12" stroke="url(#logoGrad2)" strokeWidth="2" strokeLinecap="round" />
            </svg>
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
          </NavLink>
        ))}
      </nav>

      {/* Footer / User */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            {user?.photoURL ? (
              <img src={user.photoURL} alt={displayName} className="user-avatar-img" />
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
    </aside>
  )
}
