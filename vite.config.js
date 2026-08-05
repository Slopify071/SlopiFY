import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from "@cloudflare/vite-plugin"
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
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
  server: {
    port: 5173,
    strictPort: true,
    open: true,
  },
  build: {
    target: 'es2020',
    minify: 'esbuild',
    cssMinify: true,
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Split Firebase into auth vs everything else to reduce initial unused JS
          if (id.includes('node_modules/firebase/auth') || id.includes('node_modules/@firebase/auth')) {
            return 'vendor-firebase-auth'
          }
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
          if (id.includes('node_modules/music-metadata')) {
            return 'vendor-music-metadata'
          }
        },
      },
    },
  },
}))