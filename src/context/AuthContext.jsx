import { createContext, useContext, useState, useEffect } from 'react'
import { isFirebaseConfigured, initFirebase } from '../config/firebase'
import { syncUser } from '../services/firestore'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Try to restore cached user so refreshes are instant (no loading spinner)
function getCachedUser() {
  try {
    const cached = sessionStorage.getItem('slopify_cached_user')
    if (cached) {
      const parsed = JSON.parse(cached)
      if (parsed?.isDemo || parsed?.uid?.startsWith('demo-')) {
        sessionStorage.removeItem('slopify_cached_user')
        localStorage.removeItem('slopify_demo_user')
        return null
      }
      return parsed
    }
  } catch { /* ignore */ }
  // Also clear legacy localStorage demo user if present
  try {
    localStorage.removeItem('slopify_demo_user')
  } catch { /* ignore */ }
  return null
}

function cacheUser(u) {
  try {
    if (u) {
      // Only cache serialisable fields (Firebase User objects have methods)
      const slim = {
        uid: u.uid,
        displayName: u.displayName,
        email: u.email,
        photoURL: u.photoURL,
      }
      sessionStorage.setItem('slopify_cached_user', JSON.stringify(slim))
    } else {
      sessionStorage.removeItem('slopify_cached_user')
    }
  } catch { /* ignore */ }
}

