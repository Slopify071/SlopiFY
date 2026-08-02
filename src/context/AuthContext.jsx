import { createContext, useContext, useState, useEffect } from 'react'
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { auth, googleProvider, isFirebaseConfigured } from '../config/firebase'
import { syncUser } from '../services/firestore'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  // Listen to Firebase Auth state changes
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      // Check localStorage for demo login state
      const demoUser = localStorage.getItem('slopify_demo_user')
      if (demoUser) {
        try {
          setUser(JSON.parse(demoUser))
        } catch {
          setUser(null)
        }
      }
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser)
        await syncUser(currentUser)
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // 1. Google Sign-In
  const loginWithGoogle = async () => {
    setAuthError(null)
    if (!isFirebaseConfigured || !auth) {
      // Graceful demo login
      const mockUser = {
        uid: 'demo-user-123',
        displayName: 'Homie (Demo)',
        email: 'homie@slopify.demo',
        photoURL: null,
        isDemo: true,
      }
      localStorage.setItem('slopify_demo_user', JSON.stringify(mockUser))
      setUser(mockUser)
      return mockUser
    }

    try {
      const result = await signInWithPopup(auth, googleProvider)
      await syncUser(result.user)
      return result.user
    } catch (err) {
      console.error('Google Sign-In failed:', err)
      let message = 'Failed to sign in with Google.'
      if (err.code === 'auth/popup-closed-by-user') {
        message = 'Sign-in popup was closed before completing.'
      } else if (err.code === 'auth/cancelled-popup-request') {
        message = 'Sign-in request was cancelled.'
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
    if (!isFirebaseConfigured || !auth) {
      // Graceful demo signup
      const mockUser = {
        uid: `demo-user-${Date.now()}`,
        displayName: displayName || email.split('@')[0],
        email,
        photoURL: null,
        isDemo: true,
      }
      localStorage.setItem('slopify_demo_user', JSON.stringify(mockUser))
      setUser(mockUser)
      return mockUser
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
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
    if (!isFirebaseConfigured || !auth) {
      // Graceful demo login
      const mockUser = {
        uid: 'demo-user-123',
        displayName: email.split('@')[0] || 'Demo Homie',
        email,
        photoURL: null,
        isDemo: true,
      }
      localStorage.setItem('slopify_demo_user', JSON.stringify(mockUser))
      setUser(mockUser)
      return mockUser
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
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
    localStorage.removeItem('slopify_demo_user')
    if (isFirebaseConfigured && auth) {
      try {
        await firebaseSignOut(auth)
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
