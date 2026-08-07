// Firebase configuration — values are compile-time constants from Vite define
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCLiKERj-DXvqA-XKYOYuqT4BvKeW6q930',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'slopify-a4cda.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'slopify-a4cda',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'slopify-a4cda.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1028073270606',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1028073270606:web:b1259d9e2274d19329021f',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-BCE6S5W6QX',
}

// Check if valid credentials are provided (synchronous, no SDK needed)
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== 'your_api_key_here' &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId !== 'your_project_id'
)

// Lazy singletons — populated on first call to initFirebase()
let auth = null
let db = null
let googleProvider = null
let _initPromise = null

/**
 * Lazily initialise Firebase. The heavy SDK modules are loaded via dynamic
 * import() so they are NOT in the initial JS bundle that blocks first paint.
 * Returns { auth, db, googleProvider } or null if Firebase is not configured.
 */
export async function initFirebase() {
  if (!isFirebaseConfigured) return null
  if (auth) return { auth, db, googleProvider }

  if (!_initPromise) {
    _initPromise = (async () => {
      try {
        const [{ initializeApp, getApps }, { getAuth, GoogleAuthProvider }, { getFirestore }] =
          await Promise.all([
            import('firebase/app'),
            import('firebase/auth'),
            import('firebase/firestore'),
          ])

        const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
        auth = getAuth(app)
        db = getFirestore(app)
        googleProvider = new GoogleAuthProvider()
        googleProvider.setCustomParameters({ prompt: 'select_account' })
        return { auth, db, googleProvider }
      } catch (error) {
        console.error('Failed to initialize Firebase:', error)
        _initPromise = null
        return null
      }
    })()
  }

  return _initPromise
}

// Re-export the lazy singletons — after initFirebase() resolves, these hold
// live references. Before that they are null (guards like `!db` still work).
export { auth, db, googleProvider }
