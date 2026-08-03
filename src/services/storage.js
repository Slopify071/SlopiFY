const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'o4qz7txk'
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'slopify_preset'

/**
 * Upload an audio file to Cloudinary via direct unsigned browser upload
 * @param {File} file - Audio File object
 * @param {Object} [user] - Current Firebase Auth user object
 * @param {Function} [onProgress] - Optional progress callback percentage (0-100)
 * @returns {Promise<{ downloadUrl: string, storagePath: string, fileSize: number, contentType: string }>}
 */
export async function uploadAudioFile(file, user, onProgress) {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    console.warn('Cloudinary credentials missing. Falling back to local ObjectURL mode.')
    if (onProgress) onProgress(100)
    const mockPath = `songs/local_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const objectUrl = URL.createObjectURL(file)
    return {
      downloadUrl: objectUrl,
      storagePath: mockPath,
      fileSize: file.size,
      contentType: file.type || 'audio/mpeg',
      isLocalFallback: true,
    }
  }

  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', UPLOAD_PRESET)
  formData.append('folder', 'slopify_songs')

  const xhr = new XMLHttpRequest()

  return new Promise((resolve, reject) => {
    xhr.open('POST', url)

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100)
          onProgress(percent)
        }
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText)
          resolve({
            downloadUrl: data.secure_url,
            storagePath: data.public_id,
            fileSize: data.bytes || file.size,
            contentType: data.format ? `audio/${data.format}` : (file.type || 'audio/mpeg'),
          })
        } catch (err) {
          reject(new Error('Invalid response from Cloudinary upload API'))
        }
      } else {
        try {
          const res = JSON.parse(xhr.responseText)
          reject(new Error(res.error?.message || `Cloudinary upload failed with status ${xhr.status}`))
        } catch (e) {
          reject(new Error(`Cloudinary upload failed with status ${xhr.status}`))
        }
      }
    }

    xhr.onerror = () => reject(new Error('Network error during Cloudinary file upload'))
    xhr.send(formData)
  })
}

/**
 * Delete an audio file reference
 * @param {string} storagePath - Cloudinary public_id or storage path
 */
export async function deleteAudioFile(storagePath) {
  // Client-side delete operations are safely handled at the Firestore metadata level
  return { success: true }
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
