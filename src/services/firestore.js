import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'
import { db, auth, isFirebaseConfigured } from '../config/firebase'
import { deleteAudioFile } from './storage'

/**
 * Sync user info to Firestore collection `users/{uid}` on login
 */
export async function syncUser(user) {
  if (!isFirebaseConfigured || !db || !user?.uid) return null

  try {
    const syncWork = async () => {
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
    console.error('Error syncing user to Firestore:', error)
    return null
  }
}

/**
 * Subscribe to communal songs library in real-time directly from Firestore
 */
export function subscribeToLibrary(onNext, onError) {
  if (!isFirebaseConfigured || !db) {
    onNext([])
    return () => {}
  }

  try {
    const songsRef = collection(db, 'songs')
    return onSnapshot(
      songsRef,
      (snapshot) => {
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
        console.error('Error listening to songs collection:', err)
        onNext([])
        if (onError) onError(err)
      }
    )
  } catch (err) {
    console.error('Failed to attach library listener:', err)
    onNext([])
    return () => {}
  }
}

/**
 * Subscribe to global storage metadata (e.g. storage size tracking)
 */
export function subscribeToStorageMeta(onNext, onError) {
  if (!isFirebaseConfigured || !db) {
    onNext({ totalBytesUsed: 0, songCount: 0 })
    return () => {}
  }

  try {
    const metaRef = doc(db, 'storage_meta', 'global')
    return onSnapshot(
      metaRef,
      (docSnap) => {
        if (docSnap.exists()) {
          onNext(docSnap.data())
        } else {
          onNext({ totalBytesUsed: 0, songCount: 0 })
        }
      },
      (err) => {
        console.error('Error listening to storage_meta:', err)
        if (onError) onError(err)
      }
    )
  } catch (err) {
    console.error('Failed to attach storage meta listener:', err)
    onNext({ totalBytesUsed: 0, songCount: 0 })
    return () => {}
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

  const { increment } = await import('firebase/firestore')
  const songsRef = collection(db, 'songs')

  const docRef = await addDoc(songsRef, {
    ...songPayload,
    uploadedAt: serverTimestamp(),
  })

  // Increment global storage tracking
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
    console.warn('Could not update storage_meta metrics:', metaErr)
  }

  return docRef.id
}

/**
 * Delete song document from Firestore and corresponding file from Cloudinary/Storage
 */
export async function deleteSongFromFirestore(songId, storagePathOrSong, fileSize = 0) {
  if (!isFirebaseConfigured || !db || !songId) {
    return { success: true }
  }

  try {
    const { increment } = await import('firebase/firestore')
    
    // 1. Delete audio file from Cloudinary via server-side Worker
    if (storagePathOrSong) {
      // Get Firebase Auth token for Worker authentication
      let authToken = null
      try {
        const currentUser = auth?.currentUser
        if (currentUser) {
          authToken = await currentUser.getIdToken()
        }
      } catch (tokenErr) {
        console.warn('Could not get auth token for Cloudinary delete:', tokenErr)
      }
      await deleteAudioFile(storagePathOrSong, authToken)
    }

    // 2. Delete Firestore song document
    const songRef = doc(db, 'songs', songId)
    await deleteDoc(songRef)

    // 3. Decrement global storage metrics
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
    } catch (metaErr) {
      console.warn('Could not decrement storage_meta metrics:', metaErr)
    }

    return { success: true }
  } catch (err) {
    console.error('Error deleting song from Firestore:', err)
    throw err
  }
}

/**
 * Save active user playback session for cross-device sync
 * Writes to `users/{uid}/session/current`
 */
