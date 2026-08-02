import { Link } from 'react-router-dom'
import './Playlists.css'

export default function Playlists() {
  // Placeholder demo data — Phase 6 will wire up Firestore
  const playlists = [
    { id: 'vibe1', name: 'Late Night Vibes', songCount: 12, isCollaborative: false },
    { id: 'vibe2', name: 'Morning Coffee', songCount: 8, isCollaborative: true },
    { id: 'vibe3', name: 'Road Trip Bangers', songCount: 24, isCollaborative: false },
  ]

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="playlists-header-row">
          <div>
            <h1>Playlists</h1>
            <p>Your personal collections</p>
          </div>
          <button className="btn btn-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Playlist
          </button>
        </div>
      </div>

      {/* Playlist Grid */}
      <div className="playlists-grid">
        {playlists.map((playlist, index) => (
          <Link
            key={playlist.id}
            to={`/playlist/${playlist.id}`}
            className="playlist-card card animate-fade-in-up"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <div className="playlist-card-cover">
              <div className="playlist-card-cover-placeholder">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
            </div>
            <div className="playlist-card-info">
              <h3 className="playlist-card-name truncate">{playlist.name}</h3>
              <div className="playlist-card-meta">
                <span>{playlist.songCount} songs</span>
                {playlist.isCollaborative && (
                  <span className="badge">Collab</span>
                )}
              </div>
            </div>
          </Link>
        ))}

        {/* Create New Card */}
        <div className="playlist-card card playlist-card-new animate-fade-in-up" style={{ animationDelay: `${playlists.length * 80}ms` }}>
          <div className="playlist-card-new-content">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Create Playlist</span>
          </div>
        </div>
      </div>
    </div>
  )
}
