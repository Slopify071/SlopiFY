import { Link } from 'react-router-dom'
import './Playlists.css'

export default function Playlists() {
  // Demo playlist data
  const playlists = [
    {
      id: 'vibe1',
      name: 'Late Night Vibes',
      songCount: 12,
      isCollaborative: false,
      coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80',
    },
    {
      id: 'vibe2',
      name: 'Morning Coffee',
      songCount: 8,
      isCollaborative: true,
      coverUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300&auto=format&fit=crop&q=80',
    },
    {
      id: 'vibe3',
      name: 'Road Trip Bangers',
      songCount: 24,
      isCollaborative: false,
      coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&auto=format&fit=crop&q=80',
    },
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
              {playlist.coverUrl ? (
                <img src={playlist.coverUrl} alt={playlist.name} className="playlist-card-cover-img" />
              ) : (
                <div className="playlist-card-cover-placeholder">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                </div>
              )}
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
