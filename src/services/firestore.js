// NOTE: firebase/firestore is intentionally NOT statically imported here.
// A static import would pull the entire Firestore SDK (~140 KiB) into the
// initial JavaScript bundle and block first paint on every page — even the
// login page — where none of it is needed yet.
// Instead, every function below uses `await import('firebase/firestore')` which
// Vite code-splits into a separate chunk loaded only when first used.
import { db, auth, isFirebaseConfigured, initFirebase } from '../config/firebase'
import { deleteAudioFile, deleteCoverImage, setStorageEndpoint } from './storage'

// Lazily resolved module reference — cached after first dynamic import so
// subsequent calls are synchronous (the promise resolves from module cache).
let _fsModule = null
async function fs() {
  if (!_fsModule) _fsModule = import('firebase/firestore')
  return _fsModule
}

/**
 * Sync user info to Firestore collection `users/{uid}` on login
 */
export async function syncUser(user) {
  if (!isFirebaseConfigured || !db || !user?.uid) return null

  try {
    const syncWork = async () => {
      const { doc, getDoc, setDoc, serverTimestamp } = await fs()
      const userRef = doc(db, 'users', user.uid)
      const userDoc = await getDoc(userRef)

      const payload = {
        uid: user.uid,
        displayName: user.displayName || user.email?.split('@')[0] || 'Friend',
        email: user.email || null,
        photoURL: user.photoURL || null,
        lastSeen: serverTimestamp(),
      }

      if (!userDoc.exists()) {
        payload.createdAt = serverTimestamp()
        payload.role = 'user'
      }

      await setDoc(userRef, payload, { merge: true })
      return payload
    }

    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 2500))
    return await Promise.race([syncWork(), timeout])
  } catch (error) {
    return null
  }
}

/**
 * Subscribe to communal songs library in real-time directly from Firestore.
 */
export function subscribeToLibrary(onNext, onError) {
  if (!isFirebaseConfigured) {
    onNext([])
    return () => {}
  }

  let cancelled = false
  let unsubSnapshot = null

  initFirebase().then(async (fb) => {
    if (cancelled) return
    const { collection, onSnapshot } = await fs()
    const fireDb = fb?.db || db
    if (!fireDb) {
      onNext([])
      return
    }

    try {
      const songsRef = collection(fireDb, 'songs')
      unsubSnapshot = onSnapshot(
        songsRef,
        (snapshot) => {
          if (cancelled) return
          const songs = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }))

          const parseTime = (val) => {
            if (!val) return 0
            if (typeof val.toMillis === 'function') return val.toMillis()
            if (typeof val === 'number') return val
            if (val.seconds) return val.seconds * 1000
            const d = new Date(val)
            return isNaN(d.getTime()) ? 0 : d.getTime()
          }

          const sortedSongs = [...songs].sort(
            (a, b) => parseTime(b.uploadedAt) - parseTime(a.uploadedAt)
          )
          onNext(sortedSongs)
        },
        (err) => {
          onNext([])
          if (onError) onError(err)
        }
      )
    } catch (err) {
      onNext([])
    }
  }).catch(() => {
    if (!cancelled) onNext([])
  })

  return () => {
    cancelled = true
    if (unsubSnapshot) unsubSnapshot()
  }
}

/**
 * Subscribe to global storage metadata (e.g. storage size tracking)
 */
export function subscribeToStorageMeta(onNext, onError) {
  if (!isFirebaseConfigured) {
    onNext({ totalBytesUsed: 0, songCount: 0 })
    return () => {}
  }

  let cancelled = false
  let unsubSnapshot = null

  initFirebase().then(async (fb) => {
    if (cancelled) return
    const { doc, onSnapshot } = await fs()
    const fireDb = fb?.db || db
    if (!fireDb) {
      onNext({ totalBytesUsed: 0, songCount: 0 })
      return
    }

    try {
      const metaRef = doc(fireDb, 'storage_meta', 'global')
      unsubSnapshot = onSnapshot(
        metaRef,
        (docSnap) => {
          if (cancelled) return
          if (docSnap.exists()) {
            const data = docSnap.data()
            if (data.endpointUrl) {
              setStorageEndpoint(data.endpointUrl)
            }
            onNext(data)
          } else {
            onNext({ totalBytesUsed: 0, songCount: 0 })
          }
        },
        (err) => {
          if (onError) onError(err)
        }
      )
    } catch (err) {
      onNext({ totalBytesUsed: 0, songCount: 0 })
    }
  }).catch(() => {
    if (!cancelled) onNext({ totalBytesUsed: 0, songCount: 0 })
  })

  return () => {
    cancelled = true
    if (unsubSnapshot) unsubSnapshot()
  }
}

