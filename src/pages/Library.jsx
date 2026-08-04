import { useState, useRef, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { usePlayer } from '../context/PlayerContext'
import { Glass } from '@samasante/liquid-glass'
import SongCard from '../components/Song/SongCard'
import { subscribeToLibrary, deleteSongFromFirestore } from '../services/firestore'
import './Library.css'

export default function Library() {
  const { user } = useAuth()
  const { playSong, playAll, enqueue, showToast } = usePlayer()
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const searchRef = useRef(null)
  const dropdownRef = useRef(null)
  const inputRef = useRef(null)

  // Subscribe to live Firestore songs collection with 400ms skeleton timeout cap
  useEffect(() => {
    let isMounted = true

    // Maximum 400ms skeleton loading duration cap
    const skeletonTimer = setTimeout(() => {
      if (isMounted) setLoading(false)
    }, 400)

    const unsubscribe = subscribeToLibrary(
      (liveSongs) => {
        if (!isMounted) return
        clearTimeout(skeletonTimer)
        setSongs(liveSongs)
        setLoading(false)
      },
      (err) => {
        if (!isMounted) return
        clearTimeout(skeletonTimer)
        console.error('Library subscription error:', err)
        setLoading(false)
      }
    )

    return () => {
      isMounted = false
      clearTimeout(skeletonTimer)
      unsubscribe()
    }
  }, [])

  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Real-time filtered results — updates on every keystroke across title, artist, album, uploader
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const query = searchQuery.toLowerCase()
    return songs
      .filter(
        (song) =>
          (song.title && song.title.toLowerCase().includes(query)) ||
          (song.artist && song.artist.toLowerCase().includes(query)) ||
          (song.album && song.album.toLowerCase().includes(query)) ||
          (song.uploaderName && song.uploaderName.toLowerCase().includes(query))
      )
      .sort((a, b) => {
        const aTitle = a.title?.toLowerCase().startsWith(query) ? 0 : 1
        const bTitle = b.title?.toLowerCase().startsWith(query) ? 0 : 1
        if (aTitle !== bTitle) return aTitle - bTitle
        const aArtist = a.artist?.toLowerCase().startsWith(query) ? 0 : 1
        const bArtist = b.artist?.toLowerCase().startsWith(query) ? 0 : 1
        return aArtist - bArtist
      })
  }, [searchQuery, songs])

  // Show dropdown when we have a query AND input is focused
  const showDropdown = isSearchFocused && searchQuery.trim().length > 0

  // Reset highlighted index when results change
  useEffect(() => {
    setHighlightedIndex(-1)
  }, [searchResults])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
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
    if (!text) return ''
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

  const handlePlaySong = (song) => {
    const songIndex = songs.findIndex((s) => s.id === song.id)
    playAll(songs, songIndex >= 0 ? songIndex : 0)
  }

  const handleDeleteSong = async (song) => {
    try {
      await deleteSongFromFirestore(song.id, song, song.fileSize)
      showToast(`Deleted "${song.title}"`)
    } catch (err) {
      console.error('Delete error:', err)
      showToast('Failed to delete song: ' + err.message)
    }
  }

  return (
    <div className="page-content">
      {/* Search — pinned to top, centered */}
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
            <Glass className="search-dropdown animate-fade-in-scale" ref={dropdownRef} radius={14} optics={{ frost: 0.4, dispersion: 0.3, bend: 0, glow: 0.1 }}>
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
                            <img src={song.coverUrl} alt={song.title} loading="lazy" />
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
                            {highlightMatch(song.artist || 'Unknown Artist', searchQuery)}
                            <span className="search-result-separator">·</span>
                            {highlightMatch(song.album || 'Single', searchQuery)}
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
            </Glass>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="page-header">
        <h1>Library</h1>
        <p>All songs uploaded by the crew</p>
      </div>

      {/* Toolbar */}
      <div className="library-toolbar animate-fade-in-up delay-1">
        <div className="library-meta">
          <span className="badge">{songs.length} song{songs.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Song List / Skeleton / Empty State */}
      {loading ? (
        <div className="library-song-list">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="library-skeleton-row animate-fade-in">
              <div className="skeleton-box" style={{ height: '16px', width: '20px' }} />
              <div className="skeleton-box" style={{ height: '48px', width: '48px', borderRadius: '6px' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div className="skeleton-box" style={{ height: '16px', width: '180px' }} />
                <div className="skeleton-box" style={{ height: '12px', width: '120px' }} />
              </div>
              <div className="skeleton-box" style={{ height: '14px', width: '100px' }} />
              <div className="skeleton-box" style={{ height: '14px', width: '40px' }} />
              <div className="skeleton-box" style={{ height: '24px', width: '24px', borderRadius: '50%' }} />
            </div>
          ))}
        </div>
      ) : songs.length === 0 ? (
        <div className="library-empty-state animate-fade-in-up" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ marginBottom: '16px', opacity: 0.6 }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>Your library is empty</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Upload your favorite audio tracks to start building your crew's music library.
          </p>
          <a href="/upload" className="btn btn-primary btn-lg">
            Upload First Song
          </a>
        </div>
      ) : (
        <div className="library-song-list">
          {songs.map((song, index) => (
            <SongCard
              key={song.id}
              song={song}
              index={index}
              currentUserId={user?.uid}
              onPlay={handlePlaySong}
              onDelete={handleDeleteSong}
              onEnqueue={enqueue}
            />
          ))}
        </div>
      )}
    </div>
  )
}

