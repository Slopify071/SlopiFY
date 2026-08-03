# SlopiFY — Full Implementation Plan (Firebase Edition)

A private, lightweight music streaming web app for friends, built on React 18 + Vite, Firebase (Auth + Firestore + Storage). **No Cloudflare R2, no Workers, no credit card needed.**

> [!TIP]
> **Key Architecture Change**: Cloudflare R2 + Workers has been replaced with **Firebase Storage** (free Spark plan). This means:
> - **5 GB free storage** (~1,000+ MP3s) with **no credit card or PayPal required**
> - Audio uploads go directly from the browser to Firebase Storage via the Firebase Web SDK — **no API proxy needed**
> - Permanent HTTPS download URLs with native HTTP `Range` header support for seeking
> - Uses the **same Firebase project** you already have for Auth & Firestore — zero extra accounts

---

## Current State (Already Completed)

| Component | Status | Files |
|---|---|---|
| Vite + React project | ✅ Done | `vite.config.js`, `package.json` |
| Design system (CSS tokens, dark/light) | ✅ Done | `src/index.css` |
| Layout (AppShell, Sidebar, MobileNav, BottomPlayer) | ✅ Done | `src/components/Layout/*` |
| Routing + Protected Routes | ✅ Done | `src/App.jsx` |
| Firebase Auth (Google + Email) | ✅ Done | `src/context/AuthContext.jsx`, `src/config/firebase.js` |
| Login Page (tabbed UI) | ✅ Done | `src/pages/Login.jsx` |
| Firestore helpers (CRUD, real-time) | ✅ Done | `src/services/firestore.js` |
| Upload page (drag-drop, ID3 parsing, form) | ✅ Done | `src/pages/Upload.jsx` |
| Library page (search, demo data) | ✅ Done | `src/pages/Library.jsx` |
| Playlists + PlaylistDetail pages (UI shells) | ✅ Done | `src/pages/Playlists.jsx`, `src/pages/PlaylistDetail.jsx` |
| Theme context (dark/light toggle) | ✅ Done | `src/context/ThemeContext.jsx` |

---

## Phase 1: Project Scaffolding & Design System

> Already completed. No changes needed.

---

## Phase 2: Firebase Integration — Auth & Firestore

> Already completed. No changes needed.

---

## Phase 3: Firebase Storage — Audio File Uploads

> ✅ **Completed**. Audio file uploads now use Firebase Storage SDK via `src/services/storage.js` with direct upload progress, permanent HTTPS download URLs, delete operations, and real-time global storage metrics.


> [!IMPORTANT]
> This replaces the old Cloudflare R2 + Workers phase entirely. No separate project, no Worker deployment, no payment method. Everything runs through your existing Firebase project.

### [MODIFY] [firebase.js](file:///c:/Users/ishaa/OneDrive/Desktop/SlopiFY/src/config/firebase.js)
- Import and initialize `getStorage` from `firebase/storage`
- Export `storage` instance alongside existing `auth`, `db`, `googleProvider`
- Ensure `VITE_FIREBASE_STORAGE_BUCKET` is set in `.env.local` (already in config object)

### [NEW] [storage.js](file:///c:/Users/ishaa/OneDrive/Desktop/SlopiFY/src/services/storage.js)
Replace the entire Cloudflare Worker API client (`api.js`) with a Firebase Storage service:
- `uploadAudioFile(file, authToken, onProgress)`:
  - Uses `uploadBytesResumable()` from Firebase Storage SDK
  - Stores files at path `songs/{uid}_{timestamp}_{filename}`
  - Real-time upload progress via `onProgress` callback (0–100%)
  - On complete: calls `getDownloadURL()` to get a permanent HTTPS streaming URL
  - Returns `{ downloadUrl, storagePath, fileSize, contentType }`
- `deleteAudioFile(storagePath)`:
  - Uses `deleteObject()` to remove file from Firebase Storage
- `getAudioStreamUrl(song)`:
  - Returns the `downloadUrl` stored in the Firestore song document
  - Firebase Storage URLs natively support HTTP `Range` requests for seeking

### [DELETE] [api.js](file:///c:/Users/ishaa/OneDrive/Desktop/SlopiFY/src/services/api.js)
- Remove the entire Cloudflare Worker API client — no longer needed

