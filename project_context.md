# SlopiFY — Project Context & Architectural Specification

## Project Overview
**SlopiFY** is a private, lightweight music streaming web application designed for a small group of friends (5-15 people). It features a shared communal music library where any user can upload audio files, combined with private, shareable, and collaborative playlists. The platform is engineered to run **100% free forever** utilizing generous free tiers across Cloudflare and Firebase.

---

## Technology Stack

| Layer | Technology | Service / Tier |
|---|---|---|
| **Frontend** | React 18 + Vite | Static SPA |
| **Hosting** | Cloudflare Pages | Free (Unlimited requests, SSL) |
| **Authentication** | Firebase Authentication | Free Spark Plan (Google Sign-In only) |
| **Database** | Firebase Firestore | Free Spark Plan (1GB DB storage, real-time sync) |
| **Audio File Storage** | Cloudflare R2 | Free Tier (10GB storage, 0$ egress fees) |
| **API Proxy / Storage Handler** | Cloudflare Workers | Free Tier (100K requests/day, pre-signed upload & range streaming) |
| **Styling** | Vanilla CSS3 | Custom Design System (Clean, Light Theme) |
| **ID3 Tag Parser** | `music-metadata-browser` | Client-side metadata extraction |

---

## Key Features & Requirements

### 1. Authentication & User Management
- **Google Sign-In Only**: One-click authentication powered by Firebase Auth. No passwords to manage.
- **User Profile**: Automatic creation of user documents in Firestore (`users` collection) storing display name, email, and avatar.

### 2. Communal Music Library
- **Shared Storage**: A single pool of audio files uploaded by any user. Everyone can search, browse, and play any song in the library.
- **Audio Formats**: MP3, M4A, WAV, OGG, FLAC.
- **Auto ID3 Metadata Extraction**: Drag-and-drop or select an MP3 file -> client-side auto-parser extracts Title, Artist, Album, and embedded Cover Art.
- **Manual Edit Fallback**: Pre-filled metadata form allows users to edit or complete missing details before saving.
- **No Upload Limits per User**: No individual file size caps, but a global **Storage Progress Bar** (0 - 10 GB) is visible to all users on the Library page to self-govern usage.

### 3. Playlists & Sharing System
- **Private by Default**: Playlists are owned by the creator and hidden from other users by default.
- **Shareable Links**: Owners can generate unique, shareable URL links (e.g. `/playlist/VIBE4299`).
- **Access Modes**:
  - **View Only**: Receivers of the link can listen to the playlist but cannot edit it.
  - **Collaborative**: Owners can toggle collaborative mode, allowing invited friends to add or remove songs.
- **Hold & Drag Reordering**: Touch and click press-and-hold interaction to reorder tracks cleanly on desktop and mobile without triggering accidental page scrolls.

### 4. Audio Player & FIFO Queue
- **Full Player Controls**: Play, pause, skip forward/backward, seek bar with buffered ranges, volume control, shuffle, and repeat modes.
- **FIFO Queue**: Strict First-In, First-Out queue structure (`push` to enqueue next tracks, `shift`/`pop` as tracks complete into playback history).
- **Cross-Device Session Sync**: Active playback state (current song, seek progress offset in seconds, queue list, volume) is synced in real-time to Firestore under `users/{userId}/session/current`. Pausing a song on a mobile phone immediately allows resuming from the exact second on a laptop.
- **OS Media Session Integration**: Supports native Android/iOS media controls (lock screen play/pause/skip and album art notification).

### 5. Design Aesthetic
- **Theme**: Light, clean, modern, and minimal (inspired by modern web dashboards and Apple Music). Soft neutral backgrounds (`#FAFAFA`), high-contrast typography (`Inter` & `Outfit` fonts), crisp rounded cards, and smooth micro-animations.
- **Responsive**: Tailored for both desktop monitors and Google Pixel / Android mobile viewports (~412px width).

---

## Data Models (Firestore)

```
collections/
├── users/
│   └── {userId}/
│       ├── displayName: string
│       ├── email: string
│       ├── photoURL: string
│       ├── createdAt: timestamp
│       └── session/ (subcollection)
│           └── current/
│               ├── currentSongId: string
│               ├── progressSeconds: number
│               ├── queueSongIds: string[]
│               ├── isPlaying: boolean
│               └── updatedAt: timestamp
│
├── songs/
│   └── {songId}/
│       ├── title: string
│       ├── artist: string
│       ├── album: string
│       ├── duration: number (seconds)
│       ├── fileSize: number (bytes)
│       ├── r2Key: string
│       ├── coverArtUrl: string
│       ├── uploadedBy: string (userId)
│       ├── uploaderName: string
│       ├── createdAt: timestamp
│       └── plays: number
│
├── playlists/
│   └── {playlistId}/
│       ├── name: string
│       ├── description: string
│       ├── coverImageUrl: string
│       ├── ownerId: string (userId)
│       ├── ownerName: string
│       ├── songIds: string[] (ordered array)
│       ├── shareCode: string (unique 8-char code)
│       ├── isShared: boolean
│       ├── isCollaborative: boolean
│       ├── collaborators: string[] (array of userIds)
│       ├── createdAt: timestamp
│       └── updatedAt: timestamp
│
└── storage_meta/
    └── global/
        ├── totalBytesUsed: number
        └── lastUpdated: timestamp
```

---

## Cloudflare Worker API Specification

Worker handles R2 bucket access securely by validating Firebase JWT Tokens:
1. `POST /api/upload` — Accepts audio file + authorization header. Validates token, uploads to R2, updates R2 index.
2. `GET /api/audio/:r2Key` — Streams audio content with HTTP `Range` request support (essential for seeking).
3. `DELETE /api/audio/:r2Key` — Removes audio file from R2 (uploader only).
4. `GET /api/storage-info` — Queries current bucket size in bytes.
