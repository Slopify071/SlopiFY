import { createContext, useContext, useReducer, useRef, useEffect, useCallback } from 'react'

const PlayerContext = createContext(null)

const initialState = {
  currentSong: null,
  queue: [],
  history: [],
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.7,
  muted: false,
  shuffle: false,
  repeat: 'off', // 'off' | 'all' | 'one'
}

function playerReducer(state, action) {
  switch (action.type) {
    case 'SET_SONG':
      return {
        ...state,
        currentSong: action.payload,
        isPlaying: true,
        currentTime: 0,
        duration: 0,
      }
    case 'TOGGLE_PLAY':
      return { ...state, isPlaying: !state.isPlaying }
    case 'SET_PLAYING':
      return { ...state, isPlaying: action.payload }
    case 'SET_CURRENT_TIME':
      return { ...state, currentTime: action.payload }
    case 'SET_DURATION':
      return { ...state, duration: action.payload }
    case 'SET_VOLUME':
      return { ...state, volume: action.payload, muted: action.payload === 0 }
    case 'TOGGLE_MUTE':
      return { ...state, muted: !state.muted }
    case 'TOGGLE_SHUFFLE':
      return { ...state, shuffle: !state.shuffle }
    case 'CYCLE_REPEAT':
      return {
        ...state,
        repeat: state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off',
      }
    case 'SET_QUEUE':
      return { ...state, queue: action.payload }
    case 'ENQUEUE':
      return { ...state, queue: [...state.queue, action.payload] }
    case 'CLEAR_QUEUE':
      return { ...state, queue: [] }
    case 'PUSH_HISTORY':
      return { ...state, history: [...state.history, action.payload] }
    case 'POP_HISTORY': {
      const newHistory = [...state.history]
      const prev = newHistory.pop()
      return { ...state, history: newHistory, currentSong: prev || state.currentSong }
    }
    case 'DEQUEUE': {
      const newQueue = [...state.queue]
      const next = newQueue.shift()
      return { ...state, queue: newQueue, currentSong: next || state.currentSong }
    }
    default:
      return state
  }
}

