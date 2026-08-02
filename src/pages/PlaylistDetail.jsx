import { useParams } from 'react-router-dom'
import './PlaylistDetail.css'

export default function PlaylistDetail() {
  const { id } = useParams()

  // Placeholder — Phase 6 will wire up Firestore
  const playlist = {
    name: 'Late Night Vibes',
    description: 'Chill tracks for those 2am coding sessions',
    ownerName: 'Demo User',
    songCount: 4,
    isShared: false,
    isCollaborative: false,
    songs: [
      { id: '1', title: 'Midnight City', artist: 'M83', duration: 243 },
      { id: '2', title: 'Tadow', artist: 'Masego & FKJ', duration: 295 },
      { id: '3', title: 'Redbone', artist: 'Childish Gambino', duration: 327 },
      { id: '6', title: 'Ivy', artist: 'Frank Ocean', duration: 249 },
    ],
  }

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="page-content">
      {/* Playlist Header */}
      <div className="playlist-detail-header animate-fade-in-up">
        <div className="playlist-detail-cover">
          <div className="playlist-detail-cover-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
        </div>
        <div className="playlist-detail-info">
          <span className="playlist-detail-type">Playlist</span>
          <h1 className="playlist-detail-name">{playlist.name}</h1>
          <p className="playlist-detail-description">{playlist.description}</p>
          <div className="playlist-detail-meta">
            <span>{playlist.ownerName}</span>
            <span className="playlist-detail-dot">•</span>
            <span>{playlist.songCount} songs</span>
            {playlist.isCollaborative && <span className="badge">Collaborative</span>}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="playlist-detail-actions animate-fade-in-up delay-1">
        <button className="btn btn-primary btn-lg">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          Play All
        </button>
        <button className="btn btn-secondary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Share
        </button>
      </div>

      {/* Song List */}
      <div className="playlist-detail-songs">
        {playlist.songs.map((song, index) => (
          <div
            key={song.id}
            className="playlist-detail-song-row animate-fade-in-up"
            style={{ animationDelay: `${(index + 2) * 60}ms` }}
          >
            <div className="playlist-detail-song-index">{index + 1}</div>
            <div className="playlist-detail-song-cover">
              <div className="library-song-cover-placeholder">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
            </div>
            <div className="playlist-detail-song-info">
              <span className="playlist-detail-song-title truncate">{song.title}</span>
              <span className="playlist-detail-song-artist truncate">{song.artist}</span>
            </div>
            <span className="playlist-detail-song-duration">{formatDuration(song.duration)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