/**
 * Update the storage endpoint URL in Firestore
 */
export async function updateStorageEndpoint(endpointUrl, online = true) {
  if (!isFirebaseConfigured || !db) return false
  try {
    const { doc, setDoc, serverTimestamp } = await fs()
    const metaRef = doc(db, 'storage_meta', 'global')
    await setDoc(
      metaRef,
      {
        endpointUrl: (endpointUrl || '').trim().replace(/\/+$/, ''),
        online: Boolean(online),
        lastUpdated: serverTimestamp(),
      },
      { merge: true }
    )
    if (endpointUrl) {
      setStorageEndpoint(endpointUrl)
    }
    return true
  } catch (err) {
    console.error('Failed to update storage endpoint:', err)
    return false
  }
}

/**
 * Save new uploaded song metadata directly to Firestore `songs` collection
 * and atomically increment global storage metrics.
 */
export async function addSongToFirestore(songData) {
  const songPayload = {
    title: songData.title || 'Untitled',
    artist: songData.artist || 'Unknown Artist',
    album: songData.album || '',
    duration: songData.duration || 0,
    storagePath: songData.storagePath || songData.r2Key || '',
    r2Key: songData.storagePath || songData.r2Key || '',
    audioUrl: songData.audioUrl || songData.downloadUrl || '',
    coverUrl: songData.coverUrl || '',
    lyrics: songData.lyrics || '',
    fileSize: songData.fileSize || 0,
    uploaderUid: songData.uploaderUid || 'anonymous',
    uploaderName: songData.uploaderName || 'Friend',
  }

  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase is not configured')
  }

  const { collection, addDoc, doc, setDoc, serverTimestamp, increment } = await fs()
  const songsRef = collection(db, 'songs')

  const docRef = await addDoc(songsRef, {
    ...songPayload,
    uploadedAt: serverTimestamp(),
  })

  try {
    const metaRef = doc(db, 'storage_meta', 'global')
    await setDoc(
      metaRef,
      {
        totalBytesUsed: increment(songData.fileSize || 0),
        songCount: increment(1),
        lastUpdated: serverTimestamp(),
      },
      { merge: true }
    )
  } catch (metaErr) {
    // non-critical
  }

  return docRef.id
}

/**
 * Check if a song already exists in Firestore by title and artist
 */
export async function checkSongExists(title, artist) {
  if (!isFirebaseConfigured || !db) return false
  
  const { collection, query, where, getDocs } = await fs()
  try {
    const q = query(
      collection(db, 'songs'), 
      where('title', '==', title || 'Untitled'),
      where('artist', '==', artist || 'Unknown Artist')
    )
    const querySnapshot = await getDocs(q)
    return !querySnapshot.empty
  } catch (err) {
    console.warn('Error checking for duplicate song:', err)
    return false
  }
}

/**
 * Delete song document from Firestore and corresponding file from Cloudinary/Storage
 */
