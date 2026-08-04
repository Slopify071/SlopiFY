import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { PlayerProvider } from './context/PlayerContext'
import AppShell from './components/Layout/AppShell'
import './App.css'

const Login = lazy(() => import('./pages/Login'))
const Library = lazy(() => import('./pages/Library'))
const Upload = lazy(() => import('./pages/Upload'))
const Playlists = lazy(() => import('./pages/Playlists'))
const PlaylistDetail = lazy(() => import('./pages/PlaylistDetail'))

function PageFallback() {
  return (
    <div className="app-loading-screen">
      <div className="spinner" />
      <p>Loading...</p>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="app-loading-screen">
        <div className="spinner" />
        <p>Loading SlopiFY...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppShell>
                <Suspense fallback={<PageFallback />}>
                  <Routes>
                    <Route path="/" element={<Navigate to="/library" replace />} />
                    <Route path="/library" element={<Library />} />
                    <Route path="/upload" element={<Upload />} />
                    <Route path="/playlists" element={<Playlists />} />
                    <Route path="/playlist/:id" element={<PlaylistDetail />} />
                  </Routes>
                </Suspense>
              </AppShell>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  )
}

function App() {
  return (
    <AuthProvider>
      <PlayerProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </PlayerProvider>
    </AuthProvider>
  )
}

export default App


