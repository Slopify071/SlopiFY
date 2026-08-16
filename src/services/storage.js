// Storage Service for SlopiFY
// Supports Self-Hosted MinIO S3 Storage (1TB Laptop Backend) with Cloudflare Tunnel,
// with Cloudinary and ObjectURL fallback modes.

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || ''
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || ''
const DEFAULT_ENDPOINT = import.meta.env.VITE_STORAGE_ENDPOINT || 'http://192.168.1.10:9000'

// Active MinIO Storage Endpoint (updated dynamically from Firestore storage_meta)
let activeStorageEndpoint = (typeof localStorage !== 'undefined' && localStorage.getItem('slopify_storage_endpoint')) || DEFAULT_ENDPOINT

/**
 * Update the active storage endpoint URL dynamically (e.g. from Firestore tunnel sync)
 * @param {string} endpointUrl 
 */
export function setStorageEndpoint(endpointUrl) {
  if (!endpointUrl) return
  const cleanUrl = endpointUrl.trim().replace(/\/+$/, '')
  if (cleanUrl && cleanUrl !== activeStorageEndpoint) {
    console.log('[Storage] Active storage endpoint updated:', cleanUrl)
    activeStorageEndpoint = cleanUrl
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('slopify_storage_endpoint', cleanUrl)
      }
    } catch (e) {
      // ignore storage quota / private mode
    }
  }
}

/**
 * Get current active storage endpoint URL
 * @returns {string}
 */
export function getStorageEndpoint() {
  return activeStorageEndpoint || DEFAULT_ENDPOINT
}

function sanitizeFilename(filename) {
  return (filename || 'audio.mp3')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .replace(/_+/g, '_')
}

/**
 * Upload an audio file directly to MinIO (or Cloudinary / local fallback)
 * @param {File} file - Audio File object
 * @param {Object} [user] - Current Firebase Auth user object
 * @param {Function} [onProgress] - Progress callback percentage (0-100)
 * @returns {Promise<{ downloadUrl: string, storagePath: string, fileSize: number, contentType: string }>}
 */
export async function uploadAudioFile(file, user, onProgress) {
  const endpoint = getStorageEndpoint()
  const timestamp = Date.now()
  const safeName = sanitizeFilename(file.name)
  const storagePath = `songs/${timestamp}_${safeName}`

  // 1. Direct upload to MinIO S3 bucket (via active Cloudflare Tunnel or local IP)
  if (endpoint) {
    const uploadUrl = `${endpoint}/slopify-audio/${storagePath}`
    const xhr = new XMLHttpRequest()

    return new Promise((resolve, reject) => {
      xhr.open('PUT', uploadUrl)
      xhr.setRequestHeader('Content-Type', file.type || 'audio/mpeg')

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
          if (onProgress) onProgress(100)
          resolve({
            downloadUrl: uploadUrl,
            storagePath: storagePath,
            fileSize: file.size,
            contentType: file.type || 'audio/mpeg',
          })
        } else {
          console.warn(`MinIO upload returned status ${xhr.status}. Attempting Cloudinary/local fallback.`)
          uploadToCloudinaryOrLocal(file, storagePath, onProgress).then(resolve).catch(reject)
        }
      }

      xhr.onerror = () => {
        console.warn('Network error uploading to MinIO. Attempting Cloudinary/local fallback.')
        uploadToCloudinaryOrLocal(file, storagePath, onProgress).then(resolve).catch(reject)
      }

      xhr.send(file)
    })
  }

  return uploadToCloudinaryOrLocal(file, storagePath, onProgress)
}

/**
 * Fallback uploader for Cloudinary or browser ObjectURL
 */
async function uploadToCloudinaryOrLocal(file, defaultPath, onProgress) {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    console.warn('Falling back to local ObjectURL mode.')
    if (onProgress) onProgress(100)
    const objectUrl = URL.createObjectURL(file)
    return {
      downloadUrl: objectUrl,
      storagePath: defaultPath,
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
          onProgress(Math.round((event.loaded / event.total) * 100))
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
          reject(new Error('Invalid response from Cloudinary'))
        }
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`))
      }
    }

    xhr.onerror = () => reject(new Error('Network error during file upload'))
    xhr.send(formData)
  })
}

/**
 * Upload cover image to MinIO or Cloudinary
 * @param {Blob|File} imageBlob
 * @param {Object} [user]
 * @returns {Promise<string>} Download URL of the cover image
 */
export async function uploadCoverImage(imageBlob, user) {
  if (!imageBlob) return ''

  const endpoint = getStorageEndpoint()
  if (endpoint) {
    const timestamp = Date.now()
    const coverPath = `covers/cover_${timestamp}.jpg`
    const uploadUrl = `${endpoint}/slopify-audio/${coverPath}`

    try {
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': imageBlob.type || 'image/jpeg' },
        body: imageBlob,
      })
      if (res.ok) {
        return uploadUrl
      }
    } catch (e) {
      console.warn('MinIO cover upload failed, trying Cloudinary:', e)
    }
  }

  if (CLOUD_NAME && UPLOAD_PRESET) {
    try {
      const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`
      const formData = new FormData()
      formData.append('file', imageBlob)
      formData.append('upload_preset', UPLOAD_PRESET)
      formData.append('folder', 'slopify_covers')

      const response = await fetch(url, { method: 'POST', body: formData })
      if (response.ok) {
        const data = await response.json()
        return data.secure_url || ''
      }
    } catch (err) {
      console.warn('Failed to upload cover art to Cloudinary:', err)
    }
  }

  return ''
}

