import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('SlopiFY App Error:', error, errorInfo)
  }

  handleReset = () => {
    try {
      sessionStorage.clear()
      localStorage.removeItem('slopify_cached_user')
      localStorage.removeItem('slopify_demo_user')
    } catch { /* ignore */ }
    window.location.href = '/login'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          color: '#ffffff',
          textAlign: 'center',
          background: '#0c0a16',
          fontFamily: 'sans-serif'
        }}>
          <div style={{
            background: 'rgba(20, 26, 40, 0.92)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '24px',
            padding: '40px 32px',
            maxWidth: '460px',
            width: '100%',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)'
          }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '12px', fontWeight: '700' }}>
              Oops! Something went wrong
            </h2>
            <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem', marginBottom: '24px' }}>
              {this.state.error?.message || 'An unexpected error occurred while loading SlopiFY.'}
            </p>
            <button
              onClick={this.handleReset}
              style={{
                background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                color: '#fff',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)'
              }}
            >
              Reset Session & Reload
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
