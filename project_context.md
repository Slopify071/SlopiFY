# SlopiFY — Project Context & Architectural Specification

## Project Overview
**SlopiFY** is a private, lightweight music streaming web application designed for a small group of friends (5-15 people). It features a shared communal music library where any user can upload audio files, combined with private, shareable, and collaborative playlists. The platform is engineered to run **100% free forever** utilizing a self-hosted **1TB MinIO S3 storage backend** on a dedicated laptop, connected seamlessly to the world via **Cloudflare Tunnel** and **Firebase Firestore** real-time sync.

---

## Technology Stack

| Layer | Technology | Service / Tier |
|---|---|---|
| **Frontend** | React 18 + Vite | Static SPA (Vercel / Cloudflare Pages) |
| **Authentication** | Firebase Authentication | Free Spark Plan (Google Sign-In + Email/Pass) |
| **Database** | Firebase Firestore | Free Spark Plan (1GB DB storage, real-time sync) |
| **Audio File Storage** | MinIO S3 (Self-Hosted) | 1TB HDD Laptop Backend ($0 cost, unlimited storage & bandwidth) |
| **Network Gateway** | Cloudflare Quick Tunnel (`cloudflared`) | Free HTTPS public tunnel (No domain / credit card needed) |
| **Storage Auto-Sync** | SlopiFY Tunnel Daemon (Python) | Auto-publishes dynamic tunnel URL to Firestore `storage_meta/global` |
| **Styling** | Vanilla CSS3 | Custom Design System (Clean, Modern Light Theme) |
| **ID3 Tag Parser** | `music-metadata` / Browser | Client-side metadata extraction |

---

## Key Features & Requirements

### 1. Authentication & User Management
- **Google Sign-In & Email/Password**: Fast, secure authentication powered by Firebase Auth.
- **User Profile**: Automatic creation of user documents in Firestore (`users` collection) storing display name, email, and avatar.

### 2. Communal Music Library & 1TB Storage
- **Shared 1TB Storage Pool**: Audio files uploaded by any friend are stored directly in the self-hosted 1TB MinIO backend.
- **Dynamic Endpoint Resolution**: All clients subscribe in realtime to Firestore `storage_meta/global`. Whenever the tunnel URL changes upon reboot, all audio stream links resolve automatically to the new live tunnel URL without breaking past links.
- **Audio Formats**: MP3, M4A, WAV, OGG, FLAC.
- **Auto ID3 Metadata Extraction**: Drag-and-drop or select an MP3 file -> client-side auto-parser extracts Title, Artist, Album, and embedded Cover Art.
- **Direct HTTP PUT Uploads**: High-speed binary upload with live progress reporting (0%–100%) via `XMLHttpRequest`.
- **Live Storage Indicator**: A global **1TB Storage Progress Bar** with live status (`🟢 Online` / `🟡 Connecting...`) on the Upload page.

### 3. Playlists & Sharing System
- **Private by Default**: Playlists are owned by the creator and hidden from other users by default.
- **Shareable Links**: Owners can generate unique, shareable URL links (e.g. `/playlist/VIBE4299`).
- **Access Modes**:
  - **View Only**: Receivers of the link can listen to the playlist but cannot edit it.
  - **Collaborative**: Owners can toggle collaborative mode, allowing invited friends to add or remove songs.
- **Hold & Drag Reordering**: Touch and click press-and-hold interaction to reorder tracks cleanly on desktop and mobile.

### 4. Audio Player & FIFO Queue
- **Full Player Controls**: Play, pause, skip forward/backward, seek bar with buffered ranges, volume control, shuffle, and repeat modes.
- **HTTP Range Streaming**: MinIO native HTTP 206 Partial Content support enables instant scrubbing and seeking across tracks.
- **FIFO Queue**: Strict First-In, First-Out queue structure (`push` to enqueue next tracks, `shift`/`pop` as tracks complete into playback history).
- **Cross-Device Session Sync**: Active playback state (current song, seek progress offset in seconds, queue list, volume) is synced in real-time to Firestore under `users/{userId}/session/current`.
- **OS Media Session Integration**: Supports native Android/iOS media controls (lock screen play/pause/skip and album art notification).

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
│       ├── storagePath: string (e.g. "songs/178689_track.mp3")
│       ├── audioUrl: string
│       ├── coverUrl: string
│       ├── uploaderUid: string
│       ├── uploaderName: string
│       ├── uploadedAt: timestamp
│       └── plays: number
│
├── playlists/
│   └── {playlistId}/
│       ├── name: string
│       ├── description: string
│       ├── coverImageUrl: string
│       ├── ownerId: string
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
        ├── endpointUrl: string (e.g. "https://xxxx.trycloudflare.com")
        ├── online: boolean
        ├── totalBytesUsed: number
        ├── songCount: number
        └── lastUpdated: timestamp
```

---

## Storage & Tunnel Architecture

1. **MinIO Server**: Runs on Linux Mint laptop (`:9000` S3 API, `:9001` Web Console) storing data on local 1TB HDD (`/home/sev/slopify-storage`).
2. **Cloudflare Quick Tunnel**: `cloudflared tunnel --url http://localhost:9000` provides free, zero-config global HTTPS routing.
3. **Tunnel Sync Daemon**: `slopify-tunnel-daemon.py` captures the generated HTTPS URL and updates Firestore `storage_meta/global` with authenticated REST calls.
4. **Client-Side Resolution**: SlopiFY dynamically prefixes `storagePath` with the live `endpointUrl`, ensuring zero broken links across reboots and network reconnects.

