# SlopiFY — Full Implementation Plan

A private, lightweight music streaming web app for friends, built on React 18 + Vite, Firebase (Auth + Firestore), Cloudflare R2 (audio storage), and Cloudflare Workers (API proxy).

---

## Phase 1: Project Scaffolding & Design System

Set up the Vite + React project and establish the entire visual foundation before building any features.

### [NEW] Vite + React Project
- Initialize with `npx -y create-vite@latest ./ --template react`
- Install core dependencies: `firebase`, `react-router-dom`, `music-metadata-browser`
- Configure `vite.config.js` for SPA routing (historyApiFallback)

### [NEW] Design System — `src/index.css`
- CSS custom properties for the light, clean theme:
  - Backgrounds: `#FAFAFA`, `#FFFFFF`, cards with soft shadows
  - Typography: `Inter` (body) + `Outfit` (headings) from Google Fonts
  - Accent color palette (a subtle purple/blue gradient for interactive elements)
  - Spacing scale, border-radius tokens, transition easings
- Global resets, scrollbar styling, smooth animations keyframes

### [NEW] Layout Components
- `src/components/Layout/AppShell.jsx` — Sidebar + main content + bottom player bar layout
- `src/components/Layout/Sidebar.jsx` — Navigation (Library, Playlists, Upload)
- `src/components/Layout/BottomPlayer.jsx` — Persistent audio player bar (placeholder UI)
- `src/components/Layout/MobileNav.jsx` — Responsive bottom tab nav for mobile

### [NEW] Routing — `src/App.jsx`
- React Router with routes: `/`, `/library`, `/upload`, `/playlist/:id`, `/login`
- Protected route wrapper that redirects unauthenticated users to `/login`

---

## Phase 2: Firebase Integration — Auth & Firestore

### [NEW] Firebase Config — `src/config/firebase.js`
- Initialize Firebase app with project credentials (from env vars via `import.meta.env`)
- Export `auth`, `db` (Firestore), and `googleProvider` instances

### [NEW] Auth Context — `src/context/AuthContext.jsx`
- React context + provider wrapping the app
- `onAuthStateChanged` listener to track login state
- `signInWithPopup(googleProvider)` / `signOut()` methods
- Auto-create user document in `users/{uid}` on first sign-in

### [NEW] Login Page — `src/pages/Login.jsx`
- Clean, centered card with SlopiFY branding and "Sign in with Google" button
- Redirect to `/library` after successful auth

### [NEW] Firestore Helpers — `src/services/firestore.js`
- CRUD helpers for `songs`, `playlists`, `users`, `storage_meta` collections
- Real-time snapshot listeners for library and playlists

---

## Phase 3: Cloudflare Worker API & R2 Storage

> [!IMPORTANT]
> This phase produces a **separate deployable Worker project** in `worker/`. It requires a Cloudflare account with R2 enabled and a Workers free tier. The user will need to provide their Cloudflare Account ID, R2 bucket name, and deploy the worker themselves via `wrangler`.

### [NEW] Worker Project — `worker/`
- `worker/wrangler.toml` — Config binding the R2 bucket
- `worker/src/index.js` — Cloudflare Worker with 4 endpoints:
  1. `POST /api/upload` — Validate Firebase JWT, stream file to R2, return r2Key
  2. `GET /api/audio/:r2Key` — Stream audio with `Range` header support for seeking
  3. `DELETE /api/audio/:r2Key` — Delete file from R2 (uploader-only via JWT claim check)
  4. `GET /api/storage-info` — Return total bytes used in R2 bucket
- CORS headers for the frontend origin
- Firebase JWT verification using JWKS endpoint

---

## Phase 4: Music Upload & Library

### [NEW] Upload Page — `src/pages/Upload.jsx`
- Drag-and-drop zone + file picker (accepts MP3, M4A, WAV, OGG, FLAC)
- Client-side ID3 metadata extraction via `music-metadata-browser`
- Pre-filled editable form: Title, Artist, Album, Cover Art preview
- Upload progress bar (XHR with `onUploadProgress`)
- On success: write song document to Firestore `songs` collection, update `storage_meta/global`

### [NEW] Library Page — `src/pages/Library.jsx`
- Real-time Firestore listener on `songs` collection
- Grid/list view of all songs with cover art, title, artist, duration
- Search bar with client-side filtering
- Global storage progress bar (0–10 GB) at the top
- Click a song → play it / add to queue