export async function deleteSongFromFirestore(songId, storagePathOrSong, fileSize = 0) {
  if (!isFirebaseConfigured || !db || !songId) {
    return { success: true }
  }

  try {
    const { doc, deleteDoc, setDoc, serverTimestamp, increment, collection, getDocs, updateDoc } = await fs()

    if (storagePathOrSong) {
      let authToken = null
      try {
        const currentUser = auth?.currentUser
        if (currentUser) {
          authToken = await currentUser.getIdToken()
        }
      } catch { /* ignore */ }
      await deleteAudioFile(storagePathOrSong, authToken)
    }

    const songRef = doc(db, 'songs', songId)
    await deleteDoc(songRef)

    // Remove deleted song from all playlists in Firestore
    try {
      const playlistsSnap = await getDocs(collection(db, 'playlists'))
      for (const pDoc of playlistsSnap.docs) {
        const pData = pDoc.data()
        if (Array.isArray(pData.songs) && pData.songs.some((s) => s.id === songId)) {
          const cleaned = pData.songs.filter((s) => s.id !== songId)
          await updateDoc(pDoc.ref, {
            songs: cleaned,
            updatedAt: serverTimestamp(),
          })
        }
      }
    } catch (e) {
      console.warn('Playlist song cleanup warning:', e)
    }

    const effectiveFileSize = typeof storagePathOrSong === 'object' ? (storagePathOrSong.fileSize || fileSize) : fileSize
    try {
      const metaRef = doc(db, 'storage_meta', 'global')
      await setDoc(
        metaRef,
        {
          totalBytesUsed: increment(-Math.abs(effectiveFileSize || 0)),
          songCount: increment(-1),
          lastUpdated: serverTimestamp(),
        },
        { merge: true }
      )
    } catch { /* non-critical */ }

    return { success: true }
  } catch (err) {
    throw err
  }
}

/**
 * Update an existing song in Firestore
 */
export async function updateSongInFirestore(songId, updates) {
  if (!isFirebaseConfigured || !db || !songId) return
  const { doc, updateDoc } = await fs()
  try {
    const songRef = doc(db, 'songs', songId)
    await updateDoc(songRef, updates)
  } catch (err) {
    throw err
  }
}

/**
 * Save active user playback session for cross-device sync
 */
export async function saveUserSession(uid, sessionData) {
  if (!isFirebaseConfigured || !db || !uid) return
  const { doc, setDoc, serverTimestamp } = await fs()
  try {
    const sessionRef = doc(db, 'users', uid, 'session', 'current')
    await setDoc(sessionRef, { ...sessionData, updatedAt: serverTimestamp() }, { merge: true })
  } catch { /* non-critical */ }
}

/**
 * Subscribe to real-time user playback session changes across devices
 */
export function subscribeToUserSession(uid, onNext, onError) {
  if (!isFirebaseConfigured || !uid) {
    return () => {}
  }

  let cancelled = false
  let unsubSnapshot = null

  initFirebase().then(async (fb) => {
    if (cancelled) return
    const { doc, onSnapshot } = await fs()
    const fireDb = fb?.db || db
    if (!fireDb) return

    try {
      const sessionRef = doc(fireDb, 'users', uid, 'session', 'current')
      unsubSnapshot = onSnapshot(
        sessionRef,
        (docSnap) => {
          if (cancelled) return
          if (docSnap.exists()) {
            onNext(docSnap.data())
          }
        },
        (err) => {
          if (onError) onError(err)
        }
      )
    } catch { /* ignore */ }
  }).catch(() => {})

  return () => {
    cancelled = true
    if (unsubSnapshot) unsubSnapshot()
  }
}

/**
 * Generate unique 8-character share code
 */
function generateShareCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Search songs by title or artist in Firestore
 */
export async function searchSongs(searchTerm) {
  if (!isFirebaseConfigured || !db || !searchTerm) return []
  const { collection, getDocs } = await fs()

  const term = searchTerm.toLowerCase().trim()
  const snapshot = await getDocs(collection(db, 'songs'))
  const result = []

  snapshot.forEach((doc) => {
    const data = doc.data()
    const titleMatch = data.title && data.title.toLowerCase().includes(term)
    const artistMatch = data.artist && data.artist.toLowerCase().includes(term)
    const albumMatch = data.album && data.album.toLowerCase().includes(term)

    if (titleMatch || artistMatch || albumMatch) {
      result.push({ id: doc.id, ...data })
    }
  })

  return result
}

/**
 * Subscribe to playlists for current user directly from Firestore
 */
