import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../config/firebase'
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
 * Local Storage Fallback Store for Offline / Timeout scenarios
 */
export function getLocalFallbackSongs() {
  try {
    const raw = localStorage.getItem('slopify_local_songs')
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    return []
  }
}

export function saveLocalFallbackSong(song) {
  try {
    const existing = getLocalFallbackSongs()
    const updated = [song, ...existing]
    localStorage.setItem('slopify_local_songs', JSON.stringify(updated))
  } catch (e) {
    console.warn('Could not save fallback song to localStorage:', e)
  }
}

/**
 * Subscribe to communal songs library in real-time
 */
export function subscribeToLibrary(onNext, onError) {
  const emitMerged = (remoteSongs = []) => {
    const localSongs = getLocalFallbackSongs()
    const remoteUrls = new Set(remoteSongs.map((s) => s.audioUrl || s.id))
    const uniqueLocal = localSongs.filter((s) => !remoteUrls.has(s.audioUrl || s.id))
    onNext([...uniqueLocal, ...remoteSongs])
  }

  if (!isFirebaseConfigured || !db) {
    emitMerged([])
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
        emitMerged(sortedSongs)
      },
      (err) => {
        console.error('Error listening to songs collection:', err)
        emitMerged([])
        if (onError) onError(err)
      }
    )
  } catch (err) {
    console.error('Failed to attach library listener:', err)
    emitMerged([])
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
 * Save new uploaded song metadata to Firestore `songs` collection
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
    fileSize: songData.fileSize || 0,
    uploaderUid: songData.uploaderUid || 'anonymous',
    uploaderName: songData.uploaderName || 'Friend',
  }

  if (!isFirebaseConfigured || !db) {
    console.warn('Firebase not configured. Song metadata saved to local storage fallback.')
    const localId = 'local_song_' + Date.now()
    saveLocalFallbackSong({ id: localId, ...songPayload, uploadedAt: new Date().toISOString() })
    return localId
  }

  try {
    const { addDoc, increment } = await import('firebase/firestore')
    const songsRef = collection(db, 'songs')

    const docRef = await addDoc(songsRef, {
      ...songPayload,
      uploadedAt: serverTimestamp(),
    })

    // Safely increment global storage tracking without blocking song creation
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
  } catch (err) {
    console.warn('Firestore write failed. Falling back to local storage:', err)
    const localId = 'local_song_' + Date.now()
    saveLocalFallbackSong({ id: localId, ...songPayload, uploadedAt: new Date().toISOString() })
    return localId
  }
}

/**
 * Delete song document from Firestore and corresponding file from Firebase Storage
 */
export async function deleteSongFromFirestore(songId, storagePath, fileSize = 0) {
  if (!isFirebaseConfigured || !db || !songId) {
    return { success: true }
  }

  try {
    const { deleteDoc, increment } = await import('firebase/firestore')
    
    // 1. Delete audio file from Firebase Storage if storagePath exists
    if (storagePath) {
      await deleteAudioFile(storagePath)
    }

    // 2. Delete Firestore song document
    const songRef = doc(db, 'songs', songId)
    await deleteDoc(songRef)

    // 3. Decrement global storage metrics
    try {
      const metaRef = doc(db, 'storage_meta', 'global')
      await setDoc(
        metaRef,
        {
          totalBytesUsed: increment(-Math.abs(fileSize || 0)),
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