export function PlayerProvider({ children }) {
  const [state, dispatch] = useReducer(playerReducer, initialState)
  const audioRef = useRef(null)
  const allSongsRef = useRef([])

  // Create audio element once
  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.volume = initialState.volume
    audioRef.current = audio

    return () => {
      audio.pause()
      audio.src = ''
    }
  }, [])

  // Sync audio src when currentSong changes
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !state.currentSong) return

    const url = state.currentSong.audioUrl || state.currentSong.downloadUrl || ''
    if (!url) return

    audio.src = url
    audio.load()
    audio.play().catch((err) => {
      console.warn('Autoplay blocked or failed:', err)
      dispatch({ type: 'SET_PLAYING', payload: false })
    })
  }, [state.currentSong])

  // Sync play/pause
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !state.currentSong) return

    if (state.isPlaying) {
      audio.play().catch(() => dispatch({ type: 'SET_PLAYING', payload: false }))
    } else {
      audio.pause()
    }
  }, [state.isPlaying])

  // Sync volume + mute
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = state.muted ? 0 : state.volume
  }, [state.volume, state.muted])

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => dispatch({ type: 'SET_CURRENT_TIME', payload: audio.currentTime })
    const onLoadedMetadata = () => dispatch({ type: 'SET_DURATION', payload: audio.duration })
    const onEnded = () => {
      if (state.repeat === 'one') {
        audio.currentTime = 0
        audio.play()
        return
      }
      // Try to play next in queue
      if (state.queue.length > 0) {
        if (state.currentSong) {
          dispatch({ type: 'PUSH_HISTORY', payload: state.currentSong })
        }
        if (state.shuffle) {
          const randomIndex = Math.floor(Math.random() * state.queue.length)
          const nextSong = state.queue[randomIndex]
          const newQueue = state.queue.filter((_, i) => i !== randomIndex)
          dispatch({ type: 'SET_QUEUE', payload: newQueue })
          dispatch({ type: 'SET_SONG', payload: nextSong })
        } else {
          dispatch({ type: 'DEQUEUE' })
        }
      } else if (state.repeat === 'all' && allSongsRef.current.length > 0) {
        // Repeat all: rebuild queue from all songs
        const currentIndex = allSongsRef.current.findIndex(
          (s) => s.id === state.currentSong?.id
        )
        const nextIndex = (currentIndex + 1) % allSongsRef.current.length
        if (state.currentSong) {
          dispatch({ type: 'PUSH_HISTORY', payload: state.currentSong })
        }
        dispatch({ type: 'SET_SONG', payload: allSongsRef.current[nextIndex] })
      } else {
        dispatch({ type: 'SET_PLAYING', payload: false })
      }
    }
    const onPlay = () => dispatch({ type: 'SET_PLAYING', payload: true })
    const onPause = () => dispatch({ type: 'SET_PLAYING', payload: false })

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [state.queue, state.repeat, state.shuffle, state.currentSong])

  // Media Session API (OS lock-screen controls)
  useEffect(() => {
    if (!('mediaSession' in navigator) || !state.currentSong) return

    navigator.mediaSession.metadata = new MediaMetadata({
      title: state.currentSong.title || 'Unknown',
      artist: state.currentSong.artist || 'Unknown Artist',
      album: state.currentSong.album || 'SlopiFY',
      artwork: state.currentSong.coverUrl
        ? [{ src: state.currentSong.coverUrl, sizes: '256x256', type: 'image/jpeg' }]
        : [],
    })

    navigator.mediaSession.setActionHandler('play', () => dispatch({ type: 'SET_PLAYING', payload: true }))
    navigator.mediaSession.setActionHandler('pause', () => dispatch({ type: 'SET_PLAYING', payload: false }))
    navigator.mediaSession.setActionHandler('previoustrack', () => playPrevious())
    navigator.mediaSession.setActionHandler('nexttrack', () => playNext())
  }, [state.currentSong])

  // Global Keyboard Shortcuts (Spacebar to play/pause)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore key events when user is typing in inputs or text fields
      const activeTag = document.activeElement?.tagName?.toLowerCase()
      const isInput = activeTag === 'input' || activeTag === 'textarea' || document.activeElement?.isContentEditable
      if (isInput) return

      if (e.code === 'Space' || e.key === ' ') {
        if (state.currentSong) {
          e.preventDefault()
          dispatch({ type: 'TOGGLE_PLAY' })
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.currentSong])


  const playSong = useCallback((song) => {
    if (state.currentSong) {
      dispatch({ type: 'PUSH_HISTORY', payload: state.currentSong })
    }
    dispatch({ type: 'SET_SONG', payload: song })
  }, [state.currentSong])

  const playAll = useCallback((songs, startIndex = 0) => {
    if (!songs || songs.length === 0) return
    allSongsRef.current = songs
    const song = songs[startIndex]
    const remaining = [...songs.slice(startIndex + 1), ...songs.slice(0, startIndex)]
    dispatch({ type: 'SET_QUEUE', payload: remaining })
    if (state.currentSong) {
      dispatch({ type: 'PUSH_HISTORY', payload: state.currentSong })
    }
    dispatch({ type: 'SET_SONG', payload: song })
  }, [state.currentSong])

  const togglePlay = useCallback(() => {
    if (!state.currentSong) return
    dispatch({ type: 'TOGGLE_PLAY' })
  }, [state.currentSong])

  const playNext = useCallback(() => {
    if (state.queue.length > 0) {
      if (state.currentSong) {
        dispatch({ type: 'PUSH_HISTORY', payload: state.currentSong })
      }
      if (state.shuffle) {
        const randomIndex = Math.floor(Math.random() * state.queue.length)
        const nextSong = state.queue[randomIndex]
        const newQueue = state.queue.filter((_, i) => i !== randomIndex)
        dispatch({ type: 'SET_QUEUE', payload: newQueue })
        dispatch({ type: 'SET_SONG', payload: nextSong })
      } else {
        dispatch({ type: 'DEQUEUE' })
      }
    }
  }, [state.queue, state.currentSong, state.shuffle])

  const playPrevious = useCallback(() => {
    const audio = audioRef.current
    // If more than 3 seconds in, restart current song
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0
      return
    }
    if (state.history.length > 0) {
      if (state.currentSong) {
        // Put current song at front of queue
        dispatch({ type: 'SET_QUEUE', payload: [state.currentSong, ...state.queue] })
      }
      dispatch({ type: 'POP_HISTORY' })
    } else if (audio) {
      audio.currentTime = 0
    }
  }, [state.history, state.currentSong, state.queue])

  const seek = useCallback((time) => {
    const audio = audioRef.current
    if (audio && isFinite(time)) {
      audio.currentTime = time
      dispatch({ type: 'SET_CURRENT_TIME', payload: time })
    }
  }, [])

  const setVolume = useCallback((vol) => {
    dispatch({ type: 'SET_VOLUME', payload: Math.max(0, Math.min(1, vol)) })
  }, [])

  const toggleMute = useCallback(() => {
    dispatch({ type: 'TOGGLE_MUTE' })
  }, [])

  const toggleShuffle = useCallback(() => {
    dispatch({ type: 'TOGGLE_SHUFFLE' })
  }, [])

  const cycleRepeat = useCallback(() => {
    dispatch({ type: 'CYCLE_REPEAT' })
  }, [])

  const enqueue = useCallback((song) => {
    dispatch({ type: 'ENQUEUE', payload: song })
  }, [])

  const clearQueue = useCallback(() => {
    dispatch({ type: 'CLEAR_QUEUE' })
  }, [])

  const value = {
    ...state,
    playSong,
    playAll,
    togglePlay,
    playNext,
    playPrevious,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    enqueue,
    clearQueue,
  }

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const context = useContext(PlayerContext)
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider')
  }
  return context
}