export async function saveUserSession(uid, sessionData) {
  if (!isFirebaseConfigured || !db || !uid) return

  try {
    const sessionRef = doc(db, 'users', uid, 'session', 'current')
    await setDoc(
      sessionRef,
      {
        ...sessionData,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    )
  } catch (err) {
    console.warn('Could not save user playback session:', err)
  }
}

/**
 * Subscribe to real-time user playback session changes across devices
 */
export function subscribeToUserSession(uid, onNext, onError) {
  if (!isFirebaseConfigured || !db || !uid) {
    return () => {}
  }

  try {
    const sessionRef = doc(db, 'users', uid, 'session', 'current')
    return onSnapshot(
      sessionRef,
      (docSnap) => {
        if (docSnap.exists()) {
          onNext(docSnap.data())
        }
      },
      (err) => {
        console.error('Error listening to user playback session:', err)
        if (onError) onError(err)
      }
    )
  } catch (err) {
    console.error('Failed to attach user playback session listener:', err)
    return () => {}
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
 * Subscribe to playlists for current user directly from Firestore
 */
export function subscribeToUserPlaylists(userUid, onNext, onError) {
  if (!isFirebaseConfigured || !db) {
    onNext([])
    return () => {}
  }

  try {
    const playlistsRef = collection(db, 'playlists')
    return onSnapshot(
      playlistsRef,
      (snapshot) => {
        const playlists = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))

        // Filter playlists owned by user, anonymous/unowned, public or collaborative playlists
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
        console.error('Error subscribing to playlists:', err)
        onNext([])
        if (onError) onError(err)
      }
    )
  } catch (err) {
    console.error('Failed to attach playlists listener:', err)
    onNext([])
    return () => {}
  }
}

/**
 * Subscribe to single playlist detail by ID or shareCode directly from Firestore
 */
export function subscribeToPlaylistDetail(idOrShareCode, onNext, onError) {
  if (!isFirebaseConfigured || !db || !idOrShareCode) {
    onNext(null)
    return () => {}
  }

  try {
    const docRef = doc(db, 'playlists', idOrShareCode)

    return onSnapshot(
      docRef,
      async (docSnap) => {
        if (docSnap.exists()) {
          onNext({ id: docSnap.id, ...docSnap.data() })
        } else {
          // If not found by direct ID, search by shareCode
          try {
            const q = query(collection(db, 'playlists'), where('shareCode', '==', idOrShareCode))
            const querySnap = await getDocs(q)
            if (!querySnap.empty) {
              const matchedDoc = querySnap.docs[0]
              onNext({ id: matchedDoc.id, ...matchedDoc.data() })
            } else {
              onNext(null)
            }
          } catch (e) {
            console.error('Error querying playlist by shareCode:', e)
            onNext(null)
          }
        }
      },
      (err) => {
        console.error('Error subscribing to playlist detail:', err)
        if (onError) onError(err)
      }
    )
  } catch (err) {
    console.error('Failed to attach playlist detail listener:', err)
    onNext(null)
    return () => {}
  }
}

/**
 * Create a new playlist directly in Firestore
 */
export async function createPlaylist({ name, description = '', coverUrl = '', ownerUid, ownerName, isCollaborative = false }) {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase is not configured')
  }

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
 * Delete a playlist from Firestore
 */
export async function deletePlaylist(playlistId) {
  if (!isFirebaseConfigured || !db || !playlistId) return

  try {
    const docRef = doc(db, 'playlists', playlistId)
    await deleteDoc(docRef)
  } catch (err) {
    console.error('Error deleting playlist:', err)
    throw err
  }
}

/**
 * Update playlist cover image URL in Firestore
 */
export async function updatePlaylistCover(playlistId, coverUrl) {
  if (!isFirebaseConfigured || !db || !playlistId) return

  try {
    const playlistRef = doc(db, 'playlists', playlistId)
    await updateDoc(playlistRef, {
      coverUrl: coverUrl || '',
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    console.error('Error updating playlist cover:', err)
    throw err
  }
}

/**
 * Add a song to playlist in Firestore
 */
export async function addSongToPlaylist(playlistId, song) {
  if (!isFirebaseConfigured || !db || !playlistId || !song) return

  try {
    const playlistRef = doc(db, 'playlists', playlistId)
    const snap = await getDoc(playlistRef)
    if (!snap.exists()) return

    const data = snap.data()
    const songs = data.songs || []
    
    // Avoid duplicate song addition
    if (songs.some((s) => s.id === song.id)) {
      return
    }

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
    console.error('Error adding song to playlist:', err)
    throw err
  }
}

/**
 * Remove a song from playlist in Firestore
 */
export async function removeSongFromPlaylist(playlistId, songId) {
  if (!isFirebaseConfigured || !db || !playlistId || !songId) return

  try {
    const playlistRef = doc(db, 'playlists', playlistId)
    const snap = await getDoc(playlistRef)
    if (!snap.exists()) return

    const data = snap.data()
    const songs = data.songs || []
    const updatedSongs = songs.filter((s) => s.id !== songId)

    await updateDoc(playlistRef, {
      songs: updatedSongs,
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    console.error('Error removing song from playlist:', err)
    throw err
  }
}

/**
 * Reorder playlist songs in Firestore
 */
export async function reorderPlaylistSongs(playlistId, reorderedSongs) {
  if (!isFirebaseConfigured || !db || !playlistId) return

  try {
    const playlistRef = doc(db, 'playlists', playlistId)
    await updateDoc(playlistRef, {
      songs: reorderedSongs,
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    console.error('Error reordering playlist songs:', err)
    throw err
  }
}

/**
 * Toggle playlist collaborative mode in Firestore
 */
export async function togglePlaylistCollaboration(playlistId, isCollaborative) {
  if (!isFirebaseConfigured || !db || !playlistId) return

  try {
    const playlistRef = doc(db, 'playlists', playlistId)
    await updateDoc(playlistRef, {
      isCollaborative: Boolean(isCollaborative),
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    console.error('Error toggling playlist collaboration:', err)
    throw err
  }
}
