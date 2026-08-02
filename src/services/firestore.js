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

/**
 * Sync user info to Firestore collection `users/{uid}` on login
 */
export async function syncUser(user) {
  if (!isFirebaseConfigured || !db || !user?.uid) return null

  try {
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