/**
 * Delete a cover image asset from MinIO
 * @param {string} coverUrlOrPath - Full cover URL or relative path
 */
export async function deleteCoverImage(coverUrlOrPath) {
  if (!coverUrlOrPath || typeof coverUrlOrPath !== 'string') return { success: true }
  if (coverUrlOrPath.startsWith('blob:') || coverUrlOrPath.startsWith('data:')) {
    return { success: true }
  }

  const endpoint = getStorageEndpoint()
  let coverPath = coverUrlOrPath

  // If it's a full URL containing /slopify-audio/
  if (coverPath.includes('/slopify-audio/')) {
    const parts = coverPath.split('/slopify-audio/')
    coverPath = parts[1] || ''
  }

  // Remove leading slashes and query params
  coverPath = coverPath.replace(/^\/+/, '').split('?')[0]

  if (endpoint && coverPath.startsWith('covers/')) {
    try {
      await fetch(`${endpoint}/slopify-audio/${coverPath}`, {
        method: 'DELETE',
      })
      console.log(`[Storage] Deleted cover art: ${coverPath}`)
      return { success: true }
    } catch (e) {
      console.warn('MinIO cover delete failed:', e)
    }
  }

  return { success: true }
}

/**
 * Delete audio file asset (and associated cover art if song object is provided)
 * @param {string|Object} target - Storage path string OR song object with storagePath and optional coverUrl
 * @param {string} [authToken] - Optional Firebase Auth ID token
 */
export async function deleteAudioFile(target, authToken) {
  if (!target) return { success: true }

  const storagePath = typeof target === 'string' ? target : (target.storagePath || target.r2Key || '')
  const coverUrl = typeof target === 'object' ? (target.coverUrl || target.coverPath || '') : ''

  // 1. Delete audio file from MinIO
  const endpoint = getStorageEndpoint()
  if (endpoint && storagePath) {
    let cleanPath = storagePath
    if (cleanPath.includes('/slopify-audio/')) {
      const parts = cleanPath.split('/slopify-audio/')
      cleanPath = parts[1] || ''
    }
    cleanPath = cleanPath.replace(/^\/+/, '').split('?')[0]

    if (cleanPath.startsWith('songs/')) {
      try {
        await fetch(`${endpoint}/slopify-audio/${cleanPath}`, {
          method: 'DELETE',
        })
        console.log(`[Storage] Deleted audio track: ${cleanPath}`)
      } catch (e) {
        console.warn('MinIO audio delete failed:', e)
      }
    }
  }

  // 2. Delete cover art if associated with song
  if (coverUrl) {
    await deleteCoverImage(coverUrl)
  }

  return { success: true }
}

/**
 * Get dynamic audio stream URL from song object or string.
 * Automatically resolves relative storage paths and legacy tunnel URLs against the active endpoint.
 * @param {Object|string} song
 * @returns {string}
 */
export function getAudioStreamUrl(song) {
  if (!song) return ''
  if (typeof song === 'string') {
    if (song.startsWith('blob:') || song.startsWith('data:')) return song
    const endpoint = getStorageEndpoint()
    if (endpoint && song.includes('/slopify-audio/')) {
      return song.replace(/^https?:\/\/[^/]+\/slopify-audio\//, `${endpoint}/slopify-audio/`)
    }
    return song
  }

  const endpoint = getStorageEndpoint()

  // 1. If song has a relative storagePath (e.g. "songs/1234_abc.mp3")
  if (song.storagePath) {
    if (song.storagePath.startsWith('http://') || song.storagePath.startsWith('https://') || song.storagePath.startsWith('blob:')) {
      return song.storagePath
    }
    const cleanPath = song.storagePath.replace(/^\/+/, '')
    if (endpoint) {
      return `${endpoint}/slopify-audio/${cleanPath}`
    }
  }

  // 2. Dynamic rewrite for stored audioUrl if it points to a MinIO/tunnel bucket
  const url = song.audioUrl || song.downloadUrl || ''
  if (url && endpoint && url.includes('/slopify-audio/')) {
    return url.replace(/^https?:\/\/[^/]+\/slopify-audio\//, `${endpoint}/slopify-audio/`)
  }

  return url
}


