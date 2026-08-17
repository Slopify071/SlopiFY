import { createContext, useContext, useReducer, useRef, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { saveUserSession, subscribeToUserSession, subscribeToLibrary, subscribeToStorageMeta } from '../services/firestore'
import { getAudioStreamUrl, getCoverArtUrl } from '../services/storage'

const PlayerContext = createContext(null)

let globalAudio = null
function getAudioElement() {
  if (!globalAudio && typeof window !== 'undefined') {
    globalAudio = new Audio()
    globalAudio.preload = 'auto'
  }
  return globalAudio
}

function getDeviceId() {
  try {
    let id = sessionStorage.getItem('slopify_device_id')
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now()
      sessionStorage.setItem('slopify_device_id', id)
    }
    return id
  } catch {
    return 'dev_' + Math.random().toString(36).substring(2, 9)
  }
}

const loadLocalState = () => {
  try {
    const saved = localStorage.getItem('slopify_player_state')
    if (saved) {
      const parsed = JSON.parse(saved)
      return {
        ...parsed,
        isPlaying: false, // Don't auto-play on refresh
        isBuffering: false,
        isFullscreen: parsed.isFullscreen || false,
        toast: null,
      }
    }
  } catch (err) {
    console.warn('Failed to load local player state:', err)
  }
  return null
}

const initialState = {
  currentSong: null,
  queue: [],
  history: [],
  isPlaying: false,
  isBuffering: false,
  currentTime: 0,
  duration: 0,
  volume: 0.7,
  muted: false,
  shuffle: false,
  repeat: 'off', // 'off' | 'all' | 'one'
  isQueueOpen: false,
  isFullscreen: false,
  toast: null, // { id, message }
}

const initialHydratedState = {
  ...initialState,
  ...(loadLocalState() || {})
}