### [NEW] Song Card Component — `src/components/Song/SongCard.jsx`
- Displays cover art (fallback gradient), title, artist, duration
- Hover: play button overlay, "Add to Queue" action
- Context menu: Add to Playlist, Delete (if uploader)

---

## Phase 5: Audio Player & FIFO Queue

### [NEW] Player Context — `src/context/PlayerContext.jsx`
- Global state: `currentSong`, `queue[]`, `history[]`, `isPlaying`, `progress`, `volume`, `shuffle`, `repeat`
- FIFO queue methods: `enqueue(song)`, `playNext()`, `playPrevious()`, `clearQueue()`
- HTML5 `<audio>` element ref with event handlers for `timeupdate`, `ended`, `loadedmetadata`
- OS Media Session API integration (`navigator.mediaSession`)

### [MODIFY] `src/components/Layout/BottomPlayer.jsx`
- Wire up to PlayerContext: album art, song info, play/pause, skip, seek bar, volume slider
- Buffered range visualization on seek bar
- Animated "now playing" indicator

### [NEW] Queue Drawer — `src/components/Player/QueueDrawer.jsx`
- Slide-up panel showing current queue and play history
- Drag-to-reorder within queue

---

## Phase 6: Playlists & Sharing

### [NEW] Playlists Page — `src/pages/Playlists.jsx`
- List of user's own playlists
- "Create Playlist" modal (name, description, optional cover)
- Each playlist card shows name, song count, cover

### [NEW] Playlist Detail Page — `src/pages/PlaylistDetail.jsx`
- Header: cover art, name, description, owner info, play all button
- Song list with drag-to-reorder (hold & drag)
- Share button → generate unique share code + copyable link
- Toggle: Collaborative mode on/off
- If collaborative: invited users can add/remove songs

### [NEW] Shared Playlist Access — Route `/playlist/:shareCode`
- Firestore query by `shareCode`
- View-only mode for non-collaborators (listen but can't edit)
- Collaborative mode: add/remove songs if user is in `collaborators[]`

---

## Phase 7: Cross-Device Session Sync

### [MODIFY] `src/context/PlayerContext.jsx`
- On play/pause/seek/queue change: debounced write to `users/{uid}/session/current`
- On app load: read session doc and restore playback state
- Real-time listener on session doc for multi-device sync
- Conflict resolution: latest `updatedAt` wins

---

## Phase 8: Polish, Animations & Responsive

### Final UI Polish
- Micro-animations: page transitions, card hover effects, button ripples
- Skeleton loading states for Library, Playlists
- Toast notifications for actions (upload complete, song added, link copied)
- Empty states with illustrations
- Mobile-optimized: bottom sheet player, swipe gestures, touch-friendly hit targets

### Responsive Audit
- Desktop (1200px+): Sidebar layout
- Tablet (768-1200px): Collapsible sidebar
- Mobile (< 768px): Bottom tab navigation, full-screen player

---

## Open Questions

> [!IMPORTANT]
> **Firebase Credentials**: Do you already have a Firebase project created? If so, please share the Firebase config object (apiKey, authDomain, projectId, etc.) so I can wire it into the app. If not, I'll use placeholder values that you can replace later.

> [!IMPORTANT]
> **Cloudflare Worker**: Do you have a Cloudflare account with R2 enabled? The Worker API (Phase 3) is a separate deployment. I'll scaffold the code, but you'll need to deploy it with `wrangler`. Should I proceed with placeholder config, or do you have credentials ready?

> [!IMPORTANT]
> **Domain / URL**: What will the frontend URL be? This affects CORS configuration in the Worker. I'll default to `localhost:5173` for development.

---

## Verification Plan

### Automated Tests
- `npm run build` — Verify the production build compiles without errors after each phase.
- `npm run dev` — Visual verification in browser after each phase.

### Manual Verification
- After Phase 2: Google Sign-In flow works, user doc created in Firestore.
- After Phase 4: Upload a test MP3, verify metadata extraction and R2 storage.
- After Phase 5: Full playback controls, queue management, media session.
- After Phase 6: Create playlist, share link, collaborative editing.
- After Phase 7: Open on two devices, verify session sync.

---

## Execution Strategy

I will build this **phase by phase**, completing each one fully before moving to the next. After each phase, we'll verify the build is clean and the UI is functional. Phases 1–2 and 4–6 are frontend-only and can proceed immediately. Phase 3 (Cloudflare Worker) will be scaffolded as code but requires your credentials to deploy.
