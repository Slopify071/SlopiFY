# SlopiFY — Project Handoff Document

## 📌 Executive Summary
**SlopiFY** is a private, lightweight music streaming web application built for a small group of friends (5–15 users). It features a communal music library (shared uploads), private & collaborative playlists, cross-device sync, and a mobile-first design. Engineered to run **100% free forever** utilizing generous free tiers across Cloudflare and Firebase.

---

## 🛠️ Technology Stack
- **Frontend**: React 18 + Vite SPA
- **Styling**: Custom CSS3 Design System with HSL tokens, dark/light theme foundation, and responsive layouts
- **Routing**: React Router v6 (`/library`, `/upload`, `/playlists`, `/playlist/:id`, `/login`)
- **Hosting**: Cloudflare Pages (Free Tier)
- **Backend / Database / Auth**: Firebase Auth (Google Sign-In + Email/Password) & Cloudflare R2 + Workers (Audio file storage, pre-signed upload & range streaming)

---

## 🚀 Recent Accomplishments

### 🔐 1. Firebase Authentication & Firestore Integration (Phase 2 Completed)
- **Auth Provider Context**: Implemented [`src/context/AuthContext.jsx`](file:///c:/Users/shrey/OneDrive/Desktop/SlopiFY/src/context/AuthContext.jsx) supporting Google Auth (`signInWithPopup`), Email/Password authentication (Sign Up + Sign In with display name), and persistent session listeners via `onAuthStateChanged`.
- **User Auto-Syncing**: On sign-in, automatically creates or updates user profile records in Firestore collection `users/{uid}` with timestamping via [`src/services/firestore.js`](file:///c:/Users/shrey/OneDrive/Desktop/SlopiFY/src/services/firestore.js).
- **Tabbed Login UI**: Refactored [`src/pages/Login.jsx`](file:///c:/Users/shrey/OneDrive/Desktop/SlopiFY/src/pages/Login.jsx) with Sign In vs Create Account tabs, error alert messaging, Google Auth button, and a Graceful Demo Mode badge when Firebase credentials are not yet set.
- **Sidebar & Mobile User Profile**: Updated [`Sidebar.jsx`](file:///c:/Users/shrey/OneDrive/Desktop/SlopiFY/src/components/Layout/Sidebar.jsx) and [`MobileNav.jsx`](file:///c:/Users/shrey/OneDrive/Desktop/SlopiFY/src/components/Layout/MobileNav.jsx) with user profile avatar/initials display and Sign Out actions.

### 📱 2. Mobile Layout & Alignment Polish (Phase 1)
- **AppShell Flex Layout**: Converted `.app-shell` to flex direction column on mobile (`<= 768px`) with `min-height: 100dvh` and smooth touch scrolling.
- **Fixed Bottom Player & Mobile Navigation**: Pinned player bar directly above `MobileNav` with iOS safe area inset support.
- **Library Song Row Inline Alignment**: 4-column grid layout for track row items (Cover, Info, Duration, Actions) in single row alignment on mobile.

---

## 📂 Repository Structure & Key Components

```
SlopiFY/
├── index.html                   # Main HTML template (viewport-fit=cover & SEO meta)
├── .env.example                 # Template environment configuration file
├── handoff.md                   # Project handoff document
├── package.json                 # Dependencies & build scripts
├── vite.config.js               # Vite build configuration
└── src/
    ├── main.jsx                 # Application entry point
    ├── App.jsx                  # Routes configuration, AuthProvider wrapper & ProtectedRoute guard
    ├── App.css                  # Page headers, search bar, empty states, and loading screen
    ├── index.css                # Design tokens, CSS custom properties, global animations
    ├── config/
    │   └── firebase.js          # Firebase app, auth, db, and googleProvider initialization
    ├── context/
    │   └── AuthContext.jsx      # Auth state provider (Google & Email Auth, logout, user sync)
    ├── services/
    │   └── firestore.js         # Firestore CRUD and real-time subscriber helpers
    ├── components/
    │   └── Layout/
    │       ├── AppShell.jsx / .css     # Main layout container (Sidebar, Main, Player, MobileNav)
    │       ├── Sidebar.jsx / .css      # Desktop collapsible navigation sidebar with User Profile
    │       ├── BottomPlayer.jsx / .css # Sticky/Fixed audio player bar
    │       └── MobileNav.jsx / .css    # Fixed mobile bottom navigation tab bar with Sign Out
    └── pages/
        ├── Library.jsx / .css          # Communal library list, search filter, storage bar
        ├── Upload.jsx / .css           # Audio uploader dropzone & ID3 metadata form
        ├── Playlists.jsx / .css        # Playlist grid view & "Create Playlist" action
        ├── PlaylistDetail.jsx / .css   # Playlist track list & header details
        └── Login.jsx / .css            # Google & Email Auth login page layout with tabs & alerts
```

---

## 📋 Next Recommended Steps

### ☁️ 1. Cloudflare R2 Storage & Workers API (Phase 3)
- Deploy Cloudflare Worker for generating pre-signed upload URLs and serving HTTP `Range` streaming (`GET /api/audio/:r2Key`).
- Wire client-side ID3 parser (`music-metadata-browser`) in `Upload.jsx` to parse Title, Artist, Album, and Cover Art on file drop.

### 🎧 2. Global Audio Player Context & Real-Time Sync (Phase 4)
- Connect `Library.jsx` to Firestore `songs` collection with `onSnapshot` real-time updates.
- Create `PlayerContext` for global playback queue state:
  - HTML5 Audio player instance management.
  - Sync current playback position & queue to Firestore (`users/{userId}/session/current`) for cross-device continuation.
  - Connect OS `navigator.mediaSession` API for native mobile media controls.

### 🎶 3. Playlists & Sharing System (Phase 5)
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
