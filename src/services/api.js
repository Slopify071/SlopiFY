/**
 * SlopiFY Worker API & R2 Storage Service Client
 */

const WORKER_BASE_URL = import.meta.env.VITE_CLOUDFLARE_WORKER_URL || 'http://127.0.0.1:8787';

/**
 * Get configured Worker base URL
 */
export function getWorkerUrl() {
  return WORKER_BASE_URL.replace(/\/+$/, '');
}

/**
 * Upload an audio file to Cloudflare R2 via Worker API
 * @param {File} file - Audio file object
 * @param {string} authToken - Firebase Auth ID Token
 * @param {function} [onProgress] - Optional progress callback percentage (0-100)
 */
export async function uploadAudioToWorker(file, authToken, onProgress) {
  const baseUrl = getWorkerUrl();

  // Try real Cloudflare Worker upload first
  try {
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    
    const uploadPromise = new Promise((resolve, reject) => {
      xhr.open('POST', `${baseUrl}/api/upload`);

      if (authToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
      }

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (err) {
            reject(new Error('Invalid JSON response from upload API'));
          }
        } else {
          try {
            const res = JSON.parse(xhr.responseText);
            reject(new Error(res.error || `Upload failed with status ${xhr.status}`));
          } catch (e) {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Network error during file upload'));
      xhr.send(formData);
    });

    return await uploadPromise;
  } catch (err) {
    console.warn('Worker upload failed or offline. Falling back to local ObjectURL mode:', err.message);
    
    // Graceful fallback for local development without active Cloudflare Worker
    if (onProgress) onProgress(100);
    const mockR2Key = `songs/local_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const objectUrl = URL.createObjectURL(file);

    return {
      success: true,
      r2Key: mockR2Key,
      size: file.size,
      contentType: file.type || 'audio/mpeg',
      audioUrl: objectUrl,
      isLocalFallback: true,
    };
  }
}

/**
 * Get streaming audio URL for an R2 key
 * @param {string} r2Key - Storage R2 key
 */
export function getAudioStreamUrl(r2Key) {
  if (!r2Key) return '';
  if (r2Key.startsWith('http://') || r2Key.startsWith('https://') || r2Key.startsWith('blob:')) {
    return r2Key;
  }
  const baseUrl = getWorkerUrl();
  return `${baseUrl}/api/audio/${encodeURIComponent(r2Key)}`;
}

/**
 * Delete an audio file from R2
 * @param {string} r2Key - Storage R2 key
 * @param {string} authToken - Firebase Auth ID Token
 */
export async function deleteAudioFromWorker(r2Key, authToken) {
  if (!r2Key || r2Key.startsWith('blob:')) {
    return { success: true };
  }

  const baseUrl = getWorkerUrl();
  try {
    const res = await fetch(`${baseUrl}/api/audio/${encodeURIComponent(r2Key)}`, {
      method: 'DELETE',
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    });
    return await res.json();
  } catch (err) {
    console.warn('Worker delete operation failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch storage usage statistics
 */
export async function getStorageUsage() {
  const baseUrl = getWorkerUrl();
  try {
    const res = await fetch(`${baseUrl}/api/storage-info`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return {
      success: true,
      totalBytes: 0,
      totalFiles: 0,
      limitBytes: 10737418240, // 10 GB
      mocked: true,
    };
  }
}