export function subscribeToUserPlaylists(userUid, onNext, onError) {
  if (!isFirebaseConfigured) {
    onNext([])
    return () => {}
  }

  let cancelled = false
  let unsubSnapshot = null

  initFirebase().then(async (fb) => {
    if (cancelled) return
    const { collection, onSnapshot, getDocs, doc, updateDoc, serverTimestamp } = await fs()
    const fireDb = fb?.db || db
    if (!fireDb) {
      onNext([])
      return
    }

    try {
      const playlistsRef = collection(fireDb, 'playlists')
      unsubSnapshot = onSnapshot(
        playlistsRef,
        async (snapshot) => {
          if (cancelled) return

          // Fetch active song IDs to filter & auto-heal ghost songs in playlists
          let validSongIds = null
          try {
            const songsSnap = await getDocs(collection(fireDb, 'songs'))
            validSongIds = new Set(songsSnap.docs.map((d) => d.id))
          } catch (e) {
            // ignore
          }

          const playlists = snapshot.docs.map((docSnap) => {
            const data = docSnap.data()
            let songsList = Array.isArray(data.songs) ? data.songs : []

            // Auto-heal if ghost songs are found in the playlist
            if (validSongIds && songsList.length > 0) {
              const cleaned = songsList.filter((s) => validSongIds.has(s.id))
              if (cleaned.length !== songsList.length) {
                songsList = cleaned
                updateDoc(doc(fireDb, 'playlists', docSnap.id), {
                  songs: cleaned,
                  updatedAt: serverTimestamp(),
                }).catch(() => {})
              }
            }

            return {
              id: docSnap.id,
              ...data,
              songs: songsList,
            }
          })

          const userPlaylists = playlists.filter(
            (p) =>
              !userUid ||
              p.ownerUid === userUid ||
              p.ownerUid === 'anonymous' ||
              !p.ownerUid ||
              p.isCollaborative ||
              p.isPublic !== false ||
              p.collaborators?.includes(userUid)
          )

          userPlaylists.sort((a, b) => {
            const tA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0
            const tB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0
            return tB - tA
          })

          onNext(userPlaylists)
        },
        (err) => {
          onNext([])
          if (onError) onError(err)
        }
      )
    } catch {
      onNext([])
    }
  }).catch(() => {
    if (!cancelled) onNext([])
  })

  return () => {
    cancelled = true
    if (unsubSnapshot) unsubSnapshot()
  }
}

/**
 * Subscribe to single playlist detail by ID or shareCode directly from Firestore
 */
export function subscribeToPlaylistDetail(idOrShareCode, onNext, onError) {
  if (!isFirebaseConfigured || !idOrShareCode) {
    onNext(null)
    return () => {}
  }

  let cancelled = false
  let unsubSnapshot = null

  initFirebase().then(async (fb) => {
    if (cancelled) return
    const { doc, onSnapshot, collection, query, where, getDocs, updateDoc, serverTimestamp } = await fs()
    const fireDb = fb?.db || db
    if (!fireDb) {
      onNext(null)
      return
    }

    try {
      const docRefLocal = doc(fireDb, 'playlists', idOrShareCode)

      const sanitizePlaylistData = async (playlistId, rawData) => {
        if (!rawData) return null
        let songsList = Array.isArray(rawData.songs) ? rawData.songs : []
        if (songsList.length > 0) {
          try {
            const songsSnap = await getDocs(collection(fireDb, 'songs'))
            const validSongIds = new Set(songsSnap.docs.map((d) => d.id))
            const cleaned = songsList.filter((s) => validSongIds.has(s.id))
            if (cleaned.length !== songsList.length) {
              songsList = cleaned
              updateDoc(doc(fireDb, 'playlists', playlistId), {
                songs: cleaned,
                updatedAt: serverTimestamp(),
              }).catch(() => {})
            }
          } catch (e) {
            // ignore
          }
        }
        return { id: playlistId, ...rawData, songs: songsList }
      }

      unsubSnapshot = onSnapshot(
        docRefLocal,
        async (docSnap) => {
          if (cancelled) return
          if (docSnap.exists()) {
            const sanitized = await sanitizePlaylistData(docSnap.id, docSnap.data())
            onNext(sanitized)
          } else {
            try {
              const q = query(collection(fireDb, 'playlists'), where('shareCode', '==', idOrShareCode))
              const querySnap = await getDocs(q)
              if (!querySnap.empty) {
                const matchedDoc = querySnap.docs[0]
                const sanitized = await sanitizePlaylistData(matchedDoc.id, matchedDoc.data())
                onNext(sanitized)
              } else {
                onNext(null)
              }
            } catch {
              onNext(null)
            }
          }
        },
        (err) => {
          if (onError) onError(err)
        }
      )
    } catch {
      onNext(null)
    }
  }).catch(() => {
    if (!cancelled) onNext(null)
  })

  return () => {
    cancelled = true
    if (unsubSnapshot) unsubSnapshot()
  }
}