export function AuthProvider({ children }) {
  const cachedUser = getCachedUser()
  const [user, setUser] = useState(cachedUser)
  // Always start with loading false so unauthenticated cold start paints instantly on frame 1
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState(null)

  // Listen to Firebase Auth state changes
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setUser(null)
      cacheUser(null)
      try {
        localStorage.removeItem('slopify_demo_user')
        sessionStorage.removeItem('slopify_cached_user')
      } catch { /* ignore */ }
      setLoading(false)
      return
    }

    // Safety fallback timer capped at 300ms for unauthenticated visits so FCP/LCP paints immediately
    const fallbackTimer = setTimeout(() => {
      setLoading(false)
    }, 300)

    let unsubscribe = () => {}

    // Lazily initialise Firebase SDK — this keeps the heavy modules out of the
    // critical rendering path and off the main-thread parse budget.
    initFirebase().then(async (fb) => {
      if (!fb) {
        clearTimeout(fallbackTimer)
        setLoading(false)
        return
      }

      const { onAuthStateChanged, getRedirectResult } = await import('firebase/auth')

      // Only run getRedirectResult if returning from Google Auth redirect
      if (window.location.search.includes('apiKey') || window.location.hash.includes('access_token')) {
        getRedirectResult(fb.auth)
          .then(async (result) => {
            if (result?.user) {
              setUser(result.user)
              cacheUser(result.user)
              await syncUser(result.user)
            }
          })
          .catch((err) => {
            console.error('Redirect sign-in error:', err)
          })
      }

      unsubscribe = onAuthStateChanged(
        fb.auth,
        async (currentUser) => {
          clearTimeout(fallbackTimer)
          try {
            if (currentUser) {
              setUser(currentUser)
              cacheUser(currentUser)
              await syncUser(currentUser)
            } else {
              setUser(null)
              cacheUser(null)
            }
          } catch (err) {
            console.error('Auth state change error:', err)
          } finally {
            setLoading(false)
          }
        },
        (error) => {
          console.error('Firebase Auth state error:', error)
          clearTimeout(fallbackTimer)
          setLoading(false)
        }
      )
    })

    return () => {
      clearTimeout(fallbackTimer)
      unsubscribe()
    }
  }, [])

  // 1. Google Sign-In
  const loginWithGoogle = async () => {
    setAuthError(null)
    if (!isFirebaseConfigured) {
      const message = 'Firebase is not configured. Please set environment variables.'
      setAuthError(message)
      throw new Error(message)
    }

    try {
      const fb = await initFirebase()
      if (!fb) throw new Error('Firebase failed to initialise')

      const { signInWithPopup, signInWithRedirect } = await import('firebase/auth')

      try {
        const result = await signInWithPopup(fb.auth, fb.googleProvider)
        await syncUser(result.user)
        return result.user
      } catch (err) {
        if (err.code === 'auth/popup-blocked') {
          try {
            await signInWithRedirect(fb.auth, fb.googleProvider)
            return
          } catch (redirectErr) {
            console.error('Google Sign-In redirect failed:', redirectErr)
          }
        }
        throw err
      }
    } catch (err) {
      console.error('Google Sign-In failed:', err)
      let message = 'Failed to sign in with Google.'
      if (err.code === 'auth/popup-blocked') {
        message = 'Sign-in popup was blocked by your browser. Please allow popups for this site in your address bar.'
      } else if (err.code === 'auth/popup-closed-by-user') {
        message = 'Sign-in popup was closed before completing.'
      } else if (err.code === 'auth/cancelled-popup-request') {
        message = 'Sign-in request was cancelled.'
      } else if (err.code === 'auth/unauthorized-domain') {
        message = 'This domain is not authorized in Firebase Console. Please add it to Authorized Domains.'
      } else if (err.message) {
        message = err.message
      }
      setAuthError(message)
      throw new Error(message)
    }
  }

  // 2. Email / Password Sign Up
  const signupWithEmail = async (email, password, displayName) => {
    setAuthError(null)
    if (!isFirebaseConfigured) {
      const message = 'Firebase is not configured. Please set environment variables.'
      setAuthError(message)
      throw new Error(message)
    }

    try {
      const fb = await initFirebase()
      if (!fb) throw new Error('Firebase failed to initialise')

      const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth')

      const userCredential = await createUserWithEmailAndPassword(fb.auth, email, password)
      if (displayName) {
        await updateProfile(userCredential.user, { displayName })
      }
      const updatedUser = {
        ...userCredential.user,
        displayName: displayName || userCredential.user.displayName,
      }
      await syncUser(updatedUser)
      return updatedUser
    } catch (err) {
      console.error('Email Signup failed:', err)
      let message = 'Failed to create account.'
      if (err.code === 'auth/email-already-in-use') {
        message = 'This email is already registered. Try logging in.'
      } else if (err.code === 'auth/weak-password') {
        message = 'Password should be at least 6 characters long.'
      } else if (err.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.'
      } else if (err.message) {
        message = err.message
      }
      setAuthError(message)
      throw new Error(message)
    }
  }

  // 3. Email / Password Sign In
  const loginWithEmail = async (email, password) => {
    setAuthError(null)
    if (!isFirebaseConfigured) {
      const message = 'Firebase is not configured. Please set environment variables.'
      setAuthError(message)
      throw new Error(message)
    }

    try {
      const fb = await initFirebase()
      if (!fb) throw new Error('Firebase failed to initialise')

      const { signInWithEmailAndPassword } = await import('firebase/auth')

      const userCredential = await signInWithEmailAndPassword(fb.auth, email, password)
      await syncUser(userCredential.user)
      return userCredential.user
    } catch (err) {
      console.error('Email Login failed:', err)
      let message = 'Failed to sign in.'
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        message = 'Invalid email or password.'
      } else if (err.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.'
      } else if (err.message) {
        message = err.message
      }
      setAuthError(message)
      throw new Error(message)
    }
  }

  // 4. Sign Out
  const logout = async () => {
    setAuthError(null)
    cacheUser(null)
    if (isFirebaseConfigured) {
      try {
        const fb = await initFirebase()
        if (fb) {
          const { signOut } = await import('firebase/auth')
          await signOut(fb.auth)
        }
      } catch (err) {
        console.error('Sign-out failed:', err)
      }
    }
    setUser(null)
  }

  const value = {
    user,
    isAuthenticated: Boolean(user),
    loading,
    authError,
    setAuthError,
    isFirebaseConfigured,
    loginWithGoogle,
    signupWithEmail,
    loginWithEmail,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
