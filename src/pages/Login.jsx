import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Login.css'

export default function Login() {
  const navigate = useNavigate()
  const {
    user,
    isAuthenticated,
    isFirebaseConfigured,
    loginWithGoogle,
    loginWithEmail,
    signupWithEmail,
    authError,
    setAuthError,
  } = useAuth()

  const [isSignUp, setIsSignUp] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Redirect to library if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/library', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true)
    try {
      await loginWithGoogle()
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEmailAuthSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      setAuthError('Please fill in all required fields.')
      return
    }
    if (isSignUp && !displayName) {
      setAuthError('Please enter your name.')
      return
    }

    setIsSubmitting(true)
    try {
      if (isSignUp) {
        await signupWithEmail(email, password, displayName)
      } else {
        await loginWithEmail(email, password)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleAuthMode = () => {
    setIsSignUp(!isSignUp)
    setAuthError(null)
  }

  return (
    <div className="login-page">
      <div className="login-bg-pattern" />

      <div className="login-card animate-fade-in-scale">
        {!isFirebaseConfigured && (
          <div className="login-demo-badge">
            <span className="demo-dot" /> Graceful Demo Mode (Firebase unconfigured)
          </div>
        )}

        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <defs>
                <linearGradient id="loginLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6C5CE7" />
                  <stop offset="100%" stopColor="#A29BFE" />
                </linearGradient>
              </defs>
              <circle cx="12" cy="12" r="10" stroke="url(#loginLogoGrad)" strokeWidth="2" fill="none" />
              <circle cx="12" cy="12" r="3" fill="url(#loginLogoGrad)" />
              <path d="M12 2C6.48 2 2 6.48 2 12" stroke="url(#loginLogoGrad)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="login-title">SlopiFY</h1>
          <p className="login-subtitle">Private music streaming for friends</p>
        </div>

        {/* Auth Mode Tabs */}
        <div className="login-tabs">
          <button
            type="button"
            className={`login-tab ${!isSignUp ? 'active' : ''}`}
            onClick={() => {
              setIsSignUp(false)
              setAuthError(null)
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`login-tab ${isSignUp ? 'active' : ''}`}
            onClick={() => {
              setIsSignUp(true)
              setAuthError(null)
            }}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {authError && (
          <div className="login-error-alert animate-fade-in">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{authError}</span>
          </div>
        )}

        {/* Email/Password Form */}
        <form className="login-form" onSubmit={handleEmailAuthSubmit}>
          {isSignUp && (
            <div className="input-group">
              <label htmlFor="displayName">Display Name</label>
              <input
                id="displayName"
                type="text"
                placeholder="e.g. Alex"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required={isSignUp}
              />
            </div>
          )}

          <div className="input-group">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              placeholder="homie@slopify.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="login-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? 'Processing...'
              : isSignUp
              ? 'Create Account'
              : 'Sign In'}
          </button>
        </form>

        {/* Or Divider */}
        <div className="login-or-divider">
          <span>OR</span>
        </div>

        {/* Google Sign In */}
        <button
          className="login-google-btn"
          onClick={handleGoogleSignIn}
          disabled={isSubmitting}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          <span>Continue with Google</span>
        </button>

        <p className="login-toggle-prompt">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button type="button" className="login-toggle-btn" onClick={toggleAuthMode}>
            {isSignUp ? 'Sign In' : 'Create one'}
          </button>
        </p>

        <p className="login-footer">
          Private music streaming for friends ✨
        </p>
      </div>
    </div>
  )
}