### [MODIFY] [Upload.jsx](file:///c:/Users/ishaa/OneDrive/Desktop/SlopiFY/src/pages/Upload.jsx)
- Replace `uploadAudioToWorker` import with `uploadAudioFile` from `storage.js`
- Upload progress text: "Uploading..." (with real percentage from `uploadBytesResumable`)
- On success: write song document to Firestore with permanent `downloadUrl` as `audioUrl`
- Storage bar: read from Firestore `storage_meta/global` (already wired)

### [MODIFY] [firestore.js](file:///c:/Users/ishaa/OneDrive/Desktop/SlopiFY/src/services/firestore.js)
- Update `addSongToFirestore` to accept `storagePath` (Firebase Storage path) instead of `r2Key`
- Add `deleteSongFromFirestore(songId, fileSize)`: delete doc + decrement `storage_meta/global`

### Firebase Storage Security Rules
- Configure rules in the Firebase Console to allow authenticated users to upload/read audio files:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /songs/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.resource.size < 50 * 1024 * 1024
                   && request.resource.contentType.matches('audio/.*');
    }
  }
}
```

---

## Phase 4: Music Upload & Library (Wire to Live Data)

> ✅ **Completed**. `Library.jsx` is wired to real-time Firestore `subscribeToLibrary`, with animated skeleton loading states, empty states, instant live search filtering, and song deletion via `SongCard.jsx`.


### [MODIFY] [Library.jsx](file:///c:/Users/ishaa/OneDrive/Desktop/SlopiFY/src/pages/Library.jsx)
- Replace the hardcoded `songs` array with real-time Firestore `onSnapshot` listener on `songs` collection (using existing `subscribeToLibrary`)
- Show skeleton loading state while data loads
- Clicking a song → dispatch to PlayerContext (built in Phase 5)
- Delete song action (for uploader only): remove Firestore doc + Firebase Storage file + decrement `storage_meta`
- Search filters live Firestore data

### [NEW] [SongCard.jsx](file:///c:/Users/ishaa/OneDrive/Desktop/SlopiFY/src/components/Song/SongCard.jsx)
- Reusable song card component: cover art (with fallback gradient), title, artist, duration
- Hover: play button overlay, "Add to Queue" action
- Context menu: Add to Playlist, Delete (if uploader)

---

## Phase 5: Audio Player & FIFO Queue

> ✅ **Completed**. Full audio playback engine via `PlayerContext.jsx` with HTML5 Audio, seek, volume, shuffle, repeat (off/all/one), FIFO queue, play history, Media Session API, and all BottomPlayer controls wired.


### [NEW] [PlayerContext.jsx](file:///c:/Users/ishaa/OneDrive/Desktop/SlopiFY/src/context/PlayerContext.jsx)
- Global state: `currentSong`, `queue[]`, `history[]`, `isPlaying`, `progress`, `volume`, `shuffle`, `repeat`
- FIFO queue methods: `enqueue(song)`, `playNext()`, `playPrevious()`, `clearQueue()`
- HTML5 `<audio>` element ref with event handlers for `timeupdate`, `ended`, `loadedmetadata`
- Audio source URL: reads `song.audioUrl` (permanent Firebase Storage download URL — works across sessions, devices, and refreshes)
- OS Media Session API integration (`navigator.mediaSession`) for lock screen controls

### [MODIFY] [BottomPlayer.jsx](file:///c:/Users/ishaa/OneDrive/Desktop/SlopiFY/src/components/Layout/BottomPlayer.jsx)
- Wire to PlayerContext: album art, song info, play/pause, skip, seek bar, volume slider
- Buffered range visualization on seek bar
- Animated "now playing" indicator

### [NEW] [QueueDrawer.jsx](file:///c:/Users/ishaa/OneDrive/Desktop/SlopiFY/src/components/Player/QueueDrawer.jsx)
- Slide-up panel showing current queue and play history
- Drag-to-reorder within queue
- "Clear Queue" action

---

## Phase 6: Playlists & Sharing

### [MODIFY] [Playlists.jsx](file:///c:/Users/ishaa/OneDrive/Desktop/SlopiFY/src/pages/Playlists.jsx)
- Real-time Firestore listener on `playlists` collection (filtered by `ownerId`)
- "Create Playlist" modal: name, description, optional cover
- Each playlist card: name, song count, cover image
- Delete playlist action

### [MODIFY] [PlaylistDetail.jsx](file:///c:/Users/ishaa/OneDrive/Desktop/SlopiFY/src/pages/PlaylistDetail.jsx)
- Header: cover art, name, description, owner info, "Play All" button
- Song list with drag-to-reorder (hold & drag)
- Add songs from library to playlist
- Remove songs from playlist
- Share button → generate unique 8-char `shareCode` + copyable link
- Toggle: Collaborative mode on/off

### [NEW] Shared Playlist Access — Route `/playlist/:shareCode`
- Firestore query by `shareCode`
- View-only mode for non-collaborators (listen but can't edit)
- Collaborative mode: add/remove songs if user is in `collaborators[]`

### [MODIFY] [firestore.js](file:///c:/Users/ishaa/OneDrive/Desktop/SlopiFY/src/services/firestore.js)
- Add playlist CRUD: `createPlaylist()`, `updatePlaylist()`, `deletePlaylist()`
- Add `getPlaylistByShareCode()` helper
- Add `addSongToPlaylist()`, `removeSongFromPlaylist()`, `reorderPlaylistSongs()`

---

## Phase 7: Cross-Device Session Sync

### [MODIFY] [PlayerContext.jsx](file:///c:/Users/ishaa/OneDrive/Desktop/SlopiFY/src/context/PlayerContext.jsx)
- On play/pause/seek/queue change: debounced write to `users/{uid}/session/current`
- On app load: read session doc and restore playback state
- Real-time listener on session doc for multi-device sync
- Conflict resolution: latest `updatedAt` wins
- Full cross-device audio resume works immediately (Firebase Storage URLs are permanent)

---

## Phase 8: Polish, Animations & Responsive

### Final UI Polish
- Micro-animations: page transitions, card hover effects, button ripples
- Skeleton loading states for Library, Playlists
- Toast notification system for actions (upload complete, song added, link copied)
- Empty states with illustrations
- Mobile-optimized: bottom sheet player, swipe gestures, touch-friendly hit targets

### Responsive Audit
- Desktop (1200px+): Sidebar layout
- Tablet (768–1200px): Collapsible sidebar
- Mobile (< 768px): Bottom tab navigation, full-screen player

---

## Updated Data Model

```
songs/{songId}/
  ├── title: string
  ├── artist: string
  ├── album: string
  ├── duration: number (seconds)
  ├── fileSize: number (bytes)
  ├── storagePath: string          ← Firebase Storage path (e.g. "songs/uid_123_track.mp3")
  ├── audioUrl: string             ← Permanent Firebase download URL
  ├── coverUrl: string
  ├── uploaderUid: string
  ├── uploaderName: string
  ├── uploadedAt: timestamp
  └── plays: number