function playerReducer(state, action) {
  switch (action.type) {
    case 'SYNC_REMOTE_STATE':
      return {
        ...state,
        ...(action.payload.currentSong !== undefined ? { currentSong: action.payload.currentSong } : {}),
        ...(action.payload.isPlaying !== undefined ? { isPlaying: action.payload.isPlaying } : {}),
        ...(action.payload.currentTime !== undefined ? { currentTime: action.payload.currentTime } : {}),
        ...(action.payload.duration !== undefined ? { duration: action.payload.duration } : {}),
        ...(action.payload.queue !== undefined ? { queue: action.payload.queue } : {}),
      }
    case 'SET_SONG':
      return {
        ...state,
        currentSong: action.payload,
        isPlaying: true,
        isBuffering: true,
        currentTime: 0,
        duration: action.payload?.duration || 0,
      }
    case 'UPDATE_CURRENT_SONG':
      return {
        ...state,
        currentSong: state.currentSong ? { ...state.currentSong, ...action.payload } : state.currentSong,
      }
    case 'TOGGLE_PLAY':
      return { ...state, isPlaying: !state.isPlaying }
    case 'SET_PLAYING':
      return { ...state, isPlaying: action.payload }
    case 'SET_BUFFERING':
      return { ...state, isBuffering: action.payload }
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
    case 'REMOVE_FROM_QUEUE':
      return {
        ...state,
        queue: state.queue.filter((_, i) => i !== action.payload),
      }
    case 'CLEAR_QUEUE':
      return { ...state, queue: [] }
    case 'TOGGLE_QUEUE':
      return { ...state, isQueueOpen: !state.isQueueOpen }
    case 'SET_QUEUE_OPEN':
      return { ...state, isQueueOpen: !!action.payload }
    case 'TOGGLE_FULLSCREEN':
      return { ...state, isFullscreen: !state.isFullscreen }
    case 'SET_FULLSCREEN':
      return { ...state, isFullscreen: !!action.payload }
    case 'SHOW_TOAST':
      return { ...state, toast: { id: Date.now(), message: action.payload } }
    case 'HIDE_TOAST':
      return { ...state, toast: null }
    case 'PUSH_HISTORY':
      return { ...state, history: [...state.history, action.payload] }
    case 'POP_HISTORY': {
      const newHistory = [...state.history]
      const prev = newHistory.pop()
      const nextSong = prev || state.currentSong
      return {
        ...state,
        history: newHistory,
        currentSong: nextSong,
        currentTime: 0,
        duration: nextSong?.duration || 0,
        isPlaying: prev ? true : state.isPlaying,
      }
    }
    case 'DEQUEUE': {
      const newQueue = [...state.queue]
      const next = newQueue.shift()
      const nextSong = next || state.currentSong
      return {
        ...state,
        queue: newQueue,
        currentSong: nextSong,
        currentTime: 0,
        duration: nextSong?.duration || 0,
        isPlaying: next ? true : state.isPlaying,
      }
    }
    case 'PURGE_DELETED_SONG': {
      const deletedSongId = action.payload
      if (!deletedSongId) return state

      const isCurrentDeleted = state.currentSong?.id === deletedSongId
      const newQueue = state.queue.filter((s) => s.id !== deletedSongId)
      const newHistory = state.history.filter((s) => s.id !== deletedSongId)

      if (!isCurrentDeleted) {
        if (newQueue.length === state.queue.length && newHistory.length === state.history.length) {
          return state
        }
        return {
          ...state,
          queue: newQueue,
          history: newHistory,
        }
      }

      // Current song was deleted: Advance to next song in queue if available
      if (newQueue.length > 0) {
        const [nextSong, ...remainingQueue] = newQueue
        return {
          ...state,
          currentSong: nextSong,
          queue: remainingQueue,
          history: newHistory,
          currentTime: 0,
          duration: nextSong?.duration || 0,
          isPlaying: state.isPlaying,
          isBuffering: false,
        }
      }

      // No songs left in queue: close player
      return {
        ...state,
        currentSong: null,
        queue: [],
        history: newHistory,
        isPlaying: false,
        isBuffering: false,
        currentTime: 0,
        duration: 0,
      }
    }
    case 'PURGE_MISSING_SONGS': {
      const validIds = action.payload
      if (!validIds || typeof validIds.has !== 'function') return state

      const isCurrentValid = !state.currentSong || validIds.has(state.currentSong.id)
      const newQueue = state.queue.filter((s) => validIds.has(s.id))
      const newHistory = state.history.filter((s) => validIds.has(s.id))

      if (isCurrentValid) {
        if (newQueue.length === state.queue.length && newHistory.length === state.history.length) {
          return state
        }
        return {
          ...state,
          queue: newQueue,
          history: newHistory,
        }
      }

      if (newQueue.length > 0) {
        const [nextSong, ...remainingQueue] = newQueue
        return {
          ...state,
          currentSong: nextSong,
          queue: remainingQueue,
          history: newHistory,
          currentTime: 0,
          duration: nextSong?.duration || 0,
          isPlaying: state.isPlaying,
          isBuffering: false,
        }
      }

      return {
        ...state,
        currentSong: null,
        queue: [],
        history: newHistory,
        isPlaying: false,
        isBuffering: false,
        currentTime: 0,
        duration: 0,
      }
    }
    case 'RESET_PLAYER':
      return {
        ...initialState,
      }
    default:
      return state
  }
}

