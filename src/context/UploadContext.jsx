import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './AuthContext'
import { uploadAudioFile, uploadCoverImage, getAudioStreamUrl } from '../services/storage'
import { addSongToFirestore, subscribeToStorageMeta, checkSongExists } from '../services/firestore'

const UploadContext = createContext(null)

export const useUpload = () => {
  const context = useContext(UploadContext)
  if (!context) {
    throw new Error('useUpload must be used within an UploadProvider')
  }
  return context
}

export function UploadProvider({ children }) {
  const { user } = useAuth()
  const userRef = useRef(user)
  useEffect(() => {
    userRef.current = user
  }, [user])

  const [isDragging, setIsDragging] = useState(false)
  const [fileList, setFileList] = useState([])
  const [activeTrackIndex, setActiveTrackIndex] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [batchProgress, setBatchProgress] = useState({
    current: 0,
    total: 0,
    percent: 0,
    stageText: '',
    currentTrackTitle: '',
    currentTrackArtist: '',
    currentCoverUrl: '',
    currentFileSize: 0,
    overallPercent: 0,
  })
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [completedCount, setCompletedCount] = useState(0)
  const [skippedCount, setSkippedCount] = useState(0)
  const [error, setError] = useState(null)
  const [storageMeta, setStorageMeta] = useState({ totalBytesUsed: 0, songCount: 0 })

  // Subscribe to storage meta
  useEffect(() => {
    const unsubscribe = subscribeToStorageMeta((meta) => {
      if (meta) setStorageMeta(meta)
    })
    return () => unsubscribe()
  }, [])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelect(e.dataTransfer.files)
    }
  }, [])

  const handleFilesSelect = useCallback(async (files) => {
    if (!files || files.length === 0) return
    setError(null)
    setUploadSuccess(false)

    const validFiles = Array.from(files).filter((file) =>
      /\.(mp3|m4a|wav|ogg|flac)$/i.test(file.name)
    )

    if (validFiles.length === 0) {
      setError('Please select valid audio files (.mp3, .m4a, .wav, .ogg, .flac).')
      return
    }

    const newItems = validFiles.map((file) => {
      const cleanName = file.name.replace(/\.[^/.]+$/, '')
      return {
        id: Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
        file,
        title: cleanName,
        artist: '',
        album: '',
        lyrics: '',
        duration: 0,
        coverUrl: '',
        pictureBlob: null,
        parsing: true,
        status: 'pending', // 'pending' | 'uploading' | 'saving' | 'completed' | 'skipped' | 'error'
        progress: 0,
      }
    })

    setFileList((prev) => [...prev, ...newItems])

    // Parse ID3 metadata for each selected file in parallel
    newItems.forEach(async (item) => {
      let title = item.title
      let artist = ''
      let album = ''
      let duration = 0
      let coverUrl = ''
      let pictureBlob = null

      try {
        const musicMetadata = await import('music-metadata')
        const parsed = await musicMetadata.parseBlob(item.file)
        if (parsed.common.title) title = parsed.common.title
        if (parsed.common.artist) artist = parsed.common.artist
        if (parsed.common.album) album = parsed.common.album
        if (parsed.format.duration) duration = Math.round(parsed.format.duration)

        if (parsed.common.picture && parsed.common.picture.length > 0) {
          const pic = parsed.common.picture[0]
          pictureBlob = new Blob([pic.data], { type: pic.format })
          coverUrl = URL.createObjectURL(pictureBlob)
        }
      } catch (err) {
        console.warn('ID3 parsing warning for ' + item.file.name, err)
      } finally {
        setFileList((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? { ...it, title, artist, album, duration, coverUrl, pictureBlob, parsing: false }
              : it
          )
        )
      }
    })
  }, [])

  const handleMetadataChange = useCallback((id, field, value) => {
    setFileList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    )
  }, [])

  const removeTrack = useCallback((id) => {
    setFileList((prev) => {
      const updated = prev.filter((item) => item.id !== id)
      setActiveTrackIndex((prevIndex) => {
        if (prevIndex >= updated.length) {
          return Math.max(0, updated.length - 1)
        }
        return prevIndex
      })
      return updated
    })
  }, [])

  const handleUpload = useCallback(async () => {
    if (fileList.length === 0 || uploading) return
    setUploading(true)
    setError(null)
    setUploadSuccess(false)

    let successCount = 0
    let duplicatesCount = 0
    const totalFiles = fileList.length
    const currentFiles = [...fileList]

    for (let i = 0; i < totalFiles; i++) {
      const item = currentFiles[i]
      const overallBasePercent = Math.round((i / totalFiles) * 100)

      setBatchProgress({
        current: i + 1,
        total: totalFiles,
        percent: 0,
        stageText: `Uploading track ${i + 1} of ${totalFiles}: "${item.title || item.file.name}"...`,
        currentTrackTitle: item.title || item.file.name,
        currentTrackArtist: item.artist || 'Unknown Artist',
        currentCoverUrl: item.coverUrl || '',
        currentFileSize: item.file.size || 0,
        overallPercent: overallBasePercent,
      })

      setFileList((prev) =>
        prev.map((it, idx) => (idx === i ? { ...it, status: 'uploading', progress: 0 } : it))
      )

      try {
        // 0. Check if song already exists in Firestore to prevent duplicate uploads
        const exists = await checkSongExists(item.title, item.artist)
        if (exists) {
          duplicatesCount++
          setSkippedCount(duplicatesCount)
          setFileList((prev) =>
            prev.map((it, idx) => (idx === i ? { ...it, status: 'skipped', progress: 100 } : it))
          )
          console.log(`Skipped duplicate track: "${item.title}" by "${item.artist}"`)
          const newOverall = Math.round(((i + 1) / totalFiles) * 100)
          setBatchProgress((prev) => ({
            ...prev,
            percent: 100,
            overallPercent: newOverall,
            stageText: `Skipped duplicate: "${item.title}"`,
          }))
          continue
        }

        // 1. Upload audio file to Storage
        const result = await uploadAudioFile(item.file, userRef.current, (percent) => {
          const weightedOverall = Math.round(((i + percent / 100) / totalFiles) * 100)
          setFileList((prev) =>
            prev.map((it, idx) =>
              idx === i
                ? {
                    ...it,
                    progress: percent,
                    status: percent === 100 ? 'saving' : 'uploading',
                  }
                : it
            )
          )
          setBatchProgress((prev) => ({
            ...prev,
            percent,
            overallPercent: weightedOverall,
            stageText:
              percent === 100
                ? `Saving track details ${i + 1} of ${totalFiles}...`
                : `Uploading track ${i + 1} of ${totalFiles}: "${item.title || item.file.name}" (${percent}%)...`,
          }))
        })

        const audioUrl = getAudioStreamUrl(result)

        // Upload cover art blob if available to get permanent HTTPS URL
        let finalCoverUrl = item.coverUrl || ''
        if (item.pictureBlob) {
          const uploadedCoverUrl = await uploadCoverImage(item.pictureBlob, userRef.current)
          if (uploadedCoverUrl) finalCoverUrl = uploadedCoverUrl
        }

        // 2. Save song record to Firestore
        const currentUser = userRef.current
        await addSongToFirestore({
          title: item.title || 'Untitled',
          artist: item.artist || 'Unknown Artist',
          album: item.album || '',
          lyrics: item.lyrics || '',
          duration: item.duration || 0,
          storagePath: result.storagePath,
          audioUrl: audioUrl,
          coverUrl: finalCoverUrl,
          fileSize: result.fileSize || item.file.size,
          uploaderUid: currentUser?.uid || 'anonymous',
          uploaderName: currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Friend',
        })

        successCount++
        setCompletedCount(successCount)
        setFileList((prev) =>
          prev.map((it, idx) => (idx === i ? { ...it, status: 'completed', progress: 100 } : it))
        )
      } catch (err) {
        console.error(`Upload error for track "${item.title}":`, err)
        setFileList((prev) =>
          prev.map((it, idx) => (idx === i ? { ...it, status: 'error' } : it))
        )
        setError(`Failed uploading "${item.title}". ${err.message || ''}`)
      }
    }

    setUploading(false)
    if (successCount > 0 || duplicatesCount > 0) {
      setCompletedCount(successCount)
      setSkippedCount(duplicatesCount)
      setUploadSuccess(true)
    }
  }, [fileList, uploading])

  const resetForm = useCallback(() => {
    setFileList([])
    setActiveTrackIndex(0)
    setUploadSuccess(false)
    setCompletedCount(0)
    setSkippedCount(0)
    setError(null)
    setUploading(false)
    setBatchProgress({
      current: 0,
      total: 0,
      percent: 0,
      stageText: '',
      currentTrackTitle: '',
      currentTrackArtist: '',
      currentCoverUrl: '',
      currentFileSize: 0,
      overallPercent: 0,
    })
  }, [])

  const value = {
    isDragging,
    setIsDragging,
    fileList,
    setFileList,
    activeTrackIndex,
    setActiveTrackIndex,
    uploading,
    batchProgress,
    uploadSuccess,
    completedCount,
    skippedCount,
    error,
    setError,
    storageMeta,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFilesSelect,
    handleMetadataChange,
    removeTrack,
    handleUpload,
    resetForm,
  }

  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>
}
