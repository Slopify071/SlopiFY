const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'o4qz7txk'
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'slopify_preset'
const API_KEY = import.meta.env.VITE_CLOUDINARY_API_KEY || '962243497828134'
const API_SECRET = import.meta.env.VITE_CLOUDINARY_API_SECRET || 'pRe6feqGtLidjfFy05GLjt5gQxo'
const WORKER_URL = import.meta.env.VITE_CLOUDFLARE_WORKER_URL || ''

async function sha1Hex(str) {
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hashBuffer = await crypto.subtle.digest('SHA-1', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

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
 * Upload cover image to Cloudinary
 * @param {Blob|File} imageBlob
 * @param {Object} [user]
 * @returns {Promise<string>} Download URL of the cover image
 */
export async function uploadCoverImage(imageBlob, user) {
  if (!CLOUD_NAME || !UPLOAD_PRESET || !imageBlob) return ''

  try {
    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`
    const formData = new FormData()
    formData.append('file', imageBlob)
    formData.append('upload_preset', UPLOAD_PRESET)
    formData.append('folder', 'slopify_covers')

    const response = await fetch(url, { method: 'POST', body: formData })
    if (!response.ok) {
      throw new Error(`Cover upload failed with status ${response.status}`)
    }
    const data = await response.json()
    return data.secure_url || ''
  } catch (err) {
    console.warn('Failed to upload cover art image to Cloudinary:', err)
    return ''
  }
}

/**
 * Delete audio file asset from Cloudinary
 * Tries direct signed API first, and falls back to Cloudflare Worker proxy.
 * @param {string|Object} target - Storage path (public_id) string OR song object with storagePath
 * @param {string} [authToken] - Optional Firebase Auth ID token
 */
export async function deleteAudioFile(target, authToken) {
  if (!target) return { success: true }

  const publicId = typeof target === 'string' ? target : (target.storagePath || target.r2Key || '')

  if (!publicId) {
    console.warn('deleteAudioFile: No public_id to delete')
    return { success: true }
  }

  // 1. Direct Cloudinary Destroy API (tries 'video', 'raw', 'image' resource types)
  if (CLOUD_NAME && API_KEY && API_SECRET) {
    const resourceTypes = ['video', 'raw', 'image']
    for (const resourceType of resourceTypes) {
      try {
        const timestamp = Math.floor(Date.now() / 1000)
        const toSign = `public_id=${publicId}&timestamp=${timestamp}${API_SECRET}`
        const signature = await sha1Hex(toSign)

        const formData = new URLSearchParams()
        formData.append('public_id', publicId)
        formData.append('api_key', API_KEY)
        formData.append('timestamp', timestamp.toString())
        formData.append('signature', signature)

        const destroyUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/destroy`
        const res = await fetch(destroyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
        })
        const data = await res.json()
        if (data.result === 'ok') {
          console.log(`Cloudinary asset "${publicId}" deleted successfully (${resourceType})`)
          return { success: true }
        }
      } catch (err) {
        console.warn(`Direct Cloudinary destroy attempt (${resourceType}) failed:`, err)
      }
    }
  }

  // 2. Fallback to Cloudflare Worker Proxy Endpoint
  if (WORKER_URL) {
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`
      }

      const res = await fetch(`${WORKER_URL}/api/cloudinary-delete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          public_id: publicId,
          resource_type: 'video',
        }),
      })

      const data = await res.json()
      if (data.success) {
        console.log(`Cloudinary asset ${publicId} deleted via Worker`)
        return { success: true }
      }
    } catch (err) {
      console.warn('deleteAudioFile Worker request failed:', err)
    }
  }

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