export function PlayerProvider({ children }) {
  const { user } = useAuth()
  const [state, dispatch] = useReducer(playerReducer, initialHydratedState)
  const audioRef = useRef(getAudioElement())
  const allSongsRef = useRef([])
  const stateRef = useRef(state)
  const playPromiseRef = useRef(null)
  const isChangingSrcRef = useRef(false)
  const isSeekingAudioRef = useRef(false)
  const pendingSeekRef = useRef(0)
  // Synchronous buffering flag — set directly in audio event handlers so
  // onTimeUpdate can gate on it with ZERO latency (no React render cycle).
  // The React state `isBuffering` is still dispatched for UI (spinner etc).
  const isBufferingRef = useRef(false)
  const deviceIdRef = useRef(getDeviceId())
  const isSyncingFromRemoteRef = useRef(false)

  useEffect(() => {
    stateRef.current = state
    try {
      localStorage.setItem('slopify_player_state', JSON.stringify({
        currentSong: state.currentSong,
        queue: state.queue,
        history: state.history,
        currentTime: state.currentTime,
        duration: state.duration,
        volume: state.volume,
        muted: state.muted,
        shuffle: state.shuffle,
        repeat: state.repeat,
        isQueueOpen: state.isQueueOpen,
        isFullscreen: state.isFullscreen,
      }))
    } catch (e) {
      // ignore
    }
  }, [state])

  // Reset audio and state when user logs out
  const prevUserRef = useRef(user)
  useEffect(() => {
    if (prevUserRef.current && !user) {
      const audio = audioRef.current || getAudioElement()
      if (audio) {
        try {
          audio.pause()
          audio.removeAttribute('src')
          audio.load()
        } catch (e) {
          // ignore
        }
      }
      dispatch({ type: 'RESET_PLAYER' })
      try {
        localStorage.removeItem('slopify_player_state')
      } catch (e) {
        // ignore
      }
    }
    prevUserRef.current = user
  }, [user])

  // 1. Listen for cross-device playback session changes from Firestore
  useEffect(() => {
    if (!user?.uid) return

    const unsubscribe = subscribeToUserSession(
      user.uid,
      (remoteData) => {
        if (!remoteData || remoteData.deviceId === deviceIdRef.current) return

        isSyncingFromRemoteRef.current = true

        const payload = {}
        let shouldSync = false

        if (remoteData.currentSong && remoteData.currentSong.id !== stateRef.current.currentSong?.id) {
          payload.currentSong = remoteData.currentSong
          payload.duration = remoteData.currentSong.duration || 0
          payload.currentTime = typeof remoteData.currentTime === 'number' ? remoteData.currentTime : 0
          shouldSync = true
          if (audioRef.current && isFinite(payload.currentTime)) {
            audioRef.current.currentTime = payload.currentTime
          }
        }

        if (typeof remoteData.isPlaying === 'boolean' && remoteData.isPlaying !== stateRef.current.isPlaying) {
          payload.isPlaying = remoteData.isPlaying
          shouldSync = true
        }

        if (Array.isArray(remoteData.queue) && JSON.stringify(remoteData.queue) !== JSON.stringify(stateRef.current.queue)) {
          payload.queue = remoteData.queue
          shouldSync = true
        }

        if (typeof remoteData.currentTime === 'number' && Math.abs(remoteData.currentTime - stateRef.current.currentTime) > 2) {
          payload.currentTime = remoteData.currentTime
          shouldSync = true
          if (audioRef.current && isFinite(remoteData.currentTime)) {
            audioRef.current.currentTime = remoteData.currentTime
          }
        }

        if (shouldSync) {
          dispatch({ type: 'SYNC_REMOTE_STATE', payload })
        }

        setTimeout(() => {
          isSyncingFromRemoteRef.current = false
        }, 300)
      },
      (err) => console.warn('User session listener error:', err)
    )

    return () => unsubscribe()
  }, [user?.uid])

  // 2. Broadcast local playback state changes to Firestore
  useEffect(() => {
    if (!user?.uid || isSyncingFromRemoteRef.current) return

    saveUserSession(user.uid, {
      deviceId: deviceIdRef.current,
      currentSong: state.currentSong,
      isPlaying: state.isPlaying,
      currentTime: state.currentTime,
      queue: state.queue,
    })
  }, [user?.uid, state.currentSong?.id, state.isPlaying, state.queue?.length])

  // 3. Periodic position sync during active playback (every 5 seconds)
  useEffect(() => {
    if (!user?.uid || !state.isPlaying) return

    const interval = setInterval(() => {
      if (isSyncingFromRemoteRef.current) return
      saveUserSession(user.uid, {
        deviceId: deviceIdRef.current,
        currentSong: stateRef.current.currentSong,
        isPlaying: true,
        currentTime: stateRef.current.currentTime,
        queue: stateRef.current.queue,
      })
    }, 5000)

    return () => clearInterval(interval)
  }, [user?.uid, state.isPlaying])

  // 3b. Buffering Watchdog — alerts user if audio stream stays stalled/buffering for > 8s
  useEffect(() => {
    if (!state.isPlaying || !state.isBuffering || !state.currentSong) return

    const watchdogTimer = setTimeout(() => {
      if (stateRef.current.isPlaying && isBufferingRef.current) {
        console.warn('[Player] Audio stream buffering > 8s. Checking tunnel/storage connection...')
        dispatch({
          type: 'SHOW_TOAST',
          payload: 'Audio is buffering slowly. Checking storage connection...',
        })
      }
    }, 8000)

    return () => clearTimeout(watchdogTimer)
  }, [state.isPlaying, state.isBuffering, state.currentSong?.id])

  // 4. Real-time library subscription to sync deleted songs across player state
  const libraryLoadedOnceRef = useRef(false)
  useEffect(() => {
    const unsubscribe = subscribeToLibrary((songs) => {
      if (!Array.isArray(songs)) return
      allSongsRef.current = songs

      // Ignore before initial library load if library snapshot is empty
      if (!libraryLoadedOnceRef.current) {
        libraryLoadedOnceRef.current = true
        if (songs.length === 0) return
      }

      const validIds = new Set(songs.map((s) => s.id))
      const current = stateRef.current.currentSong
      const isCurrentMissing = Boolean(current?.id && !validIds.has(current.id))
      const hasMissingInQueue = stateRef.current.queue.some((s) => s?.id && !validIds.has(s.id))
      const hasMissingInHistory = stateRef.current.history.some((s) => s?.id && !validIds.has(s.id))

      if (isCurrentMissing) {
        const audio = audioRef.current || getAudioElement()
        if (audio) {
          try {
            audio.pause()
            audio.removeAttribute('src')
            audio.load()
          } catch (e) {
            // ignore
          }
        }
      }

      if (isCurrentMissing || hasMissingInQueue || hasMissingInHistory) {
        dispatch({ type: 'PURGE_MISSING_SONGS', payload: validIds })
      }
    })

    return () => unsubscribe()
  }, [])

  // 5. Global storage metadata listener for live dynamic endpoint resolution
  useEffect(() => {
    const unsubscribe = subscribeToStorageMeta(() => {})
    return () => unsubscribe()
  }, [])

  // Ensure singleton audio instance is configured
  useEffect(() => {
    const audio = audioRef.current || getAudioElement()
    if (audio) {
      audio.volume = initialState.volume
    }
  }, [])

  // Single, consolidated effect to sync audio src and play/pause state
  useEffect(() => {
    const audio = audioRef.current || getAudioElement()
    if (!audio) return

    if (!state.currentSong) {
      try {
        if (!audio.paused) {
          audio.pause()
        }
        audio.removeAttribute('src')
        audio.load()
      } catch (e) {
        // ignore
      }
      return
    }

    const url = getAudioStreamUrl(state.currentSong)
    if (!url) return

    // Cancellation flag — if this effect re-runs before the play promise
    // resolves, the stale invocation is discarded.
    let cancelled = false

    let srcChanged = false
    try {
      const currentSrc = audio.src ? new URL(audio.src, window.location.href).href : ''
      const targetSrc = new URL(url, window.location.href).href
      if (currentSrc !== targetSrc) {
        srcChanged = true
      }
    } catch {
      if (audio.src !== url) {
        srcChanged = true
      }
    }

    if (srcChanged) {
      isChangingSrcRef.current = true
      isBufferingRef.current = true
      audioDurationResolvedRef.current = false
      if (typeof state.currentTime === 'number' && state.currentTime > 0) {
        pendingSeekRef.current = state.currentTime
      } else {
        pendingSeekRef.current = 0
      }
      try {
        audio.pause()
      } catch (e) {
        // ignore pause errors
      }
      audio.preload = 'auto'
      audio.src = url
      audio.load()
    }

    if (state.isPlaying) {
      // Only call play() if not already playing the correct source
      if (srcChanged || audio.paused) {
        const playPromise = audio.play()
        playPromiseRef.current = playPromise
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              if (cancelled) return
              playPromiseRef.current = null
              isChangingSrcRef.current = false
            })
            .catch((err) => {
              if (cancelled) return
              playPromiseRef.current = null
              if (err && err.name === 'AbortError') {
                return
              }
              isChangingSrcRef.current = false
              console.warn('Autoplay or playback failed:', err)
              dispatch({ type: 'SET_PLAYING', payload: false })
            })
        } else {
          isChangingSrcRef.current = false
        }
      }
    } else {
      if (playPromiseRef.current) {
        playPromiseRef.current
          .then(() => {
            if (cancelled) return
            audio.pause()
            isChangingSrcRef.current = false
          })
          .catch(() => {
            if (cancelled) return
            audio.pause()
            isChangingSrcRef.current = false
          })
      } else {
        audio.pause()
        isChangingSrcRef.current = false
      }
    }

    return () => {
      cancelled = true
    }
  }, [state.currentSong?.id, state.currentSong?.audioUrl, state.currentSong?.downloadUrl, state.isPlaying])

  // Sync volume + mute
  useEffect(() => {
    const audio = audioRef.current || getAudioElement()
    if (!audio) return
    audio.volume = state.muted ? 0 : state.volume
  }, [state.volume, state.muted])

  // Audio event listeners attached once
  const lastTimeDispatchRef = useRef(0)
  // Tracks whether we have received the real audio.duration from the browser.
  // Once true, we must NEVER overwrite duration with song metadata again.
  const audioDurationResolvedRef = useRef(false)

  useEffect(() => {
    const audio = audioRef.current || getAudioElement()
    if (!audio) return

    const getAudioDuration = () => {
      return audio.duration && isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : 0
    }

    const updateDuration = () => {
      const realDuration = getAudioDuration()
      if (realDuration > 0) {
        // Real audio duration is available — lock it in and never allow
        // song metadata to override it again for this track.
        audioDurationResolvedRef.current = true
        if (realDuration !== stateRef.current.duration) {
          dispatch({ type: 'SET_DURATION', payload: realDuration })
        }
      } else if (!audioDurationResolvedRef.current && stateRef.current.currentSong?.duration) {
        // Fallback to metadata ONLY if we have never resolved real duration
        const metaDur = stateRef.current.currentSong.duration
        if (metaDur !== stateRef.current.duration) {
          dispatch({ type: 'SET_DURATION', payload: metaDur })
        }
      }
    }

    const onTimeUpdate = () => {
      // CRITICAL: Gate on the synchronous ref, NOT stateRef.current.isBuffering.
      // stateRef.current lags by one React render cycle.  If we checked it,
      // timeupdate events could slip through the gap between dispatch() and
      // the next render, advancing the timer while the song is still loading.
      if (isBufferingRef.current) {
        // Still reconcile duration even while buffering
        updateDuration()
        return
      }

      const cur = audio.currentTime

      if (Math.abs(cur - lastTimeDispatchRef.current) >= 0.25 || cur === 0 || audio.ended) {
        lastTimeDispatchRef.current = cur
        dispatch({ type: 'SET_CURRENT_TIME', payload: cur })
      }

      updateDuration()
    }
    const applyPendingSeek = () => {
      if (pendingSeekRef.current > 0 && audio.duration && isFinite(audio.duration)) {
        try {
          audio.currentTime = Math.max(0, Math.min(pendingSeekRef.current, audio.duration - 0.5))
        } catch (e) {
          // ignore
        }
        pendingSeekRef.current = 0
      }
    }

    const onLoadedMetadata = () => {
      updateDuration()
      applyPendingSeek()
    }
    const onDurationChange = () => {
      updateDuration()
      applyPendingSeek()
    }
    const onCanPlay = () => {
      updateDuration()
      applyPendingSeek()
      isChangingSrcRef.current = false
      if (!stateRef.current.isPlaying) {
        isBufferingRef.current = false
        dispatch({ type: 'SET_BUFFERING', payload: false })
      }
    }

    const onWaiting = () => {
      isBufferingRef.current = true
      dispatch({ type: 'SET_BUFFERING', payload: true })
    }

    const onStalled = () => {
      isBufferingRef.current = true
      dispatch({ type: 'SET_BUFFERING', payload: true })
    }

    const onLoadStart = () => {
      audioDurationResolvedRef.current = false
      isBufferingRef.current = true
      dispatch({ type: 'SET_BUFFERING', payload: true })
    }

    const onSeeking = () => {
      isSeekingAudioRef.current = true
      isBufferingRef.current = true
      dispatch({ type: 'SET_BUFFERING', payload: true })
    }

    const onSeeked = () => {
      isSeekingAudioRef.current = false
      // Snap displayed position to where the browser actually landed,
      // but keep isBufferingRef true — let `playing` clear it once audio
      // is actually outputting sound.
      const cur = audio.currentTime
      lastTimeDispatchRef.current = cur
      dispatch({ type: 'SET_CURRENT_TIME', payload: cur })
    }

    const onPlaying = () => {
      // `playing` fires ONLY when audio output has actually started.
      // This is the single gate that unlocks the timer.
      isChangingSrcRef.current = false
      isBufferingRef.current = false
      dispatch({ type: 'SET_BUFFERING', payload: false })
      // Resync timer to real audio position now that output has resumed
      const cur = audio.currentTime
      lastTimeDispatchRef.current = cur
      dispatch({ type: 'SET_CURRENT_TIME', payload: cur })
      if (!stateRef.current.isPlaying) {
        dispatch({ type: 'SET_PLAYING', payload: true })
      }
    }

    const onEnded = () => {
      // Ignore spurious ended events (often fired by browsers during seek errors or buffering issues on streams)
      if (audio.duration && Math.abs(audio.currentTime - audio.duration) > 2) {
        console.warn('Spurious ended event ignored (currentTime is far from duration)')
        return
      }

      isBufferingRef.current = false
      dispatch({ type: 'SET_BUFFERING', payload: false })
      // Snap currentTime to duration so the UI shows exactly 100%
      const finalDuration = stateRef.current.duration
      if (finalDuration > 0) {
        lastTimeDispatchRef.current = finalDuration
        dispatch({ type: 'SET_CURRENT_TIME', payload: finalDuration })
      }
      const currentState = stateRef.current
      if (currentState.repeat === 'one') {
        audio.currentTime = 0
        audio.play()
        return
      }
      if (currentState.queue.length > 0) {
        if (currentState.currentSong) {
          dispatch({ type: 'PUSH_HISTORY', payload: currentState.currentSong })
        }
        if (currentState.shuffle) {
          const randomIndex = Math.floor(Math.random() * currentState.queue.length)
          const nextSong = currentState.queue[randomIndex]
          const newQueue = currentState.queue.filter((_, i) => i !== randomIndex)
          dispatch({ type: 'SET_QUEUE', payload: newQueue })
          dispatch({ type: 'SET_SONG', payload: nextSong })
        } else {
          dispatch({ type: 'DEQUEUE' })
        }
      } else if (currentState.repeat === 'all' && allSongsRef.current.length > 0) {
        const currentIndex = allSongsRef.current.findIndex(
          (s) => s.id === currentState.currentSong?.id
        )
        const nextIndex = (currentIndex + 1) % allSongsRef.current.length
        if (currentState.currentSong) {
          dispatch({ type: 'PUSH_HISTORY', payload: currentState.currentSong })
        }
        dispatch({ type: 'SET_SONG', payload: allSongsRef.current[nextIndex] })
      } else {
        dispatch({ type: 'SET_PLAYING', payload: false })
      }
    }
    const onPlay = () => {
      isChangingSrcRef.current = false
      if (!stateRef.current.isPlaying) {
        dispatch({ type: 'SET_PLAYING', payload: true })
      }
    }
    const onPause = () => {
      if (isChangingSrcRef.current || isSeekingAudioRef.current) return
      isBufferingRef.current = false
      dispatch({ type: 'SET_BUFFERING', payload: false })
      if (stateRef.current.isPlaying) {
        dispatch({ type: 'SET_PLAYING', payload: false })
      }
    }
    const onError = (e) => {
      console.warn('Audio element error:', e)
      isChangingSrcRef.current = false
      isBufferingRef.current = false
      dispatch({ type: 'SET_BUFFERING', payload: false })
      dispatch({ type: 'SET_PLAYING', payload: false })
      if (stateRef.current.currentSong?.title) {
        dispatch({ type: 'SHOW_TOAST', payload: `Unable to stream "${stateRef.current.currentSong.title}" (storage server offline or reconnecting)` })
      }
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('canplay', onCanPlay)
    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('stalled', onStalled)
    audio.addEventListener('loadstart', onLoadStart)
    audio.addEventListener('seeking', onSeeking)
    audio.addEventListener('seeked', onSeeked)
    audio.addEventListener('playing', onPlaying)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('error', onError)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('canplay', onCanPlay)
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('stalled', onStalled)
      audio.removeEventListener('loadstart', onLoadStart)
      audio.removeEventListener('seeking', onSeeking)
      audio.removeEventListener('seeked', onSeeked)
      audio.removeEventListener('playing', onPlaying)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('error', onError)
    }
  }, [])

  // Media Session API (OS lock-screen controls)
  useEffect(() => {
    if (!('mediaSession' in navigator) || !state.currentSong) return

    navigator.mediaSession.metadata = new MediaMetadata({
      title: state.currentSong.title || 'Unknown',
      artist: state.currentSong.artist || 'Unknown Artist',
      album: state.currentSong.album || 'SlopiFY',
      artwork: state.currentSong.coverUrl
        ? [{ src: getCoverArtUrl(state.currentSong.coverUrl), sizes: '256x256', type: 'image/jpeg' }]
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
        if (e.repeat) return
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
    isBufferingRef.current = true
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
    isBufferingRef.current = true
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
      isSeekingAudioRef.current = true
      isBufferingRef.current = true
      dispatch({ type: 'SET_BUFFERING', payload: true })
      const dur = audio.duration && isFinite(audio.duration) && audio.duration > 1 ? audio.duration - 0.5 : time
      const targetTime = Math.max(0, Math.min(time, dur))
      audio.currentTime = targetTime
      dispatch({ type: 'SET_CURRENT_TIME', payload: targetTime })
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
    const msg = song?.title ? `Added "${song.title}" to queue` : 'Added to queue'
    dispatch({ type: 'SHOW_TOAST', payload: msg })
  }, [])

  const reorderQueue = useCallback((newQueue) => {
    dispatch({ type: 'SET_QUEUE', payload: newQueue })
  }, [])

  const removeFromQueue = useCallback((index) => {
    dispatch({ type: 'REMOVE_FROM_QUEUE', payload: index })
  }, [])

  const clearQueue = useCallback(() => {
    dispatch({ type: 'CLEAR_QUEUE' })
  }, [])

  const toggleQueue = useCallback(() => {
    dispatch({ type: 'TOGGLE_QUEUE' })
  }, [])

  const setQueueOpen = useCallback((isOpen) => {
    dispatch({ type: 'SET_QUEUE_OPEN', payload: isOpen })
  }, [])

  const toggleFullscreen = useCallback(() => {
    dispatch({ type: 'TOGGLE_FULLSCREEN' })
  }, [])

  const setFullscreen = useCallback((isOpen) => {
    dispatch({ type: 'SET_FULLSCREEN', payload: isOpen })
  }, [])

  const showToast = useCallback((msg) => {
    dispatch({ type: 'SHOW_TOAST', payload: msg })
  }, [])

  const hideToast = useCallback(() => {
    dispatch({ type: 'HIDE_TOAST' })
  }, [])

  const updateCurrentSong = useCallback((updates) => {
    dispatch({ type: 'UPDATE_CURRENT_SONG', payload: updates })
  }, [])

  const purgeDeletedSong = useCallback((deletedSongId) => {
    if (!deletedSongId) return
    if (stateRef.current.currentSong?.id === deletedSongId) {
      const audio = audioRef.current || getAudioElement()
      if (audio) {
        try {
          audio.pause()
          audio.removeAttribute('src')
          audio.load()
        } catch (e) {
          // ignore
        }
      }
    }
    dispatch({ type: 'PURGE_DELETED_SONG', payload: deletedSongId })
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
    reorderQueue,
    removeFromQueue,
    clearQueue,
    toggleQueue,
    setQueueOpen,
    toggleFullscreen,
    setFullscreen,
    showToast,
    hideToast,
    updateCurrentSong,
    purgeDeletedSong,
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
    console.warn('usePlayer used outside of PlayerProvider, returning fallback state.')
    return {
      currentSong: null,
      queue: [],
      history: [],
      isPlaying: false,
      isBuffering: false,
      currentTime: 0,
      duration: 0,
      volume: 0.7,
      muted: false,
      shuffle: false,
      repeat: 'off',
      isQueueOpen: false,
      isFullscreen: false,
      toast: null,
      playSong: () => {},
      playAll: () => {},
      togglePlay: () => {},
      playNext: () => {},
      playPrevious: () => {},
      seek: () => {},
      setVolume: () => {},
      toggleMute: () => {},
      toggleShuffle: () => {},
      cycleRepeat: () => {},
      enqueue: () => {},
      reorderQueue: () => {},
      removeFromQueue: () => {},
      clearQueue: () => {},
      toggleQueue: () => {},
      setQueueOpen: () => {},
      toggleFullscreen: () => {},
      setFullscreen: () => {},
      showToast: () => {},
      hideToast: () => {},
      updateCurrentSong: () => {},
      purgeDeletedSong: () => {},
    }
  }
  return context
}
