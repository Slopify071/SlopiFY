import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from "@cloudflare/vite-plugin"
import fs from 'node:fs'

// Read wrangler.jsonc vars if available
let wranglerVars = {}
try {
  const wranglerRaw = fs.readFileSync('./wrangler.jsonc', 'utf8')
  // Strip comments from jsonc
  const cleaned = wranglerRaw.replace(/\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
  const parsed = JSON.parse(cleaned)
  if (parsed.vars) {
    wranglerVars = parsed.vars
  }
} catch (e) {
  console.warn('Could not parse wrangler.jsonc vars:', e)
}

export default defineConfig({
  plugins: [react(), cloudflare()],
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
  },
  server: {
    port: 5173,
    strictPort: true,
    open: true,
  },
})