/**
 * Create a new playlist directly in Firestore
 */
export async function createPlaylist({ name, description = '', coverUrl = '', ownerUid, ownerName, isCollaborative = false }) {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase is not configured')
  }

  const { collection, addDoc, serverTimestamp } = await fs()
  const shareCode = generateShareCode()
  const payload = {
    name: name.trim() || 'Untitled Playlist',
    description: description.trim(),
    coverUrl: coverUrl.trim(),
    ownerUid: ownerUid || 'anonymous',
    ownerName: ownerName || 'Friend',
    isCollaborative: Boolean(isCollaborative),
    shareCode,
    songs: [],
    collaborators: ownerUid ? [ownerUid] : [],
    createdAt: serverTimestamp(),
  }

  const docRef = await addDoc(collection(db, 'playlists'), payload)
  return docRef.id
}

/**
 * Delete a playlist from Firestore and clean up cover image if hosted on MinIO
 */
export async function deletePlaylist(playlistId, playlistOrCoverUrl) {
  if (!isFirebaseConfigured || !db || !playlistId) return
  const { doc, deleteDoc } = await fs()
  try {
    const coverUrl = typeof playlistOrCoverUrl === 'object' ? playlistOrCoverUrl?.coverUrl : (playlistOrCoverUrl || '')
    if (coverUrl) {
      await deleteCoverImage(coverUrl)
    }
    await deleteDoc(doc(db, 'playlists', playlistId))
  } catch (err) {
    throw err
  }
}

/**
 * Update playlist cover image URL in Firestore
 */
