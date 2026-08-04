import { initializeApp, getApps } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCLiKERj-DXvqA-XKYOYuqT4BvKeW6q930',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'slopify-a4cda.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'slopify-a4cda',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'slopify-a4cda.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1028073270606',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1028073270606:web:b1259d9e2274d19329021f',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-BCE6S5W6QX',
}

// Check if valid credentials are provided
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== 'your_api_key_here' &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId !== 'your_project_id'
)

let app = null
let auth = null
let db = null
let storage = null
let googleProvider = null

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
    auth = getAuth(app)
    db = getFirestore(app)
    storage = getStorage(app)
    googleProvider = new GoogleAuthProvider()
    googleProvider.setCustomParameters({ prompt: 'select_account' })
  } catch (error) {
    console.error('Failed to initialize Firebase:', error)
  }
}

export { auth, db, googleProvider }

