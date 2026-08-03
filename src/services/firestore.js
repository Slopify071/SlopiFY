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
 * Subscribe to communal songs library in real-time
 */
export function subscribeToLibrary(onNext, onError) {
  if (!isFirebaseConfigured || !db) {
    onNext([])
    return () => {}
  }

  try {
    const q = query(collection(db, 'songs'), orderBy('uploadedAt', 'desc'))
    return onSnapshot(
      q,
      (snapshot) => {
        const songs = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        onNext(songs)
      },
      (err) => {
        console.error('Error listening to songs collection:', err)
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
 * Subscribe to communal playlists in real-time
 */
export function subscribeToPlaylists(onNext, onError) {
  if (!isFirebaseConfigured || !db) {
    onNext([])
    return () => {}
  }

  try {
    const q = query(collection(db, 'playlists'), orderBy('updatedAt', 'desc'))
    return onSnapshot(
      q,
      (snapshot) => {
        const playlists = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        onNext(playlists)
      },
      (err) => {
        console.error('Error listening to playlists collection:', err)
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
  if (!isFirebaseConfigured || !db) {
    console.warn('Firebase not configured. Song metadata saved in mock mode.')
    return 'mock_song_' + Date.now()
  }

  try {
    const { addDoc, increment } = await import('firebase/firestore')
    const songsRef = collection(db, 'songs')
    
    const docRef = await addDoc(songsRef, {
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
      uploadedAt: serverTimestamp(),
    })

    // Increment global storage tracking
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

    return docRef.id
  } catch (err) {
    console.error('Error writing song to Firestore:', err)
    throw err
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

    return { success: true }
  } catch (err) {
    console.error('Error deleting song from Firestore:', err)
    throw err
  }
}


