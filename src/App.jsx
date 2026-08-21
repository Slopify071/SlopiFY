import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { PlayerProvider } from './context/PlayerContext'
import { UploadProvider } from './context/UploadContext'
import { isAdmin } from './config/admin'
import './App.css'

import Login from './pages/Login'

// AppShell is lazy purely so its stylesheet graph (AppShell + Sidebar + BottomPlayer
// + FullScreenPlayer + MobileNav + QueueSidebar + Toast + ConfirmModal, ~28 KiB raw)
// splits out of index-*.css instead of render-blocking the login page. Vite emits the
// chunk's <link> before resolving its JS, so there is no flash of unstyled shell.
const AppShell = lazy(() => import('./components/Layout/AppShell'))

const Library = lazy(() => import('./pages/Library'))
const Upload = lazy(() => import('./pages/Upload'))
const Playlists = lazy(() => import('./pages/Playlists'))
const PlaylistDetail = lazy(() => import('./pages/PlaylistDetail'))
const Admin = lazy(() => import('./pages/Admin'))

function PageFallback() {
  return null
}

function PublicOnlyRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return null
  }

  if (isAuthenticated) {
    return <Navigate to="/library" replace />
  }

  return children
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

function AdminRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth()

  if (loading) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!isAdmin(user)) {
    return <Navigate to="/library" replace />
  }

  return children
}

function AppRoutes() {
  const { isAuthenticated } = useAuth()

  // Warm the shell and the landing page together as soon as we know the user is
  // signed in. Same module specifiers as the lazy() calls above, so React reuses
  // these in-flight promises and both chunks download in parallel instead of
  // serially (AppShell → Outlet → Library). Returning users hit this on frame 1
  // because AuthProvider seeds `user` from sessionStorage.
  useEffect(() => {
    if (!isAuthenticated) return
    const swallow = () => {} // failures resurface through Suspense on render
    import('./components/Layout/AppShell').catch(swallow)
    import('./pages/Library').catch(swallow)
  }, [isAuthenticated])

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <Login />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/library" replace />} />
          <Route path="library" element={<Library />} />
          <Route path="upload" element={<Upload />} />
          <Route path="playlists" element={<Playlists />} />
          <Route path="playlist/:id" element={<PlaylistDetail />} />
          <Route
            path="admin"
            element={
              <AdminRoute>
                <Admin />
              </AdminRoute>
            }
          />
          <Route path="*" element={<Navigate to="/library" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

function App() {
  return (
    <AuthProvider>
      <PlayerProvider>
        <UploadProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </UploadProvider>
      </PlayerProvider>
    </AuthProvider>
  )
}

export default App