```

---

## Updated Technology Stack

| Layer | Technology | Free Tier |
|---|---|---|
| Frontend | React 18 + Vite | Static SPA |
| Authentication | Firebase Auth | Spark Plan (free, no card) |
| Database | Firebase Firestore | Spark Plan (1 GB storage, free) |
| **Audio Storage** | **Firebase Storage** | **Spark Plan (5 GB, 1 GB/day download, free, no card)** |
| Styling | Vanilla CSS3 | Custom Design System |
| ID3 Parser | `music-metadata` | Client-side |

---

## Verification Plan

### Automated Tests
- `npm run build` — Verify production build compiles without errors after each phase
- `npm run dev` — Visual verification in browser after each phase

### Manual Verification
- After Phase 3: Upload an MP3, verify it appears in Firebase Storage console, permanent URL works
- After Phase 4: Library shows real Firestore data, search filters live data, delete removes both Firestore doc and Storage file
- After Phase 5: Full playback controls, queue management, media session, seek with Range headers
- After Phase 6: Create playlist, share link, collaborative editing
- After Phase 7: Open on two devices, verify session sync with full audio resume
- After Phase 8: Visual polish audit on desktop + mobile

---

## Execution Strategy

I will build this **phase by phase**, completing each one fully before moving to the next. After each phase, we'll verify the build is clean and the UI is functional.
