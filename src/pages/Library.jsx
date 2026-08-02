import './Library.css'

export default function Library() {
  // Placeholder demo data — Phase 4 will wire up Firestore real-time listener
  const songs = [
    { id: '1', title: 'Midnight City', artist: 'M83', album: 'Hurry Up, We\'re Dreaming', duration: 243 },
    { id: '2', title: 'Redbone', artist: 'Childish Gambino', album: 'Awaken, My Love!', duration: 327 },
    { id: '3', title: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', duration: 200 },
    { id: '4', title: 'Tadow', artist: 'Masego & FKJ', album: 'Tadow', duration: 295 },
    { id: '5', title: 'Electric Feel', artist: 'MGMT', album: 'Oracular Spectacular', duration: 228 },
    { id: '6', title: 'Ivy', artist: 'Frank Ocean', album: 'Blonde', duration: 249 },
  ]

  const totalStorageUsed = 2.3 // GB placeholder
  const maxStorage = 10

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <h1>Library</h1>
        <p>All songs uploaded by the crew</p>
      </div>

      {/* Storage Bar */}
      <div className="library-storage animate-fade-in-up">
        <div className="library-storage-info">
          <span className="library-storage-label">Storage</span>
          <span className="library-storage-value">
            {totalStorageUsed} GB / {maxStorage} GB
          </span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-bar-fill"
            style={{ width: `${(totalStorageUsed / maxStorage) * 100}%` }}
          />
        </div>
      </div>

      {/* Search */}
      <div className="library-toolbar animate-fade-in-up delay-1">
        <div className="search-bar">
          <span className="search-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input type="text" className="input" placeholder="Search songs, artists, albums..." />
        </div>
        <div className="library-meta">
          <span className="badge">{songs.length} songs</span>
        </div>
      </div>

      {/* Song List */}
      <div className="library-song-list">
        {songs.map((song, index) => (
          <div
            key={song.id}
            className="library-song-row animate-fade-in-up"
            style={{ animationDelay: `${(index + 2) * 50}ms` }}
          >
            <div className="library-song-index">{index + 1}</div>
            <div className="library-song-cover">
              <div className="library-song-cover-placeholder">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
              <div className="library-song-play-overlay">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
            <div className="library-song-info">
              <span className="library-song-title truncate">{song.title}</span>
              <span className="library-song-artist truncate">{song.artist}</span>
            </div>
            <span className="library-song-album truncate">{song.album}</span>
            <span className="library-song-duration">{formatDuration(song.duration)}</span>
            <button className="btn-icon library-song-more" aria-label="More options">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
