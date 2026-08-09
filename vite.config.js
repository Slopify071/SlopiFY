import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from "@cloudflare/vite-plugin"
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'node:fs'

// Read wrangler.jsonc vars if available
let wranglerVars = {}
try {
  const wranglerRaw = fs.readFileSync('./wrangler.jsonc', 'utf8')
  // Strip comments from jsonc while preserving http:// in string literals
  const cleaned = wranglerRaw
    .replace(/("(?:[^"\\]|\\.)*")|\/\/[^\r\n]*/g, (m, g1) => (g1 ? g1 : ''))
    .replace(/\/\*[\s\S]*?\*\//g, '')
  const parsed = JSON.parse(cleaned)
  if (parsed.vars) {
    wranglerVars = parsed.vars
  }
} catch (e) {
  console.warn('Could not parse wrangler.jsonc vars:', e)
}

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    command === 'build' && !process.env.VERCEL && cloudflare(),
    VitePWA({
      registerType: 'autoUpdate',
      // 'script-defer' makes the injected SW registration script non-render-blocking
      // This removes ~510ms of blocking time from FCP/LCP critical path
      injectRegister: 'script-defer',
      devOptions: {
        enabled: false
      },
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
      includeAssets: ['favicon-32x32.png', 'pwa-192x192.png', 'pwa-512x512.png', 'apple-touch-icon.png', 'logo.png'],
      manifest: {
        name: 'SlopiFY',
        short_name: 'SlopiFY',
        description: 'Private music streaming for friends',
        theme_color: '#0c0a16',
        background_color: '#000000',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ].filter(Boolean),
  define: {
    'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(
      process.env.VITE_FIREBASE_API_KEY || wranglerVars.VITE_FIREBASE_API_KEY || 'AIzaSyCLiKERj-DXvqA-XKYOYuqT4BvKeW6q930'
    ),
    'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(
      process.env.VITE_FIREBASE_AUTH_DOMAIN || wranglerVars.VITE_FIREBASE_AUTH_DOMAIN || 'slopify-a4cda.firebaseapp.com'
    ),
    'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(
      process.env.VITE_FIREBASE_PROJECT_ID || wranglerVars.VITE_FIREBASE_PROJECT_ID || 'slopify-a4cda'
    ),
    'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(
      process.env.VITE_FIREBASE_STORAGE_BUCKET || wranglerVars.VITE_FIREBASE_STORAGE_BUCKET || 'slopify-a4cda.firebasestorage.app'
    ),
    'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(
      process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || wranglerVars.VITE_FIREBASE_MESSAGING_SENDER_ID || '1028073270606'
    ),
    'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(
      process.env.VITE_FIREBASE_APP_ID || wranglerVars.VITE_FIREBASE_APP_ID || '1:1028073270606:web:b1259d9e2274d19329021f'
    ),
    'import.meta.env.VITE_FIREBASE_MEASUREMENT_ID': JSON.stringify(
      process.env.VITE_FIREBASE_MEASUREMENT_ID || wranglerVars.VITE_FIREBASE_MEASUREMENT_ID || 'G-BCE6S5W6QX'
    ),
    'import.meta.env.VITE_CLOUDINARY_CLOUD_NAME': JSON.stringify(
      process.env.VITE_CLOUDINARY_CLOUD_NAME || wranglerVars.VITE_CLOUDINARY_CLOUD_NAME || 'o4qz7txk'
    ),
    'import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET': JSON.stringify(
      process.env.VITE_CLOUDINARY_UPLOAD_PRESET || wranglerVars.VITE_CLOUDINARY_UPLOAD_PRESET || 'slopify_preset'
    ),
    'import.meta.env.VITE_CLOUDINARY_API_KEY': JSON.stringify(
      process.env.VITE_CLOUDINARY_API_KEY || wranglerVars.CLOUDINARY_API_KEY || '962243497828134'
    ),
    'import.meta.env.VITE_CLOUDINARY_API_SECRET': JSON.stringify(
      process.env.VITE_CLOUDINARY_API_SECRET || wranglerVars.CLOUDINARY_API_SECRET || 'pRe6feqGtLidjfFy05GLjt5gQxo'
    ),
    'import.meta.env.VITE_CLOUDFLARE_WORKER_URL': JSON.stringify(
      process.env.VITE_CLOUDFLARE_WORKER_URL || wranglerVars.VITE_CLOUDFLARE_WORKER_URL || 'http://127.0.0.1:8787'
    ),
  },
  esbuild: {
    // Drop console/debugger in prod; also mark these as pure so tree-shaking
    // removes calls whose return values are unused
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
    legalComments: 'none',
    treeShaking: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    open: true,
  },
  build: {
    target: 'es2020',
    // terser gives ~15-20% better compression than esbuild on complex vendor code
    // (Firebase vendor chunk saves ~30 KiB). Requires `terser` devDependency.
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.warn', 'console.info', 'console.error', 'console.debug'],
        passes: 2,          // two-pass compression for better reduction
        unsafe_arrows: true,
        unsafe_methods: true,
        module: true,
      },
      mangle: {
        toplevel: true,
      },
      format: {
        comments: false,    // strip all comments
      },
    },
    cssMinify: true,
    cssCodeSplit: true,
    sourcemap: false,
    reportCompressedSize: false, // skip gzip reporting — speeds up build
    chunkSizeWarningLimit: 800,
    // Prevent vendor chunks from being preloaded eagerly.
    // Without this, Vite injects <link rel="modulepreload"> for every chunk
    // in the page, loading ~300 KiB of Firebase/React JS the moment the page
    // opens — even for routes that never use them.
    modulePreload: {
      polyfill: true,
      resolveDependencies: (filename, deps) => {
        // Only preload the initial app chunk; let vendor chunks load on demand
        return deps.filter(dep =>
          !dep.includes('vendor-firebase') &&
          !dep.includes('vendor-music-metadata') &&
          !dep.includes('vendor-liquid-glass') &&
          !dep.includes('vendor-icons')
        )
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Firestore — loaded lazily via dynamic imports in firestore.js
          if (id.includes('node_modules/@firebase/firestore') || id.includes('node_modules/firebase/firestore')) {
            return 'vendor-firebase-firestore'
          }
          // Auth — loaded lazily via dynamic imports in firebase.js / AuthContext
          if (id.includes('node_modules/firebase/auth') || id.includes('node_modules/@firebase/auth')) {
            return 'vendor-firebase-auth'
          }
          // Firebase app core (tiny) + other firebase modules
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'vendor-firebase'
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
            return 'vendor-react'
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons'
          }
          if (id.includes('node_modules/@samasante/liquid-glass')) {
            return 'vendor-liquid-glass'
          }
          // music-metadata is dynamically imported in Upload.jsx — Vite will
          // already code-split it; this just gives it a stable name.
          if (id.includes('node_modules/music-metadata')) {
            return 'vendor-music-metadata'
          }
        },
      },
    },
  },
}))