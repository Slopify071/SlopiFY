# SlopiFY 🎵

> **Private, high-performance communal music streaming web app for friends.**  
> 100% free forever with self-hosted **1TB MinIO S3 storage**, **Cloudflare Tunnels**, and **Firebase Firestore** real-time sync.

[![Live App](https://img.shields.io/badge/Live-slopify--nu.vercel.app-7928CA?style=flat&logo=vercel)](https://slopify-nu.vercel.app)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat&logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=flat&logo=vite)](https://vitejs.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%26%20Firestore-FFCA28?style=flat&logo=firebase)](https://firebase.google.com/)
[![MinIO](https://img.shields.io/badge/Storage-1TB%20MinIO%20S3-C72C48?style=flat&logo=minio)](https://min.io/)

---

## 🌟 Key Features

### 🎧 High-Fidelity Audio Player & Engine
- **HTTP 206 Range Streaming**: MinIO native partial content streaming enables zero-delay seeking and instant scrubbing across large audio files.
- **Gapless Next-Track Preloader**: When the current song reaches 82% (or $\le 18\text{s}$ remaining), the audio engine silently pre-buffers the next queue item for seamless 0ms track transitions.
- **Buffered Range Visualizer**: Real-time seekbar overlay displaying exact audio data buffered ahead (`audio.buffered`).
- **FIFO Playback Queue & Session Sync**: First-In, First-Out queue structure with cross-device playback state synchronization (`users/{userId}/session/current`).
- **OS Media Session Integration**: Native lock-screen controls, play/pause/skip commands, and album art notifications on iOS, Android, macOS, and Windows.

### 💾 Communal 1TB Storage & Dynamic Tunnel
- **Shared 1TB Storage Pool**: Audio files uploaded by any user are stored on a dedicated self-hosted 1TB MinIO S3 backend ($0 cost, unlimited storage & bandwidth).
- **Dynamic Endpoint Resolution**: Subscribes in real-time to Firestore `storage_meta/global`. Whenever the laptop reboots or tunnel URL changes, all audio stream links (`getAudioStreamUrl`) and album art resolve automatically without broken links.
- **Multi-Format Support**: MP3, FLAC, WAV, M4A, and OGG formats.

### ⚡ Client-Side ID3 Metadata Extraction
- **Auto Tag Parsing**: Drag-and-drop audio files $\rightarrow$ browser-side parser automatically extracts Title, Artist, Album, and embedded album cover art.
- **Auto Web Compression**: Embedded album artwork is automatically compressed client-side to $500\times 500\text{px}$ Web JPEG ($\sim 40\text{–}60\text{KB}$) before upload.
- **Direct Binary Uploads**: High-speed binary upload with live progress reporting ($0\%\text{–}100\%$) via `XMLHttpRequest`.

### 📂 Playlists & Sharing
- **Private & Shared Modes**: Playlists are private by default, with shareable unique URL codes (e.g. `/playlist/VIBE4299`).
- **Collaborative Playlists**: Owners can toggle collaborative mode to let invited friends add and remove tracks.
- **Hold & Drag Reordering**: Touch and click press-and-hold interaction to reorder tracks cleanly on desktop and mobile.

### 🚀 Offline PWA & Performance
- **Album Cover Runtime Cache**: Service Worker `CacheFirst` runtime cache stores up to 1,000 album covers locally in `CacheStorage` for 30 days for 0ms instant repeat loads.
- **Optimized Bundle**: Code-split vendor chunks (Firebase Firestore, Auth, Icons, Liquid Glass, Music Metadata), Terser 2-pass compression, and non-blocking Service Worker registration.
- **Zero-Shift Critical CSS**: Inlined login critical styles and pre-rendered semantic fallback for instant FCP and SEO indexing.

---

## 🏗️ Architecture

```
                      ┌─────────────────────────┐
                      │    SlopiFY Frontend     │
                      │  (React 18 + Vite SPA)  │
                      │   Deployed on Vercel    │
                      └────────────┬────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
   ┌──────────────────────┐                  ┌──────────────────────┐
   │  Firebase Platform   │                  │ Cloudflare Tunnel    │
   │  - Auth (Google/Pwd) │                  │ (Public HTTPS Proxy) │
   │  - Firestore DB      │                  └──────────┬───────────┘
   │    (Sync & Metadata) │                             │
   └──────────────────────┘                             ▼
                                             ┌──────────────────────┐
                                             │ Dedicated Storage PC │
                                             │ - MinIO S3 (:9000)   │
                                             │ - 1TB Local HDD      │
                                             │ - Python Auto-Daemon │
                                             └──────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend Framework** | React 18 + Vite 6 | Fast SPA rendering, code-splitting & modular UI |
| **Routing** | React Router v7 | Client-side routing with protected & public routes |
| **Authentication** | Firebase Auth | Google Sign-In & Email/Password authentication |
| **Database** | Firebase Firestore | Real-time database for songs, playlists & session sync |
| **Storage Backend** | MinIO S3 (Self-Hosted) | 1TB HDD storage pool with HTTP Range support |
| **Gateway / Tunnel** | Cloudflare Tunnel (`cloudflared`) | Free, zero-config HTTPS public routing |
| **Storage Sync Daemon** | Python 3 + Systemd | Health checks & auto-publishing tunnel URL to Firestore |
| **Styling** | Vanilla CSS3 + Design Tokens | Blueberry dark theme & liquid glassmorphism |
| **PWA & Offline** | `vite-plugin-pwa` + Workbox | Offline cover art caching & audio stream caching |
| **Metadata Parsing** | `music-metadata` | In-browser ID3/FLAC tag & cover art extraction |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18+ (Node v20+ recommended)
- **npm** or **pnpm**

### 1. Clone the Repository
```bash
git clone https://github.com/Slopify071/SlopiFY.git
cd SlopiFY
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env.local` and add your Firebase credentials:
```bash
cp .env.example .env.local
```

```env
VITE_FIREBASE_API_KEY="your-api-key"
VITE_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-project-id"
VITE_FIREBASE_STORAGE_BUCKET="your-project.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
VITE_FIREBASE_APP_ID="your-app-id"
VITE_FIREBASE_MEASUREMENT_ID="your-measurement-id"
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5. Build for Production
```bash
npm run build
```

---

## 💻 Storage Backend & Tunnel Daemon Setup

To run the self-hosted MinIO 1TB backend on a dedicated machine/laptop:

1. **Install MinIO Server & Cloudflared** on the storage host.
2. Navigate to `laptop-daemon/` and run the installation script:
   ```bash
   cd laptop-daemon
   chmod +x install-daemon.sh
   ./install-daemon.sh
   ```
3. The daemon will run as a systemd service (`slopify-tunnel.service`), monitoring health and auto-updating Firestore `storage_meta/global` with the live tunnel URL.

---

## 🌐 Deployment

Automated continuous deployment is configured via **Vercel**. Every push to the `main` branch automatically triggers a production build and deployment to:
**[https://slopify-nu.vercel.app](https://slopify-nu.vercel.app)**

---

## 📄 License

MIT © 2026 SlopiFY
