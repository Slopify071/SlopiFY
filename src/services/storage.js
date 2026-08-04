import { storage } from '../config/firebase'
import {
  ref,
  uploadBytesResumable,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage'

/**
 * Upload an audio file to Firebase Storage with real-time progress.
 * @param {File} file - Audio File object
 * @param {Object} [user] - Current Firebase Auth user object
 * @param {Function} [onProgress] - Progress callback (0-100)
 * @returns {Promise<{ downloadUrl: string, storagePath: string, fileSize: number, contentType: string }>}
 */
export async function uploadAudioFile(file, user, onProgress) {
  const uid = user?.uid || 'guest'
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `songs/${uid}_${Date.now()}_${cleanName}`

  if (!storage) {
    console.warn('Firebase Storage instance unavailable. Falling back to local ObjectURL.')
    if (onProgress) onProgress(100)
    return {
      downloadUrl: URL.createObjectURL(file),
      storagePath,
      fileSize: file.size,
      contentType: file.type || 'audio/mpeg',
      isLocalFallback: true,
    }
  }

  const storageRef = ref(storage, storagePath)
  const uploadTask = uploadBytesResumable(storageRef, file, {
    contentType: file.type || 'audio/mpeg',
  })

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.totalBytes > 0 && onProgress) {
          const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
          onProgress(percent)
        }
      },
      (error) => {
        console.error('Firebase Storage upload error:', error)
        reject(error)
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref)
          resolve({
            downloadUrl,
            storagePath,
            fileSize: file.size,
            contentType: file.type || 'audio/mpeg',
          })
        } catch (urlErr) {
          reject(urlErr)
        }
      }
    )
  })
}

/**
 * Upload cover image (e.g. parsed ID3 artwork) to Firebase Storage
 * @param {Blob|File} imageBlob 
 * @param {Object} [user] 
 * @returns {Promise<string>} Download URL of the cover image
 */
export async function uploadCoverImage(imageBlob, user) {
  if (!storage || !imageBlob) return ''
  try {
    const uid = user?.uid || 'guest'
    const storagePath = `covers/${uid}_${Date.now()}.jpg`
    const storageRef = ref(storage, storagePath)
    await uploadBytes(storageRef, imageBlob, { contentType: imageBlob.type || 'image/jpeg' })
    const downloadUrl = await getDownloadURL(storageRef)
    return downloadUrl
  } catch (err) {
    console.warn('Failed to upload cover art image to Firebase Storage:', err)
    return ''
  }
}

/**
 * Delete an audio file reference from Firebase Storage
 * @param {string} storagePath 
 */
export async function deleteAudioFile(storagePath) {
  if (!storage || !storagePath) return { success: true }
  try {
    const storageRef = ref(storage, storagePath)
    await deleteObject(storageRef)
    return { success: true }
  } catch (err) {
    console.warn('Firebase Storage delete warning (file may not exist):', err)
    return { success: true, warning: err.message }
  }
}

/**
 * Get audio stream URL from song object or string
 * @param {Object|string} song
 */
export function getAudioStreamUrl(song) {
  if (!song) return ''
  if (typeof song === 'string') return song
  return song.audioUrl || song.downloadUrl || ''
}
