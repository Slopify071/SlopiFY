# SlopiFY — Project Handoff Document

## 📌 Executive Summary
**SlopiFY** is a private, lightweight music streaming web application built for a small group of friends (5–15 users). It features a communal music library (shared uploads), private & collaborative playlists, cross-device sync, and a mobile-first design. Engineered to run **100% free forever** utilizing generous free tiers across Cloudflare and Firebase.

---

## 🛠️ Technology Stack
- **Frontend**: React 18 + Vite SPA
- **Styling**: Custom CSS3 Design System with HSL tokens, dark/light theme foundation, and responsive layouts
- **Routing**: React Router v6 (`/library`, `/upload`, `/playlists`, `/playlist/:id`, `/login`)
- **Hosting**: Cloudflare Pages (Free Tier)
- **Backend / Database / Auth**: Firebase Auth (Google Sign-In) & Cloudflare R2 + Workers (Audio file storage, pre-signed upload & range streaming)

---

## 🚀 Recent Accomplishments & Mobile UI Optimizations

### 📱 1. Layout & Mobile Grid Restructuring
- **AppShell Flex Layout**: Converted `.app-shell` to flex direction column on mobile (`<= 768px`) with `min-height: 100dvh` and `-webkit-overflow-scrolling: touch` for smooth touch scrolling.
- **Fixed Bottom Player & Mobile Navigation**:
  - `BottomPlayer` pinned fixed directly above the navigation bar (`bottom: calc(var(--mobile-nav-height) + env(safe-area-inset-bottom, 0px))`).
  - `MobileNav` pinned to the bottom of the viewport with iOS safe-area inset support (`viewport-fit=cover` in `index.html`).
  - Added bottom padding to `.main-content` (`padding-bottom: calc(var(--player-height) + var(--mobile-nav-height))`) so content is never obscured by fixed controls.

### 🎵 2. Library Song Row Inline Alignment Fix
- **Song Row Grid Template**: Adjusted `.library-song-row` mobile grid columns to `40px 1fr 45px 32px`.
- **Three-Dots Menu Placement**: Resolved alignment issue where the context menu button (`.library-song-more`) wrapped onto a second row under the track name. All 4 elements (Cover, Title & Artist, Duration, Three-Dots) now sit in a single row.

### 🎨 3. Responsive Page Polish
- **Page Headers & Search Bar**: Scaled header typography (`h1` to `24px`, `p` to `14px`) and search inputs on mobile viewports (~412px Pixel / Android).
- **Upload Dropzone & Forms**: Optimized padding, centered dropzone text, and converted upload action buttons to full-width touch targets.
- **Playlist Grid**: Updated card min-height and grid gaps for smaller mobile screens.

---

## 📂 Repository Structure & Key Components

```
SlopiFY/
├── index.html                   # Main HTML template (viewport-fit=cover & SEO meta)
├── project_context.md           # Architecture specification & Firestore data schema
├── handoff.md                   # Project handoff document
├── package.json                 # Dependencies & build scripts
├── vite.config.js               # Vite build configuration
└── src/
    ├── main.jsx                 # Application entry point
    ├── App.jsx                  # Routes configuration & ProtectedRoute guard
    ├── App.css                  # Page header, search bar, empty state, and mobile helpers
    ├── index.css                # Design tokens, CSS custom properties, global animations
    ├── components/
    │   └── Layout/
    │       ├── AppShell.jsx / .css     # Main layout container (Sidebar, Main, Player, MobileNav)
    │       ├── Sidebar.jsx / .css      # Desktop collapsible navigation sidebar
    │       ├── BottomPlayer.jsx / .css # Sticky/Fixed audio player bar
    │       └── MobileNav.jsx / .css    # Fixed mobile bottom navigation tab bar
    └── pages/
        ├── Library.jsx / .css          # Communal library list, search filter, storage bar
        ├── Upload.jsx / .css           # Audio uploader dropzone & ID3 metadata form
        ├── Playlists.jsx / .css        # Playlist grid view & "Create Playlist" action
        ├── PlaylistDetail.jsx / .css   # Playlist track list & header details
        └── Login.jsx / .css            # Google Auth login page layout
```

---

## 📋 Next Recommended Steps

### 🔐 1. Firebase Authentication Integration (Phase 2)
- Wire up `firebase/auth` with Google Auth Provider (`signInWithPopup`).
- Replace mock auth logic in `App.jsx` with a global `AuthContext`.
- Automatically create/sync user documents in Firestore collection `users/{userId}` upon login.

### ☁️ 2. Cloudflare R2 Storage & Workers API (Phase 3)
- Deploy Cloudflare Worker for generating pre-signed upload URLs and serving HTTP `Range` streaming (`GET /api/audio/:r2Key`).
- Wire client-side ID3 parser (`music-metadata-browser`) in `Upload.jsx` to parse Title, Artist, Album, and Cover Art on file drop.

### 🎧 3. Global Audio Player Context & Real-Time Sync (Phase 4)
- Connect `Library.jsx` to Firestore `songs` collection with `onSnapshot` real-time updates.
- Create `PlayerContext` for global playback queue state:
  - HTML5 Audio player instance management.
  - Sync current playback position & queue to Firestore (`users/{userId}/session/current`) for cross-device continuation.
  - Connect OS `navigator.mediaSession` API for native mobile media controls.

### 🎶 4. Playlists & Sharing System (Phase 5)
- Wire `Playlists.jsx` and `PlaylistDetail.jsx` to Firestore `playlists` collection.
- Implement shareable unique URL codes (`/playlist/:shareCode`).
- Implement drag-and-drop / hold-and-drag reordering for tracks.

---

## ⚙️ Development Commands

```bash
# Development server
npm run dev

# Production build
$env:Path = "C:\Program Files\nodejs;" + $env:Path; npx vite build
```
