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

// Lazy singletons — populated on first call to initFirebase() / getDb()
let auth = null
let db = null
let googleProvider = null
let _initPromise = null
let _dbPromise = null
let _app = null

/**
 * Lazily initialise Firebase Auth. The heavy SDK modules are loaded via dynamic
 * import() so they are NOT in the initial JS bundle that blocks first paint.
 *
 * Firestore is deliberately NOT loaded here — see getDb(). The login page needs
 * auth only, and pulling Firestore in alongside it cost ~145 KiB gzip plus a
 * long-lived `Listen` channel on every cold load.
 *
 * Returns { auth, db, googleProvider } or null if Firebase is not configured.
 * Note `db` is null until getDb() has run.
 */
export async function initFirebase() {
  if (!isFirebaseConfigured) return null
  if (auth) return { auth, db, googleProvider }

  if (!_initPromise) {
    _initPromise = (async () => {
      try {
        const [
          { initializeApp, getApps },
          {
            initializeAuth,
            GoogleAuthProvider,
            indexedDBLocalPersistence,
            browserLocalPersistence,
            browserSessionPersistence,
          },
        ] = await Promise.all([import('firebase/app'), import('firebase/auth')])

        _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

        // This is exactly what getAuth() does internally, minus
        // `popupRedirectResolver: browserPopupRedirectResolver`. That resolver
        // eagerly fetches a 93 KiB iframe from firebaseapp.com on every cold
        // load (3.4s into the critical path) purely to support popup/redirect
        // sign-in. AuthContext now passes the resolver explicitly at the three
        // call sites that need it, so the iframe loads on sign-in click instead.
        // The persistence hierarchy is identical to getAuth()'s, so existing
        // sessions survive untouched.
        auth = initializeAuth(_app, {
          persistence: [
            indexedDBLocalPersistence,
            browserLocalPersistence,
            browserSessionPersistence,
          ],
        })

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

/**
 * Lazily initialise Firestore and return the Firestore instance (or null if
 * Firebase is not configured / init failed).
 *
 * Every consumer in services/firestore.js awaits this, which is what keeps the
 * ~145 KiB gzip Firestore SDK off the login critical path — it is fetched the
 * first time the app actually reads or writes a document.
 */
export async function getDb() {
  if (!isFirebaseConfigured) return null
  if (db) return db

  if (!_dbPromise) {
    _dbPromise = (async () => {
      try {
        // Guarantees `auth` and `_app` are populated before we touch Firestore.
        const fb = await initFirebase()
        if (!fb || !_app) return null

        const { getFirestore } = await import('firebase/firestore')
        db = getFirestore(_app)
        return db
      } catch (error) {
        console.error('Failed to initialize Firestore:', error)
        _dbPromise = null
        return null
      }
    })()
  }

  return _dbPromise
}

// Re-export the lazy singletons — after initFirebase() / getDb() resolve, these
// hold live references. Before that they are null (guards like `!db` still work).
export { auth, db, googleProvider }
