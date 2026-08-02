import { useState, useRef, useEffect, useMemo } from 'react'
import './Library.css'

export default function Library() {
  // Demo library songs with artwork
  const songs = [
    {
      id: '1',
      title: 'Midnight City',
      artist: 'M83',
      album: 'Hurry Up, We\'re Dreaming',
      duration: 243,
      coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&auto=format&fit=crop&q=80',
    },
    {
      id: '2',
      title: 'Redbone',
      artist: 'Childish Gambino',
      album: 'Awaken, My Love!',
      duration: 327,
      coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&auto=format&fit=crop&q=80',
    },
    {
      id: '3',
      title: 'Blinding Lights',
      artist: 'The Weeknd',
      album: 'After Hours',
      duration: 200,
      coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&auto=format&fit=crop&q=80',
    },
    {
      id: '4',
      title: 'Tadow',
      artist: 'Masego & FKJ',
      album: 'Tadow',
      duration: 295,
      coverUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=200&auto=format&fit=crop&q=80',
    },
    {
      id: '5',
      title: 'Electric Feel',
      artist: 'MGMT',
      album: 'Oracular Spectacular',
      duration: 228,
      coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=200&auto=format&fit=crop&q=80',
    },
    {
      id: '6',
      title: 'Ivy',
      artist: 'Frank Ocean',
      album: 'Blonde',
      duration: 249,
      coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=200&auto=format&fit=crop&q=80',
    },
  ]

  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const searchRef = useRef(null)
  const dropdownRef = useRef(null)
  const inputRef = useRef(null)

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Real-time filtered results — updates on every keystroke
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const query = searchQuery.toLowerCase()
    return songs
      .filter(
        (song) =>
          song.title.toLowerCase().includes(query) ||
          song.artist.toLowerCase().includes(query) ||
          song.album.toLowerCase().includes(query)
      )
      .sort((a, b) => {
        // Prioritize title matches, then artist, then album
        const aTitle = a.title.toLowerCase().startsWith(query) ? 0 : 1
        const bTitle = b.title.toLowerCase().startsWith(query) ? 0 : 1
        if (aTitle !== bTitle) return aTitle - bTitle
        const aArtist = a.artist.toLowerCase().startsWith(query) ? 0 : 1
        const bArtist = b.artist.toLowerCase().startsWith(query) ? 0 : 1
        return aArtist - bArtist
      })
  }, [searchQuery])

  // Show dropdown when we have a query AND input is focused
  const showDropdown = isSearchFocused && searchQuery.trim().length > 0

  // Reset highlighted index when results change
  useEffect(() => {
    setHighlightedIndex(-1)
  }, [searchResults])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(e.target)
      ) {
        setIsSearchFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keyboard navigation inside the dropdown
  const handleKeyDown = (e) => {
    if (!showDropdown) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) =>
        prev < searchResults.length - 1 ? prev + 1 : 0
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : searchResults.length - 1
      )
    } else if (e.key === 'Escape') {
      clearSearch()
    }
  }

  const clearSearch = () => {
    setSearchQuery('')
    setIsSearchFocused(false)
    inputRef.current?.blur()
  }

  // Highlight matching text in results
  const highlightMatch = (text, query) => {
    if (!query.trim()) return text
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} className="search-highlight">{part}</span>
      ) : (
        part
      )
    )
  }

  return (
    <div className="page-content">
      {/* Search — pinned to top, centered, independent of content */}
      <div className="library-search-wrapper animate-fade-in-up">
        <div className="search-container" ref={searchRef}>
          <div className={`search-bar ${isSearchFocused ? 'search-bar--focused' : ''}`}>
            <span className="search-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              ref={inputRef}
              type="text"
              className="input"
              placeholder="Search songs, artists, albums..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onKeyDown={handleKeyDown}
            />
            {searchQuery && (
              <button
                className="search-clear-btn"
                onClick={clearSearch}
                aria-label="Clear search"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Live search dropdown — renders as you type */}
          {showDropdown && (
            <div className="search-dropdown animate-fade-in-scale" ref={dropdownRef}>
              {searchResults.length > 0 ? (
                <>
                  <div className="search-dropdown-header">
                    <span className="search-dropdown-count">
                      {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                    </span>
                    <span className="search-dropdown-hint">
                      <kbd>↑</kbd><kbd>↓</kbd> Navigate&nbsp;&nbsp;<kbd>Esc</kbd> Close
                    </span>
                  </div>
                  <div className="search-dropdown-results">
                    {searchResults.map((song, index) => (
                      <div
                        key={song.id}
                        className={`search-result-item ${index === highlightedIndex ? 'search-result-item--active' : ''}`}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        onClick={() => {
                          // Scroll to the song in the list (future: play it)
                          const songRow = document.querySelector(`[data-song-id="${song.id}"]`)
                          if (songRow) {
                            songRow.scrollIntoView({ behavior: 'smooth', block: 'center' })
                            songRow.classList.add('library-song-row--flash')
                            setTimeout(() => songRow.classList.remove('library-song-row--flash'), 1200)
                          }
                          clearSearch()
                        }}
                      >
                        <div className="search-result-cover">
                          {song.coverUrl ? (
                            <img src={song.coverUrl} alt={song.title} />
                          ) : (
                            <div className="search-result-cover-placeholder">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 18V5l12-2v13" />
                                <circle cx="6" cy="18" r="3" />
                                <circle cx="18" cy="16" r="3" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="search-result-info">
                          <span className="search-result-title">
                            {highlightMatch(song.title, searchQuery)}
                          </span>
                          <span className="search-result-meta">
                            {highlightMatch(song.artist, searchQuery)}
                            <span className="search-result-separator">·</span>
                            {highlightMatch(song.album, searchQuery)}
                          </span>
                        </div>
                        <span className="search-result-duration">{formatDuration(song.duration)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="search-no-results">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                  </svg>
                  <p>No results for "<strong>{searchQuery}</strong>"</p>
                  <span>Try searching by song title, artist, or album</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="page-header">
        <h1>Library</h1>
        <p>All songs uploaded by the crew</p>
      </div>

      {/* Song count */}
      <div className="library-toolbar animate-fade-in-up delay-1">
        <div className="library-meta">
          <span className="badge">{songs.length} songs</span>
        </div>
      </div>

      {/* Song List */}
      <div className="library-song-list">
        {songs.map((song, index) => (
          <div
            key={song.id}
            data-song-id={song.id}
            className="library-song-row animate-fade-in-up"
            style={{ animationDelay: `${(index + 2) * 50}ms` }}
          >
            <div className="library-song-index">{index + 1}</div>
            <div className="library-song-cover">
              {song.coverUrl ? (
                <img src={song.coverUrl} alt={song.title} className="library-song-cover-img" />
              ) : (
                <div className="library-song-cover-placeholder">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                </div>
              )}
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