export async function updatePlaylistCover(playlistId, coverUrl) {
  if (!isFirebaseConfigured || !db || !playlistId) return
  const { doc, updateDoc, serverTimestamp } = await fs()
  try {
    await updateDoc(doc(db, 'playlists', playlistId), {
      coverUrl: coverUrl || '',
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    throw err
  }
}

/**
 * Add a song to playlist in Firestore
 */
export async function addSongToPlaylist(playlistId, song) {
  if (!isFirebaseConfigured || !db || !playlistId || !song) return
  const { doc, getDoc, updateDoc, serverTimestamp } = await fs()
  try {
    const playlistRef = doc(db, 'playlists', playlistId)
    const snap = await getDoc(playlistRef)
    if (!snap.exists()) return

    const data = snap.data()
    const songs = data.songs || []
    if (songs.some((s) => s.id === song.id)) return

    const cleanSong = {
      id: song.id,
      title: song.title || 'Untitled',
      artist: song.artist || 'Unknown Artist',
      album: song.album || '',
      duration: song.duration || 0,
      audioUrl: song.audioUrl || '',
      coverUrl: song.coverUrl || '',
      addedAt: new Date().toISOString(),
    }

    await updateDoc(playlistRef, {
      songs: [...songs, cleanSong],
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    throw err
  }
}

/**
 * Remove a song from playlist in Firestore
 */
export async function removeSongFromPlaylist(playlistId, songId) {
  if (!isFirebaseConfigured || !db || !playlistId || !songId) return
  const { doc, getDoc, updateDoc, serverTimestamp } = await fs()
  try {
    const playlistRef = doc(db, 'playlists', playlistId)
    const snap = await getDoc(playlistRef)
    if (!snap.exists()) return

    const data = snap.data()
    await updateDoc(playlistRef, {
      songs: (data.songs || []).filter((s) => s.id !== songId),
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    throw err
  }
}

/**
 * Reorder playlist songs in Firestore
 */
export async function reorderPlaylistSongs(playlistId, reorderedSongs) {
  if (!isFirebaseConfigured || !db || !playlistId) return
  const { doc, updateDoc, serverTimestamp } = await fs()
  try {
    await updateDoc(doc(db, 'playlists', playlistId), {
      songs: reorderedSongs,
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    throw err
  }
}

/**
 * Toggle playlist collaborative mode in Firestore
 */
export async function togglePlaylistCollaboration(playlistId, isCollaborative) {
  if (!isFirebaseConfigured || !db || !playlistId) return
  const { doc, updateDoc, serverTimestamp } = await fs()
  try {
    await updateDoc(doc(db, 'playlists', playlistId), {
      isCollaborative: Boolean(isCollaborative),
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    throw err
  }
}

/**
 * Nuke the entire song library — delete every song's Cloudinary asset
 * and Firestore document, then reset storage_meta/global to zero.
 *
 * Playlists are intentionally left intact (they will simply appear empty).
 *
 * @param {function} [onProgress] - Optional callback invoked as
 *   onProgress({ completed, total, currentTitle, phase })
 * @returns {Promise<{ deletedCount: number, freedBytes: number }>}
 */
export async function nukeLibrary(onProgress) {
  if (!isFirebaseConfigured || !db) {
    return { deletedCount: 0, freedBytes: 0 }
  }

  const { collection, getDocs, doc, deleteDoc, setDoc, serverTimestamp } = await fs()

  // --- Phase 1: Fetch all songs ---
  if (onProgress) onProgress({ completed: 0, total: 0, currentTitle: '', phase: 'fetching' })

  const songsRef = collection(db, 'songs')
  const snapshot = await getDocs(songsRef)
  const songs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
  const total = songs.length

  if (total === 0) {
    return { deletedCount: 0, freedBytes: 0 }
  }

  // Get auth token once for all Cloudinary deletions
  let authToken = null
  try {
    const currentUser = auth?.currentUser
    if (currentUser) {
      authToken = await currentUser.getIdToken()
    }
  } catch { /* ignore */ }

  // --- Phase 2: Delete songs one-by-one ---
  let completed = 0
  let freedBytes = 0

  for (const song of songs) {
    if (onProgress) {
      onProgress({ completed, total, currentTitle: song.title || 'Untitled', phase: 'deleting' })
    }

    // Delete Cloudinary audio asset (best-effort — don't let one failure stop the nuke)
    try {
      await deleteAudioFile(song, authToken)
    } catch (err) {
      console.warn(`nukeLibrary: Failed to delete Cloudinary audio for "${song.title}":`, err)
    }

    // Delete Cloudinary cover image if present
    if (song.coverUrl) {
      try {
        await deleteCoverImage(song.coverUrl)
      } catch (err) {
        console.warn(`nukeLibrary: Failed to delete cover image for "${song.title}":`, err)
      }
    }

    // Delete Firestore document
    try {
      await deleteDoc(doc(db, 'songs', song.id))
    } catch (err) {
      console.warn(`nukeLibrary: Failed to delete Firestore doc "${song.id}":`, err)
    }

    freedBytes += song.fileSize || 0
    completed++
  }

  // --- Phase 3: Reset storage metadata ---
  if (onProgress) {
    onProgress({ completed, total, currentTitle: '', phase: 'cleanup' })
  }

  try {
    const metaRef = doc(db, 'storage_meta', 'global')
    await setDoc(metaRef, {
      totalBytesUsed: 0,
      songCount: 0,
      lastUpdated: serverTimestamp(),
    })
  } catch (err) {
    console.warn('nukeLibrary: Failed to reset storage_meta:', err)
  }

  if (onProgress) {
    onProgress({ completed, total, currentTitle: '', phase: 'done' })
  }

  return { deletedCount: completed, freedBytes }
}
